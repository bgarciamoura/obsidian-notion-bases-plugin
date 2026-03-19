import { TFile } from 'obsidian'
import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../context'
import { DatabaseManager } from '../database-manager'
import {
	DatabaseConfig, DEFAULT_DATABASE_CONFIG,
	FilterOperator, NoteRow, SelectOption, ViewConfig,
} from '../types'
import { evaluateFormulas } from '../formula-engine'
import {
	ActiveFilter, applyFilters, applySorts,
	getColumnIconStatic, getDefaultOperator,
	OPERATOR_LABELS, NO_VALUE_OPERATORS, getOperatorsForType,
} from './filter-utils'
import { t } from '../i18n'
import { useIsMobile } from '../hooks/useIsMobile'
import { MobileToolbar, IconFields, IconSort, IconFilter, IconSubfolders } from './MobileToolbar'
import { BottomSheet } from './BottomSheet'

interface DatabaseBoardProps {
	dbFile: TFile | null
	manager: DatabaseManager
	externalView: ViewConfig
	onViewChange: (view: ViewConfig) => Promise<void>
}

const DRAG_TYPE_CARD = 'nb-card'
const DRAG_TYPE_COLUMN = 'nb-column'

export function DatabaseBoard({ dbFile, manager, externalView, onViewChange }: DatabaseBoardProps) {
	const app = useApp()
	const [rows, setRows] = useState<NoteRow[]>([])
	const [config, setConfig] = useState<DatabaseConfig>(DEFAULT_DATABASE_CONFIG)
	const [loading, setLoading] = useState(true)
	const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([])
	const [activeView, setActiveView] = useState<ViewConfig>(externalView)
	const [hideEmpty, setHideEmpty] = useState(false)
	const [hideNoValue, setHideNoValue] = useState(false)
	const [editingLimit, setEditingLimit] = useState<string | null>(null)
	const [expandedColumns, setExpandedColumns] = useState<Set<string>>(new Set())
	const [fieldsMenuOpen, setFieldsMenuOpen] = useState(false)
	const [groupByMenuOpen, setGroupByMenuOpen] = useState(false)
	const [filterMenuOpen, setFilterMenuOpen] = useState(false)
	// card drag
	const [cardDragOver, setCardDragOver] = useState<string | null>(null)
	// column drag
	const [colDragOver, setColDragOver] = useState<string | null>(null)
	// touch drag state

	const fieldsMenuRef = useRef<HTMLDivElement>(null)
	const groupByMenuRef = useRef<HTMLDivElement>(null)
	const filterMenuRef = useRef<HTMLDivElement>(null)
	const mobileActionBarRef = useRef<HTMLDivElement>(null)
	const filtersInitialized = useRef(false)
	const loadVersion = useRef(0)

	useEffect(() => { setActiveView(externalView) }, [externalView.id])

	const saveView = useCallback(async (updated: ViewConfig) => {
		setActiveView(updated)
		await onViewChange(updated)
	}, [onViewChange])

	// ── Data loading ────────────────────────────────────────────────────────

	const loadData = useCallback(async () => {
		if (!dbFile) { setLoading(false); return }
		setLoading(true)
		const version = ++loadVersion.current
		const cfg = manager.readConfig(dbFile)
		const notes = manager.getNotesInDatabase(dbFile, activeView.includeSubfolders)
		if (cfg.schema.length === 0 && notes.length > 0) {
			cfg.schema = manager.inferSchema(notes)
			await manager.writeConfig(dbFile, cfg)
		}
		const noteRows = manager.resolveLookupsForRows(
			evaluateFormulas(notes.map(f => manager.getNoteData(f, cfg.schema)), cfg.schema),
			cfg.schema
		)
		if (loadVersion.current !== version) return
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
		setConfig(prev => ({ schema: cfg.schema, views: prev.views }))
		setRows(noteRows)
		setLoading(false)
	}, [dbFile, manager, activeView.includeSubfolders])

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
		if (!fieldsMenuOpen) return
		const h = (e: MouseEvent) => {
			if (mobileActionBarRef.current?.contains(e.target as Node)) return
			if (fieldsMenuRef.current && !fieldsMenuRef.current.contains(e.target as Node)) setFieldsMenuOpen(false)
		}
		document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
	}, [fieldsMenuOpen])

	useEffect(() => {
		if (!groupByMenuOpen) return
		const h = (e: MouseEvent) => {
			if (mobileActionBarRef.current?.contains(e.target as Node)) return
			if (groupByMenuRef.current && !groupByMenuRef.current.contains(e.target as Node)) setGroupByMenuOpen(false)
		}
		document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
	}, [groupByMenuOpen])

	useEffect(() => {
		if (!filterMenuOpen) return
		const h = (e: MouseEvent) => {
			if (mobileActionBarRef.current?.contains(e.target as Node)) return
			if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) setFilterMenuOpen(false)
		}
		document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
	}, [filterMenuOpen])

	// ── Groupable columns ─────────────────────────────────────────────────────

	const groupableColumns = useMemo(
		() => config.schema.filter(c => c.type === 'select' || c.type === 'status'),
		[config.schema]
	)

	const groupByCol = useMemo(
		() => config.schema.find(c => c.id === activeView.groupByColumnId) ?? groupableColumns[0] ?? null,
		[config.schema, activeView.groupByColumnId, groupableColumns]
	)

	// ── Derived data ─────────────────────────────────────────────────────────

	const filteredRows = useMemo(() => applyFilters(rows, activeFilters), [rows, activeFilters])
	const sortedRows = useMemo(() => applySorts(filteredRows, activeView.sorts), [filteredRows, activeView.sorts])

	const visibleCols = useMemo(
		() => config.schema.filter(col =>
			col.id !== groupByCol?.id &&
			col.type !== 'title' &&
			col.visible &&
			!activeView.hiddenColumns.includes(col.id)
		),
		[config.schema, activeView.hiddenColumns, groupByCol]
	)

	const DEFAULT_STATUS_OPTIONS: SelectOption[] = [
		{ value: t('status_not_started'), color: '#9E9E9E' },
		{ value: t('status_in_progress'), color: '#2196F3' },
		{ value: t('status_done'), color: '#4CAF50' },
		{ value: t('status_cancelled'), color: '#F44336' },
	]

	const columns = useMemo(() => {
		if (!groupByCol) return []
		const options = (groupByCol.type === 'status' && !groupByCol.options?.length)
			? DEFAULT_STATUS_OPTIONS
			: (groupByCol.options ?? [])
		const all = [
			...options.map(opt => ({
				value: opt.value,
				label: opt.value,
				color: opt.color,
				rows: sortedRows.filter(r => r[groupByCol.id] === opt.value),
			})),
			{
				value: '',
				label: t('no_value'),
				color: undefined,
				rows: sortedRows.filter(r => {
					const v = r[groupByCol.id]
					return v === null || v === undefined || String(v as string | number | boolean).trim() === ''
				}),
			},
		]
		// Apply saved column order
		const order = activeView.boardColumnOrder
		let ordered = all
		if (order && order.length > 0) {
			const inOrder = order.flatMap(v => { const c = all.find(x => x.value === v); return c ? [c] : [] })
			const rest = all.filter(x => !order.includes(x.value))
			ordered = [...inOrder, ...rest]
		}
		let result = hideEmpty ? ordered.filter(c => c.rows.length > 0) : ordered
		if (hideNoValue) result = result.filter(c => c.value !== '')
		return result
	}, [groupByCol, sortedRows, hideEmpty, hideNoValue, activeView.boardColumnOrder])

	// ── Actions ───────────────────────────────────────────────────────────────

	const moveCard = useCallback(async (rowPath: string, targetValue: string) => {
		if (!dbFile || !groupByCol) return
		const file = app.vault.getFileByPath(rowPath)
		if (!file) return
		await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			if (targetValue === '') {
				delete fm[groupByCol.id]
			} else {
				fm[groupByCol.id] = targetValue
			}
		})
	}, [app, dbFile, groupByCol])

	const moveColumn = useCallback(async (fromValue: string, toValue: string) => {
		if (fromValue === toValue) return
		const currentOrder = columns.map(c => c.value)
		const fromIdx = currentOrder.indexOf(fromValue)
		const toIdx = currentOrder.indexOf(toValue)
		if (fromIdx === -1 || toIdx === -1) return
		const next = [...currentOrder]
		next.splice(fromIdx, 1)
		next.splice(toIdx, 0, fromValue)
		await saveView({ ...activeView, boardColumnOrder: next })
	}, [columns, activeView, saveView])

	// Touch drag for mobile — registers listeners directly on element with { passive: false }
	const boardRef = useRef<HTMLDivElement>(null)
	const moveCardRef = useRef(moveCard)
	moveCardRef.current = moveCard
	const moveColumnRef = useRef(moveColumn)
	moveColumnRef.current = moveColumn

	const createGhost = (el: HTMLElement, x: number, y: number): HTMLElement => {
		const ghost = el.cloneNode(true) as HTMLElement
		const rect = el.getBoundingClientRect()
		ghost.style.cssText = `position:fixed;z-index:9999;pointer-events:none;opacity:0.85;width:${rect.width}px;transform:rotate(2deg);box-shadow:0 8px 24px rgba(0,0,0,0.2);`
		ghost.style.left = `${x - rect.width / 2}px`
		ghost.style.top = `${y - 20}px`
		document.body.appendChild(ghost)
		return ghost
	}

	const handleCardTouchStart = useCallback((e: React.TouchEvent, rowPath: string) => {
		const touch = e.touches[0]
		const el = e.currentTarget as HTMLElement
		let active = false, overColKey: string | null = null, ghost: HTMLElement | null = null
		let scrollInterval: ReturnType<typeof setInterval> | null = null

		const startEdgeScroll = (clientX: number) => {
			const board = boardRef.current
			if (!board) return
			const boardRect = board.getBoundingClientRect()
			const edgeZone = 50
			const speed = 8
			const nearLeft = clientX - boardRect.left < edgeZone
			const nearRight = boardRect.right - clientX < edgeZone

			if (!nearLeft && !nearRight) {
				if (scrollInterval) { clearInterval(scrollInterval); scrollInterval = null }
				return
			}
			if (scrollInterval) return
			const dir = nearRight ? 1 : -1
			scrollInterval = setInterval(() => {
				board.scrollLeft += dir * speed
			}, 16)
		}

		const stopEdgeScroll = () => {
			if (scrollInterval) { clearInterval(scrollInterval); scrollInterval = null }
		}

		const onMove = (ev: TouchEvent) => {
			const t = ev.touches[0]
			if (!active && Math.abs(t.clientX - touch.clientX) < 12 && Math.abs(t.clientY - touch.clientY) < 12) return
			ev.preventDefault()
			ev.stopPropagation()
			if (!active) {
				active = true
				el.classList.add('nb-touch-drag-source')
				boardRef.current?.classList.add('nb-board--dragging')
				ghost = createGhost(el, t.clientX, t.clientY)
			}
			if (ghost) {
				ghost.style.left = `${t.clientX - ghost.offsetWidth / 2}px`
				ghost.style.top = `${t.clientY - 20}px`
			}
			el.classList.add('nb-touch-drag-hidden')
			const target = document.elementFromPoint(t.clientX, t.clientY)
			el.classList.remove('nb-touch-drag-hidden')
			el.classList.add('nb-touch-drag-source')
			const col = target?.closest('.nb-board-column') as HTMLElement | null
			overColKey = col?.dataset.colKey ?? null
			setCardDragOver(overColKey)
			startEdgeScroll(t.clientX)
		}

		const onEnd = () => {
			stopEdgeScroll()
			boardRef.current?.classList.remove('nb-board--dragging')
			el.classList.remove('nb-touch-drag-source', 'nb-touch-drag-hidden')
			ghost?.remove()
			if (active && overColKey !== null) {
				void moveCardRef.current(rowPath, overColKey)
			}
			setCardDragOver(null)
			el.removeEventListener('touchmove', onMove)
			el.removeEventListener('touchend', onEnd)
			el.removeEventListener('touchcancel', onEnd)
		}

		el.addEventListener('touchmove', onMove, { passive: false })
		el.addEventListener('touchend', onEnd)
		el.addEventListener('touchcancel', onEnd)
	}, [])

	const handleColumnTouchStart = useCallback((e: React.TouchEvent, colValue: string) => {
		const touch = e.touches[0]
		const el = e.currentTarget.closest('.nb-board-column') as HTMLElement
		if (!el) return
		let active = false, overColKey: string | null = null, ghost: HTMLElement | null = null
		let scrollInterval: ReturnType<typeof setInterval> | null = null

		const startEdgeScroll = (clientX: number) => {
			const board = boardRef.current
			if (!board) return
			const boardRect = board.getBoundingClientRect()
			const edgeZone = 50
			const speed = 8
			const nearLeft = clientX - boardRect.left < edgeZone
			const nearRight = boardRect.right - clientX < edgeZone

			if (!nearLeft && !nearRight) {
				if (scrollInterval) { clearInterval(scrollInterval); scrollInterval = null }
				return
			}
			if (scrollInterval) return
			const dir = nearRight ? 1 : -1
			scrollInterval = setInterval(() => {
				board.scrollLeft += dir * speed
			}, 16)
		}

		const stopEdgeScroll = () => {
			if (scrollInterval) { clearInterval(scrollInterval); scrollInterval = null }
		}

		const onMove = (ev: TouchEvent) => {
			const t = ev.touches[0]
			if (!active && Math.abs(t.clientX - touch.clientX) < 12 && Math.abs(t.clientY - touch.clientY) < 12) return
			ev.preventDefault()
			ev.stopPropagation()
			if (!active) {
				active = true
				el.classList.add('nb-touch-drag-source')
				boardRef.current?.classList.add('nb-board--dragging')
				ghost = createGhost(el, t.clientX, t.clientY)
			}
			if (ghost) {
				ghost.style.left = `${t.clientX - ghost.offsetWidth / 2}px`
				ghost.style.top = `${t.clientY - 20}px`
			}
			el.classList.add('nb-touch-drag-hidden')
			const target = document.elementFromPoint(t.clientX, t.clientY)
			el.classList.remove('nb-touch-drag-hidden')
			el.classList.add('nb-touch-drag-source')
			const col = target?.closest('.nb-board-column') as HTMLElement | null
			overColKey = col?.dataset.colKey ?? null
			setColDragOver(overColKey)
			startEdgeScroll(t.clientX)
		}

		const onEnd = () => {
			stopEdgeScroll()
			boardRef.current?.classList.remove('nb-board--dragging')
			el.classList.remove('nb-touch-drag-source', 'nb-touch-drag-hidden')
			ghost?.remove()
			if (active && overColKey !== null) {
				void moveColumnRef.current(colValue, overColKey)
			}
			setColDragOver(null)
			el.removeEventListener('touchmove', onMove)
			el.removeEventListener('touchend', onEnd)
			el.removeEventListener('touchcancel', onEnd)
		}

		el.addEventListener('touchmove', onMove, { passive: false })
		el.addEventListener('touchend', onEnd)
		el.addEventListener('touchcancel', onEnd)
	}, [])


	const addCardToColumn = useCallback(async (columnValue: string) => {
		if (!dbFile || !groupByCol) return
		const newFile = await manager.createNote(dbFile)
		if (columnValue !== '') {
			await app.fileManager.processFrontMatter(newFile, (fm: Record<string, unknown>) => {
				fm[groupByCol.id] = columnValue
			})
		}
	}, [app, dbFile, manager, groupByCol])

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

	// ── Render ─────────────────────────────────────────────────────────────────

	const isMobile = useIsMobile()

	if (!dbFile) return <div className="nb-empty-state"><p>{t('no_database_open')}</p></div>
	if (loading) return <div className="nb-loading">{t('loading')}</div>

	if (groupableColumns.length === 0) {
		return (
			<div className="nb-empty-state">
				<p>{t('board_no_select_col')}</p>
				<p>{t('board_add_select_hint')}</p>
			</div>
		)
	}

	const closeMobileMenus = (except?: string) => {
		if (except !== 'fields') setFieldsMenuOpen(false)
		if (except !== 'groupby') setGroupByMenuOpen(false)
		if (except !== 'filter') setFilterMenuOpen(false)
	}

	const toolbarContent = isMobile ? (
		<MobileToolbar
			actionBarRef={mobileActionBarRef}
			actions={[
				{ id: 'fields', label: t('fields'), icon: <IconFields />, active: fieldsMenuOpen, onClick: () => { closeMobileMenus('fields'); setFieldsMenuOpen(v => !v) } },
				{ id: 'groupby', label: t('group_by'), icon: <IconSort />, active: groupByMenuOpen, onClick: () => { closeMobileMenus('groupby'); setGroupByMenuOpen(v => !v) } },
				{ id: 'subfolders', label: t('tooltip_include_subfolders'), icon: <IconSubfolders />, active: !!activeView.includeSubfolders, onClick: () => { closeMobileMenus(); void saveView({ ...activeView, includeSubfolders: !activeView.includeSubfolders }) } },
				{ id: 'filter', label: t('filter'), icon: <IconFilter />, active: filterMenuOpen, badge: activeFilters.length || undefined, onClick: () => { closeMobileMenus('filter'); setFilterMenuOpen(v => !v) } },
			]}
			rowCount={filteredRows.length}
			rowCountLabel={filteredRows.length === 1 ? t('item_singular').toLowerCase() : t('item_plural').toLowerCase()}
			filters={activeFilters}
			onFilterUpdate={updateFilter}
			onFilterRemove={removeFilter}
			onConjunctionToggle={toggleConjunction}
		>
			<BottomSheet open={fieldsMenuOpen} onClose={() => setFieldsMenuOpen(false)} title={t('fields_in_card')}>
				{config.schema.filter(c => c.id !== groupByCol?.id && c.type !== 'title').map(col => (
					<label key={col.id} className="nb-field-row">
						<input type="checkbox" className="nb-field-checkbox" checked={col.visible && !activeView.hiddenColumns.includes(col.id)} onChange={() => { void toggleFieldVisibility(col.id) }} />
						<span className="nb-field-icon">{getColumnIconStatic(col.type)}</span>
						<span className="nb-field-name">{col.name}</span>
					</label>
				))}
			</BottomSheet>
			<BottomSheet open={groupByMenuOpen} onClose={() => setGroupByMenuOpen(false)} title={t('group_by')}>
				{groupableColumns.map(col => (
					<button
						key={col.id}
						className={`nb-menu-item${activeView.groupByColumnId === col.id ? ' nb-menu-item--active' : ''}`}
						onClick={() => { void saveView({ ...activeView, groupByColumnId: col.id }); setGroupByMenuOpen(false) }}
					>
						<span className="nb-menu-item-icon">{getColumnIconStatic(col.type)}</span>
						<span>{col.name}</span>
					</button>
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
			<div className="nb-mobile-toggles-row">
				<label className="nb-mobile-toggle">
					<input type="checkbox" checked={hideEmpty} onChange={e => setHideEmpty(e.target.checked)} />
					<span>{t('hide_empty_cols')}</span>
				</label>
				<label className="nb-mobile-toggle">
					<input type="checkbox" checked={hideNoValue} onChange={e => setHideNoValue(e.target.checked)} />
					<span>{t('hide_no_value_cols')}</span>
				</label>
			</div>
		</MobileToolbar>
	) : (
		<>
			{/* Desktop Toolbar */}
			<div className="nb-toolbar">
				{/* Campos */}
				<div className="nb-fields-menu-wrapper" ref={fieldsMenuRef}>
					<button className={`nb-toolbar-btn${fieldsMenuOpen ? ' nb-toolbar-btn--active' : ''}`} onClick={() => setFieldsMenuOpen(v => !v)}>
						{t('fields')}
					</button>
					{fieldsMenuOpen && (
						<div className="nb-fields-dropdown">
							<div className="nb-fields-dropdown-label">{t('fields_in_card')}</div>
							{config.schema.filter(c => c.id !== groupByCol?.id && c.type !== 'title').map(col => (
								<label key={col.id} className="nb-field-row">
									<input type="checkbox" className="nb-field-checkbox" checked={col.visible && !activeView.hiddenColumns.includes(col.id)} onChange={() => { void toggleFieldVisibility(col.id) }} />
									<span className="nb-field-icon">{getColumnIconStatic(col.type)}</span>
									<span className="nb-field-name">{col.name}</span>
								</label>
							))}
						</div>
					)}
				</div>

				{/* Agrupar por */}
				<div className="nb-fields-menu-wrapper" ref={groupByMenuRef}>
					<button className={`nb-toolbar-btn${groupByMenuOpen ? ' nb-toolbar-btn--active' : ''}`} onClick={() => setGroupByMenuOpen(v => !v)}>
						{t('group_by')}: <strong>{groupByCol?.name ?? '—'}</strong>
					</button>
					{groupByMenuOpen && (
						<div className="nb-fields-dropdown">
							<div className="nb-fields-dropdown-label">{t('group_by_label')}</div>
							{groupableColumns.map(col => (
								<button
									key={col.id}
									className={`nb-menu-item${activeView.groupByColumnId === col.id ? ' nb-menu-item--active' : ''}`}
									onClick={() => { void saveView({ ...activeView, groupByColumnId: col.id }); setGroupByMenuOpen(false) }}
								>
									<span className="nb-menu-item-icon">{getColumnIconStatic(col.type)}</span>
									<span>{col.name}</span>
								</button>
							))}
						</div>
					)}
				</div>

				{/* Ocultar vazias */}
				<label className="nb-toolbar-btn nb-toolbar-toggle">
					<input type="checkbox" checked={hideEmpty} onChange={e => setHideEmpty(e.target.checked)} />
					{t('hide_empty_cols')}
				</label>

				{/* Ocultar sem valor */}
				<label className="nb-toolbar-btn nb-toolbar-toggle">
					<input type="checkbox" checked={hideNoValue} onChange={e => setHideNoValue(e.target.checked)} />
					{t('hide_no_value_cols')}
				</label>

				{/* Include subfolders */}
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

				{/* Row count */}
				<span className="nb-row-count">{filteredRows.length} {filteredRows.length === 1 ? t('item_singular').toLowerCase() : t('item_plural').toLowerCase()}</span>

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
		</>
	)

	return (
		<div className="nb-container">
			{toolbarContent}

			{/* Board */}
			<div className="nb-board" ref={boardRef}>
				{columns.map(col => {
					const key = col.value || '__no_value__'
					const isCardOver = cardDragOver === key
					const isColOver = colDragOver === key
					return (
						<div
							key={key}
							data-col-key={key}
							className={`nb-board-column${isCardOver ? ' nb-board-column--card-over' : ''}${isColOver ? ' nb-board-column--col-over' : ''}${(() => { const lim = activeView.boardColumnLimits?.[col.value]; return lim && lim > 0 && col.rows.length >= lim ? ' nb-board-column--over-limit' : '' })()}`}
							onDragOver={e => {
								e.preventDefault()
								const type = e.dataTransfer.types.includes(DRAG_TYPE_CARD) ? DRAG_TYPE_CARD : DRAG_TYPE_COLUMN
								if (type === DRAG_TYPE_CARD) setCardDragOver(key)
								else setColDragOver(key)
							}}
							onDragLeave={e => {
								const related = e.relatedTarget as Node | null
								if (!e.currentTarget.contains(related)) {
									setCardDragOver(null)
									setColDragOver(null)
								}
							}}
							// eslint-disable-next-line @typescript-eslint/no-misused-promises -- async handler required for drag-and-drop file operations
							onDrop={async e => {
								e.preventDefault()
								setCardDragOver(null)
								setColDragOver(null)
								const dragType = e.dataTransfer.getData('nb-drag-type')
								if (dragType === DRAG_TYPE_CARD) {
									const rowPath = e.dataTransfer.getData('nb-row-path')
									if (rowPath) await moveCard(rowPath, col.value)
								} else if (dragType === DRAG_TYPE_COLUMN) {
									const fromValue = e.dataTransfer.getData('nb-col-value')
									if (fromValue !== undefined) await moveColumn(fromValue, col.value)
								}
							}}
						>
							{/* Column header with drag handle */}
							<div
								className="nb-board-column-header"
								draggable={!isMobile}
								onDragStart={!isMobile ? e => {
									e.stopPropagation()
									e.dataTransfer.effectAllowed = 'move'
									e.dataTransfer.setData('nb-drag-type', DRAG_TYPE_COLUMN)
									e.dataTransfer.setData('nb-col-value', col.value)
									e.dataTransfer.setData(DRAG_TYPE_COLUMN, '')
								} : undefined}
								onDragEnd={!isMobile ? () => setColDragOver(null) : undefined}
								title={t('board_drag_reorder')}
							>
								<span
									className="nb-board-column-drag-handle"
									onTouchStart={isMobile ? e => handleColumnTouchStart(e, col.value) : undefined}
								>⠿</span>
								{col.color ? (
									<span className="nb-board-column-badge" style={{ background: col.color }}>{col.label}</span>
								) : (
									<span className="nb-board-column-name">{col.label}</span>
								)}
								{(() => {
									const limit = activeView.boardColumnLimits?.[col.value]
									const count = col.rows.length
									const overLimit = limit !== undefined && limit > 0 && count >= limit
									return (
										<span
											className={`nb-board-column-count ${overLimit ? 'nb-board-column-count--over' : ''}`}
											onClick={e => {
												e.stopPropagation()
												setEditingLimit(editingLimit === col.value ? null : col.value)
											}}
											title={t('board_set_limit')}
										>
											{limit && limit > 0 ? `${count}/${limit}` : count}
										</span>
									)
								})()}
							</div>
							{editingLimit === col.value && (
								<div className="nb-board-limit-input-wrapper">
									<input
										className="nb-board-limit-input"
										type="number"
										min="0"
										placeholder={t('board_limit_placeholder')}
										defaultValue={activeView.boardColumnLimits?.[col.value] ?? ''}
										autoFocus
										onKeyDown={e => {
											if (e.key === 'Enter' || e.key === 'Escape') {
												const val = parseInt((e.target as HTMLInputElement).value)
												const limits = { ...activeView.boardColumnLimits }
												if (isNaN(val) || val <= 0) delete limits[col.value]
												else limits[col.value] = val
												void saveView({ ...activeView, boardColumnLimits: limits })
												setEditingLimit(null)
											}
										}}
										onBlur={e => {
											const val = parseInt(e.target.value)
											const limits = { ...activeView.boardColumnLimits }
											if (isNaN(val) || val <= 0) delete limits[col.value]
											else limits[col.value] = val
											void saveView({ ...activeView, boardColumnLimits: limits })
											setEditingLimit(null)
										}}
									/>
								</div>
							)}

							{/* Cards */}
							<div className="nb-board-cards">
								{(() => {
									const limit = activeView.boardColumnLimits?.[col.value]
									const isExpanded = expandedColumns.has(col.value)
									const visibleRows = (limit && limit > 0 && !isExpanded)
										? col.rows.slice(0, limit)
										: col.rows
									const hiddenCount = col.rows.length - visibleRows.length
									return <>
										{visibleRows.map(row => (
											<div
												key={row._file.path}
												className="nb-board-card"
												draggable={!isMobile}
												onDragStart={!isMobile ? e => {
													e.stopPropagation()
													e.dataTransfer.effectAllowed = 'move'
													e.dataTransfer.setData('nb-drag-type', DRAG_TYPE_CARD)
													e.dataTransfer.setData('nb-row-path', row._file.path)
													e.dataTransfer.setData(DRAG_TYPE_CARD, '')
												} : undefined}
												onTouchStart={isMobile ? e => handleCardTouchStart(e, row._file.path) : undefined}
												onClick={() => { void app.workspace.getLeaf().openFile(row._file) }}
											>
												<div className="nb-board-card-title">{row._title}</div>
												{(() => {
													const dbFolder = dbFile?.parent?.path ?? ''
													const fileFolder = row._file.parent?.path ?? ''
													const relPath = activeView.includeSubfolders && fileFolder.length > dbFolder.length
														? fileFolder.slice(dbFolder.length + 1) : ''
													return relPath ? <div className="nb-folder-path">{relPath}</div> : null
												})()}
												{visibleCols.length > 0 && (
													<div className="nb-board-card-props">
														{visibleCols.map(c => {
															const val = row[c.id]
															if (val === null || val === undefined || String(val as string | number | boolean).trim() === '') return null
															const display = Array.isArray(val) ? (val as string[]).join(', ') : String(val as string | number | boolean)
															return (
																<span key={c.id} className="nb-board-card-prop">
																	<span className="nb-board-card-prop-name">{c.name}:</span>
																	<span className="nb-board-card-prop-value">{display}</span>
																</span>
															)
														})}
													</div>
												)}
											</div>
										))}
										{hiddenCount > 0 && (
											<button
												className="nb-board-show-more"
												onClick={() => setExpandedColumns(prev => { const next = new Set(prev); next.add(col.value); return next })}
											>
												{`+${hiddenCount} ${t('board_show_more')}`}
											</button>
										)}
										{isExpanded && limit && limit > 0 && col.rows.length > limit && (
											<button
												className="nb-board-show-more"
												onClick={() => setExpandedColumns(prev => { const next = new Set(prev); next.delete(col.value); return next })}
											>
												{t('board_show_less')}
											</button>
										)}
									</>
								})()}
							</div>

							{/* Add card */}
							<button className="nb-board-add-card" onClick={() => { void addCardToColumn(col.value) }}>
								{'+ ' + t('add_card')}
							</button>
						</div>
					)
				})}
			</div>
		</div>
	)
}
