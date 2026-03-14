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

// ── Constants ─────────────────────────────────────────────────────────────────

const SIDEBAR_W = 200
const ROW_H     = 34
const GROUP_H   = 28
const HEADER_H  = 56   // two rows of 28px each

const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

type ZoomLevel = 'days' | 'weeks' | 'months'
const UNIT_W:    Record<ZoomLevel, number> = { days: 30,  weeks: 80,  months: 100 }
const TOTAL_U:   Record<ZoomLevel, number> = { days: 730, weeks: 156, months: 48  }
const ZOOM_LBL:  Record<ZoomLevel, string> = { days: 'Dias', weeks: 'Semanas', months: 'Meses' }

// ── Utilities ─────────────────────────────────────────────────────────────────

function addDays(d: Date, n: number): Date {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}
function addMonths(d: Date, n: number): Date {
	return new Date(d.getFullYear(), d.getMonth() + n, 1)
}
function parseDateObj(val: unknown): Date | null {
	if (!val || typeof val !== 'string') return null
	const p = val.split('-')
	if (p.length !== 3) return null
	const y = parseInt(p[0]), m = parseInt(p[1]) - 1, d = parseInt(p[2])
	if (isNaN(y) || isNaN(m) || isNaN(d)) return null
	return new Date(y, m, d)
}
function computeOrigin(zoom: ZoomLevel, today: Date): Date {
	if (zoom === 'months') return new Date(today.getFullYear() - 1, 0, 1)
	if (zoom === 'weeks')  { const a = addDays(today, -78 * 7); return addDays(a, -a.getDay()) }
	return new Date(today.getFullYear() - 1, 0, 1)
}
function d2px(d: Date, zoom: ZoomLevel, origin: Date, unitW: number): number {
	if (zoom === 'days')  return Math.round((d.getTime() - origin.getTime()) / 86400000) * unitW
	if (zoom === 'weeks') return ((d.getTime() - origin.getTime()) / 86400000 / 7) * unitW
	const mo = (d.getFullYear() - origin.getFullYear()) * 12 + (d.getMonth() - origin.getMonth())
	const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
	return (mo + (d.getDate() - 1) / dim) * unitW
}

interface HCell { key: string; left: number; width: number; label: string }
function computeHeader(zoom: ZoomLevel, origin: Date, unitW: number, total: number): { top: HCell[]; bottom: HCell[] } {
	const bottom: HCell[] = []
	const top: HCell[]    = []

	if (zoom === 'months') {
		for (let i = 0; i < total; i++) {
			const d = addMonths(origin, i)
			bottom.push({ key: `m${i}`, left: i * unitW, width: unitW, label: MONTHS_SHORT[d.getMonth()] })
		}
		let curY = -1, sl = 0
		for (let i = 0; i <= total; i++) {
			const yr = i < total ? addMonths(origin, i).getFullYear() : -1
			if (yr !== curY && curY !== -1) {
				top.push({ key: `y${curY}`, left: sl, width: i * unitW - sl, label: String(curY) })
				sl = i * unitW
			}
			if (curY === -1 || yr !== curY) curY = yr
		}
	} else if (zoom === 'weeks') {
		for (let i = 0; i < total; i++) {
			const d = addDays(origin, i * 7)
			bottom.push({ key: `w${i}`, left: i * unitW, width: unitW,
				label: `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}` })
		}
		let curMY = '', sl = 0
		for (let i = 0; i <= total; i++) {
			const d   = i < total ? addDays(origin, i * 7) : null
			const my  = d ? `${d.getFullYear()}-${d.getMonth()}` : ''
			if (my !== curMY && curMY !== '') {
				const d0 = addDays(origin, Math.round(sl / unitW) * 7)
				top.push({ key: curMY, left: sl, width: i * unitW - sl,
					label: `${MONTHS_SHORT[d0.getMonth()]} ${d0.getFullYear()}` })
				sl = i * unitW
			}
			if (curMY === '' || my !== curMY) curMY = my
		}
	} else {
		for (let i = 0; i < total; i++) {
			const d = addDays(origin, i)
			bottom.push({ key: `d${i}`, left: i * unitW, width: unitW, label: String(d.getDate()) })
		}
		let curMY = '', sl = 0
		for (let i = 0; i <= total; i++) {
			const d   = i < total ? addDays(origin, i) : null
			const my  = d ? `${d.getFullYear()}-${d.getMonth()}` : ''
			if (my !== curMY && curMY !== '') {
				const d0 = addDays(origin, Math.round(sl / unitW))
				top.push({ key: curMY, left: sl, width: i * unitW - sl,
					label: `${MONTHS_SHORT[d0.getMonth()]} ${d0.getFullYear()}` })
				sl = i * unitW
			}
			if (curMY === '' || my !== curMY) curMY = my
		}
	}
	return { top, bottom }
}

type TLItem =
	| { kind: 'group'; label: string; color: string | undefined }
	| { kind: 'row'; row: NoteRow; barLeft: number | null; barWidth: number | null }

// ── Component ─────────────────────────────────────────────────────────────────

interface DatabaseTimelineProps {
	dbFile: TFile | null
	manager: DatabaseManager
	externalView: ViewConfig
	onViewChange: (view: ViewConfig) => Promise<void>
}

export function DatabaseTimeline({ dbFile, manager, externalView, onViewChange }: DatabaseTimelineProps) {
	const app   = useApp()
	const today = useMemo(() => new Date(), [])

	const [rows,   setRows]   = useState<NoteRow[]>([])
	const [config, setConfig] = useState<DatabaseConfig>(DEFAULT_DATABASE_CONFIG)
	const [loading, setLoading] = useState(true)
	const [activeView, setActiveView] = useState<ViewConfig>(externalView)
	const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([])

	const [filterMenuOpen, setFilterMenuOpen] = useState(false)
	const [fieldsMenuOpen, setFieldsMenuOpen] = useState(false)
	const [startMenuOpen,  setStartMenuOpen]  = useState(false)
	const [endMenuOpen,    setEndMenuOpen]    = useState(false)
	const [groupMenuOpen,  setGroupMenuOpen]  = useState(false)
	const [noIntervalOpen, setNoIntervalOpen] = useState(true)

	const filterMenuRef = useRef<HTMLDivElement>(null)
	const fieldsMenuRef = useRef<HTMLDivElement>(null)
	const startMenuRef  = useRef<HTMLDivElement>(null)
	const endMenuRef    = useRef<HTMLDivElement>(null)
	const groupMenuRef  = useRef<HTMLDivElement>(null)
	const scrollRef     = useRef<HTMLDivElement>(null)
	const filtersInit   = useRef(false)

	useEffect(() => { setActiveView(externalView) }, [externalView.id])

	const saveView = useCallback(async (v: ViewConfig) => {
		setActiveView(v); await onViewChange(v)
	}, [onViewChange])

	// ── Data loading ──────────────────────────────────────────────────────────

	const loadData = useCallback(async () => {
		if (!dbFile) { setLoading(false); return }
		setLoading(true)
		const cfg   = await manager.readConfig(dbFile)
		const notes = manager.getNotesInDatabase(dbFile)
		if (cfg.schema.length === 0 && notes.length > 0) {
			cfg.schema = manager.inferSchema(notes)
			await manager.writeConfig(dbFile, cfg)
		}
		const noteRows = await manager.resolveLookupsForRows(
			evaluateFormulas(notes.map(f => manager.getNoteData(f, cfg.schema)), cfg.schema),
			cfg.schema
		)
		if (!filtersInit.current) {
			filtersInit.current = true
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
		setConfig(cfg); setRows(noteRows); setLoading(false)
	}, [dbFile, manager])

	useEffect(() => { filtersInit.current = false }, [dbFile])
	useEffect(() => { loadData() }, [loadData])
	useEffect(() => {
		const cb = () => loadData()
		app.vault.on('create', cb); app.vault.on('delete', cb); app.vault.on('rename', cb)
		app.metadataCache.on('changed', cb)
		return () => {
			app.vault.off('create', cb); app.vault.off('delete', cb); app.vault.off('rename', cb)
			app.metadataCache.off('changed', cb)
		}
	}, [app, loadData])

	// ── Close menus on outside click ──────────────────────────────────────────

	const mkCloseEffect = (open: boolean, ref: React.RefObject<HTMLDivElement>, setter: (v: boolean) => void) =>
		useEffect(() => {
			if (!open) return
			const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setter(false) }
			document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
		}, [open]) // eslint-disable-line react-hooks/exhaustive-deps

	mkCloseEffect(filterMenuOpen, filterMenuRef, setFilterMenuOpen)
	mkCloseEffect(fieldsMenuOpen, fieldsMenuRef, setFieldsMenuOpen)
	mkCloseEffect(startMenuOpen,  startMenuRef,  setStartMenuOpen)
	mkCloseEffect(endMenuOpen,    endMenuRef,    setEndMenuOpen)
	mkCloseEffect(groupMenuOpen,  groupMenuRef,  setGroupMenuOpen)

	// ── Canvas geometry ────────────────────────────────────────────────────────

	const zoom   = activeView.timelineZoom ?? 'months'
	const unitW  = UNIT_W[zoom]
	const total  = TOTAL_U[zoom]
	const origin = useMemo(() => computeOrigin(zoom, today), [zoom, today])
	const canvasWidth = total * unitW
	const header  = useMemo(() => computeHeader(zoom, origin, unitW, total), [zoom, origin, unitW, total])
	const todayPx = useMemo(() => d2px(today, zoom, origin, unitW), [today, zoom, origin, unitW])

	// Scroll to today on zoom change and initial mount
	useEffect(() => {
		requestAnimationFrame(() => {
			if (!scrollRef.current) return
			const target = Math.max(0, todayPx - scrollRef.current.clientWidth * 0.3)
			scrollRef.current.scrollLeft = target
		})
	}, [zoom]) // eslint-disable-line react-hooks/exhaustive-deps

	// ── Derived data ──────────────────────────────────────────────────────────

	const filteredRows  = useMemo(() => applyFilters(rows, activeFilters), [rows, activeFilters])
	const displayRows   = useMemo(() => applySorts(filteredRows, activeView.sorts), [filteredRows, activeView.sorts])

	const startField = useMemo(() => config.schema.find(c => c.id === activeView.timelineStartField) ?? null, [config.schema, activeView.timelineStartField])
	const endField   = useMemo(() => config.schema.find(c => c.id === activeView.timelineEndField)   ?? null, [config.schema, activeView.timelineEndField])
	const groupField = useMemo(() => config.schema.find(c => c.id === activeView.timelineGroupByField) ?? null, [config.schema, activeView.timelineGroupByField])

	const visibleCols = useMemo(
		() => config.schema.filter(col => col.visible && !activeView.hiddenColumns.includes(col.id)
			&& col.id !== activeView.timelineStartField && col.id !== activeView.timelineEndField),
		[config.schema, activeView.hiddenColumns, activeView.timelineStartField, activeView.timelineEndField]
	)

	const noIntervalRows = useMemo(() => {
		if (!startField) return []
		return filteredRows.filter(row => !parseDateObj(row[startField.id]))
	}, [filteredRows, startField])

	const items = useMemo((): TLItem[] => {
		const makeItem = (row: NoteRow): TLItem => {
			if (!startField) return { kind: 'row', row, barLeft: null, barWidth: null }
			const sd = parseDateObj(row[startField.id])
			if (!sd) return { kind: 'row', row, barLeft: null, barWidth: null }
			const ed        = endField ? parseDateObj(row[endField.id]) : null
			const edForCalc = ed ?? sd
			const barLeft   = Math.max(0, d2px(sd, zoom, origin, unitW))
			const barRight  = d2px(edForCalc, zoom, origin, unitW) + unitW
			return { kind: 'row', row, barLeft, barWidth: Math.max(8, barRight - barLeft) }
		}

		const src = startField ? displayRows.filter(row => !!parseDateObj(row[startField.id])) : displayRows

		// Default sort by start date when no explicit sort is set
		const sorted = activeView.sorts.length > 0 || !startField ? src : [...src].sort((a, b) => {
			const da = parseDateObj(a[startField.id]), db = parseDateObj(b[startField.id])
			if (!da && !db) return 0; if (!da) return 1; if (!db) return -1
			return da.getTime() - db.getTime()
		})

		if (!groupField) return sorted.map(makeItem)

		const groups = new Map<string, NoteRow[]>()
		for (const row of sorted) {
			const val = String(row[groupField.id] ?? '')
			if (!groups.has(val)) groups.set(val, [])
			groups.get(val)!.push(row)
		}
		const optOrder = groupField.options?.map(o => o.value) ?? []
		const keys = [...groups.keys()].sort((a, b) => {
			const ai = optOrder.indexOf(a), bi = optOrder.indexOf(b)
			if (ai !== -1 && bi !== -1) return ai - bi
			if (ai !== -1) return -1; if (bi !== -1) return 1
			if (!a) return 1; if (!b) return -1
			return a.localeCompare(b)
		})
		const result: TLItem[] = []
		for (const key of keys) {
			const opt = groupField.options?.find(o => o.value === key)
			result.push({ kind: 'group', label: key || 'Sem valor', color: opt?.color })
			for (const row of groups.get(key)!) result.push(makeItem(row))
		}
		return result
	}, [displayRows, startField, endField, groupField, zoom, origin, unitW, activeView.sorts])

	// ── Actions ───────────────────────────────────────────────────────────────

	const saveActivePills = useCallback(async (filters: ActiveFilter[]) => {
		await saveView({ ...activeView, activePills: filters.map(f => ({ id: f.id, columnId: f.columnId, operator: f.operator, value: f.value, conjunction: f.conjunction })) })
	}, [saveView, activeView])

	const addFilter = (columnId: string, columnName: string, icon: string, columnType: string) => {
		const next = [...activeFilters, { id: crypto.randomUUID(), columnId, columnName, columnType, icon, operator: getDefaultOperator(columnType), value: '', conjunction: 'and' as const }]
		setActiveFilters(next); saveActivePills(next); setFilterMenuOpen(false)
	}
	const removeFilter = (id: string) => { const n = activeFilters.filter(f => f.id !== id); setActiveFilters(n); saveActivePills(n) }
	const updateFilter = (id: string, op: FilterOperator, val: string) => { const n = activeFilters.map(f => f.id === id ? { ...f, operator: op, value: val } : f); setActiveFilters(n); saveActivePills(n) }
	const toggleConj   = (id: string) => { const n = activeFilters.map(f => f.id === id ? { ...f, conjunction: f.conjunction === 'and' ? 'or' as const : 'and' as const } : f); setActiveFilters(n); saveActivePills(n) }

	const toggleFieldVisibility = useCallback(async (fieldId: string) => {
		const hidden = activeView.hiddenColumns.includes(fieldId)
			? activeView.hiddenColumns.filter(id => id !== fieldId)
			: [...activeView.hiddenColumns, fieldId]
		await saveView({ ...activeView, hiddenColumns: hidden })
	}, [activeView, saveView])

	const handlePrev  = () => scrollRef.current?.scrollBy({ left: -(scrollRef.current.clientWidth * 0.6), behavior: 'smooth' })
	const handleNext  = () => scrollRef.current?.scrollBy({ left:   scrollRef.current.clientWidth * 0.6,  behavior: 'smooth' })
	const handleToday = () => {
		if (!scrollRef.current) return
		scrollRef.current.scrollTo({ left: Math.max(0, todayPx - scrollRef.current.clientWidth * 0.3), behavior: 'smooth' })
	}

	// ── Render ────────────────────────────────────────────────────────────────

	if (!dbFile) return <div className="nb-empty-state"><p>Nenhum banco de dados aberto.</p></div>
	if (loading)  return <div className="nb-loading">Carregando...</div>

	const todayInRange = todayPx >= 0 && todayPx <= canvasWidth

	// Helper for date field picker dropdown
	const DateFieldDropdown = ({ label, valueKey, open, setOpen, menuRef: ref }: {
		label: string; valueKey: 'timelineStartField' | 'timelineEndField'; open: boolean
		setOpen: (v: boolean) => void; menuRef: React.RefObject<HTMLDivElement>
	}) => {
		const fieldName = config.schema.find(c => c.id === activeView[valueKey])?.name ?? 'Nenhum'
		return (
			<div className="nb-fields-menu-wrapper" ref={ref}>
				<button className={`nb-toolbar-btn${open ? ' nb-toolbar-btn--active' : ''}`} onClick={() => setOpen(!open)}>
					{label}: <strong>{fieldName}</strong>
				</button>
				{open && (
					<div className="nb-fields-dropdown">
						<div className="nb-fields-dropdown-label">Campo de {label.toLowerCase()}</div>
						<button className={`nb-menu-item${!activeView[valueKey] ? ' nb-menu-item--active' : ''}`}
							onClick={async () => { await saveView({ ...activeView, [valueKey]: undefined }); setOpen(false) }}>
							<span className="nb-menu-item-icon">—</span><span>Nenhum</span>
						</button>
						{config.schema.filter(c => c.type === 'date').map(col => (
							<button key={col.id} className={`nb-menu-item${activeView[valueKey] === col.id ? ' nb-menu-item--active' : ''}`}
								onClick={async () => { await saveView({ ...activeView, [valueKey]: col.id }); setOpen(false) }}>
								<span className="nb-menu-item-icon">📅</span><span>{col.name}</span>
							</button>
						))}
					</div>
				)}
			</div>
		)
	}

	return (
		<div className="nb-container">
			{/* Toolbar */}
			<div className="nb-toolbar">
				<DateFieldDropdown label="Início" valueKey="timelineStartField" open={startMenuOpen} setOpen={setStartMenuOpen} menuRef={startMenuRef} />
				<DateFieldDropdown label="Fim"    valueKey="timelineEndField"   open={endMenuOpen}   setOpen={setEndMenuOpen}   menuRef={endMenuRef} />

				{/* Agrupar por */}
				<div className="nb-fields-menu-wrapper" ref={groupMenuRef}>
					<button className={`nb-toolbar-btn${groupMenuOpen ? ' nb-toolbar-btn--active' : ''}`} onClick={() => setGroupMenuOpen(v => !v)}>
						Agrupar: <strong>{groupField?.name ?? 'Nenhum'}</strong>
					</button>
					{groupMenuOpen && (
						<div className="nb-fields-dropdown">
							<div className="nb-fields-dropdown-label">Agrupar por</div>
							<button className={`nb-menu-item${!activeView.timelineGroupByField ? ' nb-menu-item--active' : ''}`}
								onClick={async () => { await saveView({ ...activeView, timelineGroupByField: undefined }); setGroupMenuOpen(false) }}>
								<span className="nb-menu-item-icon">—</span><span>Nenhum</span>
							</button>
							{config.schema.filter(c => c.type === 'select' || c.type === 'status').map(col => (
								<button key={col.id} className={`nb-menu-item${activeView.timelineGroupByField === col.id ? ' nb-menu-item--active' : ''}`}
									onClick={async () => { await saveView({ ...activeView, timelineGroupByField: col.id }); setGroupMenuOpen(false) }}>
									<span className="nb-menu-item-icon">{getColumnIconStatic(col.type)}</span><span>{col.name}</span>
								</button>
							))}
						</div>
					)}
				</div>

				{/* Campos */}
				<div className="nb-fields-menu-wrapper" ref={fieldsMenuRef}>
					<button className={`nb-toolbar-btn${fieldsMenuOpen ? ' nb-toolbar-btn--active' : ''}`} onClick={() => setFieldsMenuOpen(v => !v)}>Campos</button>
					{fieldsMenuOpen && (
						<div className="nb-fields-dropdown">
							<div className="nb-fields-dropdown-label">Campos nas barras</div>
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
					<button className="nb-toolbar-btn nb-cal-nav-arrow" onClick={handlePrev} title="Scroll anterior">‹</button>
					<button className="nb-toolbar-btn nb-cal-today-btn" onClick={handleToday}>Hoje</button>
					<button className="nb-toolbar-btn nb-cal-nav-arrow" onClick={handleNext} title="Scroll próximo">›</button>
				</div>

				{/* Zoom */}
				<div className="nb-tl-zoom-group">
					{(['days', 'weeks', 'months'] as ZoomLevel[]).map(z => (
						<button key={z} className={`nb-tl-zoom-btn${zoom === z ? ' nb-tl-zoom-btn--active' : ''}`}
							onClick={() => saveView({ ...activeView, timelineZoom: z })}>
							{ZOOM_LBL[z]}
						</button>
					))}
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
									<span className="nb-menu-item-icon">{getColumnIconStatic(col.type)}</span><span>{col.name}</span>
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
								<button className={`nb-pill-conjunction${f.conjunction === 'or' ? ' nb-pill-conjunction--or' : ''}`} onClick={() => toggleConj(f.id)}>
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

			{/* Timeline body */}
			{!startField ? (
				<div className="nb-cal-no-field">
					<p>Selecione um campo de início no toolbar para exibir a timeline.</p>
				</div>
			) : (
				<div className="nb-tl-body" ref={scrollRef}>
					<div className="nb-tl-canvas-wrapper" style={{ width: SIDEBAR_W + canvasWidth }}>

						{/* Sidebar (sticky left) */}
						<div className="nb-tl-sidebar" style={{ width: SIDEBAR_W }}>
							<div className="nb-tl-sidebar-corner" style={{ height: HEADER_H }} />
							{items.map((item, idx) => item.kind === 'group' ? (
								<div key={`sg-${idx}`} className="nb-tl-sidebar-row nb-tl-sidebar-group" style={{ height: GROUP_H }}>
									{item.color && <span className="nb-tl-group-dot" style={{ background: item.color }} />}
									<span>{item.label}</span>
								</div>
							) : (
								<div key={item.row._file.path} className="nb-tl-sidebar-row" style={{ height: ROW_H }}
									onClick={() => app.workspace.getLeaf().openFile(item.row._file)}>
									<span className="nb-tl-row-label">{item.row._title}</span>
								</div>
							))}
						</div>

						{/* Canvas (scrolls horizontally) */}
						<div className="nb-tl-right" style={{ width: canvasWidth }}>
							{/* Sticky header */}
							<div className="nb-tl-header" style={{ height: HEADER_H }}>
								<div className="nb-tl-header-row" style={{ height: HEADER_H / 2, borderBottom: '1px solid var(--background-modifier-border)' }}>
									{header.top.map(cell => (
										<div key={cell.key} className="nb-tl-header-top-cell" style={{ left: cell.left, width: cell.width }}>
											{cell.label}
										</div>
									))}
								</div>
								<div className="nb-tl-header-row" style={{ height: HEADER_H / 2 }}>
									{header.bottom.map(cell => (
										<div key={cell.key} className="nb-tl-header-bottom-cell" style={{ left: cell.left, width: cell.width }}>
											{cell.label}
										</div>
									))}
								</div>
							</div>

							{/* Bars area */}
							<div style={{ position: 'relative', width: canvasWidth }}>
								{todayInRange && <div className="nb-tl-today-line" style={{ left: todayPx }} />}

								{items.map((item, idx) => item.kind === 'group' ? (
									<div key={`gr-${idx}`} className="nb-tl-group-row" style={{ height: GROUP_H }} />
								) : (
									<div key={item.row._file.path} className={`nb-tl-row${idx % 2 === 0 ? '' : ' nb-tl-row--odd'}`} style={{ height: ROW_H }}>
										{item.barLeft !== null && item.barWidth !== null && (
											<div className="nb-tl-bar"
												style={{ left: item.barLeft, width: item.barWidth, top: (ROW_H - 22) / 2, height: 22 }}
												onClick={() => app.workspace.getLeaf().openFile(item.row._file)}
												title={item.row._title}>
												<span className="nb-tl-bar-title">{item.row._title}</span>
												{visibleCols.map(col => {
													const val = item.row[col.id]
													if (!val || String(val).trim() === '') return null
													const display = Array.isArray(val) ? (val as string[]).join(', ') : String(val)
													return <span key={col.id} className="nb-tl-bar-field"> · {display}</span>
												})}
											</div>
										)}
									</div>
								))}
							</div>
						</div>
					</div>
				</div>
			)}

			{/* No-interval rows */}
			{noIntervalRows.length > 0 && (
				<div className="nb-tl-no-interval">
					<div className="nb-tl-no-interval-title" onClick={() => setNoIntervalOpen(v => !v)}>
						{noIntervalOpen ? '▾' : '▸'} Sem intervalo ({noIntervalRows.length})
					</div>
					{noIntervalOpen && (
						<div className="nb-tl-no-interval-list">
							{noIntervalRows.map(row => (
								<div key={row._file.path} className="nb-cal-card nb-cal-card--no-date"
									onClick={() => app.workspace.getLeaf().openFile(row._file)}>
									<span className="nb-cal-card-title">{row._title}</span>
								</div>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	)
}
