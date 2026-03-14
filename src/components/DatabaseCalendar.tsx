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
	ActiveFilter, applyFilters,
	getColumnIconStatic, getDefaultOperator,
	OPERATOR_LABELS, NO_VALUE_OPERATORS, getOperatorsForType,
} from './filter-utils'

interface DatabaseCalendarProps {
	dbFile: TFile | null
	manager: DatabaseManager
	externalView: ViewConfig
	onViewChange: (view: ViewConfig) => Promise<void>
}

const DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS_LONG = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

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
					if (p.columnId === '_title') return [{ id: p.id ?? crypto.randomUUID(), columnId: '_title', columnName: 'Nome', columnType: 'title', icon: '📄', operator: p.operator, value: p.value, conjunction: (p.conjunction ?? 'and') as 'and' | 'or' }]
					const col = cfg.schema.find(sc => sc.id === p.columnId)
					if (!col) return []
					return [{ id: p.id ?? crypto.randomUUID(), columnId: col.id, columnName: col.name, columnType: col.type, icon: getColumnIconStatic(col.type), operator: p.operator, value: p.value, conjunction: (p.conjunction ?? 'and') as 'and' | 'or' }]
				})
				setActiveFilters(restored as ActiveFilter[])
			}
		}
		setConfig(cfg)
		setRows(noteRows)
		setLoading(false)
	}, [dbFile, manager])

	useEffect(() => { filtersInitialized.current = false }, [dbFile])
	useEffect(() => { loadData() }, [loadData])
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
			const parsed = parseDateValue(row[dateField.id])
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
			const val = row[dateField.id]
			return !val || String(val).trim() === ''
		})
	}, [filteredRows, dateField])

	// ── Actions ───────────────────────────────────────────────────────────────

	const saveActivePills = useCallback(async (filters: ActiveFilter[]) => {
		const pills = filters.map(f => ({ id: f.id, columnId: f.columnId, operator: f.operator, value: f.value, conjunction: f.conjunction }))
		await saveView({ ...activeView, activePills: pills })
	}, [saveView, activeView])

	const addFilter = (columnId: string, columnName: string, icon: string, columnType: string) => {
		const next: ActiveFilter[] = [...activeFilters, { id: crypto.randomUUID(), columnId, columnName, columnType, icon, operator: getDefaultOperator(columnType), value: '', conjunction: 'and' }]
		setActiveFilters(next); saveActivePills(next); setFilterMenuOpen(false)
	}
	const removeFilter = (id: string) => { const next = activeFilters.filter(f => f.id !== id); setActiveFilters(next); saveActivePills(next) }
	const updateFilter = (id: string, operator: FilterOperator, value: string) => { const next = activeFilters.map(f => f.id === id ? { ...f, operator, value } : f); setActiveFilters(next); saveActivePills(next) }
	const toggleConjunction = (id: string) => { const next = activeFilters.map(f => f.id === id ? { ...f, conjunction: f.conjunction === 'and' ? 'or' as const : 'and' as const } : f); setActiveFilters(next); saveActivePills(next) }

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
		await app.fileManager.processFrontMatter(newFile, fm => { fm[dateField.id] = dateStr })
	}

	// ── Render ────────────────────────────────────────────────────────────────

	if (!dbFile) return <div className="nb-empty-state"><p>Nenhum banco de dados aberto.</p></div>
	if (loading) return <div className="nb-loading">Carregando...</div>

	const todayDay = today.getFullYear() === currentYear && today.getMonth() === currentMonth ? today.getDate() : null

	return (
		<div className="nb-container">
			{/* Toolbar */}
			<div className="nb-toolbar">
				{/* Campo de data */}
				<div className="nb-fields-menu-wrapper" ref={dateFieldMenuRef}>
					<button className={`nb-toolbar-btn${dateFieldMenuOpen ? ' nb-toolbar-btn--active' : ''}`} onClick={() => setDateFieldMenuOpen(v => !v)}>
						Data: <strong>{dateField?.name ?? 'Nenhum'}</strong>
					</button>
					{dateFieldMenuOpen && (
						<div className="nb-fields-dropdown">
							<div className="nb-fields-dropdown-label">Campo de data</div>
							<button
								className={`nb-menu-item${!activeView.calendarDateField ? ' nb-menu-item--active' : ''}`}
								onClick={async () => { await saveView({ ...activeView, calendarDateField: undefined }); setDateFieldMenuOpen(false) }}
							>
								<span className="nb-menu-item-icon">—</span>
								<span>Nenhum</span>
							</button>
							{config.schema.filter(c => c.type === 'date').map(col => (
								<button
									key={col.id}
									className={`nb-menu-item${activeView.calendarDateField === col.id ? ' nb-menu-item--active' : ''}`}
									onClick={async () => { await saveView({ ...activeView, calendarDateField: col.id }); setDateFieldMenuOpen(false) }}
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
							<div className="nb-fields-dropdown-label">Campos</div>
							{config.schema.map(col => (
								<label key={col.id} className="nb-field-row">
									<input type="checkbox" className="nb-field-checkbox" checked={col.visible && !activeView.hiddenColumns.includes(col.id)} onChange={() => toggleFieldVisibility(col.id)} />
									<span className="nb-field-icon">{getColumnIconStatic(col.type)}</span>
									<span className="nb-field-name">{col.name}</span>
								</label>
							))}
						</div>
					)}
				</div>

				{/* Navegação */}
				<div className="nb-cal-nav">
					<button className="nb-toolbar-btn nb-cal-nav-arrow" onClick={goToPrevMonth} title="Mês anterior">‹</button>
					<button className="nb-toolbar-btn nb-cal-today-btn" onClick={goToToday}>Hoje</button>
					<span className="nb-cal-month-label">{MONTHS_LONG[currentMonth]} {currentYear}</span>
					<button className="nb-toolbar-btn nb-cal-nav-arrow" onClick={goToNextMonth} title="Próximo mês">›</button>
				</div>

				<span className="nb-row-count">{filteredRows.length} {filteredRows.length === 1 ? 'item' : 'itens'}</span>

				{/* Filtros */}
				<div className="nb-fields-menu-wrapper" ref={filterMenuRef} style={{ marginLeft: 'auto' }}>
					<button className={`nb-toolbar-btn nb-toolbar-btn--icon${filterMenuOpen ? ' nb-toolbar-btn--active' : ''}`} onClick={() => setFilterMenuOpen(v => !v)} title="Filtros">
						<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
						</svg>
						{activeFilters.length > 0 && <span className="nb-hidden-badge">{activeFilters.length}</span>}
					</button>
					{filterMenuOpen && (
						<div className="nb-fields-dropdown nb-filter-menu-dropdown">
							<div className="nb-fields-dropdown-label">Filtrar por</div>
							<button className="nb-menu-item" onClick={() => addFilter('_title', 'Nome', '📄', 'title')}>
								<span className="nb-menu-item-icon">📄</span><span>Nome</span>
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
									{f.conjunction === 'or' ? 'OU' : 'E'}
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
					<p>Selecione um campo de data no toolbar para exibir o calendário.</p>
				</div>
			) : (
				<>
					<div className="nb-cal-grid">
						{/* Day headers */}
						{DAYS_SHORT.map(d => (
							<div key={d} className="nb-cal-day-header">{d}</div>
						))}

						{/* Day cells */}
						{calendarCells.map((day, idx) => {
							if (day === null) {
								return <div key={`empty-${idx}`} className="nb-cal-cell nb-cal-cell--outside" />
							}
							const isToday = day === todayDay
							const dayRows = rowsByDay.get(day) ?? []
							return (
								<div
									key={day}
									className={`nb-cal-cell${isToday ? ' nb-cal-cell--today' : ''}`}
									onClick={() => handleDayClick(day)}
									title="Clique para criar nota"
								>
									<div className="nb-cal-cell-header">
										<span className={`nb-cal-day-num${isToday ? ' nb-cal-day-num--today' : ''}`}>{day}</span>
									</div>
									<div className="nb-cal-cell-body">
										{dayRows.map(row => (
											<div
												key={row._file.path}
												className="nb-cal-card"
												onClick={e => { e.stopPropagation(); app.workspace.getLeaf().openFile(row._file) }}
											>
												<span className="nb-cal-card-title">{row._title}</span>
												{visibleCols.length > 0 && (
													<div className="nb-cal-card-props">
														{visibleCols.map(col => {
															const val = row[col.id]
															if (val === null || val === undefined || String(val).trim() === '') return null
															const display = Array.isArray(val) ? (val as string[]).join(', ') : String(val)
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
							<div className="nb-cal-no-date-title">Sem data ({noDateRows.length})</div>
							<div className="nb-cal-no-date-list">
								{noDateRows.map(row => (
									<div
										key={row._file.path}
										className="nb-cal-card nb-cal-card--no-date"
										onClick={() => app.workspace.getLeaf().openFile(row._file)}
									>
										<span className="nb-cal-card-title">{row._title}</span>
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
