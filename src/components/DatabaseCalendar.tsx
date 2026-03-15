import { TFile } from 'obsidian'
import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../context'
import { DatabaseManager } from '../database-manager'
import {
	DatabaseConfig, DEFAULT_DATABASE_CONFIG,
	FilterOperator, NoteRow, ViewConfig,
} from '../types'
import { evaluateFormulas } from '../formula-engine'
import {
	ActiveFilter, applyFilters,
	getColumnIconStatic, getDefaultOperator,
	OPERATOR_LABELS, NO_VALUE_OPERATORS, getOperatorsForType,
} from './filter-utils'
import { t } from '../i18n'

interface DatabaseCalendarProps {
	dbFile: TFile | null
	manager: DatabaseManager
	externalView: ViewConfig
	onViewChange: (view: ViewConfig) => Promise<void>
}

const DAYS_SHORT = () => [t('day_sun'), t('day_mon'), t('day_tue'), t('day_wed'), t('day_thu'), t('day_fri'), t('day_sat')]
const MONTHS_LONG = () => [t('month_january'), t('month_february'), t('month_march'), t('month_april'), t('month_may'), t('month_june'), t('month_july'), t('month_august'), t('month_september'), t('month_october'), t('month_november'), t('month_december')]

function buildCalendarGrid(year: number, month: number): (number | null)[] {
	const firstDay = new Date(year, month, 1).getDay()
	const daysInMonth = new Date(year, month + 1, 0).getDate()
	const cells: (number | null)[] = []
	for (let i = 0; i < firstDay; i++) cells.push(null)
	for (let d = 1; d <= daysInMonth; d++) cells.push(d)
	while (cells.length % 7 !== 0) cells.push(null)
	return cells
}

function parseDateValue(val: unknown): { year: number; month: number; day: number } | null {
	if (!val || typeof val !== 'string') return null
	const parts = val.split('-')
	if (parts.length !== 3) return null
	const year = parseInt(parts[0])
	const month = parseInt(parts[1]) - 1
	const day = parseInt(parts[2])
	if (isNaN(year) || isNaN(month) || isNaN(day)) return null
	return { year, month, day }
}

export function DatabaseCalendar({ dbFile, manager, externalView, onViewChange }: DatabaseCalendarProps) {
	const app = useApp()
	const today = new Date()
	const [rows, setRows] = useState<NoteRow[]>([])
	const [config, setConfig] = useState<DatabaseConfig>(DEFAULT_DATABASE_CONFIG)
	const [loading, setLoading] = useState(true)
	const [activeView, setActiveView] = useState<ViewConfig>(externalView)
	const [currentYear, setCurrentYear] = useState(today.getFullYear())
	const [currentMonth, setCurrentMonth] = useState(today.getMonth())
	const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([])
	const [filterMenuOpen, setFilterMenuOpen] = useState(false)
	const [fieldsMenuOpen, setFieldsMenuOpen] = useState(false)
	const [dateFieldMenuOpen, setDateFieldMenuOpen] = useState(false)
	const [dragOverDay, setDragOverDay] = useState<number | null>(null)

	const filterMenuRef = useRef<HTMLDivElement>(null)
	const fieldsMenuRef = useRef<HTMLDivElement>(null)
	const dateFieldMenuRef = useRef<HTMLDivElement>(null)
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
		const notes = manager.getNotesInDatabase(dbFile, activeView.includeSubfolders)
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
		if (!dateFieldMenuOpen) return
		const h = (e: MouseEvent) => { if (dateFieldMenuRef.current && !dateFieldMenuRef.current.contains(e.target as Node)) setDateFieldMenuOpen(false) }
		document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
	}, [dateFieldMenuOpen])

	// ── Derived data ─────────────────────────────────────────────────────────

	const filteredRows = useMemo(() => applyFilters(rows, activeFilters), [rows, activeFilters])

	const dateField = useMemo(
		() => config.schema.find(c => c.id === activeView.calendarDateField) ?? null,
		[config.schema, activeView.calendarDateField]
	)

	const visibleCols = useMemo(
		() => config.schema.filter(col => col.visible && !activeView.hiddenColumns.includes(col.id)),
		[config.schema, activeView.hiddenColumns]
	)

	const calendarCells = useMemo(() => buildCalendarGrid(currentYear, currentMonth), [currentYear, currentMonth])

	const rowsByDay = useMemo(() => {
		const map = new Map<number, NoteRow[]>()
		if (!dateField) return map
		for (const row of filteredRows) {
			const parsed = parseDateValue((row as Record<string, unknown>)[dateField.id])
			if (!parsed) continue
			if (parsed.year === currentYear && parsed.month === currentMonth) {
				const existing = map.get(parsed.day) ?? []
				existing.push(row)
				map.set(parsed.day, existing)
			}
		}
		return map
	}, [filteredRows, dateField, currentYear, currentMonth])

	const noDateRows = useMemo(() => {
		if (!dateField) return []
		return filteredRows.filter(row => {
			const val = (row as Record<string, unknown>)[dateField.id]
			return !val || String(val as string | number | boolean).trim() === ''
		})
	}, [filteredRows, dateField])

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

	const goToPrevMonth = () => {
		if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) }
		else setCurrentMonth(m => m - 1)
	}
	const goToNextMonth = () => {
		if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) }
		else setCurrentMonth(m => m + 1)
	}
	const goToToday = () => {
		setCurrentYear(today.getFullYear())
		setCurrentMonth(today.getMonth())
	}

	const handleDayClick = async (day: number) => {
		if (!dbFile || !dateField) return
		const newFile = await manager.createNote(dbFile)
		const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
		await app.fileManager.processFrontMatter(newFile, (fm: Record<string, unknown>) => { fm[dateField.id] = dateStr })
	}

	const handleCardDragStart = (e: React.DragEvent, row: NoteRow) => {
		e.dataTransfer.setData('nb-cal-path', row._file.path)
		e.dataTransfer.effectAllowed = 'move'
		e.stopPropagation()
	}

	const handleDayDragOver = (e: React.DragEvent, day: number) => {
		if (!e.dataTransfer.types.includes('nb-cal-path')) return
		e.preventDefault()
		e.dataTransfer.dropEffect = 'move'
		setDragOverDay(day)
	}

	const handleDayDragLeave = (e: React.DragEvent) => {
		if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverDay(null)
	}

	const handleDayDrop = async (e: React.DragEvent, day: number) => {
		e.preventDefault()
		e.stopPropagation()
		setDragOverDay(null)
		const path = e.dataTransfer.getData('nb-cal-path')
		if (!path || !dateField) return
		const file = app.vault.getFileByPath(path)
		if (!file) return
		const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
		await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => { fm[dateField.id] = dateStr })
	}

	// ── Render ────────────────────────────────────────────────────────────────

	if (!dbFile) return <div className="nb-empty-state"><p>{t('no_database_open')}</p></div>
	if (loading) return <div className="nb-loading">{t('loading')}</div>

	const todayDay = today.getFullYear() === currentYear && today.getMonth() === currentMonth ? today.getDate() : null

	return (
		<div className="nb-container">
			{/* Toolbar */}
			<div className="nb-toolbar">
				{/* Campo de data */}
				<div className="nb-fields-menu-wrapper" ref={dateFieldMenuRef}>
					<button className={`nb-toolbar-btn${dateFieldMenuOpen ? ' nb-toolbar-btn--active' : ''}`} onClick={() => setDateFieldMenuOpen(v => !v)}>
						{t('date_field')}: <strong>{dateField?.name ?? t('none_value')}</strong>
					</button>
					{dateFieldMenuOpen && (
						<div className="nb-fields-dropdown">
							<div className="nb-fields-dropdown-label">{t('date_field_label')}</div>
							<button
								className={`nb-menu-item${!activeView.calendarDateField ? ' nb-menu-item--active' : ''}`}
								onClick={() => { void saveView({ ...activeView, calendarDateField: undefined }); setDateFieldMenuOpen(false) }}
							>
								<span className="nb-menu-item-icon">—</span>
								<span>{t('none_value')}</span>
							</button>
							{config.schema.filter(c => c.type === 'date').map(col => (
								<button
									key={col.id}
									className={`nb-menu-item${activeView.calendarDateField === col.id ? ' nb-menu-item--active' : ''}`}
									onClick={() => { void saveView({ ...activeView, calendarDateField: col.id }); setDateFieldMenuOpen(false) }}
								>
									<span className="nb-menu-item-icon">📅</span>
									<span>{col.name}</span>
								</button>
							))}
						</div>
					)}
				</div>

				{/* Campos */}
				<div className="nb-fields-menu-wrapper" ref={fieldsMenuRef}>
					<button className={`nb-toolbar-btn${fieldsMenuOpen ? ' nb-toolbar-btn--active' : ''}`} onClick={() => setFieldsMenuOpen(v => !v)}>
						Campos
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

				{/* Navegação */}
				<div className="nb-cal-nav">
					<button className="nb-toolbar-btn nb-cal-nav-arrow" onClick={goToPrevMonth} title={t('calendar_prev_month')}>‹</button>
					<button className="nb-toolbar-btn nb-cal-today-btn" onClick={goToToday}>{t('calendar_today')}</button>
					<span className="nb-cal-month-label">{MONTHS_LONG()[currentMonth]} {currentYear}</span>
					<button className="nb-toolbar-btn nb-cal-nav-arrow" onClick={goToNextMonth} title={t('calendar_next_month')}>›</button>
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

			{/* Calendar body */}
			{!dateField ? (
				<div className="nb-cal-no-field">
					<p>{t('calendar_no_date_field')}</p>
				</div>
			) : (
				<>
					<div className="nb-cal-grid">
						{/* Day headers */}
						{DAYS_SHORT().map(d => (
							<div key={d} className="nb-cal-day-header">{d}</div>
						))}

						{/* Day cells */}
						{calendarCells.map((day, idx) => {
							if (day === null) {
								return <div key={`empty-${idx}`} className="nb-cal-cell nb-cal-cell--outside" />
							}
							const isToday  = day === todayDay
							const isDragOver = day === dragOverDay
							const dayRows  = rowsByDay.get(day) ?? []
							return (
								<div
									key={day}
									className={`nb-cal-cell${isToday ? ' nb-cal-cell--today' : ''}${isDragOver ? ' nb-cal-cell--drag-over' : ''}`}
									onClick={() => { void handleDayClick(day) }}
									onDragOver={e => handleDayDragOver(e, day)}
									onDragLeave={handleDayDragLeave}
									onDrop={e => { void handleDayDrop(e, day) }}
									title={t('calendar_click_to_create')}
								>
									<div className="nb-cal-cell-header">
										<span className={`nb-cal-day-num${isToday ? ' nb-cal-day-num--today' : ''}`}>{day}</span>
									</div>
									<div className="nb-cal-cell-body">
										{dayRows.map(row => (
											<div
												key={row._file.path}
												className="nb-cal-card"
												draggable
												onDragStart={e => handleCardDragStart(e, row)}
												onClick={(e) => { e.stopPropagation(); void app.workspace.getLeaf().openFile(row._file) }}
											>
												<span className="nb-cal-card-title">{row._title}</span>
												{(() => {
													const dbFolder = dbFile?.parent?.path ?? ''
													const fileFolder = row._file.parent?.path ?? ''
													const relPath = activeView.includeSubfolders && fileFolder.length > dbFolder.length
														? fileFolder.slice(dbFolder.length + 1) : ''
													return relPath ? <div className="nb-folder-path">{relPath}</div> : null
												})()}
												{visibleCols.length > 0 && (
													<div className="nb-cal-card-props">
														{visibleCols.map(col => {
															const val = row[col.id]
															if (val === null || val === undefined || String(val as string | number | boolean).trim() === '') return null
															const display = Array.isArray(val) ? (val as string[]).join(', ') : String(val as string | number | boolean)
															return (
																<span key={col.id} className="nb-cal-card-prop">
																	{display}
																</span>
															)
														})}
													</div>
												)}
											</div>
										))}
									</div>
								</div>
							)
						})}
					</div>

					{/* No-date rows */}
					{noDateRows.length > 0 && (
						<div className="nb-cal-no-date">
							<div className="nb-cal-no-date-title">{t('calendar_no_date_section')} ({noDateRows.length})</div>
							<div className="nb-cal-no-date-list">
								{noDateRows.map(row => (
									<div
										key={row._file.path}
										className="nb-cal-card nb-cal-card--no-date"
										draggable
										onDragStart={e => handleCardDragStart(e, row)}
										onClick={() => { void app.workspace.getLeaf().openFile(row._file) }}
									>
										<span className="nb-cal-card-title">{row._title}</span>
										{(() => {
											const dbFolder = dbFile?.parent?.path ?? ''
											const fileFolder = row._file.parent?.path ?? ''
											const relPath = activeView.includeSubfolders && fileFolder.length > dbFolder.length
												? fileFolder.slice(dbFolder.length + 1) : ''
											return relPath ? <div className="nb-folder-path">{relPath}</div> : null
										})()}
									</div>
								))}
							</div>
						</div>
					)}
				</>
			)}
		</div>
	)
}
