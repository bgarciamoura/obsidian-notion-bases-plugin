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
import { useIsMobile } from '../hooks/useIsMobile'
import { MobileToolbar, IconFields, IconFilter, IconSubfolders } from './MobileToolbar'
import { BottomSheet } from './BottomSheet'

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

function buildWeekGrid(year: number, month: number, day: number): Date[] {
	const anchor = new Date(year, month, day)
	const dow = anchor.getDay()
	const sunday = new Date(anchor)
	sunday.setDate(anchor.getDate() - dow)
	const days: Date[] = []
	for (let i = 0; i < 7; i++) {
		const d = new Date(sunday)
		d.setDate(sunday.getDate() + i)
		days.push(d)
	}
	return days
}

function formatWeekRange(days: Date[]): string {
	if (days.length === 0) return ''
	const first = days[0]
	const last = days[6]
	const MONTHS_SHORT = () => [t('month_january'), t('month_february'), t('month_march'), t('month_april'), t('month_may'), t('month_june'), t('month_july'), t('month_august'), t('month_september'), t('month_october'), t('month_november'), t('month_december')]
	const months = MONTHS_SHORT()
	if (first.getMonth() === last.getMonth()) {
		return `${months[first.getMonth()]} ${first.getDate()} – ${last.getDate()}, ${first.getFullYear()}`
	}
	if (first.getFullYear() === last.getFullYear()) {
		return `${months[first.getMonth()]} ${first.getDate()} – ${months[last.getMonth()]} ${last.getDate()}, ${first.getFullYear()}`
	}
	return `${months[first.getMonth()]} ${first.getDate()}, ${first.getFullYear()} – ${months[last.getMonth()]} ${last.getDate()}, ${last.getFullYear()}`
}

function dateKey(year: number, month: number, day: number): string {
	return `${year}-${month}-${day}`
}

function formatTime(hour: number, minute: number): string {
	return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function getRowTime(row: NoteRow, fieldId: string): string | null {
	const parsed = parseDateValue((row as Record<string, unknown>)[fieldId])
	if (!parsed || parsed.hour === undefined || parsed.minute === undefined) return null
	return formatTime(parsed.hour, parsed.minute)
}

function parseDateValue(val: unknown): { year: number; month: number; day: number; hour?: number; minute?: number } | null {
	if (!val || typeof val !== 'string') return null
	const tIdx = val.indexOf('T')
	const datePart = tIdx >= 0 ? val.slice(0, tIdx) : val
	const parts = datePart.split('-')
	if (parts.length !== 3) return null
	const year = parseInt(parts[0])
	const month = parseInt(parts[1]) - 1
	const day = parseInt(parts[2])
	if (isNaN(year) || isNaN(month) || isNaN(day)) return null
	if (tIdx >= 0) {
		const timePart = val.slice(tIdx + 1)
		const tp = timePart.split(':')
		if (tp.length >= 2) {
			const hour = parseInt(tp[0])
			const minute = parseInt(tp[1])
			if (!isNaN(hour) && !isNaN(minute)) return { year, month, day, hour, minute }
		}
	}
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
	const [currentDay, setCurrentDay] = useState(today.getDate())
	const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([])
	const [filterMenuOpen, setFilterMenuOpen] = useState(false)
	const [fieldsMenuOpen, setFieldsMenuOpen] = useState(false)
	const [dateFieldMenuOpen, setDateFieldMenuOpen] = useState(false)
	const [dragOverDay, setDragOverDay] = useState<number | null>(null)
	const [expandedDay, setExpandedDay] = useState<string | null>(null)
	const [actionDay, setActionDay] = useState<{ year: number; month: number; day: number } | null>(null)
	const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const weekBodyRef = useRef<HTMLDivElement>(null)
	const [nowMinutes, setNowMinutes] = useState(() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes() })

	const filterMenuRef = useRef<HTMLDivElement>(null)
	const fieldsMenuRef = useRef<HTMLDivElement>(null)
	const dateFieldMenuRef = useRef<HTMLDivElement>(null)
	const mobileActionBarRef = useRef<HTMLDivElement>(null)
	const filtersInitialized = useRef(false)
	const loadVersion = useRef(0)

	useEffect(() => { setActiveView(externalView) }, [externalView.id])

	// Update current time indicator every minute
	useEffect(() => {
		const tick = () => { const n = new Date(); setNowMinutes(n.getHours() * 60 + n.getMinutes()) }
		const id = setInterval(tick, 60_000)
		return () => clearInterval(id)
	}, [])

	const saveView = useCallback(async (updated: ViewConfig) => {
		setActiveView(updated)
		await onViewChange(updated)
	}, [onViewChange])

	const viewMode = activeView.calendarViewMode ?? 'month'

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
		if (!dateFieldMenuOpen) return
		const h = (e: MouseEvent) => {
			if (mobileActionBarRef.current?.contains(e.target as Node)) return
			if (dateFieldMenuRef.current && !dateFieldMenuRef.current.contains(e.target as Node)) setDateFieldMenuOpen(false)
		}
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

	const weekDays = useMemo(
		() => viewMode === 'week' ? buildWeekGrid(currentYear, currentMonth, currentDay) : [],
		[viewMode, currentYear, currentMonth, currentDay]
	)

	const rowsByDate = useMemo(() => {
		const map = new Map<string, NoteRow[]>()
		if (!dateField) return map
		for (const row of filteredRows) {
			const parsed = parseDateValue((row as Record<string, unknown>)[dateField.id])
			if (!parsed) continue
			const key = dateKey(parsed.year, parsed.month, parsed.day)
			if (viewMode === 'week') {
				const match = weekDays.some(d =>
					d.getFullYear() === parsed.year && d.getMonth() === parsed.month && d.getDate() === parsed.day
				)
				if (match) {
					const existing = map.get(key) ?? []
					existing.push(row)
					map.set(key, existing)
				}
			} else {
				if (parsed.year === currentYear && parsed.month === currentMonth) {
					const existing = map.get(key) ?? []
					existing.push(row)
					map.set(key, existing)
				}
			}
		}
		// Sort entries within each day by time (entries without time come first)
		for (const [key, dayRows] of map) {
			dayRows.sort((a, b) => {
				const pa = parseDateValue((a as Record<string, unknown>)[dateField.id])
				const pb = parseDateValue((b as Record<string, unknown>)[dateField.id])
				const ta = (pa?.hour ?? -1) * 60 + (pa?.minute ?? -1)
				const tb = (pb?.hour ?? -1) * 60 + (pb?.minute ?? -1)
				return ta - tb
			})
			map.set(key, dayRows)
		}
		return map
	}, [filteredRows, dateField, currentYear, currentMonth, currentDay, viewMode, weekDays])

	const noDateRows = useMemo(() => {
		if (!dateField) return []
		return filteredRows.filter(row => {
			const val = (row as Record<string, unknown>)[dateField.id]
			return !val || String(val as string | number | boolean).trim() === ''
		})
	}, [filteredRows, dateField])

	// Earliest timed card in current week (minutes from midnight)
	const earliestTimedMinute = useMemo(() => {
		if (viewMode !== 'week' || !dateField) return null
		let earliest: number | null = null
		for (const [, dayRows] of rowsByDate) {
			for (const row of dayRows) {
				const p = parseDateValue((row as Record<string, unknown>)[dateField.id])
				if (p && p.hour !== undefined && p.minute !== undefined) {
					const m = p.hour * 60 + p.minute
					if (earliest === null || m < earliest) earliest = m
				}
			}
		}
		return earliest
	}, [viewMode, dateField, rowsByDate])

	// Auto-scroll week body to current time or earliest card
	const weekAnchor = viewMode === 'week' && weekDays.length > 0 ? weekDays[0].toISOString() : ''
	useEffect(() => {
		if (viewMode !== 'week' || loading) return
		const timer = setTimeout(() => {
			const el = weekBodyRef.current
			if (!el || el.scrollHeight <= el.clientHeight) return
			const SLOT_HEIGHT = 48
			const totalHeight = SLOT_HEIGHT * 24
			const targetMinutes = earliestTimedMinute !== null ? Math.min(earliestTimedMinute, nowMinutes) : nowMinutes
			const targetPx = (targetMinutes / 1440) * totalHeight
			const viewportHeight = el.clientHeight
			el.scrollTo({ top: Math.max(0, targetPx - viewportHeight * 0.25), behavior: 'smooth' })
		}, 100)
		return () => clearTimeout(timer)
	}, [viewMode, weekAnchor, loading])

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

	const goToPrev = () => {
		if (viewMode === 'week') {
			const d = new Date(currentYear, currentMonth, currentDay - 7)
			setCurrentYear(d.getFullYear()); setCurrentMonth(d.getMonth()); setCurrentDay(d.getDate())
		} else {
			if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) }
			else setCurrentMonth(m => m - 1)
		}
	}
	const goToNext = () => {
		if (viewMode === 'week') {
			const d = new Date(currentYear, currentMonth, currentDay + 7)
			setCurrentYear(d.getFullYear()); setCurrentMonth(d.getMonth()); setCurrentDay(d.getDate())
		} else {
			if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) }
			else setCurrentMonth(m => m + 1)
		}
	}
	const goToToday = () => {
		setCurrentYear(today.getFullYear())
		setCurrentMonth(today.getMonth())
		setCurrentDay(today.getDate())
	}

	const handleDayClick = async (year: number, month: number, day: number) => {
		if (!dbFile || !dateField) return
		const newFile = await manager.createNote(dbFile)
		const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
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

	const handleDayDrop = async (e: React.DragEvent, year: number, month: number, day: number) => {
		e.preventDefault()
		e.stopPropagation()
		setDragOverDay(null)
		const path = e.dataTransfer.getData('nb-cal-path')
		if (!path || !dateField) return
		const file = app.vault.getFileByPath(path)
		if (!file) return
		const datePart = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
		await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			const existing = fm[dateField.id]
			if (typeof existing === 'string' && existing.includes('T')) {
				fm[dateField.id] = `${datePart}T${existing.split('T')[1]}`
			} else {
				fm[dateField.id] = datePart
			}
		})
	}

	// ── Render ────────────────────────────────────────────────────────────────

	const isMobile = useIsMobile()

	if (!dbFile) return <div className="nb-empty-state"><p>{t('no_database_open')}</p></div>
	if (loading) return <div className="nb-loading">{t('loading')}</div>

	const todayDay = today.getFullYear() === currentYear && today.getMonth() === currentMonth ? today.getDate() : null

	const closeMobileMenus = (except?: string) => {
		if (except !== 'datefield') setDateFieldMenuOpen(false)
		if (except !== 'fields') setFieldsMenuOpen(false)
		if (except !== 'filter') setFilterMenuOpen(false)
	}

	const toolbarContent = isMobile ? (
		<MobileToolbar
			actionBarRef={mobileActionBarRef}
			actions={[
				{ id: 'datefield', label: t('date_field'), icon: <IconFields />, active: dateFieldMenuOpen, onClick: () => { closeMobileMenus('datefield'); setDateFieldMenuOpen(v => !v) } },
				{ id: 'fields', label: t('fields'), icon: <IconFields />, active: fieldsMenuOpen, onClick: () => { closeMobileMenus('fields'); setFieldsMenuOpen(v => !v) } },
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
			<BottomSheet open={dateFieldMenuOpen} onClose={() => setDateFieldMenuOpen(false)} title={t('date_field')}>
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
			</BottomSheet>
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
				<button className="nb-menu-item" onClick={() => addFilter('_title', 'Nome', '📄', 'title')}>
					<span className="nb-menu-item-icon">📄</span><span>{t('name_column')}</span>
				</button>
				{config.schema.map(col => (
					<button key={col.id} className="nb-menu-item" onClick={() => addFilter(col.id, col.name, getColumnIconStatic(col.type), col.type)}>
						<span className="nb-menu-item-icon">{getColumnIconStatic(col.type)}</span>
						<span>{col.name}</span>
					</button>
				))}
			</BottomSheet>
			{/* View mode toggle */}
			<div className="nb-cal-view-toggle" style={{ margin: '4px 12px' }}>
				{(['month', 'week'] as const).map(m => (
					<button key={m} className={`nb-cal-view-btn${viewMode === m ? ' nb-cal-view-btn--active' : ''}`}
						onClick={() => { void saveView({ ...activeView, calendarViewMode: m }) }}>
						{m === 'month' ? t('calendar_view_month') : t('calendar_view_week')}
					</button>
				))}
			</div>
			{/* Calendar navigation */}
			<div className="nb-cal-nav" style={{ padding: '4px 12px' }}>
				<button className="nb-toolbar-btn nb-cal-nav-arrow" onClick={goToPrev} title={viewMode === 'week' ? t('calendar_prev_week') : t('calendar_prev_month')}>‹</button>
				<button className="nb-toolbar-btn nb-cal-today-btn" onClick={goToToday}>{t('calendar_today')}</button>
				<span className="nb-cal-month-label">
					{viewMode === 'week' ? formatWeekRange(weekDays) : `${MONTHS_LONG()[currentMonth]} ${currentYear}`}
				</span>
				<button className="nb-toolbar-btn nb-cal-nav-arrow" onClick={goToNext} title={viewMode === 'week' ? t('calendar_next_week') : t('calendar_next_month')}>›</button>
			</div>
		</MobileToolbar>
	) : (
		<>
			{/* Desktop Toolbar */}
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

				{/* View mode toggle */}
				<div className="nb-cal-view-toggle">
					{(['month', 'week'] as const).map(m => (
						<button key={m} className={`nb-cal-view-btn${viewMode === m ? ' nb-cal-view-btn--active' : ''}`}
							onClick={() => { void saveView({ ...activeView, calendarViewMode: m }) }}>
							{m === 'month' ? t('calendar_view_month') : t('calendar_view_week')}
						</button>
					))}
				</div>

				{/* Navegação */}
				<div className="nb-cal-nav">
					<button className="nb-toolbar-btn nb-cal-nav-arrow" onClick={goToPrev} title={viewMode === 'week' ? t('calendar_prev_week') : t('calendar_prev_month')}>‹</button>
					<button className="nb-toolbar-btn nb-cal-today-btn" onClick={goToToday}>{t('calendar_today')}</button>
					<span className="nb-cal-month-label">
						{viewMode === 'week' ? formatWeekRange(weekDays) : `${MONTHS_LONG()[currentMonth]} ${currentYear}`}
					</span>
					<button className="nb-toolbar-btn nb-cal-nav-arrow" onClick={goToNext} title={viewMode === 'week' ? t('calendar_next_week') : t('calendar_next_month')}>›</button>
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
		</>
	)

	return (
		<div className="nb-container">
			{toolbarContent}

			{/* Calendar body */}
			{!dateField ? (
				<div className="nb-cal-no-field">
					<p>{t('calendar_no_date_field')}</p>
				</div>
			) : (
				<>
					{viewMode === 'week' ? (
						<div className="nb-cal-week-container">
							{/* All-day row */}
							<div className="nb-cal-week-allday">
								<div className="nb-cal-week-time-gutter nb-cal-week-allday-label">{t('calendar_all_day')}</div>
								{weekDays.map(d => {
									const key = dateKey(d.getFullYear(), d.getMonth(), d.getDate())
									const dayRows = (rowsByDate.get(key) ?? []).filter(row => {
										const p = parseDateValue((row as Record<string, unknown>)[dateField.id])
										return !p || p.hour === undefined
									})
									return (
										<div
											key={key}
											className="nb-cal-week-allday-cell"
											onClick={() => { void handleDayClick(d.getFullYear(), d.getMonth(), d.getDate()) }}
											onDragOver={e => handleDayDragOver(e, d.getDate())}
											onDragLeave={handleDayDragLeave}
											onDrop={e => { void handleDayDrop(e, d.getFullYear(), d.getMonth(), d.getDate()) }}
										>
											{dayRows.map(row => (
												<div
													key={row._file.path}
													className="nb-cal-card nb-cal-card--allday"
													draggable
													onDragStart={e => handleCardDragStart(e, row)}
													onClick={e => { e.stopPropagation(); void app.workspace.getLeaf().openFile(row._file) }}
												>
													<span className="nb-cal-card-title">{row._title}</span>
												</div>
											))}
										</div>
									)
								})}
							</div>
							{/* Day headers */}
							<div className="nb-cal-week-header">
								<div className="nb-cal-week-time-gutter" />
								{weekDays.map(d => {
									const isToday = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
									return (
										<div key={d.toISOString()} className={`nb-cal-week-day-header${isToday ? ' nb-cal-week-day-header--today' : ''}`}>
											{DAYS_SHORT()[d.getDay()]} {d.getDate()}
										</div>
									)
								})}
							</div>
							{/* Time grid */}
							<div className="nb-cal-week-body" ref={weekBodyRef}>
								{/* Current time indicator spanning full width */}
								{weekDays.some(d => d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()) && (
									<div
										className="nb-cal-now-line"
										style={{ top: `${(nowMinutes / 1440) * 48 * 24}px` }}
									/>
								)}
								<div className="nb-cal-week-time-gutter">
									{Array.from({ length: 24 }, (_, h) => (
										<div key={h} className="nb-cal-week-hour-label">
											{formatTime(h, 0)}
										</div>
									))}
								</div>
								{weekDays.map(d => {
									const key = dateKey(d.getFullYear(), d.getMonth(), d.getDate())
									const isToday = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
									const timedRows = (rowsByDate.get(key) ?? []).filter(row => {
										const p = parseDateValue((row as Record<string, unknown>)[dateField.id])
										return p && p.hour !== undefined
									})
									return (
										<div
											key={key}
											className={`nb-cal-week-day-col${isToday ? ' nb-cal-week-day-col--today' : ''}`}
											onClick={() => { void handleDayClick(d.getFullYear(), d.getMonth(), d.getDate()) }}
											onDragOver={e => handleDayDragOver(e, d.getDate())}
											onDragLeave={handleDayDragLeave}
											onDrop={e => { void handleDayDrop(e, d.getFullYear(), d.getMonth(), d.getDate()) }}
										>
											{/* Hour grid lines */}
											{Array.from({ length: 24 }, (_, h) => (
												<div key={h} className="nb-cal-week-hour-slot" />
											))}
											{/* Positioned timed events */}
											{timedRows.map(row => {
												const p = parseDateValue((row as Record<string, unknown>)[dateField.id])
												if (!p || p.hour === undefined || p.minute === undefined) return null
												const topPct = ((p.hour * 60 + p.minute) / 1440) * 100
												return (
													<div
														key={row._file.path}
														className="nb-cal-card nb-cal-card--timed"
														draggable
														onDragStart={e => handleCardDragStart(e, row)}
														onClick={e => { e.stopPropagation(); void app.workspace.getLeaf().openFile(row._file) }}
														style={{ top: `${topPct}%` }}
													>
														<div className="nb-cal-card-title-row">
															<span className="nb-cal-time-badge">{formatTime(p.hour, p.minute)}</span>
															<span className="nb-cal-card-title">{row._title}</span>
														</div>
													</div>
												)
											})}
										</div>
									)
								})}
							</div>
						</div>
					) : (
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
								const dayRows  = rowsByDate.get(dateKey(currentYear, currentMonth, day)) ?? []
								return (
									<div
										key={day}
										className={`nb-cal-cell${isToday ? ' nb-cal-cell--today' : ''}${isDragOver ? ' nb-cal-cell--drag-over' : ''}`}
										onClick={!isMobile ? () => { void handleDayClick(currentYear, currentMonth, day) } : undefined}
										onDragOver={e => handleDayDragOver(e, day)}
										onDragLeave={handleDayDragLeave}
										onDrop={e => { void handleDayDrop(e, currentYear, currentMonth, day) }}
										title={!isMobile ? t('calendar_click_to_create') : undefined}
										onTouchStart={isMobile ? () => { longPressRef.current = setTimeout(() => { setActionDay({ year: currentYear, month: currentMonth, day }) }, 500) } : undefined}
										onTouchMove={isMobile ? () => { if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null } } : undefined}
										onTouchEnd={isMobile ? () => { if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null } } : undefined}
									>
										<div className="nb-cal-cell-header">
											<span className={`nb-cal-day-num${isToday ? ' nb-cal-day-num--today' : ''}`}>{day}</span>
										</div>
									<div className="nb-cal-cell-body">
										{(() => {
											const mobileMax = 1
											const showRows = isMobile && dayRows.length > mobileMax ? dayRows.slice(0, mobileMax) : dayRows
											const extraCount = isMobile ? dayRows.length - showRows.length : 0
											const dayKey = dateKey(currentYear, currentMonth, day)
											return <>
												{showRows.map(row => (
													<div
														key={row._file.path}
														className="nb-cal-card"
														draggable={!isMobile}
														onDragStart={!isMobile ? e => handleCardDragStart(e, row) : undefined}
														onClick={(e) => { e.stopPropagation(); void app.workspace.getLeaf().openFile(row._file) }}
													>
														<div className="nb-cal-card-title-row">
															{dateField && (() => { const tm = getRowTime(row, dateField.id); return tm ? <span className="nb-cal-time-badge">{tm}</span> : null })()}
															<span className="nb-cal-card-title">{row._title}</span>
														</div>
														{!isMobile && (() => {
															const dbFolder = dbFile?.parent?.path ?? ''
															const fileFolder = row._file.parent?.path ?? ''
															const relPath = activeView.includeSubfolders && fileFolder.length > dbFolder.length
																? fileFolder.slice(dbFolder.length + 1) : ''
															return relPath ? <div className="nb-folder-path">{relPath}</div> : null
														})()}
														{!isMobile && visibleCols.length > 0 && (
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
												{extraCount > 0 && (
													<button className="nb-cal-more-badge" onClick={e => { e.stopPropagation(); setExpandedDay(dayKey) }}>
														+{extraCount}
													</button>
												)}
											</>
										})()}
									</div>
								</div>
							)
						})
						}
					</div>
					)}

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

			{/* Expanded day BottomSheet (mobile) */}
			<BottomSheet open={expandedDay !== null} onClose={() => setExpandedDay(null)} title={expandedDay ?? ''}>
				{(expandedDay !== null ? (rowsByDate.get(expandedDay) ?? []) : []).map(row => (
					<button key={row._file.path} className="nb-menu-item" onClick={() => { void app.workspace.getLeaf().openFile(row._file); setExpandedDay(null) }}>
						<span className="nb-menu-item-icon">📄</span><span>{row._title}</span>
					</button>
				))}
			</BottomSheet>

			{/* Day actions BottomSheet (mobile long-press) */}
			<BottomSheet open={actionDay !== null} onClose={() => setActionDay(null)} title={actionDay ? `${actionDay.day}/${actionDay.month + 1}/${actionDay.year}` : ''}>
				{actionDay && (() => {
					const dayKey = dateKey(actionDay.year, actionDay.month, actionDay.day)
					const dayRows = rowsByDate.get(dayKey) ?? []
					return <>
						<button className="nb-menu-item" onClick={() => { void handleDayClick(actionDay.year, actionDay.month, actionDay.day); setActionDay(null) }}>
							<span className="nb-menu-item-icon">➕</span><span>{t('add_card')}</span>
						</button>
						{dayRows.length > 0 && <div className="nb-menu-separator" />}
						{dayRows.map(row => (
							<Fragment key={row._file.path}>
								<button className="nb-menu-item" onClick={() => { void app.workspace.getLeaf().openFile(row._file); setActionDay(null) }}>
									<span className="nb-menu-item-icon">📄</span><span>{row._title}</span>
								</button>
								<div className="nb-cal-day-actions">
									<button className="nb-menu-item" onClick={() => { void manager.duplicateNotes([row._file]); setActionDay(null) }}>
										<span className="nb-menu-item-icon">📋</span><span>{t('duplicate_note')}</span>
									</button>
									<button className="nb-menu-item nb-menu-item--danger" onClick={() => { void manager.deleteNotes([row._file]); setActionDay(null) }}>
										<span className="nb-menu-item-icon">🗑</span><span>{t('delete_note')}</span>
									</button>
								</div>
							</Fragment>
						))}
					</>
				})()}
			</BottomSheet>
		</div>
	)
}
