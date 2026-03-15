import {
	useReactTable,
	getCoreRowModel,
	getSortedRowModel,
	getFilteredRowModel,
	flexRender,
	ColumnDef,
	SortingState,
	SortingFnOption,
	RowSelectionState,
} from '@tanstack/react-table'
import {
	DndContext,
	DragEndEvent,
	closestCenter,
	PointerSensor,
	useSensor,
	useSensors,
} from '@dnd-kit/core'
import {
	SortableContext,
	horizontalListSortingStrategy,
	arrayMove,
	useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { TFile, Notice } from 'obsidian'
import React, { Fragment, ReactNode, useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../context'
import { DatabaseManager } from '../database-manager'
import { ColumnSchema, ColumnType, DatabaseConfig, FilterOperator, NoteRow, SortConfig, ViewConfig, AggregationType, DEFAULT_DATABASE_CONFIG, DEFAULT_VIEW } from '../types'
import { evaluateFormulas } from '../formula-engine'
import { ColumnHeader } from './ColumnHeader'
import { CellRenderer, CellContext } from './cells/CellRenderer'
import { FolderPickerModal } from '../folder-picker-modal'
import { t } from '../i18n'

// ── Validação de compatibilidade de tipos ────────────────────────────────────

function validateTypeChange(rows: NoteRow[], columnId: string, fromType: ColumnType, toType: ColumnType): string | null {
	if (fromType === toType) return null
	const skipTypes: ColumnType[] = ['formula', 'lookup', 'relation']
	if (skipTypes.includes(toType) || skipTypes.includes(fromType)) return null

	const values = rows
		.map(r => r[columnId])
		.filter(v => v !== null && v !== undefined && v !== '')

	if (toType === 'number') {
		const bad = values.filter(v => {
			const s = String(v).trim()
			return s !== '' && (isNaN(Number(s)) || !isFinite(Number(s)))
		})
		if (bad.length > 0)
			return `${bad.length} ${t('validate_non_numeric')}${String(bad[0])}"`
	}

	if (toType === 'date') {
		const bad = values.filter(v => {
			const s = String(v).trim()
			return s !== '' && isNaN(new Date(s).getTime())
		})
		if (bad.length > 0)
			return `${bad.length} ${t('validate_invalid_dates')}${String(bad[0])}"`
	}

	if (toType === 'checkbox') {
		const validBool = new Set(['true', 'false', '1', '0', 'yes', 'no', 'sim', 'não', 'nao'])
		const bad = values.filter(v => {
			if (typeof v === 'boolean') return false
			return !validBool.has(String(v).toLowerCase().trim())
		})
		if (bad.length > 0)
			return `${bad.length} ${t('validate_invalid_checkbox')}${String(bad[0])}"`
	}

	if (fromType === 'multiselect' && toType === 'select') {
		const multi = values.filter(v => Array.isArray(v) && (v as unknown[]).length > 1)
		if (multi.length > 0)
			return `${multi.length} ${t('validate_multiselect_to_select')}`
	}

	if (toType === 'email') {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
		const bad = values.filter(v => {
			const s = String(v).trim()
			return s !== '' && !emailRegex.test(s)
		})
		if (bad.length > 0)
			return `${bad.length} ${t('validate_invalid_email')}${String(bad[0])}"`
	}

	if (toType === 'url') {
		const bad = values.filter(v => {
			const s = String(v).trim()
			try { new URL(s); return false } catch { return true }
		})
		if (bad.length > 0)
			return `${bad.length} ${t('validate_invalid_url')}${String(bad[0])}"`
	}

	if (toType === 'phone') {
		const phoneRegex = /^[\d\s()\-+]+$/
		const bad = values.filter(v => {
			const s = String(v).trim()
			return s !== '' && !phoneRegex.test(s)
		})
		if (bad.length > 0)
			return `${bad.length} ${t('validate_invalid_phone')}${String(bad[0])}"`
	}

	return null
}

// ── Helpers estáticos ────────────────────────────────────────────────────────

function getColumnIconStatic(type: string): string {
	const icons: Record<string, string> = {
		title: '📄', text: 'Aa', number: '#', select: '◉',
		multiselect: '◈', date: '📅', checkbox: '☑', formula: 'ƒ', relation: '🔗', lookup: '↗',
	}
	return icons[type] ?? '·'
}

interface ActiveFilter {
	id: string
	columnId: string
	columnName: string
	columnType: string
	icon: string
	operator: FilterOperator
	value: string
	conjunction: 'and' | 'or'
}

const TEXT_OPERATORS: FilterOperator[] = ['contains', 'not_contains', 'starts_with', 'ends_with', 'is', 'is_not', 'is_empty', 'is_not_empty']
const NUMBER_OPERATORS: FilterOperator[] = ['is', 'is_not', 'gt', 'gte', 'lt', 'lte', 'is_empty', 'is_not_empty']
const DATE_OPERATORS: FilterOperator[] = ['is', 'is_not', 'gt', 'gte', 'lt', 'lte', 'is_empty', 'is_not_empty']
const SELECT_OPERATORS: FilterOperator[] = ['is', 'is_not', 'is_empty', 'is_not_empty']
const CHECKBOX_OPERATORS: FilterOperator[] = ['is_checked', 'is_unchecked', 'is_empty', 'is_not_empty']

function getOperatorsForType(type: string): FilterOperator[] {
	switch (type) {
		case 'number': return NUMBER_OPERATORS
		case 'date': return DATE_OPERATORS
		case 'select': return SELECT_OPERATORS
		case 'multiselect': return SELECT_OPERATORS
		case 'checkbox': return CHECKBOX_OPERATORS
		default: return TEXT_OPERATORS
	}
}

function getDefaultOperator(type: string): FilterOperator {
	switch (type) {
		case 'number': case 'date': return 'is'
		case 'checkbox': return 'is_checked'
		case 'select': case 'multiselect': return 'is'
		default: return 'contains'
	}
}

const OPERATOR_LABELS = new Proxy({} as Record<FilterOperator, string>, {
	get: (_, key) => {
		const labels: Record<FilterOperator, string> = {
			is: t('op_is'), is_not: t('op_is_not'), contains: t('op_contains'),
			not_contains: t('op_not_contains'), starts_with: t('op_starts_with'),
			ends_with: t('op_ends_with'), gt: t('op_gt'), gte: t('op_gte'),
			lt: t('op_lt'), lte: t('op_lte'), is_checked: t('op_is_checked'),
			is_unchecked: t('op_is_unchecked'), is_empty: t('op_is_empty'),
			is_not_empty: t('op_is_not_empty'),
		}
		return labels[key as FilterOperator] ?? key
	}
})

const NO_VALUE_OPERATORS = new Set<FilterOperator>(['is_empty', 'is_not_empty', 'is_checked', 'is_unchecked'])

function matchesFilter(row: NoteRow, f: ActiveFilter): boolean {
	const noValue = NO_VALUE_OPERATORS.has(f.operator)
	if (!noValue && f.value === '') return true
	const raw = f.columnId === '_title' ? row._title : row[f.columnId]

	if (f.operator === 'is_empty') return raw === null || raw === undefined || String((raw as string | number | boolean | null | undefined) ?? '').trim() === ''
	if (f.operator === 'is_not_empty') return raw !== null && raw !== undefined && String((raw as string | number | boolean | null | undefined) ?? '').trim() !== ''
	if (f.operator === 'is_checked') return raw === true || raw === 'true'
	if (f.operator === 'is_unchecked') return raw !== true && raw !== 'true'

	if (f.columnType === 'number') {
		const n = parseFloat(String((raw as string | number | boolean | null | undefined) ?? ''))
		const v = parseFloat(f.value)
		if (isNaN(n) || isNaN(v)) return false
		switch (f.operator) {
			case 'is': return n === v
			case 'is_not': return n !== v
			case 'gt': return n > v
			case 'gte': return n >= v
			case 'lt': return n < v
			case 'lte': return n <= v
			default: return true
		}
	}

	if (f.columnType === 'date') {
		const d = new Date(String((raw as string | number | boolean | null | undefined) ?? '')).getTime()
		const v = new Date(f.value).getTime()
		if (isNaN(d) || isNaN(v)) return false
		switch (f.operator) {
			case 'is': return d === v
			case 'is_not': return d !== v
			case 'gt': return d > v
			case 'gte': return d >= v
			case 'lt': return d < v
			case 'lte': return d <= v
			default: return true
		}
	}

	const cell = Array.isArray(raw)
		? (raw as string[]).join(', ').toLowerCase()
		: String((raw as string | number | boolean | null | undefined) ?? '').toLowerCase()
	const v = f.value.toLowerCase()
	switch (f.operator) {
		case 'is': return cell === v
		case 'is_not': return cell !== v
		case 'contains': return cell.includes(v)
		case 'not_contains': return !cell.includes(v)
		case 'starts_with': return cell.startsWith(v)
		case 'ends_with': return cell.endsWith(v)
		default: return true
	}
}

function getColumnSortingFn(type: ColumnType): SortingFnOption<NoteRow> {
	switch (type) {
		case 'number': return 'basic'
		case 'date': return (rowA, rowB, colId) => {
			const a = new Date(String(rowA.getValue(colId) ?? '')).getTime() || 0
			const b = new Date(String(rowB.getValue(colId) ?? '')).getTime() || 0
			return a - b
		}
		case 'checkbox': return (rowA, rowB, colId) => {
			const a = rowA.getValue(colId) ? 1 : 0
			const b = rowB.getValue(colId) ? 1 : 0
			return (a as number) - (b as number)
		}
		default: return 'text'
	}
}

function SortPanel({ sorts, schema, onSortChange, onClose, anchorRect, panelRef }: {
	sorts: SortConfig[]
	schema: ColumnSchema[]
	onSortChange: (sorts: SortConfig[]) => void
	onClose: () => void
	anchorRect: DOMRect
	panelRef: React.RefObject<HTMLDivElement>
}) {
	const [pos, setPos] = useState(() => ({
		x: anchorRect.right - 280,
		y: anchorRect.bottom + 4,
	}))

	const handleDragStart = (e: React.MouseEvent) => {
		e.preventDefault()
		const startX = e.clientX - pos.x
		const startY = e.clientY - pos.y
		const onMove = (ev: MouseEvent) => setPos({ x: ev.clientX - startX, y: ev.clientY - startY })
		const onUp = () => {
			window.removeEventListener('mousemove', onMove)
			window.removeEventListener('mouseup', onUp)
		}
		window.addEventListener('mousemove', onMove)
		window.addEventListener('mouseup', onUp)
	}

	const sortableSchema = schema.filter(c =>
		c.type !== 'formula' && c.type !== 'lookup' && c.type !== 'relation' && c.type !== 'multiselect'
	)
	const usedIds = new Set(sorts.map(s => s.columnId))
	const availableColumns: { id: string; name: string }[] = [
		...(!usedIds.has('_title') ? [{ id: '_title', name: 'Nome' }] : []),
		...sortableSchema.filter(c => !usedIds.has(c.id)).map(c => ({ id: c.id, name: c.name })),
	]

	const move = (idx: number, dir: -1 | 1) => {
		const next = [...sorts]
		const swap = idx + dir
		if (swap < 0 || swap >= next.length) return
		;[next[idx], next[swap]] = [next[swap], next[idx]]
		onSortChange(next)
	}

	const toggleDir = (columnId: string) => {
		onSortChange(sorts.map(s => s.columnId === columnId
			? { ...s, direction: s.direction === 'asc' ? 'desc' : 'asc' }
			: s
		))
	}

	const remove = (columnId: string) => {
		onSortChange(sorts.filter(s => s.columnId !== columnId))
	}

	const add = (columnId: string) => {
		if (!columnId) return
		onSortChange([...sorts, { columnId, direction: 'asc' }])
	}

	return createPortal(
		<div
			ref={panelRef}
			className="nb-sort-panel"
			style={{ position: 'fixed', top: pos.y, left: pos.x }}
		>
			<div className="nb-sort-panel-titlebar" onMouseDown={handleDragStart}>
				<span className="nb-sort-panel-title">{t('sort_by')}</span>
				<button className="nb-sort-panel-close" onClick={onClose} title={t('tooltip_close')}>×</button>
			</div>
			{sorts.length === 0 && (
				<div className="nb-sort-panel-empty">{t('no_active_sorts')}</div>
			)}
			{sorts.map((sort, idx) => {
				const name = sort.columnId === '_title'
					? 'Nome'
					: (schema.find(c => c.id === sort.columnId)?.name ?? sort.columnId)
				return (
					<div key={sort.columnId} className="nb-sort-row">
						<div className="nb-sort-row-priority">
							<button className="nb-sort-priority-btn" onClick={() => move(idx, -1)} disabled={idx === 0} title={t('tooltip_move_up')}>↑</button>
							<button className="nb-sort-priority-btn" onClick={() => move(idx, 1)} disabled={idx === sorts.length - 1} title={t('tooltip_move_down')}>↓</button>
						</div>
						<span className="nb-sort-row-name">{name}</span>
						<button className="nb-sort-dir-btn" onClick={() => toggleDir(sort.columnId)}>
							{sort.direction === 'asc' ? t('sort_asc') : t('sort_desc')}
						</button>
						<button className="nb-sort-remove-btn" onClick={() => remove(sort.columnId)} title={t('tooltip_remove')}>×</button>
					</div>
				)
			})}
			{availableColumns.length > 0 && (
				<div className="nb-sort-add-row">
					<select
						className="nb-sort-add-select"
						value=""
						onChange={e => { add(e.target.value); e.target.value = '' }}
					>
						<option value="">{'+ ' + t('add_sort') + '...'}</option>
						{availableColumns.map(c => (
							<option key={c.id} value={c.id}>{c.name}</option>
						))}
					</select>
				</div>
			)}
		</div>,
		document.body
	)
}

function ResizeHandle({ onResize, onAutoFit }: { onResize: (w: number) => void; onAutoFit?: () => void }) {
	const handleMouseDown = (e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()
		const th = (e.currentTarget as HTMLElement).closest('th') as HTMLElement
		if (!th) return
		const startX = e.clientX
		const startWidth = th.offsetWidth
		let currentWidth = startWidth

		const onMouseMove = (ev: MouseEvent) => {
			currentWidth = Math.max(50, startWidth + (ev.clientX - startX))
			th.style.width = currentWidth + 'px'
		}
		const onMouseUp = () => {
			window.removeEventListener('mousemove', onMouseMove)
			window.removeEventListener('mouseup', onMouseUp)
			onResize(currentWidth)
		}
		window.addEventListener('mousemove', onMouseMove)
		window.addEventListener('mouseup', onMouseUp)
	}

	return (
		<div
			className="nb-col-resizer"
			onMouseDown={handleMouseDown}
			onDoubleClick={e => { e.stopPropagation(); onAutoFit?.() }}
			title={t('tooltip_resize_column')}
		/>
	)
}

function SortableTh({ id, size, children, stickyLeft, isLastPinned, isPinned, onTogglePin, sorted, onToggleSort, onResize, onAutoFit }: {
	id: string
	size: number
	children: ReactNode
	stickyLeft?: number
	isLastPinned?: boolean
	isPinned?: boolean
	onTogglePin?: () => void
	sorted?: false | "asc" | "desc"
	onToggleSort?: () => void
	onResize?: (width: number) => void
	onAutoFit?: () => void
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		setActivatorNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id })

	const isSticky = stickyLeft !== undefined

	return (
		<th
			ref={setNodeRef}
			data-col-id={id}
			className={[
				'nb-th',
				isDragging ? 'nb-th--dragging' : '',
				isSticky ? 'nb-th--sticky' : '',
				isLastPinned ? 'nb-th--sticky-last' : '',
			].filter(Boolean).join(' ')}
			style={{
				width: size,
				transform: CSS.Transform.toString(transform),
				transition,
				zIndex: isDragging ? 10 : isSticky ? 3 : undefined,
				...(isSticky ? { left: stickyLeft } : {}),
			}}
		>
			<div className="nb-th-inner">
				<span
					ref={setActivatorNodeRef}
					{...listeners}
					{...attributes}
					className="nb-col-drag-handle"
					title="Arrastar para reordenar"
				>⠿</span>
				{children}
				{onToggleSort && (
					<button
						className={sorted ? "nb-sort-btn nb-sort-btn--sorted" : "nb-sort-btn"}
						onClick={e => { e.stopPropagation(); onToggleSort() }}
						title={sorted === "asc" ? t('sort_asc_title') : sorted === "desc" ? t('sort_desc_title') : t('sort_none_title')}
					>
						<span className={sorted === "asc" ? "nb-sort-chevron--active" : "nb-sort-chevron"}>⌃</span>
						<span className={sorted === "desc" ? "nb-sort-chevron--active" : "nb-sort-chevron"}>⌄</span>
					</button>
				)}
				<span className="nb-col-drag-spacer" aria-hidden="true" />
				{onTogglePin && (
					<button
						className={`nb-pin-btn${isPinned ? ' nb-pin-btn--active' : ''}`}
						onClick={e => { e.stopPropagation(); onTogglePin() }}
						title={isPinned ? t('tooltip_unpin_column') : t('tooltip_pin_column')}
					>
						📌
					</button>
				)}
			</div>
			{onResize && <ResizeHandle onResize={onResize} onAutoFit={onAutoFit} />}
		</th>
	)
}

function SortablePill({ filter, isActive, onToggle, onRemove, btnRef }: {
	filter: ActiveFilter
	isActive: boolean
	onToggle: () => void
	onRemove: () => void
	btnRef: (el: HTMLButtonElement | null) => void
}) {
	const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: filter.id })

	return (
		<div
			ref={setNodeRef}
			style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
			className="nb-filter-pill-sortable"
		>
			<span
				ref={setActivatorNodeRef}
				{...listeners}
				{...attributes}
				className="nb-pill-drag-handle"
				title="Arrastar para reordenar"
			>
				<svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor">
					<circle cx="2" cy="2.5" r="1.2"/><circle cx="6" cy="2.5" r="1.2"/>
					<circle cx="2" cy="7" r="1.2"/><circle cx="6" cy="7" r="1.2"/>
					<circle cx="2" cy="11.5" r="1.2"/><circle cx="6" cy="11.5" r="1.2"/>
				</svg>
			</span>
			<button
				ref={btnRef}
				className={`nb-filter-pill ${isActive ? 'nb-filter-pill--active' : ''}`}
				onClick={onToggle}
			>
				<span className="nb-filter-pill-icon">{filter.icon}</span>
				<span className="nb-filter-pill-name">{filter.columnName}</span>
				<span
					className="nb-filter-pill-remove"
					onClick={e => { e.stopPropagation(); onRemove() }}
					title={t('tooltip_remove_filter')}
				>×</span>
			</button>
		</div>
	)
}

interface DatabaseTableProps {
	dbFile: TFile | null
	manager: DatabaseManager
	externalView?: ViewConfig
	onViewChange?: (view: ViewConfig) => Promise<void>
}

// ── AggDropdown ──────────────────────────────────────────────────────────────

const NUMERIC_TYPES = ['number', 'formula']

function AggDropdown({ colType, current, onSelect, anchorEl }: {
	colType: string
	current: AggregationType
	onSelect: (t: AggregationType) => void
	anchorEl: HTMLElement | null
}) {
	const rect = anchorEl?.getBoundingClientRect()
	const top = rect ? rect.bottom + window.scrollY : 0
	const left = rect ? rect.left + window.scrollX : 0
	const isNumeric = NUMERIC_TYPES.includes(colType)
	const options: { type: AggregationType; label: string; numericOnly?: boolean }[] = [
		{ type: 'none', label: t('agg_none') },
		{ type: 'count', label: t('agg_count') },
		{ type: 'count_values', label: t('agg_count_values') },
		{ type: 'sum', label: t('agg_sum'), numericOnly: true },
		{ type: 'avg', label: t('agg_avg'), numericOnly: true },
		{ type: 'min', label: t('agg_min'), numericOnly: true },
		{ type: 'max', label: t('agg_max'), numericOnly: true },
	]
	return (
		<div className="nb-agg-dropdown" style={{ position: 'absolute', top, left, zIndex: 9999 }}>
			{options.filter(o => !o.numericOnly || isNumeric).map(o => (
				<button
					key={o.type}
					className={`nb-menu-item ${current === o.type ? 'nb-menu-item--active' : ''}`}
					onClick={() => onSelect(o.type)}
				>
					{o.label}
				</button>
			))}
		</div>
	)
}

export function DatabaseTable({ dbFile, manager, externalView, onViewChange }: DatabaseTableProps) {
	const app = useApp()
	const [config, setConfig] = useState<DatabaseConfig>(DEFAULT_DATABASE_CONFIG)
	const [rows, setRows] = useState<NoteRow[]>([])
	const [sorting, setSorting] = useState<SortingState>([])
	const [sortPanelOpen, setSortPanelOpen] = useState(false)
	const sortPanelRef = useRef<HTMLDivElement>(null)
	const [sortAnchorRect, setSortAnchorRect] = useState<DOMRect | null>(null)
	const sortButtonRef = useRef<HTMLButtonElement>(null)
	const [globalFilter, setGlobalFilter] = useState('')
	const [editingCell, setEditingCell] = useState<{ rowIndex: number; columnId: string } | null>(null)
	const [loading, setLoading] = useState(true)
	const [relationOptions, setRelationOptions] = useState<Map<string, string[]>>(new Map())
	const [fieldsMenuOpen, setFieldsMenuOpen] = useState(false)
	const fieldsMenuRef = useRef<HTMLDivElement>(null)
	const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
	const [actionsMenuOpen, setActionsMenuOpen] = useState(false)
	const [rowHeightMenuOpen, setRowHeightMenuOpen] = useState(false)
	const [openAggCol, setOpenAggCol] = useState<string | null>(null)
	const actionsMenuRef = useRef<HTMLDivElement>(null)
	const rowHeightMenuRef = useRef<HTMLDivElement>(null)
	const csvInputRef = useRef<HTMLInputElement>(null)
	const tableRef = useRef<HTMLTableElement>(null)
	const lastCreatedPath = useRef<string | null>(null)
	const [pinnedColumnId, setPinnedColumnId] = useState<string | null>(null)
	const [filterMenuOpen, setFilterMenuOpen] = useState(false)
	const filterMenuRef = useRef<HTMLDivElement>(null)
	const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([])
	const [openFilterPill, setOpenFilterPill] = useState<string | null>(null)
	const filterPillRefs = useRef<Record<string, HTMLButtonElement | null>>({})
	const pillDropdownRef = useRef<HTMLDivElement | null>(null)
	const [pillDropdownPos, setPillDropdownPos] = useState<{ top: number; left: number } | null>(null)
	const [openOperatorPicker, setOpenOperatorPicker] = useState<string | null>(null)
	const operatorPickerRefs = useRef<Record<string, HTMLDivElement | null>>({})
	const filtersInitialized = useRef(false)
	const [searchExpanded, setSearchExpanded] = useState(false)
	const searchInputRef = useRef<HTMLInputElement>(null)
	const searchInactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
	)

	// Estado local da view do embed — inicializado com externalView e atualizado a cada mudança
	const [localEmbedView, setLocalEmbedView] = useState<ViewConfig | undefined>(externalView)
	useEffect(() => { if (externalView) setLocalEmbedView(externalView) }, [externalView?.id])

	// View ativa: embed usa estado local; database usa config.views[0]
	const activeView: ViewConfig = (externalView ? localEmbedView : undefined) ?? config.views[0] ?? DEFAULT_VIEW

	// Sync sorting state when activeView changes (e.g. embed switching)
	useEffect(() => {
		setSorting(activeView.sorts.map(s => ({ id: s.columnId, desc: s.direction === 'desc' })))
	}, [activeView.id])

	// Schema ordenado: no embed usa columnOrder da view; no database usa a ordem do schema
	const orderedSchema = useMemo(() => {
		const order = externalView ? activeView.columnOrder : undefined
		if (!order || order.length === 0) return config.schema
		const map = new Map(config.schema.map(c => [c.id, c]))
		const sorted = order.flatMap(id => map.has(id) ? [map.get(id)!] : [])
		const rest = config.schema.filter(c => !order.includes(c.id))
		return [...sorted, ...rest]
	}, [externalView, activeView.columnOrder, config.schema])

	// Salva view: embed atualiza estado local + persiste via callback; database escreve no frontmatter
	const saveView = useCallback(async (updatedView: ViewConfig) => {
		if (onViewChange) {
			setLocalEmbedView(updatedView)
			await onViewChange(updatedView)
		} else {
			if (!dbFile) return
			const newConfig = { ...config, views: config.views.map((v, i) => i === 0 ? updatedView : v) }
			setConfig(newConfig)
			await manager.writeConfig(dbFile, newConfig)
		}
	}, [onViewChange, config, dbFile, manager])

	// ── Carregar config e linhas ─────────────────────────────────────────────

	const loadData = useCallback(async () => {
		if (!dbFile) { setLoading(false); return }
		setLoading(true)

		const cfg = manager.readConfig(dbFile)
		const notes = manager.getNotesInDatabase(dbFile, activeView.includeSubfolders)

		// Inferir schema se vazio
		if (cfg.schema.length === 0 && notes.length > 0) {
			cfg.schema = manager.inferSchema(notes)
			await manager.writeConfig(dbFile, cfg)
		}

		const noteRows = await manager.resolveLookupsForRows(
			evaluateFormulas(
				notes.map(f => manager.getNoteData(f, cfg.schema)),
				cfg.schema
			),
			cfg.schema
		)

		// Garantir que a linha recém-criada apareça no final
		if (lastCreatedPath.current) {
			const idx = noteRows.findIndex(r => r._file.path === lastCreatedPath.current)
			if (idx !== -1) noteRows.push(...noteRows.splice(idx, 1))
			lastCreatedPath.current = null
		}

		// Restaurar pills (apenas na primeira carga por arquivo)
		if (!filtersInitialized.current) {
			filtersInitialized.current = true
			const sourceView = externalView ?? cfg.views[0]
			const pills = sourceView?.activePills ?? []
			if (pills.length > 0) {
				const restored = pills.flatMap(p => {
					if (p.columnId === '_title') return [{ id: p.id ?? crypto.randomUUID(), columnId: '_title', columnName: t('name_column'), columnType: 'title', icon: '📄', operator: p.operator, value: p.value, conjunction: (p.conjunction ?? 'and') }]
					const col = cfg.schema.find(sc => sc.id === p.columnId)
					if (!col) return []
					return [{ id: p.id ?? crypto.randomUUID(), columnId: col.id, columnName: col.name, columnType: col.type, icon: getColumnIconStatic(col.type), operator: p.operator, value: p.value, conjunction: (p.conjunction ?? 'and') }]
				})
				setActiveFilters(restored as ActiveFilter[])
			}
		}

		// Load relation options
		const relOpts = new Map<string, string[]>()
		for (const col of cfg.schema.filter(c => c.type === 'relation' && c.refDatabasePath && c.refColumnId)) {
			const refDbFile = app.vault.getFileByPath(col.refDatabasePath!)
			if (!refDbFile) continue
			const refConfig = manager.readConfig(refDbFile)
			const refNotes = manager.getNotesInDatabase(refDbFile)
			const values = new Set<string>()
			for (const note of refNotes) {
				const row = manager.getNoteData(note, refConfig.schema)
				const val = col.refColumnId === '_title' ? row._title : row[col.refColumnId!]
				if (val !== null && val !== undefined) {
					const s = String(val as string | number | boolean).trim()
					if (s) values.add(s)
				}
			}
			relOpts.set(col.id, Array.from(values).sort())
		}
		setRelationOptions(relOpts)

		setPinnedColumnId((externalView ?? cfg.views[0])?.pinnedColumnId ?? null)
		setConfig(cfg)
		setRows(noteRows)
		setLoading(false)
	}, [dbFile, manager, app, activeView.includeSubfolders])

	useEffect(() => { filtersInitialized.current = false }, [dbFile])

	useEffect(() => {
		void loadData()
	}, [loadData])

	// Reagir a mudanças no vault (novo arquivo, renomeação, etc.)
	useEffect(() => {
		const onVaultChange = () => { void loadData() }
		app.vault.on('create', onVaultChange)
		app.vault.on('delete', onVaultChange)
		app.vault.on('rename', onVaultChange)
		app.metadataCache.on('changed', onVaultChange)
		return () => {
			app.vault.off('create', onVaultChange)
			app.vault.off('delete', onVaultChange)
			app.vault.off('rename', onVaultChange)
			app.metadataCache.off('changed', onVaultChange)
		}
	}, [app, loadData])

	// ── Atualizar célula (salva no frontmatter) ──────────────────────────────

	const updateCell = useCallback(async (rowIndex: number, columnId: string, value: unknown) => {
		const row = rows[rowIndex]
		if (!row) return

		// Atualização otimista
		setRows(prev => prev.map((r, i) =>
			i === rowIndex ? { ...r, [columnId]: value } : r
		))

		if (columnId === '_title') {
			await manager.renameNote(row._file, String(value))
		} else {
			await manager.updateNoteField(row._file, columnId, value)
		}
	}, [rows, manager])

	// ── Atualizar schema (salva no _database.md) ─────────────────────────────

	const updateSchema = useCallback(async (newSchema: ColumnSchema[]) => {
		if (!dbFile) return
		const newConfig = { ...config, schema: newSchema }
		setConfig(newConfig)
		await manager.writeConfig(dbFile, newConfig)
	}, [dbFile, config, manager])

	// ── Validar e trocar tipo de coluna ─────────────────────────────────────

	const handleChangeColumnType = useCallback((colId: string, newType: ColumnType): boolean => {
		const col = config.schema.find(c => c.id === colId)
		if (!col) return true
		const error = validateTypeChange(rows, colId, col.type, newType)
		if (error) {
			new Notice(`${t('validate_type_change_prefix')}${error}`, 6000)
			return false
		}
		return true
	}, [config.schema, rows])

	// ── Pin de colunas ───────────────────────────────────────────────────────

	const handleTogglePin = useCallback(async (columnId: string) => {
		const next = pinnedColumnId === columnId ? null : columnId
		setPinnedColumnId(next)
		await saveView({ ...activeView, pinnedColumnId: next })
	}, [pinnedColumnId, saveView, activeView])

	const handleSortChange = useCallback(async (newSorts: SortConfig[]) => {
		setSorting(newSorts.map(s => ({ id: s.columnId, desc: s.direction === 'desc' })))
		await saveView({ ...activeView, sorts: newSorts })
	}, [activeView, saveView])

	const handleColumnToggleSort = useCallback((colId: string) => {
		const existing = activeView.sorts.find(s => s.columnId === colId)
		let newSorts: SortConfig[]
		if (!existing) {
			newSorts = [...activeView.sorts, { columnId: colId, direction: 'asc' }]
		} else if (existing.direction === 'asc') {
			newSorts = activeView.sorts.map(s => s.columnId === colId ? { ...s, direction: 'desc' as const } : s)
		} else {
			newSorts = activeView.sorts.filter(s => s.columnId !== colId)
		}
		void handleSortChange(newSorts)
	}, [activeView.sorts, handleSortChange])

	const handleColumnResize = useCallback(async (colId: string, width: number) => {
		await saveView({ ...activeView, columnWidths: { ...activeView.columnWidths, [colId]: width } })
	}, [activeView, saveView])

	const handleColumnAutoFit = useCallback(async (colId: string) => {
		const table = tableRef.current
		if (!table) return
		let maxWidth = 60
		table.querySelectorAll<HTMLElement>(`[data-col-id="${colId}"]`).forEach(el => {
			maxWidth = Math.max(maxWidth, el.scrollWidth)
		})
		await handleColumnResize(colId, maxWidth + 16)
	}, [handleColumnResize])

	const stickyMap = useMemo(() => {
		const map = new Map<string, { left: number; isLast: boolean }>()
		const SELECT_W = 40
		const TITLE_W = activeView.columnWidths['_title'] ?? 260
		map.set('_select', { left: 0, isLast: false })
		if (!pinnedColumnId) return map
		map.set('_title', { left: SELECT_W, isLast: pinnedColumnId === '_title' })
		if (pinnedColumnId === '_title') return map
		let cumLeft = SELECT_W + TITLE_W
		for (const col of config.schema.filter(c => c.visible)) {
			const colW = activeView.columnWidths[col.id] ?? (col.width ?? 150)
			map.set(col.id, { left: cumLeft, isLast: col.id === pinnedColumnId })
			cumLeft += colW
			if (col.id === pinnedColumnId) break
		}
		return map
	}, [pinnedColumnId, config])

	// ── Renomear coluna (id + nome + chave do frontmatter nas notas) ──────────

	const renameColumn = useCallback(async (oldId: string, newName: string) => {
		if (!dbFile) return
		const newConfig = await manager.renameColumn(dbFile, config, oldId, newName)
		setConfig(newConfig)
	}, [dbFile, config, manager])

	// ── Colunas TanStack Table ───────────────────────────────────────────────

	const columns = useMemo<ColumnDef<NoteRow>[]>(() => {
		const cols: ColumnDef<NoteRow>[] = []

		// Coluna seleção (sempre primeira)
		cols.push({
			id: '_select',
			size: 40,
			enableSorting: false,
			enableColumnFilter: false,
			header: () => null,
			cell: ({ row }) => (
				<div className="nb-cell-checkbox-wrapper">
					<input
						type="checkbox"
						className="nb-cell-checkbox"
						checked={row.getIsSelected()}
						onChange={row.getToggleSelectedHandler()}
					/>
				</div>
			),
		})

		// Coluna título (sempre segunda)
		cols.push({
			id: '_title',
			accessorFn: row => row._title,
			size: activeView.columnWidths['_title'] ?? 260,
			enableColumnFilter: true,
			enableSorting: true,
			sortingFn: 'text',
			header: ({ column }) => {
				const sorted = column.getIsSorted()
				return (
					<div className="nb-header-title">
						<span>📄</span>
						<span>{t('name_column')}</span>
						<button
							className={`nb-sort-btn ${sorted ? 'nb-sort-btn--sorted' : ''}`}
							onClick={e => { e.stopPropagation(); handleColumnToggleSort('_title') }}
							title={sorted === 'asc' ? t('sort_asc_title') : sorted === 'desc' ? t('sort_desc_title') : t('sort_none_title')}
						>
							<span className={sorted === 'asc' ? 'nb-sort-chevron--active' : 'nb-sort-chevron'}>⌃</span>
							<span className={sorted === 'desc' ? 'nb-sort-chevron--active' : 'nb-sort-chevron'}>⌄</span>
						</button>
					</div>
				)
			},
			cell: info => {
				const dbFolder = dbFile?.parent?.path ?? ''
				const fileFolder = info.row.original._file.parent?.path ?? ''
				const relPath = activeView.includeSubfolders && fileFolder.length > dbFolder.length
					? fileFolder.slice(dbFolder.length + 1)
					: ''
				return (
					<div>
						<CellRenderer
							col={{ id: '_title', name: 'Nome', type: 'title', visible: true }}
							value={info.getValue<string>()}
							rowIndex={info.row.index}
							columnId="_title"
							file={info.row.original._file}
						/>
						{relPath && <div className="nb-folder-path">{relPath}</div>}
					</div>
				)
			},
		})

		// Coluna virtual _folder (só quando includeSubfolders está ativo)
		if (activeView.includeSubfolders && !activeView.hiddenColumns.includes('_folder')) {
			const dbFolder = dbFile?.parent?.path ?? ''
			cols.push({
				id: '_folder',
				accessorFn: row => {
					const fileFolder = row._file.parent?.path ?? ''
					return fileFolder.length > dbFolder.length ? fileFolder.slice(dbFolder.length + 1) : ''
				},
				size: activeView.columnWidths['_folder'] ?? 150,
				enableColumnFilter: true,
				enableSorting: true,
				sortingFn: 'text',
				header: () => (
					<div className="nb-header-title">
						<span>{t('folder_column')}</span>
					</div>
				),
				cell: info => <span className="nb-folder-path">{info.getValue<string>()}</span>,
			})
		}

		// Colunas do schema
		const visibleSchema = orderedSchema.filter(col =>
			col.visible && !activeView.hiddenColumns.includes(col.id)
		)
		for (const col of visibleSchema) {
			cols.push({
				id: col.id,
				accessorFn: row => row[col.id],
				size: activeView.columnWidths[col.id] ?? (col.width ?? 150),
				enableColumnFilter: col.type !== 'formula' && col.type !== 'lookup' && col.type !== 'relation',
				enableSorting: col.type !== 'formula' && col.type !== 'lookup' && col.type !== 'relation' && col.type !== 'multiselect',
			sortingFn: getColumnSortingFn(col.type),
				header: () => (
					<ColumnHeader
						col={col}
						schema={config.schema}
						onUpdateSchema={updateSchema}
						onRenameColumn={renameColumn}
						onChangeType={newType => handleChangeColumnType(col.id, newType)}
						manager={manager}
						dbFile={dbFile}
					/>
				),
				cell: info => (
					<CellRenderer
						col={col}
						value={info.getValue()}
						rowIndex={info.row.index}
						columnId={col.id}
					/>
				),
			})
		}

		return cols
	}, [config, orderedSchema, activeView, updateSchema, renameColumn, handleChangeColumnType, manager, dbFile])

	// ── Instância da tabela ──────────────────────────────────────────────────

	const filteredRows = useMemo(() => {
		if (activeFilters.length === 0) return rows
		const groups: ActiveFilter[][] = []
		let current: ActiveFilter[] = []
		for (const f of activeFilters) {
			if (f.conjunction === 'or' && current.length > 0) {
				groups.push(current)
				current = []
			}
			current.push(f)
		}
		if (current.length > 0) groups.push(current)
		return rows.filter(row => groups.some(group => group.every(f => matchesFilter(row, f))))
	}, [rows, activeFilters])

	const table = useReactTable({
		data: filteredRows,
		columns,
		state: { sorting, globalFilter, rowSelection },
		onSortingChange: setSorting,
		onGlobalFilterChange: setGlobalFilter,
		onRowSelectionChange: setRowSelection,
		enableRowSelection: true,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		meta: {
			updateCell,
			editingCell,
			setEditingCell,
			schema: config.schema,
		},
	})

	// ── Adicionar linha ──────────────────────────────────────────────────────

	const handleAddRow = async () => {
		if (!dbFile) return
		const newFile = await manager.createNote(dbFile)
		lastCreatedPath.current = newFile.path
		// loadData será chamado pelo evento vault.on('create')
	}

	// ── Fechar menu de campos ao clicar fora ─────────────────────────────────

	useEffect(() => {
		if (!fieldsMenuOpen) return
		const handler = (e: MouseEvent) => {
			if (fieldsMenuRef.current && !fieldsMenuRef.current.contains(e.target as Node)) {
				setFieldsMenuOpen(false)
			}
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [fieldsMenuOpen])

	// ── Fechar menu de ações ao clicar fora ──────────────────────────────────

	useEffect(() => {
		if (!actionsMenuOpen) return
		const handler = (e: MouseEvent) => {
			if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
				setActionsMenuOpen(false)
			}
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [actionsMenuOpen])

	// ── Fechar menu de altura ao clicar fora ─────────────────────────────────

	useEffect(() => {
		if (!rowHeightMenuOpen) return
		const handler = (e: MouseEvent) => {
			if (rowHeightMenuRef.current && !rowHeightMenuRef.current.contains(e.target as Node)) {
				setRowHeightMenuOpen(false)
			}
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [rowHeightMenuOpen])

	// ── Fechar dropdown de agregação ao clicar fora ──────────────────────────

	useEffect(() => {
		if (!openAggCol) return
		const handler = (e: MouseEvent) => {
			const target = e.target as Node
			const open = document.querySelector('.nb-agg-dropdown')
			const btn = document.querySelector(`[data-agg-col="${openAggCol}"]`)
			if (!open?.contains(target) && !btn?.contains(target)) setOpenAggCol(null)
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [openAggCol])

	// ── Fechar painel de ordenação ao clicar fora ────────────────────

	useEffect(() => {
		if (!sortPanelOpen) return
		const handler = (e: MouseEvent) => {
			if (sortButtonRef.current?.contains(e.target as Node)) return
			if (sortPanelRef.current && !sortPanelRef.current.contains(e.target as Node)) {
				setSortPanelOpen(false)
			}
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [sortPanelOpen])

	// ── Ações em lote ────────────────────────────────────────────────────────

	const getSelectedFiles = useCallback(() => {
		return table.getSelectedRowModel().rows.map(r => r.original._file)
	}, [table])

	const handleDeleteSelected = useCallback(async () => {
		const files = getSelectedFiles()
		if (files.length === 0) return
		await manager.deleteNotes(files)
		setRowSelection({})
		setActionsMenuOpen(false)
	}, [getSelectedFiles, manager])

	const handleMoveSelected = useCallback(() => {
		const files = getSelectedFiles()
		if (files.length === 0) return
		const modal = new FolderPickerModal(app, folder => {
			void manager.moveNotes(files, folder.path)
			setRowSelection({})
		})
		modal.open()
		setActionsMenuOpen(false)
	}, [app, getSelectedFiles, manager])

	const handleDuplicateSelected = useCallback(async () => {
		const files = getSelectedFiles()
		if (files.length === 0) return
		await manager.duplicateNotes(files)
		setRowSelection({})
		setActionsMenuOpen(false)
	}, [getSelectedFiles, manager])

	const handleExportCsv = useCallback(() => {
		const visibleCols = orderedSchema.filter(col =>
			col.visible && !activeView.hiddenColumns.includes(col.id)
		)
		const escapeCell = (v: unknown): string => {
				const s = v === null || v === undefined ? '' : String(v as string | number | boolean)
			if (s.includes(',') || s.includes('"') || s.includes('\n')) {
				return '"' + s.replace(/"/g, '""') + '"'
			}
			return s
		}
		const headers = ['Nome', ...visibleCols.map(c => c.name)]
		const rowLines = filteredRows.map(row => {
			const cells = [row._title, ...visibleCols.map(col => {
				const v = row[col.id]
				return Array.isArray(v) ? v.join(';') : v
			})]
			return cells.map(escapeCell).join(',')
		})
		const csv = [headers.join(','), ...rowLines].join('\n')
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = (dbFile?.parent?.name || app.vault.getName() || 'database') + '.csv'
		a.click()
		URL.revokeObjectURL(url)
		setActionsMenuOpen(false)
	}, [orderedSchema, activeView.hiddenColumns, filteredRows, dbFile, app])

	const handleImportCsv = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
		const csvFile = e.target.files?.[0]
		if (!csvFile || !dbFile) return
		const text = await csvFile.text()
		const lines = text.split(/\r?\n/).filter(l => l.trim() !== '')
		if (lines.length < 2) return
		const parseRow = (line: string): string[] => {
			const cells: string[] = []
			let cur = '', inQ = false
			for (let i = 0; i < line.length; i++) {
				const ch = line[i]
				if (ch === '"') {
					if (inQ && line[i+1] === '"') { cur += '"'; i++ }
					else inQ = !inQ
				} else if (ch === ',' && !inQ) {
					cells.push(cur); cur = ''
				} else cur += ch
			}
			cells.push(cur)
			return cells
		}
		const headers = parseRow(lines[0]).map(h => h.trim().toLowerCase())
		// Map column index → schema column (skip duplicates: first match wins)
		const colByIdx = new Map<number, { id: string; type: string }>()
		const seenColIds = new Set<string>()
		headers.forEach((h, i) => {
			if (h === 'nome' || h === 'title' || h === 'name') return
			const col = config.schema.find(s => s.name.toLowerCase() === h)
			if (col && !seenColIds.has(col.id)) {
				colByIdx.set(i, { id: col.id, type: col.type })
				seenColIds.add(col.id)
			}
		})
		const titleIdx = headers.findIndex(h => h === 'nome' || h === 'title' || h === 'name')
		for (const line of lines.slice(1)) {
			const cells = parseRow(line)
			const title = titleIdx >= 0 ? cells[titleIdx]?.trim() : ''
			// Skip row if a note with this title already exists
			if (title && rows.some(r => r._title === title)) continue
			const newNote = await manager.createNote(dbFile)
			// renameNote mutates newNote in place — use it directly after
			if (title) await manager.renameNote(newNote, title)
			for (const [idx, col] of colByIdx) {
				const raw = cells[idx]?.trim() ?? ''
				if (!raw) continue
				const value = col.type === 'multiselect' ? raw.split(';').map((v: string) => v.trim()) : raw
				await manager.updateNoteField(newNote, col.id, value)
			}
		}
		e.target.value = ''
		setActionsMenuOpen(false)
	}, [dbFile, config.schema, manager, app])

	// ── Fechar menu de filtros ao clicar fora ────────────────────────────────

	useEffect(() => {
		if (!filterMenuOpen) return
		const handler = (e: MouseEvent) => {
			if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
				setFilterMenuOpen(false)
			}
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [filterMenuOpen])

	// ── Posição do dropdown de pill (portal) ──────────────────────────────────

	useEffect(() => {
		if (!openFilterPill) { setPillDropdownPos(null); return }
		const btn = filterPillRefs.current[openFilterPill]
		if (!btn) return
		const rect = btn.getBoundingClientRect()
		setPillDropdownPos({ top: rect.bottom + 6, left: rect.left })
	}, [openFilterPill])

	// ── Fechar pill de filtro ao clicar fora ──────────────────────────────────

	useEffect(() => {
		if (!openFilterPill) return
		const handler = (e: MouseEvent) => {
			const btn = filterPillRefs.current[openFilterPill]
			const dropdown = pillDropdownRef.current
			const clickedBtn = btn && btn.contains(e.target as Node)
			const clickedDropdown = dropdown && dropdown.contains(e.target as Node)
			if (!clickedBtn && !clickedDropdown) setOpenFilterPill(null)
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [openFilterPill])

	// ── Fechar operator picker ao clicar fora ────────────────────────────

	useEffect(() => {
		if (!openOperatorPicker) return
		const handler = (e: MouseEvent) => {
			const el = operatorPickerRefs.current[openOperatorPicker]
			if (el && !el.contains(e.target as Node)) setOpenOperatorPicker(null)
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [openOperatorPicker])

		// ── Filtros ───────────────────────────────────────────────────────────────

	const getColumnIcon = getColumnIconStatic

	const saveActivePills = useCallback(async (filters: { columnId: string }[]) => {
		const pills = (filters as ActiveFilter[]).map(f => ({ id: f.id, columnId: f.columnId, operator: f.operator, value: f.value, conjunction: f.conjunction }))
		await saveView({ ...activeView, activePills: pills })
	}, [saveView, activeView])

	const handlePillDragEnd = (event: DragEndEvent) => {
		const { active, over } = event
		if (!over || active.id === over.id) return
		const oldIndex = activeFilters.findIndex(f => f.id === active.id)
		const newIndex = activeFilters.findIndex(f => f.id === over.id)
		const next = arrayMove(activeFilters, oldIndex, newIndex)
		setActiveFilters(next)
		void saveActivePills(next)
	}

	const addFilter = (columnId: string, columnName: string, icon: string, columnType: string) => {
		const filterId = crypto.randomUUID()
		const next: ActiveFilter[] = [...activeFilters, { id: filterId, columnId, columnName, columnType, icon, operator: getDefaultOperator(columnType), value: '', conjunction: 'and' as const }]
		setActiveFilters(next)
		void saveActivePills(next)
		setFilterMenuOpen(false)
	}

	const removeFilter = (filterId: string) => {
		const next = activeFilters.filter(f => f.id !== filterId)
		setActiveFilters(next)
		void saveActivePills(next)
		if (openFilterPill === filterId) setOpenFilterPill(null)
		if (openOperatorPicker === filterId) setOpenOperatorPicker(null)
	}

	const setRowHeight = async (h: 'compact' | 'medium' | 'tall') => {
		await saveView({ ...activeView, rowHeight: h })
		setRowHeightMenuOpen(false)
	}

	const toggleWrapText = async () => {
		await saveView({ ...activeView, wrapText: !activeView.wrapText })
	}

	const toggleIncludeSubfolders = async () => {
		await saveView({ ...activeView, includeSubfolders: !activeView.includeSubfolders })
	}

	const setAggregation = async (columnId: string, type: AggregationType) => {
		const next = { ...(activeView.aggregations ?? {}), [columnId]: type }
		await saveView({ ...activeView, aggregations: next })
		setOpenAggCol(null)
	}

	const computeAgg = (columnId: string, type: AggregationType): string => {
		if (type === 'none') return ''
		const vals = filteredRows.map(r => columnId === '_title' ? r._title : r[columnId])
		const total = filteredRows.length
		if (type === 'count') return `${total} ${total === 1 ? t('row_singular').toLowerCase() : t('row_plural').toLowerCase()}`
		const nonEmpty = vals.filter(v => v !== null && v !== undefined && String(v as string | number | boolean).trim() !== '')
		if (type === 'count_values') return `${nonEmpty.length} preenchido${nonEmpty.length !== 1 ? 's' : ''}`
		const nums = nonEmpty.map(v => parseFloat(String(v as string | number | boolean))).filter(n => !isNaN(n))
		if (nums.length === 0) return '—'
		if (type === 'sum') return String(Math.round(nums.reduce((a, b) => a + b, 0) * 1e10) / 1e10)
		if (type === 'avg') return String(Math.round(nums.reduce((a, b) => a + b, 0) / nums.length * 1e10) / 1e10)
		if (type === 'min') return String(Math.min(...nums))
		if (type === 'max') return String(Math.max(...nums))
		return ''
	}

	const aggLabel: Record<AggregationType, string> = {
		none: t('agg_none'), count: '', count_values: '',
		sum: t('agg_sum'), avg: t('agg_avg'), min: t('agg_min'), max: t('agg_max'),
	}

	const updateFilter = (filterId: string, operator: FilterOperator, value: string) => {
		const next = activeFilters.map(f =>
			f.id === filterId ? { ...f, operator, value } : f
		)
		setActiveFilters(next)
		void saveActivePills(next)
	}

	const toggleConjunction = (filterId: string) => {
		const next = activeFilters.map(f =>
			f.id === filterId ? { ...f, conjunction: f.conjunction === 'and' ? 'or' as const : 'and' as const } : f
		)
		setActiveFilters(next)
		void saveActivePills(next)
	}

	// ── Busca colapsável ──────────────────────────────────────────────────────

	const shouldCollapse = activeFilters.length >= 3 || activeFilters.some(f => f.columnName.length > 10)

	useEffect(() => {
		if (!shouldCollapse) {
			setSearchExpanded(false)
			if (searchInactivityTimer.current) clearTimeout(searchInactivityTimer.current)
		}
	}, [shouldCollapse])

	useEffect(() => {
		return () => { if (searchInactivityTimer.current) clearTimeout(searchInactivityTimer.current) }
	}, [])

	const clearSearchTimer = () => {
		if (searchInactivityTimer.current) {
			clearTimeout(searchInactivityTimer.current)
			searchInactivityTimer.current = null
		}
	}

	const startSearchTimer = () => {
		clearSearchTimer()
		searchInactivityTimer.current = setTimeout(() => setSearchExpanded(false), 6000)
	}

	const expandSearch = () => {
		setSearchExpanded(true)
		startSearchTimer()
		requestAnimationFrame(() => searchInputRef.current?.focus())
	}

	const collapseSearch = () => {
		clearSearchTimer()
		setSearchExpanded(false)
	}

	// ── Toggle visibilidade de um campo ──────────────────────────────────────

	const toggleFieldVisibility = useCallback(async (fieldId: string) => {
		if (externalView) {
			const hidden = activeView.hiddenColumns.includes(fieldId)
				? activeView.hiddenColumns.filter(id => id !== fieldId)
				: [...activeView.hiddenColumns, fieldId]
			await saveView({ ...activeView, hiddenColumns: hidden })
		} else {
			const newSchema = config.schema.map(col =>
				col.id === fieldId ? { ...col, visible: !col.visible } : col
			)
			await updateSchema(newSchema)
		}
	}, [externalView, activeView, saveView, config.schema, updateSchema])

	// ── Reordenar colunas via drag ────────────────────────────────────────────

	const handleColumnDragEnd = useCallback(async (event: DragEndEvent) => {
		const { active, over } = event
		if (!over || active.id === over.id) return

		const oldIndex = orderedSchema.findIndex(c => c.id === active.id)
		const newIndex = orderedSchema.findIndex(c => c.id === over.id)
		if (oldIndex === -1 || newIndex === -1) return

		if (externalView) {
			const newOrder = arrayMove(orderedSchema, oldIndex, newIndex).map(c => c.id)
			await saveView({ ...activeView, columnOrder: newOrder })
		} else {
			await updateSchema(arrayMove(config.schema, oldIndex, newIndex))
		}
	}, [orderedSchema, externalView, activeView, saveView, config.schema, updateSchema])

	// ── Adicionar coluna ─────────────────────────────────────────────────────

	const handleAddColumn = async () => {
		const id = `campo_${Date.now()}`
		const newCol: ColumnSchema = {
			id,
			name: t('new_field'),
			type: 'text',
			visible: true,
			width: 150,
		}
		await updateSchema([...config.schema, newCol])
	}

	// ── Render ───────────────────────────────────────────────────────────────

	if (!dbFile) {
		return (
			<div className="nb-empty-state">
				<p>{t('no_database_open')}</p>
				<p>{t('no_database_hint')}</p>
			</div>
		)
	}

	if (loading) {
		return <div className="nb-loading">{t('loading')}</div>
	}

	const tableRows = table.getRowModel().rows

	return (
		<div className="nb-container">
			{/* Toolbar */}
			<div className="nb-toolbar">
				<div className={`nb-search-container${shouldCollapse ? (searchExpanded ? ' nb-search-container--expanded' : ' nb-search-container--collapsed') : ''}`}>
					{shouldCollapse && (
						<button className="nb-search-icon-btn" onClick={expandSearch} title="Buscar">
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
								<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
							</svg>
						</button>
					)}
					<input
						ref={searchInputRef}
						className="nb-search"
						type="text"
						placeholder={t('relation_search_placeholder')}
						value={globalFilter}
						onChange={e => { setGlobalFilter(e.target.value); if (shouldCollapse && searchExpanded) startSearchTimer() }}
						onKeyDown={e => { if (e.key === 'Enter' && shouldCollapse && searchExpanded) collapseSearch() }}
						onBlur={() => { if (shouldCollapse && searchExpanded) collapseSearch() }}
					/>
				</div>

				{/* Botão Altura das linhas */}
				<div className="nb-fields-menu-wrapper" ref={rowHeightMenuRef}>
					<button
						className={`nb-toolbar-btn nb-toolbar-btn--icon ${rowHeightMenuOpen ? 'nb-toolbar-btn--active' : ''}`}
						onClick={() => setRowHeightMenuOpen(v => !v)}
						title={t('row_height_label')}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="3" y2="18"/>
						</svg>
					</button>
					{rowHeightMenuOpen && (
						<div className="nb-fields-dropdown nb-rowheight-dropdown">
							<div className="nb-fields-dropdown-label">{t('row_height_label')}</div>
							{(['compact', 'medium', 'tall'] as const).map(h => (
								<button
									key={h}
									className={`nb-menu-item ${(activeView.rowHeight ?? 'medium') === h ? 'nb-menu-item--active' : ''}`}
									onClick={() => { void setRowHeight(h) }}
								>
									<span className="nb-menu-item-icon">
										{h === 'compact' ? '▤' : h === 'medium' ? '▥' : '▦'}
									</span>
									<span>{h === 'compact' ? t('height_compact') : h === 'medium' ? t('height_medium') : t('height_tall')}</span>
								</button>
							))}
						</div>
					)}
				</div>

				{/* Botão Wrap de texto */}
				<button
					className={`nb-toolbar-btn nb-toolbar-btn--icon ${activeView.wrapText ? 'nb-toolbar-btn--active' : ''}`}
					onClick={() => { void toggleWrapText() }}
					title={t('tooltip_wrap_text')}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
						<path d="M3 18h12a3 3 0 0 0 0-6h-3"/><polyline points="9 15 6 18 9 21"/>
					</svg>
				</button>

				{/* Botão Include subfolders */}
				<button
					className={`nb-toolbar-btn nb-toolbar-btn--icon nb-subfolder-toggle ${activeView.includeSubfolders ? 'nb-toolbar-btn--active' : ''}`}
					onClick={() => { void toggleIncludeSubfolders() }}
					title={t('tooltip_include_subfolders')}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
						<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
						<line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
					</svg>
				</button>

				{/* Botão Campos */}
				<div className="nb-fields-menu-wrapper" ref={fieldsMenuRef}>
					<button
						className={`nb-toolbar-btn ${fieldsMenuOpen ? 'nb-toolbar-btn--active' : ''}`}
						onClick={() => setFieldsMenuOpen(v => !v)}
						title={t('tooltip_manage_fields')}
					>
						{t('fields')} {config.schema.some(c => !c.visible) && (
							<span className="nb-hidden-badge">
								{config.schema.filter(c => !c.visible).length}
							</span>
						)}
					</button>

					{fieldsMenuOpen && (
						<div className="nb-fields-dropdown">
							<div className="nb-fields-dropdown-label">{t('fields_label')}</div>
							{config.schema.map(col => (
								<label key={col.id} className="nb-field-row">
									<input
										type="checkbox"
										className="nb-field-checkbox"
										checked={externalView
											? col.visible && !activeView.hiddenColumns.includes(col.id)
											: col.visible}
										onChange={() => { void toggleFieldVisibility(col.id) }}
									/>
									<span className="nb-field-icon">{
										col.type === 'text' ? 'Aa' :
										col.type === 'number' ? '#' :
										col.type === 'select' ? '◉' :
										col.type === 'multiselect' ? '◈' :
										col.type === 'date' ? '📅' :
										col.type === 'checkbox' ? '☑' :
										col.type === 'lookup' ? '↗' :
										col.type === 'relation' ? '🔗' :
									col.type === 'formula' ? 'ƒ' : '·'
									}</span>
									<span className="nb-field-name">{col.name}</span>
								</label>
							))}
						</div>
					)}
				</div>

				{/* Botão Ações */}
				<div className="nb-fields-menu-wrapper" ref={actionsMenuRef}>
					<button
						className={`nb-toolbar-btn ${actionsMenuOpen ? 'nb-toolbar-btn--active' : ''}`}
						onClick={() => setActionsMenuOpen(v => !v)}
						title={t('tooltip_batch_actions')}
					>
						{t('actions')}
						{table.getSelectedRowModel().rows.length > 0 && (
							<span className="nb-hidden-badge">
								{table.getSelectedRowModel().rows.length}
							</span>
						)}
					</button>

					{actionsMenuOpen && (
						<div className="nb-fields-dropdown nb-actions-dropdown">
							<button
								className="nb-menu-item"
								onClick={() => { void handleDeleteSelected() }}
								disabled={table.getSelectedRowModel().rows.length === 0}
							>
								<span className="nb-menu-item-icon">🗑</span>
								<span>{t('delete_selected')}</span>
							</button>
							<button
								className="nb-menu-item"
								onClick={handleMoveSelected}
								disabled={table.getSelectedRowModel().rows.length === 0}
							>
								<span className="nb-menu-item-icon">📁</span>
								<span>{t('move_selected')}</span>
							</button>
							<button
								className="nb-menu-item"
								onClick={() => { void handleDuplicateSelected() }}
								disabled={table.getSelectedRowModel().rows.length === 0}
							>
								<span className="nb-menu-item-icon">📋</span>
								<span>{t('duplicate_selected')}</span>
							</button>
							<div className="nb-menu-separator" />
							<button className="nb-menu-item" onClick={handleExportCsv}>
								<span className="nb-menu-item-icon">⬇</span>
								<span>{t('export_csv')}</span>
							</button>
							<button className="nb-menu-item" onClick={() => csvInputRef.current?.click()}>
								<span className="nb-menu-item-icon">⬆</span>
								<span>{t('import_csv')}</span>
							</button>
							<input ref={csvInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { void handleImportCsv(e) }} />
						</div>
					)}
				</div>

<span className="nb-row-count">
					{tableRows.length} {tableRows.length === 1 ? t('item_singular').toLowerCase() : t('item_plural').toLowerCase()}
				</span>

				{/* Botão Filtros */}
				<div className="nb-fields-menu-wrapper" ref={filterMenuRef} style={{ marginLeft: 'auto' }}>
					<button
						className={`nb-toolbar-btn nb-toolbar-btn--icon ${filterMenuOpen ? 'nb-toolbar-btn--active' : ''}`}
						onClick={() => setFilterMenuOpen(v => !v)}
						title={t('filters')}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
						</svg>
						{activeFilters.length > 0 && (
							<span className="nb-hidden-badge">{activeFilters.length}</span>
						)}
					</button>

					{filterMenuOpen && (
						<div className="nb-fields-dropdown nb-filter-menu-dropdown">
							<div className="nb-fields-dropdown-label">{t('filter_by')}</div>
							<button
								className="nb-menu-item"
								onClick={() => addFilter('_title', 'Nome', '📄', 'title')}
								
							>
								<span className="nb-menu-item-icon">📄</span>
								<span>{t('name_column')}</span>
							</button>
							{config.schema.map(col => (
								<button
									key={col.id}
									className="nb-menu-item"
									onClick={() => addFilter(col.id, col.name, getColumnIcon(col.type), col.type)}
									
								>
									<span className="nb-menu-item-icon">{getColumnIcon(col.type)}</span>
									<span>{col.name}</span>
								</button>
							))}
							<div className="nb-menu-separator" />
							<button className="nb-menu-item" onClick={() => setFilterMenuOpen(false)}>
								<span className="nb-menu-item-icon">⚡</span>
								<span>{t('add_filter_advanced')}</span>
							</button>
						</div>
					)}
				</div>

				<>
					<button
						ref={sortButtonRef}
						className={`nb-toolbar-btn${activeView.sorts.length > 0 ? ' nb-toolbar-btn--active' : ''}`}
						onClick={() => {
							if (!sortPanelOpen && sortButtonRef.current) {
								setSortAnchorRect(sortButtonRef.current.getBoundingClientRect())
							}
							setSortPanelOpen(v => !v)
						}}
					>
						<span>{t('sort')}</span>
						{activeView.sorts.length > 0 && <span className="nb-hidden-badge">{activeView.sorts.length}</span>}
					</button>
					{sortPanelOpen && sortAnchorRect && (
						<SortPanel
							sorts={activeView.sorts}
							schema={config.schema}
							onSortChange={s => { void handleSortChange(s) }}
							onClose={() => setSortPanelOpen(false)}
							anchorRect={sortAnchorRect}
							panelRef={sortPanelRef}
						/>
					)}
				</>
			</div>

	

		{/* Linha de pills de filtros ativos */}
		{activeFilters.length > 0 && !(shouldCollapse && searchExpanded) && (
			<div className="nb-pills-row">
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragStart={() => setOpenFilterPill(null)}
					onDragEnd={handlePillDragEnd}
				>
					<SortableContext items={activeFilters.map(f => f.id)} strategy={horizontalListSortingStrategy}>
						{activeFilters.map((filter, idx) => (
							<Fragment key={filter.id}>
								{idx > 0 && (
									<button
										className={`nb-pill-conjunction ${filter.conjunction === 'or' ? 'nb-pill-conjunction--or' : ''}`}
										onClick={() => toggleConjunction(filter.id)}
										title="Clique para alternar entre E / OU"
									>
										{filter.conjunction === 'or' ? t('conjunction_or') : t('conjunction_and')}
									</button>
								)}
								<SortablePill
									filter={filter}
									isActive={openFilterPill === filter.id}
									onToggle={() => setOpenFilterPill(v => v === filter.id ? null : filter.id)}
									onRemove={() => removeFilter(filter.id)}
									btnRef={el => { filterPillRefs.current[filter.id] = el }}
								/>
							</Fragment>
						))}
					</SortableContext>
				</DndContext>
			</div>
		)}

		{/* Dropdown portal para pill aberta */}
		{(() => {
			const filter = activeFilters.find(f => f.id === openFilterPill)
			if (!filter || !pillDropdownPos) return null
			return createPortal(
				<div ref={pillDropdownRef} className="nb-filter-pill-dropdown" style={{ position: 'fixed', top: pillDropdownPos.top, left: pillDropdownPos.left, zIndex: 1000 }}>
					<div className="nb-filter-query-row">
						<span className="nb-filter-query-name">{filter.columnName}</span>
						<div
							className="nb-filter-op-wrapper"
							ref={el => { operatorPickerRefs.current[filter.id] = el }}
						>
							<button
								className={`nb-filter-op-btn ${openOperatorPicker === filter.id ? 'nb-filter-op-btn--open' : ''}`}
								onClick={e => { e.stopPropagation(); setOpenOperatorPicker(v => v === filter.id ? null : filter.id) }}
							>
								{OPERATOR_LABELS[filter.operator]}
								<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
							</button>
							{openOperatorPicker === filter.id && (
								<div className="nb-filter-op-dropdown">
									{getOperatorsForType(filter.columnType).map((op: FilterOperator) => (
										<button
											key={op}
											className={`nb-menu-item ${filter.operator === op ? 'nb-menu-item--active' : ''}`}
											onClick={e => { e.stopPropagation(); updateFilter(filter.id, op, ''); setOpenOperatorPicker(null) }}
										>
											{OPERATOR_LABELS[op]}
										</button>
									))}
								</div>
							)}
						</div>
						<button
							className="nb-filter-query-clear"
							onClick={e => { e.stopPropagation(); removeFilter(filter.id) }}
							title={t('tooltip_remove_filter')}
						>×</button>
					</div>
					{!NO_VALUE_OPERATORS.has(filter.operator) && (
						<input
							className="nb-filter-value-input"
							type={filter.columnType === 'number' ? 'number' : filter.columnType === 'date' ? 'date' : 'text'}
							placeholder={filter.columnType === 'number' ? t('filter_number_placeholder') : filter.columnType === 'date' ? '' : t('filter_value_placeholder')}
							value={filter.value}
							autoFocus
							onChange={e => updateFilter(filter.id, filter.operator, e.target.value)}
						/>
					)}
				</div>,
				document.body
			)
		})()}

		{/* Tabela */}
			<CellContext.Provider value={{ editingCell, setEditingCell, updateCell, schema: config.schema, relationOptions, updateSchema }}>
			<div className={`nb-table-wrapper${activeView.wrapText ? ' nb-table--wrap' : ''}`}
				style={{ '--nb-row-height': activeView.rowHeight === 'compact' ? '28px' : activeView.rowHeight === 'tall' ? '64px' : '36px' } as React.CSSProperties}>
				<table ref={tableRef} className="nb-table">
					<thead className="nb-thead">
						{table.getHeaderGroups().map(group => {
							const visibleSchemaIds = orderedSchema
								.filter(c => c.visible && !activeView.hiddenColumns.includes(c.id))
								.map(c => c.id)
							return (
								<DndContext
									key={group.id}
									sensors={sensors}
									collisionDetection={closestCenter}
									onDragEnd={e => { void handleColumnDragEnd(e) }}
								>
									<SortableContext
										items={visibleSchemaIds}
										strategy={horizontalListSortingStrategy}
									>
										<tr className="nb-header-row">
											{group.headers.map(header => {
												const sticky = stickyMap.get(header.id)
												if (header.id === '_select') {
													return (
														<th
															key={header.id}
															className="nb-th nb-th-select nb-th--sticky"
															style={{ width: header.getSize(), left: 0, zIndex: 3 }}
														>
															<div className="nb-cell-checkbox-wrapper">
																<input
																	type="checkbox"
																	className="nb-cell-checkbox"
																	checked={table.getIsAllRowsSelected()}
																	ref={el => { if (el) el.indeterminate = table.getIsSomeRowsSelected() }}
																	onChange={table.getToggleAllRowsSelectedHandler()}
																/>
															</div>
														</th>
													)
												}
												if (header.id === '_title') {
													return (
														<th
															key={header.id}
															data-col-id="_title"
															className={[
																'nb-th',
																sticky ? 'nb-th--sticky' : '',
																sticky?.isLast ? 'nb-th--sticky-last' : '',
															].filter(Boolean).join(' ')}
															style={{
																width: header.getSize(),
																...(sticky ? { left: sticky.left, zIndex: 3 } : {}),
															}}
														>
															<div className="nb-th-inner-title">
																<div style={{ flex: 1 }}>
																	{flexRender(header.column.columnDef.header, header.getContext())}
																</div>
																<button
																	className={`nb-pin-btn${pinnedColumnId === '_title' ? ' nb-pin-btn--active' : ''}`}
																	onClick={() => { void handleTogglePin('_title') }}
																	title={pinnedColumnId === '_title' ? t('tooltip_unpin_column') : t('tooltip_pin_column')}
																>📌</button>
															</div>
															<ResizeHandle onResize={w => { void handleColumnResize('_title', w) }} onAutoFit={() => { void handleColumnAutoFit('_title') }} />
														</th>
													)
												}
												return (
													<SortableTh
														key={header.id}
														id={header.id}
														size={header.getSize()}
														stickyLeft={sticky?.left}
														isLastPinned={sticky?.isLast}
														isPinned={pinnedColumnId === header.id}
														onTogglePin={() => { void handleTogglePin(header.id) }}
					sorted={header.column.getCanSort() ? header.column.getIsSorted() : undefined}
					onToggleSort={header.column.getCanSort() ? () => handleColumnToggleSort(header.id) : undefined}
					onResize={w => { void handleColumnResize(header.id, w) }}
					onAutoFit={() => { void handleColumnAutoFit(header.id) }}
													>
														{flexRender(header.column.columnDef.header, header.getContext())}
													</SortableTh>
												)
											})}
											<th className="nb-th nb-th-add-col">
												<button className="nb-add-col-btn" onClick={() => { void handleAddColumn() }} title={t('add_field')}>
													+
												</button>
											</th>
										</tr>
									</SortableContext>
								</DndContext>
							)
						})}
					</thead>

					<tbody className="nb-tbody">
						{tableRows.length === 0 ? (
							<tr>
								<td
									colSpan={columns.length + 1}
									className="nb-empty-rows"
								>
									{t('no_results')}
								</td>
							</tr>
						) : (
							tableRows.map(row => (
								<tr
									key={row.id}
									className="nb-row"
									onClick={() => setEditingCell(null)}
								>
									{row.getVisibleCells().map(cell => {
										const sticky = stickyMap.get(cell.column.id)
										return (
											<td
												key={cell.id}
												data-col-id={cell.column.id}
												className={[
													'nb-td',
													sticky ? 'nb-td--sticky' : '',
													sticky?.isLast ? 'nb-td--sticky-last' : '',
												].filter(Boolean).join(' ')}
												style={{
													width: cell.column.getSize(),
													...(sticky ? { left: sticky.left, zIndex: 1 } : {}),
												}}
												onClick={e => e.stopPropagation()}
											>
												<div className="nb-td-inner">
													{flexRender(cell.column.columnDef.cell, cell.getContext())}
												</div>
											</td>
										)
									})}
									<td className="nb-td nb-td-empty" />
								</tr>
							))
						)}
						<tr>
							<td colSpan={columns.length + 1} className="nb-add-row-td">
								<button className="nb-add-row-btn" onClick={() => { void handleAddRow() }}>
									{'+ ' + t('add_row')}
								</button>
							</td>
						</tr>
					</tbody>
					<tfoot className="nb-tfoot">
					<tr>
						<td className="nb-td nb-agg-td nb-td--sticky" style={{ left: 0, zIndex: 1, width: 40 }} />
						{table.getVisibleLeafColumns().filter(col => col.id !== '_select').map(col => {
							const sticky = stickyMap.get(col.id)
							const aggType = (activeView.aggregations ?? {})[col.id] ?? 'none'
							const aggValue = computeAgg(col.id, aggType)
							return (
								<td
									key={col.id}
									data-agg-col={col.id}
									className={[
										'nb-td', 'nb-agg-td',
										sticky ? 'nb-td--sticky' : '',
										sticky?.isLast ? 'nb-td--sticky-last' : '',
									].filter(Boolean).join(' ')}
									style={{ width: col.getSize(), ...(sticky ? { left: sticky.left, zIndex: 1 } : {}) }}
									onClick={() => setOpenAggCol(v => v === col.id ? null : col.id)}
								>
									{aggType !== 'none' ? (
										<div className="nb-agg-cell">
											<span className="nb-agg-label">{aggLabel[aggType]}</span>
											<span className="nb-agg-value">{aggValue}</span>
										</div>
									) : (
										<div className="nb-agg-empty" />
									)}
									{openAggCol === col.id && createPortal(
										<AggDropdown
											colType={config.schema.find(s => s.id === col.id)?.type ?? 'text'}
											current={aggType}
											onSelect={t => { void setAggregation(col.id, t) }}
											anchorEl={document.querySelector(`[data-agg-col="${col.id}"]`) as HTMLElement}
										/>,
										document.body
									)}
								</td>
							)
						})}
						<td className="nb-td nb-agg-td nb-td-empty" />
					</tr>
				</tfoot>
			</table>
			</div>

			{/* Barra de contagem de linhas */}
			<div className="nb-row-count-bar">
				{(() => {
					const total = rows.length
					const filtered = table.getFilteredRowModel().rows.length
					const isFiltered = filtered !== total
					return isFiltered
						? <span className="nb-row-count">{filtered} de {total} {total !== 1 ? t('record_plural').toLowerCase() : t('record_singular').toLowerCase()}</span>
						: <span className="nb-row-count">{total} {total !== 1 ? t('record_plural').toLowerCase() : t('record_singular').toLowerCase()}</span>
				})()}
			</div>

			</CellContext.Provider>
		</div>
	)
}
