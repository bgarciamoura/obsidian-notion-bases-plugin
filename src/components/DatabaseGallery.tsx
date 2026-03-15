import { TFile } from 'obsidian'
import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../context'
import { DatabaseManager } from '../database-manager'
import {
	ColumnSchema, DatabaseConfig, DEFAULT_DATABASE_CONFIG,
	FilterOperator, NoteRow, SortConfig, ViewConfig,
} from '../types'
import { evaluateFormulas } from '../formula-engine'
import {
	ActiveFilter, applyFilters, applySorts,
	getColumnIconStatic, getDefaultOperator,
	OPERATOR_LABELS, NO_VALUE_OPERATORS, getOperatorsForType,
} from './filter-utils'
import { t } from '../i18n'

interface DatabaseGalleryProps {
	dbFile: TFile | null
	manager: DatabaseManager
	externalView: ViewConfig
	onViewChange: (view: ViewConfig) => Promise<void>
}

const CARD_SIZE_LABELS = (): Record<string, string> => ({ small: t('size_small'), medium: t('size_medium'), large: t('size_large') })
const CARD_SIZE_COLS: Record<string, string> = { small: 'repeat(auto-fill, minmax(160px, 1fr))', medium: 'repeat(auto-fill, minmax(220px, 1fr))', large: 'repeat(auto-fill, minmax(300px, 1fr))' }

// ── Sort Panel ──────────────────────────────────────────────────────────────

function GallerySortPanel({ sorts, schema, onSortChange, onClose, anchorRect, panelRef }: {
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

// ── Main component ──────────────────────────────────────────────────────────

export function DatabaseGallery({ dbFile, manager, externalView, onViewChange }: DatabaseGalleryProps) {
	const app = useApp()
	const [rows, setRows] = useState<NoteRow[]>([])
	const [config, setConfig] = useState<DatabaseConfig>(DEFAULT_DATABASE_CONFIG)
	const [loading, setLoading] = useState(true)
	const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([])
	const [activeView, setActiveView] = useState<ViewConfig>(externalView)
	const [filterMenuOpen, setFilterMenuOpen] = useState(false)
	const [fieldsMenuOpen, setFieldsMenuOpen] = useState(false)
	const [coverMenuOpen, setCoverMenuOpen] = useState(false)
	const [sizeMenuOpen, setSizeMenuOpen] = useState(false)
	const [sortPanelOpen, setSortPanelOpen] = useState(false)
	const [sortAnchorRect, setSortAnchorRect] = useState<DOMRect | null>(null)

	const filterMenuRef = useRef<HTMLDivElement>(null)
	const fieldsMenuRef = useRef<HTMLDivElement>(null)
	const coverMenuRef = useRef<HTMLDivElement>(null)
	const sizeMenuRef = useRef<HTMLDivElement>(null)
	const sortPanelRef = useRef<HTMLDivElement>(null)
	const sortButtonRef = useRef<HTMLButtonElement>(null)
	const filtersInitialized = useRef(false)

	useEffect(() => { setActiveView(externalView) }, [externalView.id])

	const saveView = useCallback(async (updated: ViewConfig) => {
		setActiveView(updated)
		await onViewChange(updated)
	}, [onViewChange])

	// ── Data loading ────────────────────────────────────────────────────────

	const loadData = useCallback(async () => {
		if (!dbFile) { setLoading(false); return }
		setLoading(true)
		const cfg = await manager.readConfig(dbFile)
		const notes = manager.getNotesInDatabase(dbFile)
		if (cfg.schema.length === 0 && notes.length > 0) {
			cfg.schema = manager.inferSchema(notes)
			await manager.writeConfig(dbFile, cfg)
		}
		const noteRows = await manager.resolveLookupsForRows(
			evaluateFormulas(notes.map(f => manager.getNoteData(f, cfg.schema)), cfg.schema),
			cfg.schema
		)
		if (!filtersInitialized.current) {
			filtersInitialized.current = true
			const pills = externalView.activePills ?? []
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
		setConfig(cfg)
		setRows(noteRows)
		setLoading(false)
	}, [dbFile, manager])

	useEffect(() => { filtersInitialized.current = false }, [dbFile])
	useEffect(() => { void loadData() }, [loadData])
	useEffect(() => {
		const onChange = () => loadData()
		app.vault.on('create', onChange)
		app.vault.on('delete', onChange)
		app.vault.on('rename', onChange)
		app.metadataCache.on('changed', onChange)
		return () => {
			app.vault.off('create', onChange)
			app.vault.off('delete', onChange)
			app.vault.off('rename', onChange)
			app.metadataCache.off('changed', onChange)
		}
	}, [app, loadData])

	// ── Close menus on outside click ─────────────────────────────────────────

	useEffect(() => {
		if (!filterMenuOpen) return
		const h = (e: MouseEvent) => { if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) setFilterMenuOpen(false) }
		document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
	}, [filterMenuOpen])

	useEffect(() => {
		if (!fieldsMenuOpen) return
		const h = (e: MouseEvent) => { if (fieldsMenuRef.current && !fieldsMenuRef.current.contains(e.target as Node)) setFieldsMenuOpen(false) }
		document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
	}, [fieldsMenuOpen])

	useEffect(() => {
		if (!coverMenuOpen) return
		const h = (e: MouseEvent) => { if (coverMenuRef.current && !coverMenuRef.current.contains(e.target as Node)) setCoverMenuOpen(false) }
		document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
	}, [coverMenuOpen])

	useEffect(() => {
		if (!sizeMenuOpen) return
		const h = (e: MouseEvent) => { if (sizeMenuRef.current && !sizeMenuRef.current.contains(e.target as Node)) setSizeMenuOpen(false) }
		document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
	}, [sizeMenuOpen])

	useEffect(() => {
		if (!sortPanelOpen) return
		const h = (e: MouseEvent) => {
			if (sortButtonRef.current?.contains(e.target as Node)) return
			if (sortPanelRef.current && !sortPanelRef.current.contains(e.target as Node)) setSortPanelOpen(false)
		}
		document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
	}, [sortPanelOpen])

	// ── Derived data ─────────────────────────────────────────────────────────

	const filteredRows = useMemo(() => applyFilters(rows, activeFilters), [rows, activeFilters])
	const displayRows = useMemo(() => applySorts(filteredRows, activeView.sorts), [filteredRows, activeView.sorts])

	const visibleCols = useMemo(
		() => config.schema.filter(col => col.visible && !activeView.hiddenColumns.includes(col.id)),
		[config.schema, activeView.hiddenColumns]
	)

	const coverField = useMemo(
		() => config.schema.find(c => c.id === activeView.galleryCoverField) ?? null,
		[config.schema, activeView.galleryCoverField]
	)

	const cardSize = activeView.galleryCardSize ?? 'medium'
	const gridTemplate = CARD_SIZE_COLS[cardSize]

	// ── Actions ───────────────────────────────────────────────────────────────

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

	// ── Render ───────────────────────────────────────────────────────────────

	if (!dbFile) return <div className="nb-empty-state"><p>{t('no_database_open')}</p></div>
	if (loading) return <div className="nb-loading">{t('loading')}</div>

	return (
		<div className="nb-container">
			{/* Toolbar */}
			<div className="nb-toolbar">
				{/* Campos */}
				<div className="nb-fields-menu-wrapper" ref={fieldsMenuRef}>
					<button className={`nb-toolbar-btn${fieldsMenuOpen ? ' nb-toolbar-btn--active' : ''}`} onClick={() => setFieldsMenuOpen(v => !v)}>
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

				{/* Capa */}
				<div className="nb-fields-menu-wrapper" ref={coverMenuRef}>
					<button className={`nb-toolbar-btn${coverMenuOpen ? ' nb-toolbar-btn--active' : ''}`} onClick={() => setCoverMenuOpen(v => !v)}>
						{t('cover')}: <strong>{coverField?.name ?? t('no_cover')}</strong>
					</button>
					{coverMenuOpen && (
						<div className="nb-fields-dropdown">
							<div className="nb-fields-dropdown-label">{t('cover_field_label')}</div>
							<button
								className={`nb-menu-item${!activeView.galleryCoverField ? ' nb-menu-item--active' : ''}`}
								onClick={() => { void saveView({ ...activeView, galleryCoverField: undefined }); setCoverMenuOpen(false) }}
							>
								<span className="nb-menu-item-icon">—</span>
								<span>{t('no_cover')}</span>
							</button>
							{config.schema.filter(c => c.type === 'text' || c.type === 'title' || c.type === 'image').map(col => (
								<button
									key={col.id}
									className={`nb-menu-item${activeView.galleryCoverField === col.id ? ' nb-menu-item--active' : ''}`}
									onClick={() => { void saveView({ ...activeView, galleryCoverField: col.id }); setCoverMenuOpen(false) }}
								>
									<span className="nb-menu-item-icon">{getColumnIconStatic(col.type)}</span>
									<span>{col.name}</span>
								</button>
							))}
						</div>
					)}
				</div>

				{/* Tamanho */}
				<div className="nb-fields-menu-wrapper" ref={sizeMenuRef}>
					<button className={`nb-toolbar-btn${sizeMenuOpen ? ' nb-toolbar-btn--active' : ''}`} onClick={() => setSizeMenuOpen(v => !v)}>
						{CARD_SIZE_LABELS()[cardSize]}
					</button>
					{sizeMenuOpen && (
						<div className="nb-fields-dropdown">
							<div className="nb-fields-dropdown-label">{t('card_size_label')}</div>
							{(['small', 'medium', 'large'] as const).map(size => (
								<button
									key={size}
									className={`nb-menu-item${cardSize === size ? ' nb-menu-item--active' : ''}`}
									onClick={() => { void saveView({ ...activeView, galleryCardSize: size }); setSizeMenuOpen(false) }}
								>
									{CARD_SIZE_LABELS()[size]}
								</button>
							))}
						</div>
					)}
				</div>

				{/* Row count */}
				<span className="nb-row-count">
					{displayRows.length} {displayRows.length === 1 ? t('item_singular').toLowerCase() : t('item_plural').toLowerCase()}
				</span>

				{/* Filtros */}
				<div className="nb-fields-menu-wrapper" ref={filterMenuRef} style={{ marginLeft: 'auto' }}>
					<button className={`nb-toolbar-btn nb-toolbar-btn--icon${filterMenuOpen ? ' nb-toolbar-btn--active' : ''}`} onClick={() => setFilterMenuOpen(v => !v)} title={t('filters')}>
						<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
						</svg>
						{activeFilters.length > 0 && <span className="nb-hidden-badge">{activeFilters.length}</span>}
					</button>
					{filterMenuOpen && (
						<div className="nb-fields-dropdown nb-filter-menu-dropdown">
							<div className="nb-fields-dropdown-label">{t('filter_by')}</div>
							<button className="nb-menu-item" onClick={() => addFilter('_title', 'Nome', '📄', 'title')}>
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

				{/* Ordenar */}
				<button
					ref={sortButtonRef}
					className={`nb-toolbar-btn${activeView.sorts.length > 0 ? ' nb-toolbar-btn--active' : ''}`}
					onClick={() => {
						if (!sortPanelOpen && sortButtonRef.current) setSortAnchorRect(sortButtonRef.current.getBoundingClientRect())
						setSortPanelOpen(v => !v)
					}}
				>
					<span>{t('sort')}</span>
					{activeView.sorts.length > 0 && <span className="nb-hidden-badge">{activeView.sorts.length}</span>}
				</button>
				{sortPanelOpen && sortAnchorRect && (
					<GallerySortPanel
						sorts={activeView.sorts}
						schema={config.schema}
						onSortChange={s => { void handleSortChange(s) }}
						onClose={() => setSortPanelOpen(false)}
						anchorRect={sortAnchorRect}
						panelRef={sortPanelRef}
					/>
				)}
			</div>

			{/* Filter pills */}
			{activeFilters.length > 0 && (
				<div className="nb-filter-pills-row">
					{activeFilters.map((f, idx) => (
						<Fragment key={f.id}>
							{idx > 0 && (
								<button className={`nb-pill-conjunction${f.conjunction === 'or' ? ' nb-pill-conjunction--or' : ''}`} onClick={() => toggleConjunction(f.id)}>
									{f.conjunction === 'or' ? t('conjunction_or') : t('conjunction_and')}
								</button>
							)}
							<span className="nb-filter-pill">
								<span className="nb-pill-icon">{f.icon}</span>
								<span className="nb-pill-name">{f.columnName}</span>
								<select className="nb-pill-op-select" value={f.operator} onChange={e => updateFilter(f.id, e.target.value as FilterOperator, f.value)}>
									{getOperatorsForType(f.columnType).map(op => <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>)}
								</select>
								{!NO_VALUE_OPERATORS.has(f.operator) && (
									<input className="nb-pill-value-input" type="text" value={f.value} onChange={e => updateFilter(f.id, f.operator, e.target.value)} />
								)}
								<button className="nb-pill-remove" onClick={() => removeFilter(f.id)}>×</button>
							</span>
						</Fragment>
					))}
				</div>
			)}

			{/* Gallery grid */}
			<div className="nb-gallery" style={{ gridTemplateColumns: gridTemplate }}>
				{displayRows.map(row => {
					const coverImagePath = coverField?.type === 'image' ? ((row as Record<string, unknown>)[coverField.id] as string | null) ?? null : null
					const coverImageFile = coverImagePath ? app.vault.getFileByPath(coverImagePath) : null
					const coverImageUrl = coverImageFile ? app.vault.getResourcePath(coverImageFile) : null
					const coverTextValue = coverField && coverField.type !== 'image'
						? (coverField.type === 'title' ? row._title : String(((row as Record<string, unknown>)[coverField.id] as string | number | boolean | null | undefined) ?? ''))
						: null

					return (
						<div
							key={row._file.path}
							className={`nb-gallery-card nb-gallery-card--${cardSize}`}
							onClick={() => { void app.workspace.getLeaf().openFile(row._file) }}
						>
							{/* Cover */}
							{coverImageUrl ? (
								<div className="nb-gallery-cover nb-gallery-cover--image">
									<img src={coverImageUrl} alt="" />
								</div>
							) : coverTextValue ? (
								<div className="nb-gallery-cover nb-gallery-cover--text">
									<span>{coverTextValue}</span>
								</div>
							) : (
								<div className="nb-gallery-cover nb-gallery-cover--empty">
									<span className="nb-gallery-cover-icon">📄</span>
								</div>
							)}

							{/* Body */}
							<div className="nb-gallery-body">
								<div className="nb-gallery-title">{row._title}</div>
								{visibleCols.length > 0 && (
									<div className="nb-gallery-props">
										{visibleCols.map(col => {
											const val = row[col.id]
											if (val === null || val === undefined || String(val as string | number | boolean).trim() === '') return null
											const display = Array.isArray(val) ? (val as string[]).join(', ') : String(val as string | number | boolean)
											return (
												<span key={col.id} className="nb-gallery-prop">
													<span className="nb-gallery-prop-name">{col.name}:</span>
													<span className="nb-gallery-prop-value">{display}</span>
												</span>
											)
										})}
									</div>
								)}
							</div>
						</div>
					)
				})}

				{/* Add card */}
				<div className="nb-gallery-card nb-gallery-card--add" onClick={() => { void handleAddRow() }}>
					<div className="nb-gallery-add-inner">{'+ ' + t('add_entry')}</div>
				</div>
			</div>
		</div>
	)
}
