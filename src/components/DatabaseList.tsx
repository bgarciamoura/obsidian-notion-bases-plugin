import { TFile } from 'obsidian'
import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../context'
import { DatabaseManager } from '../database-manager'
import {
	ColumnSchema, FilterOperator, NoteRow, SortConfig, ViewConfig,
} from '../types'
import {
	ActiveFilter, applyFilters, applySorts,
	getColumnIconStatic, getDefaultOperator,
	OPERATOR_LABELS, NO_VALUE_OPERATORS, getOperatorsForType,
} from './filter-utils'
import { t } from '../i18n'
import { useIsMobile } from '../hooks/useIsMobile'
import { useDatabaseRows } from '../hooks/useDatabaseRows'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { MobileToolbar, IconFields, IconSort, IconFilter, IconSubfolders } from './MobileToolbar'
import { Pagination } from './Pagination'
import { usePagination } from '../hooks/usePagination'
import { BottomSheet } from './BottomSheet'
import { findHierarchyColumn, buildHierarchyTree, HierarchyRow } from '../hierarchy-utils'

interface DatabaseListProps {
	dbFile: TFile | null
	manager: DatabaseManager
	externalView: ViewConfig
	onViewChange: (view: ViewConfig) => Promise<void>
}

// ── Sort Panel ──────────────────────────────────────────────────────────────

function ListSortPanel({ sorts, schema, onSortChange, onClose, anchorRect, panelRef }: {
	sorts: SortConfig[]
	schema: ColumnSchema[]
	onSortChange: (s: SortConfig[]) => void
	onClose: () => void
	anchorRect: DOMRect
	panelRef: React.RefObject<HTMLDivElement>
}) {
	const [pos, setPos] = useState({ x: anchorRect.right - 280, y: anchorRect.bottom + 4 })

	const handleDragStart = (e: React.MouseEvent) => {
		e.preventDefault()
		const sx = e.clientX - pos.x, sy = e.clientY - pos.y
		const onMove = (ev: MouseEvent) => setPos({ x: ev.clientX - sx, y: ev.clientY - sy })
		const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
		window.addEventListener('mousemove', onMove)
		window.addEventListener('mouseup', onUp)
	}

	const sortable = schema.filter(c => c.type !== 'formula' && c.type !== 'lookup' && c.type !== 'relation' && c.type !== 'multiselect')
	const used = new Set(sorts.map(s => s.columnId))
	const available = [
		...(!used.has('_title') ? [{ id: '_title', name: 'Nome' }] : []),
		...sortable.filter(c => !used.has(c.id)).map(c => ({ id: c.id, name: c.name })),
	]

	const move = (idx: number, dir: -1 | 1) => {
		const next = [...sorts]; const sw = idx + dir
		if (sw < 0 || sw >= next.length) return
		;[next[idx], next[sw]] = [next[sw], next[idx]]; onSortChange(next)
	}

	return createPortal(
		<div ref={panelRef} className="nb-sort-panel" style={{ position: 'fixed', top: pos.y, left: pos.x }}>
			<div className="nb-sort-panel-titlebar" onMouseDown={handleDragStart}>
				<span className="nb-sort-panel-title">{t('sort_by')}</span>
				<button className="nb-sort-panel-close" onClick={onClose} title={t('tooltip_close')}>×</button>
			</div>
			{sorts.length === 0 && <div className="nb-sort-panel-empty">{t('no_active_sorts')}</div>}
			{sorts.map((sort, idx) => {
				const name = sort.columnId === '_title' ? 'Nome' : (schema.find(c => c.id === sort.columnId)?.name ?? sort.columnId)
				return (
					<div key={sort.columnId} className="nb-sort-row">
						<div className="nb-sort-row-priority">
							<button className="nb-sort-priority-btn" onClick={() => move(idx, -1)} disabled={idx === 0} title={t('tooltip_move_up')}>↑</button>
							<button className="nb-sort-priority-btn" onClick={() => move(idx, 1)} disabled={idx === sorts.length - 1} title={t('tooltip_move_down')}>↓</button>
						</div>
						<span className="nb-sort-row-name">{name}</span>
						<button className="nb-sort-dir-btn" onClick={() => onSortChange(sorts.map(s => s.columnId === sort.columnId ? { ...s, direction: s.direction === 'asc' ? 'desc' : 'asc' } : s))}>
							{sort.direction === 'asc' ? t('sort_asc') : t('sort_desc')}
						</button>
						<button className="nb-sort-remove-btn" onClick={() => onSortChange(sorts.filter(s => s.columnId !== sort.columnId))} title={t('tooltip_remove')}>×</button>
					</div>
				)
			})}
			{available.length > 0 && (
				<div className="nb-sort-add-row">
					<select className="nb-sort-add-select" value="" onChange={e => { if (e.target.value) { onSortChange([...sorts, { columnId: e.target.value, direction: 'asc' }]); e.target.value = '' } }}>
						<option value="">{'+ ' + t('add_sort') + '...'}</option>
						{available.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
					</select>
				</div>
			)}
		</div>,
		document.body
	)
}

// ── Filter pill operator picker (inline) ────────────────────────────────────

function FilterPill({ filter, onUpdate, onRemove, onToggleConjunction, showConjunction }: {
	filter: ActiveFilter
	onUpdate: (operator: FilterOperator, value: string) => void
	onRemove: () => void
	onToggleConjunction: () => void
	showConjunction: boolean
}) {
	const ops = getOperatorsForType(filter.columnType)
	return (
		<Fragment>
			{showConjunction && (
				<button
					className={`nb-pill-conjunction${filter.conjunction === 'or' ? ' nb-pill-conjunction--or' : ''}`}
					onClick={onToggleConjunction}
				>
					{filter.conjunction === 'or' ? t('conjunction_or') : t('conjunction_and')}
				</button>
			)}
			<span className="nb-filter-pill">
				<span className="nb-pill-icon">{filter.icon}</span>
				<span className="nb-pill-name">{filter.columnName}</span>
				<select
					className="nb-pill-op-select"
					value={filter.operator}
					onChange={e => onUpdate(e.target.value as FilterOperator, filter.value)}
				>
					{ops.map(op => <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>)}
				</select>
				{!NO_VALUE_OPERATORS.has(filter.operator) && (
					<input
						className="nb-pill-value-input"
						type="text"
						value={filter.value}
						onChange={e => onUpdate(filter.operator, e.target.value)}
					/>
				)}
				<button className="nb-pill-remove" onClick={onRemove}>×</button>
			</span>
		</Fragment>
	)
}

// ── Main component ──────────────────────────────────────────────────────────

interface ListRowProps {
	row: NoteRow
	depth: number
	hasChildren: boolean
	isExpanded: boolean
	isHierarchical: boolean
	visibleCols: ColumnSchema[]
	dbFolderPath: string
	includeSubfolders: boolean
	onOpen: (file: TFile) => void
	onToggleExpand: (filePath: string) => void
	isMobile: boolean
	onLongPress: (file: TFile) => void
	onContextMenu: (file: TFile) => void
	longPressRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
}

const ListRow = React.memo(function ListRow({
	row, depth, hasChildren, isExpanded, isHierarchical, visibleCols,
	dbFolderPath, includeSubfolders, onOpen, onToggleExpand,
	isMobile, onLongPress, onContextMenu, longPressRef,
}: ListRowProps) {
	const fileFolder = row._file.parent?.path ?? ''
	const relPath = includeSubfolders && fileFolder.length > dbFolderPath.length
		? fileFolder.slice(dbFolderPath.length + 1) : ''

	return (
		<div
			className="nb-list-row"
			style={isHierarchical ? { paddingLeft: `${depth * 20 + 12}px` } : undefined}
			onClick={() => onOpen(row._file)}
			onContextMenu={!isMobile ? e => { e.preventDefault(); onContextMenu(row._file) } : undefined}
			onTouchStart={isMobile ? () => { longPressRef.current = setTimeout(() => onLongPress(row._file), 500) } : undefined}
			onTouchMove={isMobile ? () => { if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null } } : undefined}
			onTouchEnd={isMobile ? () => { if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null } } : undefined}
		>
			{hasChildren && (
				<button className="nb-hierarchy-toggle" onClick={e => { e.stopPropagation(); onToggleExpand(row._file.path) }}>
					{isExpanded ? '▼' : '▶'}
				</button>
			)}
			<span className="nb-list-row-icon">📄</span>
			<span className="nb-list-row-title">{row._title}</span>
			{relPath ? <span className="nb-folder-path" style={{ marginLeft: 4 }}>{relPath}</span> : null}
			{visibleCols.length > 0 && (
				<div className="nb-list-row-props">
					{visibleCols.map(col => {
						const val = row[col.id]
						if (val === null || val === undefined || String(val as string | number | boolean).trim() === '') return null
						const display = Array.isArray(val) ? (val as string[]).join(', ') : String(val as string | number | boolean)
						return (
							<span key={col.id} className="nb-list-prop">
								<span className="nb-list-prop-name">{col.name}:</span>
								<span className="nb-list-prop-value">{display}</span>
							</span>
						)
					})}
				</div>
			)}
		</div>
	)
})

export function DatabaseList({ dbFile, manager, externalView, onViewChange }: DatabaseListProps) {
	const app = useApp()
	const { rows, config, loading, activeFilters, setActiveFilters } = useDatabaseRows({
		app, dbFile, manager, includeSubfolders: externalView.includeSubfolders, externalView,
	})
	const [activeView, setActiveView] = useState<ViewConfig>(externalView)
	const [filterMenuOpen, setFilterMenuOpen] = useState(false)
	const [fieldsMenuOpen, setFieldsMenuOpen] = useState(false)
	const [sortPanelOpen, setSortPanelOpen] = useState(false)
	const [sortAnchorRect, setSortAnchorRect] = useState<DOMRect | null>(null)
	const filterMenuRef = useRef<HTMLDivElement>(null)
	const fieldsMenuRef = useRef<HTMLDivElement>(null)
	const sortPanelRef = useRef<HTMLDivElement>(null)
	const sortButtonRef = useRef<HTMLButtonElement>(null)
	const mobileActionBarRef = useRef<HTMLDivElement>(null)

	useEffect(() => { setActiveView(externalView) }, [externalView.id])

	const saveView = useCallback(async (updated: ViewConfig) => {
		setActiveView(updated)
		await onViewChange(updated)
	}, [onViewChange])

	// ── Close menus on outside click ─────────────────────────────────────────

	useEffect(() => {
		if (!filterMenuOpen) return
		const h = (e: MouseEvent) => {
			if (mobileActionBarRef.current?.contains(e.target as Node)) return
			if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) setFilterMenuOpen(false)
		}
		document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
	}, [filterMenuOpen])

	useEffect(() => {
		if (!fieldsMenuOpen) return
		const h = (e: MouseEvent) => {
			if (mobileActionBarRef.current?.contains(e.target as Node)) return
			if (fieldsMenuRef.current && !fieldsMenuRef.current.contains(e.target as Node)) setFieldsMenuOpen(false)
		}
		document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
	}, [fieldsMenuOpen])

	useEffect(() => {
		if (!sortPanelOpen) return
		const h = (e: MouseEvent) => {
			if (mobileActionBarRef.current?.contains(e.target as Node)) return
			if (sortButtonRef.current?.contains(e.target as Node)) return
			if (sortPanelRef.current && !sortPanelRef.current.contains(e.target as Node)) setSortPanelOpen(false)
		}
		document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
	}, [sortPanelOpen])

	// ── Filter actions ───────────────────────────────────────────────────────

	const saveActivePills = useCallback(async (filters: ActiveFilter[]) => {
		const pills = filters.map(f => ({ id: f.id, columnId: f.columnId, operator: f.operator, value: f.value, conjunction: f.conjunction }))
		await saveView({ ...activeView, activePills: pills })
	}, [saveView, activeView])

	const addFilter = (columnId: string, columnName: string, icon: string, columnType: string) => {
		const next: ActiveFilter[] = [...activeFilters, { id: crypto.randomUUID(), columnId, columnName, columnType, icon, operator: getDefaultOperator(columnType), value: '', conjunction: 'and' }]
		setActiveFilters(next); void saveActivePills(next); setFilterMenuOpen(false)
	}
	const removeFilter = (id: string) => { const next = activeFilters.filter(f => f.id !== id); setActiveFilters(next); void saveActivePills(next) }
	const updateFilter = (id: string, operator: FilterOperator, value: string) => { const next = activeFilters.map(f => f.id === id ? { ...f, operator, value } : f); setActiveFilters(next); void saveActivePills(next) }
	const toggleConjunction = (id: string) => { const next = activeFilters.map(f => f.id === id ? { ...f, conjunction: f.conjunction === 'and' ? 'or' as const : 'and' as const } : f); setActiveFilters(next); void saveActivePills(next) }

	const toggleFieldVisibility = useCallback(async (fieldId: string) => {
		const hidden = activeView.hiddenColumns.includes(fieldId)
			? activeView.hiddenColumns.filter(id => id !== fieldId)
			: [...activeView.hiddenColumns, fieldId]
		await saveView({ ...activeView, hiddenColumns: hidden })
	}, [activeView, saveView])

	const handleSortChange = useCallback(async (newSorts: SortConfig[]) => {
		await saveView({ ...activeView, sorts: newSorts })
	}, [activeView, saveView])

	const handleAddRow = async () => { if (dbFile) await manager.createNote(dbFile) }

	// ── Hierarchy state ───────────────────────────────────────────────────────

	const [hExpandedSet, setHExpandedSet] = useState<Set<string>>(new Set())
	const [hAllExpanded] = useState(true)

	const hierarchyCol = useMemo(
		() => findHierarchyColumn(config.schema, dbFile?.path ?? ''),
		[config.schema, dbFile?.path],
	)

	const toggleHExpand = useCallback((filePath: string) => {
		setHExpandedSet(prev => {
			const next = new Set(prev)
			if (next.has(filePath)) next.delete(filePath)
			else next.add(filePath)
			return next
		})
	}, [])

	// ── Derived data ─────────────────────────────────────────────────────────

	const debouncedFilters = useDebouncedValue(activeFilters, 200)
	const filteredRows = useMemo(() => applyFilters(rows, debouncedFilters), [rows, debouncedFilters])
	const displayRows = useMemo(() => applySorts(filteredRows, activeView.sorts), [filteredRows, activeView.sorts])

	const hierarchicalRows: HierarchyRow[] | null = useMemo(() => {
		if (!hierarchyCol) return null
		return buildHierarchyTree(displayRows, hierarchyCol.id, activeView.sorts, hExpandedSet, hAllExpanded)
	}, [displayRows, hierarchyCol, activeView.sorts, hExpandedSet, hAllExpanded])

	const { pageItems: pagedRows, currentPage, totalPages, setPage } = usePagination(displayRows, hierarchyCol ? 0 : manager.pageSize)

	const visibleCols = useMemo(() =>
		config.schema.filter(col => col.visible && !activeView.hiddenColumns.includes(col.id)),
		[config.schema, activeView.hiddenColumns]
	)

	// ── Render ───────────────────────────────────────────────────────────────

	const isMobile = useIsMobile()
	const dbFolderPath = dbFile?.parent?.path ?? ''
	const openFile = useCallback((file: TFile) => { void app.workspace.getLeaf().openFile(file) }, [app])
	const [contextMenuFile, setContextMenuFile] = useState<TFile | null>(null)
	const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const handleLongPress = useCallback((file: TFile) => { setContextMenuFile(file) }, [])
	const handleContextMenu = useCallback((file: TFile) => { setContextMenuFile(file) }, [])

	if (!dbFile) return <div className="nb-empty-state"><p>{t('no_database_open')}</p></div>
	if (loading) return <div className="nb-loading">{t('loading')}</div>

	const closeMobileMenus = (except?: string) => {
		if (except !== 'fields') setFieldsMenuOpen(false)
		if (except !== 'filter') setFilterMenuOpen(false)
		if (except !== 'sort') setSortPanelOpen(false)
	}

	const toolbarContent = isMobile ? (
		<MobileToolbar
			actionBarRef={mobileActionBarRef}
			actions={[
				{ id: 'fields', label: t('fields'), icon: <IconFields />, active: fieldsMenuOpen, onClick: () => { closeMobileMenus('fields'); setFieldsMenuOpen(v => !v) } },
				{ id: 'subfolders', label: t('tooltip_include_subfolders'), icon: <IconSubfolders />, active: !!activeView.includeSubfolders, onClick: () => { closeMobileMenus(); void saveView({ ...activeView, includeSubfolders: !activeView.includeSubfolders }) } },
				{ id: 'sort', label: t('sort'), icon: <IconSort />, active: activeView.sorts.length > 0, badge: activeView.sorts.length || undefined, onClick: () => { closeMobileMenus('sort'); if (!sortPanelOpen && sortButtonRef.current) setSortAnchorRect(sortButtonRef.current.getBoundingClientRect()); setSortPanelOpen(v => !v) } },
				{ id: 'filter', label: t('filter'), icon: <IconFilter />, active: filterMenuOpen, badge: activeFilters.length || undefined, onClick: () => { closeMobileMenus('filter'); setFilterMenuOpen(v => !v) } },
			]}
			rowCount={displayRows.length}
			rowCountLabel={displayRows.length === 1 ? t('item_singular').toLowerCase() : t('item_plural').toLowerCase()}
			filters={activeFilters}
			onFilterUpdate={updateFilter}
			onFilterRemove={removeFilter}
			onConjunctionToggle={toggleConjunction}
		>
			<BottomSheet open={fieldsMenuOpen} onClose={() => setFieldsMenuOpen(false)} title={t('fields')}>
				{config.schema.map(col => (
					<label key={col.id} className="nb-field-row">
						<input type="checkbox" className="nb-field-checkbox" checked={col.visible && !activeView.hiddenColumns.includes(col.id)} onChange={() => { void toggleFieldVisibility(col.id) }} />
						<span className="nb-field-icon">{getColumnIconStatic(col.type)}</span>
						<span className="nb-field-name">{col.name}</span>
					</label>
				))}
			</BottomSheet>
			<BottomSheet open={filterMenuOpen} onClose={() => setFilterMenuOpen(false)} title={t('filter')}>
				<button className="nb-menu-item" onClick={() => addFilter('_title', t('name_column'), '📄', 'title')}>
					<span className="nb-menu-item-icon">📄</span><span>{t('name_column')}</span>
				</button>
				{config.schema.map(col => (
					<button key={col.id} className="nb-menu-item" onClick={() => addFilter(col.id, col.name, getColumnIconStatic(col.type), col.type)}>
						<span className="nb-menu-item-icon">{getColumnIconStatic(col.type)}</span>
						<span>{col.name}</span>
					</button>
				))}
			</BottomSheet>
			<BottomSheet open={sortPanelOpen} onClose={() => setSortPanelOpen(false)} title={t('sort')}>
				{activeView.sorts.length === 0 && (
					<div className="nb-sort-panel-empty" style={{ padding: '8px 0' }}>{t('no_active_sorts')}</div>
				)}
				{activeView.sorts.map((sort, idx) => {
					const name = sort.columnId === '_title'
						? 'Nome'
						: (config.schema.find(c => c.id === sort.columnId)?.name ?? sort.columnId)
					return (
						<div key={sort.columnId} className="nb-sort-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', minHeight: '44px' }}>
							<div className="nb-sort-row-priority" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
								<button className="nb-sort-priority-btn" onClick={() => { const next = [...activeView.sorts]; if (idx > 0) { [next[idx], next[idx-1]] = [next[idx-1], next[idx]]; void handleSortChange(next) } }} disabled={idx === 0}>↑</button>
								<button className="nb-sort-priority-btn" onClick={() => { const next = [...activeView.sorts]; if (idx < next.length - 1) { [next[idx], next[idx+1]] = [next[idx+1], next[idx]]; void handleSortChange(next) } }} disabled={idx === activeView.sorts.length - 1}>↓</button>
							</div>
							<span style={{ flex: 1 }}>{name}</span>
							<button className="nb-sort-dir-btn" onClick={() => { void handleSortChange(activeView.sorts.map(s => s.columnId === sort.columnId ? { ...s, direction: s.direction === 'asc' ? 'desc' : 'asc' } : s)) }}>
								{sort.direction === 'asc' ? t('sort_asc') : t('sort_desc')}
							</button>
							<button className="nb-sort-remove-btn" onClick={() => { void handleSortChange(activeView.sorts.filter(s => s.columnId !== sort.columnId)) }}>×</button>
						</div>
					)
				})}
				{(() => {
					const sortableSchema = config.schema.filter(c => c.type !== 'formula' && c.type !== 'lookup' && c.type !== 'relation' && c.type !== 'multiselect')
					const usedIds = new Set(activeView.sorts.map(s => s.columnId))
					const available = [
						...(!usedIds.has('_title') ? [{ id: '_title', name: 'Nome' }] : []),
						...sortableSchema.filter(c => !usedIds.has(c.id)).map(c => ({ id: c.id, name: c.name })),
					]
					if (available.length === 0) return null
					return (
						<select
							className="nb-mobile-filter-overlay-select"
							style={{ width: '100%', marginTop: '8px', padding: '10px' }}
							value=""
							onChange={e => { if (e.target.value) { void handleSortChange([...activeView.sorts, { columnId: e.target.value, direction: 'asc' }]); e.target.value = '' } }}
						>
							<option value="">{'+ ' + t('add_sort') + '...'}</option>
							{available.map(c => (
								<option key={c.id} value={c.id}>{c.name}</option>
							))}
						</select>
					)
				})()}
			</BottomSheet>
		</MobileToolbar>
	) : (
		<>
			{/* Desktop Toolbar */}
			<div className="nb-toolbar">
				<div className="nb-fields-menu-wrapper" ref={fieldsMenuRef}>
					<button className={`nb-toolbar-btn ${fieldsMenuOpen ? 'nb-toolbar-btn--active' : ''}`} onClick={() => setFieldsMenuOpen(v => !v)}>
						{t('fields')}
					</button>
					{fieldsMenuOpen && (
						<div className="nb-fields-dropdown">
							<div className="nb-fields-dropdown-label">{t('fields_label')}</div>
							{config.schema.map(col => (
								<label key={col.id} className="nb-field-row">
									<input type="checkbox" className="nb-field-checkbox" checked={col.visible && !activeView.hiddenColumns.includes(col.id)} onChange={() => { void toggleFieldVisibility(col.id) }} />
									<span className="nb-field-icon">{getColumnIconStatic(col.type)}</span>
									<span className="nb-field-name">{col.name}</span>
								</label>
							))}
						</div>
					)}
				</div>
				<button
					className={`nb-toolbar-btn nb-toolbar-btn--icon nb-subfolder-toggle ${activeView.includeSubfolders ? 'nb-toolbar-btn--active' : ''}`}
					onClick={() => { void saveView({ ...activeView, includeSubfolders: !activeView.includeSubfolders }) }}
					title={t('tooltip_include_subfolders')}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
						<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
						<line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
					</svg>
				</button>
				<span className="nb-row-count">{displayRows.length} {displayRows.length === 1 ? t('item_singular').toLowerCase() : t('item_plural').toLowerCase()}</span>
				<div className="nb-fields-menu-wrapper" ref={filterMenuRef} style={{ marginLeft: 'auto' }}>
					<button className={`nb-toolbar-btn nb-toolbar-btn--icon ${filterMenuOpen ? 'nb-toolbar-btn--active' : ''}`} onClick={() => setFilterMenuOpen(v => !v)} title={t('filters')}>
						<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
						</svg>
						{activeFilters.length > 0 && <span className="nb-hidden-badge">{activeFilters.length}</span>}
					</button>
					{filterMenuOpen && (
						<div className="nb-fields-dropdown nb-filter-menu-dropdown">
							<div className="nb-fields-dropdown-label">{t('filter_by')}</div>
							<button className="nb-menu-item" onClick={() => addFilter('_title', t('name_column'), '📄', 'title')}>
								<span className="nb-menu-item-icon">📄</span><span>{t('name_column')}</span>
							</button>
							{config.schema.map(col => (
								<button key={col.id} className="nb-menu-item" onClick={() => addFilter(col.id, col.name, getColumnIconStatic(col.type), col.type)}>
									<span className="nb-menu-item-icon">{getColumnIconStatic(col.type)}</span>
									<span>{col.name}</span>
								</button>
							))}
						</div>
					)}
				</div>
				<button ref={sortButtonRef} className={`nb-toolbar-btn${activeView.sorts.length > 0 ? ' nb-toolbar-btn--active' : ''}`}
					onClick={() => { if (!sortPanelOpen && sortButtonRef.current) setSortAnchorRect(sortButtonRef.current.getBoundingClientRect()); setSortPanelOpen(v => !v) }}>
					<span>{t('sort')}</span>
					{activeView.sorts.length > 0 && <span className="nb-hidden-badge">{activeView.sorts.length}</span>}
				</button>
				{sortPanelOpen && sortAnchorRect && (
					<ListSortPanel sorts={activeView.sorts} schema={config.schema} onSortChange={s => { void handleSortChange(s) }} onClose={() => setSortPanelOpen(false)} anchorRect={sortAnchorRect} panelRef={sortPanelRef} />
				)}
			</div>
			{activeFilters.length > 0 && (
				<div className="nb-filter-pills-row">
					{activeFilters.map((f, idx) => (
						<FilterPill key={f.id} filter={f} showConjunction={idx > 0} onUpdate={(op, val) => updateFilter(f.id, op, val)} onRemove={() => removeFilter(f.id)} onToggleConjunction={() => toggleConjunction(f.id)} />
					))}
				</div>
			)}
		</>
	)

	return (
		<div className="nb-container">
			{toolbarContent}

			{/* List */}
			<div className="nb-list">
				{(hierarchicalRows ?? pagedRows.map(r => ({ row: r, depth: 0, hasChildren: false, parentTitle: null }))).map(({ row, depth, hasChildren }) => {
					const isExp = hAllExpanded ? !hExpandedSet.has(row._file.path) : hExpandedSet.has(row._file.path)
					return (
						<ListRow
							key={row._file.path}
							row={row}
							depth={depth}
							hasChildren={hasChildren}
							isExpanded={isExp}
							isHierarchical={hierarchicalRows !== null}
							visibleCols={visibleCols}
							dbFolderPath={dbFolderPath}
							includeSubfolders={activeView.includeSubfolders ?? false}
							onOpen={openFile}
							onToggleExpand={toggleHExpand}
							isMobile={isMobile}
							onLongPress={handleLongPress}
							onContextMenu={handleContextMenu}
							longPressRef={longPressRef}
						/>
					)
				})}
				<button className="nb-add-row nb-list-add-row" onClick={() => { void handleAddRow() }}>
					{'+ ' + t('add_entry')}
				</button>
			</div>
			<Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />

			{/* Context menu (long-press mobile / right-click desktop) */}
			<BottomSheet open={contextMenuFile !== null} onClose={() => setContextMenuFile(null)} title={contextMenuFile?.basename ?? ''}>
				<button className="nb-menu-item" onClick={() => { if (contextMenuFile) { void app.workspace.getLeaf().openFile(contextMenuFile) } setContextMenuFile(null) }}>
					<span className="nb-menu-item-icon">📄</span><span>{t('open_note')}</span>
				</button>
				<button className="nb-menu-item" onClick={() => { if (contextMenuFile) { void manager.duplicateNotes([contextMenuFile]) } setContextMenuFile(null) }}>
					<span className="nb-menu-item-icon">📋</span><span>{t('duplicate_note')}</span>
				</button>
				<div className="nb-menu-separator" />
				<button className="nb-menu-item nb-menu-item--danger" onClick={() => { if (contextMenuFile) { void manager.deleteNotes([contextMenuFile]) } setContextMenuFile(null) }}>
					<span className="nb-menu-item-icon">🗑</span><span>{t('delete_note')}</span>
				</button>
			</BottomSheet>
		</div>
	)
}
