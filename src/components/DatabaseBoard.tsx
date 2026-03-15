import { TFile } from 'obsidian'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../context'
import { DatabaseManager } from '../database-manager'
import {
	DatabaseConfig, DEFAULT_DATABASE_CONFIG,
	FilterOperator, NoteRow, ViewConfig,
} from '../types'
import { evaluateFormulas } from '../formula-engine'
import {
	ActiveFilter, applyFilters, applySorts,
	getColumnIconStatic, getDefaultOperator,
	OPERATOR_LABELS, NO_VALUE_OPERATORS, getOperatorsForType,
} from './filter-utils'
import { t } from '../i18n'

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
	const [fieldsMenuOpen, setFieldsMenuOpen] = useState(false)
	const [groupByMenuOpen, setGroupByMenuOpen] = useState(false)
	const [filterMenuOpen, setFilterMenuOpen] = useState(false)
	// card drag
	const [cardDragOver, setCardDragOver] = useState<string | null>(null)
	// column drag
	const [colDragOver, setColDragOver] = useState<string | null>(null)

	const fieldsMenuRef = useRef<HTMLDivElement>(null)
	const groupByMenuRef = useRef<HTMLDivElement>(null)
	const filterMenuRef = useRef<HTMLDivElement>(null)
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
		const cfg = manager.readConfig(dbFile)
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
		if (!fieldsMenuOpen) return
		const h = (e: MouseEvent) => { if (fieldsMenuRef.current && !fieldsMenuRef.current.contains(e.target as Node)) setFieldsMenuOpen(false) }
		document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
	}, [fieldsMenuOpen])

	useEffect(() => {
		if (!groupByMenuOpen) return
		const h = (e: MouseEvent) => { if (groupByMenuRef.current && !groupByMenuRef.current.contains(e.target as Node)) setGroupByMenuOpen(false) }
		document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
	}, [groupByMenuOpen])

	useEffect(() => {
		if (!filterMenuOpen) return
		const h = (e: MouseEvent) => { if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) setFilterMenuOpen(false) }
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

	const columns = useMemo(() => {
		if (!groupByCol) return []
		const options = groupByCol.options ?? []
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

			{/* Board */}
			<div className="nb-board">
				{columns.map(col => {
					const key = col.value || '__no_value__'
					const isCardOver = cardDragOver === key
					const isColOver = colDragOver === key
					return (
						<div
							key={key}
							className={`nb-board-column${isCardOver ? ' nb-board-column--card-over' : ''}${isColOver ? ' nb-board-column--col-over' : ''}`}
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
								draggable
								onDragStart={e => {
									e.stopPropagation()
									e.dataTransfer.effectAllowed = 'move'
									e.dataTransfer.setData('nb-drag-type', DRAG_TYPE_COLUMN)
									e.dataTransfer.setData('nb-col-value', col.value)
									e.dataTransfer.setData(DRAG_TYPE_COLUMN, '')
								}}
								onDragEnd={() => setColDragOver(null)}
								title={t('board_drag_reorder')}
							>
								<span className="nb-board-column-drag-handle">⠿</span>
								{col.color ? (
									<span className="nb-board-column-badge" style={{ background: col.color }}>{col.label}</span>
								) : (
									<span className="nb-board-column-name">{col.label}</span>
								)}
								<span className="nb-board-column-count">{col.rows.length}</span>
							</div>

							{/* Cards */}
							<div className="nb-board-cards">
								{col.rows.map(row => (
									<div
										key={row._file.path}
										className="nb-board-card"
										draggable
										onDragStart={e => {
											e.stopPropagation()
											e.dataTransfer.effectAllowed = 'move'
											e.dataTransfer.setData('nb-drag-type', DRAG_TYPE_CARD)
											e.dataTransfer.setData('nb-row-path', row._file.path)
											e.dataTransfer.setData(DRAG_TYPE_CARD, '')
										}}
										onClick={() => { void app.workspace.getLeaf().openFile(row._file) }}
									>
										<div className="nb-board-card-title">{row._title}</div>
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
