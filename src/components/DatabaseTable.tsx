import {
	useReactTable,
	getCoreRowModel,
	getSortedRowModel,
	getFilteredRowModel,
	flexRender,
	ColumnDef,
	SortingState,
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
import { ReactNode, useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../context'
import { DatabaseManager } from '../database-manager'
import { ColumnSchema, ColumnType, DatabaseConfig, FilterOperator, NoteRow, ViewConfig, DEFAULT_DATABASE_CONFIG, DEFAULT_VIEW } from '../types'
import { evaluateFormulas } from '../formula-engine'
import { ColumnHeader } from './ColumnHeader'
import { CellRenderer, CellContext } from './cells/CellRenderer'
import { FolderPickerModal } from '../folder-picker-modal'

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
			return `${bad.length} célula(s) contêm valores não numéricos (ex: "${String(bad[0])}")`
	}

	if (toType === 'date') {
		const bad = values.filter(v => {
			const s = String(v).trim()
			return s !== '' && isNaN(new Date(s).getTime())
		})
		if (bad.length > 0)
			return `${bad.length} célula(s) contêm valores que não são datas válidas (ex: "${String(bad[0])}")`
	}

	if (toType === 'checkbox') {
		const validBool = new Set(['true', 'false', '1', '0', 'yes', 'no', 'sim', 'não', 'nao'])
		const bad = values.filter(v => {
			if (typeof v === 'boolean') return false
			return !validBool.has(String(v).toLowerCase().trim())
		})
		if (bad.length > 0)
			return `${bad.length} célula(s) contêm valores incompatíveis com checkbox (ex: "${String(bad[0])}")`
	}

	if (fromType === 'multiselect' && toType === 'select') {
		const multi = values.filter(v => Array.isArray(v) && (v as unknown[]).length > 1)
		if (multi.length > 0)
			return `${multi.length} linha(s) têm múltiplos valores selecionados. Remova os extras antes de mudar para seleção única.`
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

const OPERATOR_LABELS: Record<FilterOperator, string> = {
	is: 'É',
	is_not: 'Não é',
	contains: 'Contém',
	not_contains: 'Não contém',
	starts_with: 'Começa com',
	ends_with: 'Termina com',
	gt: 'Maior que',
	gte: 'Maior ou igual',
	lt: 'Menor que',
	lte: 'Menor ou igual',
	is_checked: 'Está marcado',
	is_unchecked: 'Não está marcado',
	is_empty: 'Está vazio',
	is_not_empty: 'Não está vazio',
}

const NO_VALUE_OPERATORS = new Set<FilterOperator>(['is_empty', 'is_not_empty', 'is_checked', 'is_unchecked'])

function matchesFilter(row: NoteRow, f: ActiveFilter): boolean {
	const noValue = NO_VALUE_OPERATORS.has(f.operator)
	if (!noValue && f.value === '') return true
	const raw = f.columnId === '_title' ? row._title : row[f.columnId]

	if (f.operator === 'is_empty') return raw === null || raw === undefined || String(raw ?? '').trim() === ''
	if (f.operator === 'is_not_empty') return raw !== null && raw !== undefined && String(raw ?? '').trim() !== ''
	if (f.operator === 'is_checked') return raw === true || raw === 'true'
	if (f.operator === 'is_unchecked') return raw !== true && raw !== 'true'

	if (f.columnType === 'number') {
		const n = parseFloat(String(raw ?? ''))
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
		const d = new Date(String(raw ?? '')).getTime()
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
		: String(raw ?? '').toLowerCase()
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

// ── Cabeçalho de coluna arrastável ───────────────────────────────────────────

function SortableTh({ id, size, children, stickyLeft, isLastPinned, isPinned, onTogglePin, sorted, onToggleSort }: {
	id: string
	size: number
	children: ReactNode
	stickyLeft?: number
	isLastPinned?: boolean
	isPinned?: boolean
	onTogglePin?: () => void
	sorted?: false | "asc" | "desc"
	onToggleSort?: () => void
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
						title={sorted === "asc" ? "Ordenar Z→A" : sorted === "desc" ? "Remover ordenação" : "Ordenar A→Z"}
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
						title={isPinned ? 'Desafixar colunas' : 'Fixar colunas até aqui'}
					>
						📌
					</button>
				)}
			</div>
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
					title="Remover filtro"
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

export function DatabaseTable({ dbFile, manager, externalView, onViewChange }: DatabaseTableProps) {
	const app = useApp()
	const [config, setConfig] = useState<DatabaseConfig>(DEFAULT_DATABASE_CONFIG)
	const [rows, setRows] = useState<NoteRow[]>([])
	const [sorting, setSorting] = useState<SortingState>([])
	const [globalFilter, setGlobalFilter] = useState('')
	const [editingCell, setEditingCell] = useState<{ rowIndex: number; columnId: string } | null>(null)
	const [loading, setLoading] = useState(true)
	const [relationOptions, setRelationOptions] = useState<Map<string, string[]>>(new Map())
	const [fieldsMenuOpen, setFieldsMenuOpen] = useState(false)
	const fieldsMenuRef = useRef<HTMLDivElement>(null)
	const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
	const [actionsMenuOpen, setActionsMenuOpen] = useState(false)
	const actionsMenuRef = useRef<HTMLDivElement>(null)
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

		const cfg = await manager.readConfig(dbFile)
		const notes = manager.getNotesInDatabase(dbFile)

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
					if (p.columnId === '_title') return [{ id: p.id ?? crypto.randomUUID(), columnId: '_title', columnName: 'Nome', columnType: 'title', icon: '📄', operator: p.operator, value: p.value }]
					const col = cfg.schema.find(sc => sc.id === p.columnId)
					if (!col) return []
					return [{ id: p.id ?? crypto.randomUUID(), columnId: col.id, columnName: col.name, columnType: col.type, icon: getColumnIconStatic(col.type), operator: p.operator, value: p.value }]
				})
				setActiveFilters(restored as ActiveFilter[])
			}
		}

		// Load relation options
		const relOpts = new Map<string, string[]>()
		for (const col of cfg.schema.filter(c => c.type === 'relation' && c.refDatabasePath && c.refColumnId)) {
			const refDbFile = app.vault.getFileByPath(col.refDatabasePath!)
			if (!refDbFile) continue
			const refConfig = await manager.readConfig(refDbFile)
			const refNotes = manager.getNotesInDatabase(refDbFile)
			const values = new Set<string>()
			for (const note of refNotes) {
				const row = manager.getNoteData(note, refConfig.schema)
				const val = col.refColumnId === '_title' ? row._title : row[col.refColumnId!]
				if (val !== null && val !== undefined) {
					const s = String(val).trim()
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
	}, [dbFile, manager, app])

	useEffect(() => { filtersInitialized.current = false }, [dbFile])

	useEffect(() => {
		loadData()
	}, [loadData])

	// Reagir a mudanças no vault (novo arquivo, renomeação, etc.)
	useEffect(() => {
		const onVaultChange = () => { loadData() }
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

	const handleChangeColumnType = useCallback(async (colId: string, newType: ColumnType): Promise<boolean> => {
		const col = config.schema.find(c => c.id === colId)
		if (!col) return true
		const error = validateTypeChange(rows, colId, col.type, newType)
		if (error) {
			new Notice(`Não é possível mudar o tipo: ${error}`, 6000)
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
						<span>Nome</span>
						<button
							className={`nb-sort-btn ${sorted ? 'nb-sort-btn--sorted' : ''}`}
							onClick={e => { e.stopPropagation(); column.toggleSorting(sorted === 'asc') }}
							title={sorted === 'asc' ? 'Ordenar Z→A' : sorted === 'desc' ? 'Remover ordenação' : 'Ordenar A→Z'}
						>
							<span className={sorted === 'asc' ? 'nb-sort-chevron--active' : 'nb-sort-chevron'}>⌃</span>
							<span className={sorted === 'desc' ? 'nb-sort-chevron--active' : 'nb-sort-chevron'}>⌄</span>
						</button>
					</div>
				)
			},
			cell: info => (
				<CellRenderer
					col={{ id: '_title', name: 'Nome', type: 'title', visible: true }}
					value={info.getValue<string>()}
					rowIndex={info.row.index}
					columnId="_title"
					file={info.row.original._file}
				/>
			),
		})

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
				enableSorting: col.type !== 'formula' && col.type !== 'lookup' && col.type !== 'relation',
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

	const filteredRows = useMemo(
		() => activeFilters.length === 0
			? rows
			: rows.filter(row => activeFilters.every(f => matchesFilter(row, f))),
		[rows, activeFilters]
	)

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
		setSorting([])
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

	// ── Ações em lote ────────────────────────────────────────────────────────

	const getSelectedFiles = useCallback(() => {
		return table.getSelectedRowModel().rows.map(r => r.original._file)
	}, [table])

	const handleDeleteSelected = useCallback(async () => {
		const files = getSelectedFiles()
		if (files.length === 0) return
		if (!window.confirm(`Apagar ${files.length} nota(s)? Esta ação não pode ser desfeita.`)) return
		await manager.deleteNotes(files)
		setRowSelection({})
		setActionsMenuOpen(false)
	}, [getSelectedFiles, manager])

	const handleMoveSelected = useCallback(() => {
		const files = getSelectedFiles()
		if (files.length === 0) return
		const modal = new FolderPickerModal(app, async folder => {
			await manager.moveNotes(files, folder.path)
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
		const pills = (filters as ActiveFilter[]).map(f => ({ id: f.id, columnId: f.columnId, operator: f.operator, value: f.value }))
		await saveView({ ...activeView, activePills: pills })
	}, [saveView, activeView])

	const handlePillDragEnd = (event: DragEndEvent) => {
		const { active, over } = event
		if (!over || active.id === over.id) return
		const oldIndex = activeFilters.findIndex(f => f.id === active.id)
		const newIndex = activeFilters.findIndex(f => f.id === over.id)
		const next = arrayMove(activeFilters, oldIndex, newIndex)
		setActiveFilters(next)
		saveActivePills(next)
	}

	const addFilter = (columnId: string, columnName: string, icon: string, columnType: string) => {
		const filterId = crypto.randomUUID()
		const next: ActiveFilter[] = [...activeFilters, { id: filterId, columnId, columnName, columnType, icon, operator: getDefaultOperator(columnType), value: '' }]
		setActiveFilters(next)
		saveActivePills(next)
		setFilterMenuOpen(false)
	}

	const removeFilter = (filterId: string) => {
		const next = activeFilters.filter(f => f.id !== filterId)
		setActiveFilters(next)
		saveActivePills(next)
		if (openFilterPill === filterId) setOpenFilterPill(null)
		if (openOperatorPicker === filterId) setOpenOperatorPicker(null)
	}

	const updateFilter = (filterId: string, operator: FilterOperator, value: string) => {
		const next = activeFilters.map(f =>
			f.id === filterId ? { ...f, operator, value } : f
		)
		setActiveFilters(next)
		saveActivePills(next)
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
			name: 'Novo campo',
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
				<p>Nenhum banco de dados aberto.</p>
				<p>Use o botão na ribbon ou o comando <strong>Criar novo banco de dados</strong>.</p>
			</div>
		)
	}

	if (loading) {
		return <div className="nb-loading">Carregando...</div>
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
						placeholder="Buscar..."
						value={globalFilter}
						onChange={e => { setGlobalFilter(e.target.value); if (shouldCollapse && searchExpanded) startSearchTimer() }}
						onKeyDown={e => { if (e.key === 'Enter' && shouldCollapse && searchExpanded) collapseSearch() }}
						onBlur={() => { if (shouldCollapse && searchExpanded) collapseSearch() }}
					/>
				</div>

				{/* Botão Campos */}
				<div className="nb-fields-menu-wrapper" ref={fieldsMenuRef}>
					<button
						className={`nb-toolbar-btn ${fieldsMenuOpen ? 'nb-toolbar-btn--active' : ''}`}
						onClick={() => setFieldsMenuOpen(v => !v)}
						title="Gerenciar campos"
					>
						Campos {config.schema.some(c => !c.visible) && (
							<span className="nb-hidden-badge">
								{config.schema.filter(c => !c.visible).length}
							</span>
						)}
					</button>

					{fieldsMenuOpen && (
						<div className="nb-fields-dropdown">
							<div className="nb-fields-dropdown-label">Campos</div>
							{config.schema.map(col => (
								<label key={col.id} className="nb-field-row">
									<input
										type="checkbox"
										className="nb-field-checkbox"
										checked={externalView
											? col.visible && !activeView.hiddenColumns.includes(col.id)
											: col.visible}
										onChange={() => toggleFieldVisibility(col.id)}
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
						title="Ações em lote"
					>
						Ações
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
								onClick={handleDeleteSelected}
								disabled={table.getSelectedRowModel().rows.length === 0}
							>
								<span className="nb-menu-item-icon">🗑</span>
								<span>Apagar todos selecionados</span>
							</button>
							<button
								className="nb-menu-item"
								onClick={handleMoveSelected}
								disabled={table.getSelectedRowModel().rows.length === 0}
							>
								<span className="nb-menu-item-icon">📁</span>
								<span>Mover todos selecionados</span>
							</button>
							<button
								className="nb-menu-item"
								onClick={handleDuplicateSelected}
								disabled={table.getSelectedRowModel().rows.length === 0}
							>
								<span className="nb-menu-item-icon">📋</span>
								<span>Duplicar todos selecionados</span>
							</button>
						</div>
					)}
				</div>

<span className="nb-row-count">
					{tableRows.length} {tableRows.length === 1 ? 'item' : 'itens'}
				</span>

				{/* Botão Filtros */}
				<div className="nb-fields-menu-wrapper" ref={filterMenuRef} style={{ marginLeft: 'auto' }}>
					<button
						className={`nb-toolbar-btn nb-toolbar-btn--icon ${filterMenuOpen ? 'nb-toolbar-btn--active' : ''}`}
						onClick={() => setFilterMenuOpen(v => !v)}
						title="Filtros"
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
							<div className="nb-fields-dropdown-label">Filtrar por</div>
							<button
								className="nb-menu-item"
								onClick={() => addFilter('_title', 'Nome', '📄', 'title')}
								
							>
								<span className="nb-menu-item-icon">📄</span>
								<span>Nome</span>
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
								<span>Adicionar filtro avançado</span>
							</button>
						</div>
					)}
				</div>
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
						{activeFilters.map(filter => (
							<SortablePill
								key={filter.id}
								filter={filter}
								isActive={openFilterPill === filter.id}
								onToggle={() => setOpenFilterPill(v => v === filter.id ? null : filter.id)}
								onRemove={() => removeFilter(filter.id)}
								btnRef={el => { filterPillRefs.current[filter.id] = el }}
							/>
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
							title="Remover filtro"
						>×</button>
					</div>
					{!NO_VALUE_OPERATORS.has(filter.operator) && (
						<input
							className="nb-filter-value-input"
							type={filter.columnType === 'number' ? 'number' : filter.columnType === 'date' ? 'date' : 'text'}
							placeholder={filter.columnType === 'number' ? 'Número...' : filter.columnType === 'date' ? '' : 'Valor...'}
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
			<CellContext.Provider value={{ editingCell, setEditingCell, updateCell, schema: config.schema, relationOptions }}>
			<div className="nb-table-wrapper">
				<table className="nb-table">
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
									onDragEnd={handleColumnDragEnd}
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
																	onClick={() => handleTogglePin('_title')}
																	title={pinnedColumnId === '_title' ? 'Desafixar colunas' : 'Fixar colunas até aqui'}
																>📌</button>
															</div>
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
														onTogglePin={() => handleTogglePin(header.id)}
					sorted={header.column.getCanSort() ? header.column.getIsSorted() : undefined}
					onToggleSort={header.column.getCanSort() ? () => header.column.toggleSorting(header.column.getIsSorted() === "asc") : undefined}
													>
														{flexRender(header.column.columnDef.header, header.getContext())}
													</SortableTh>
												)
											})}
											<th className="nb-th nb-th-add-col">
												<button className="nb-add-col-btn" onClick={handleAddColumn} title="Adicionar campo">
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
									Nenhum item encontrado
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
												{flexRender(cell.column.columnDef.cell, cell.getContext())}
											</td>
										)
									})}
									<td className="nb-td nb-td-empty" />
								</tr>
							))
						)}
						<tr>
							<td colSpan={columns.length + 1} className="nb-add-row-td">
								<button className="nb-add-row-btn" onClick={handleAddRow}>
									+ Nova linha
								</button>
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			</CellContext.Provider>
		</div>
	)
}
