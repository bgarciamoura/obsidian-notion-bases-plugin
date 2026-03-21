import { TFile } from 'obsidian'
import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../context'
import { DatabaseManager } from '../database-manager'
import {
	FilterOperator, NoteRow, ViewConfig,
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
import { BottomSheet } from './BottomSheet'

// ── Constants ─────────────────────────────────────────────────────────────────

const SIDEBAR_W = 200
const ROW_H     = 34
const GROUP_H   = 28
const HEADER_H  = 56   // two rows of 28px each

const MONTHS_SHORT = () => [t('month_short_jan'),t('month_short_feb'),t('month_short_mar'),t('month_short_apr'),t('month_short_may'),t('month_short_jun'),t('month_short_jul'),t('month_short_aug'),t('month_short_sep'),t('month_short_oct'),t('month_short_nov'),t('month_short_dec')]

type ZoomLevel = 'days' | 'weeks' | 'months'
const UNIT_W:    Record<ZoomLevel, number> = { days: 30,  weeks: 80,  months: 100 }
const TOTAL_U:   Record<ZoomLevel, number> = { days: 730, weeks: 156, months: 48  }
const ZOOM_LBL = (): Record<ZoomLevel, string> => ({ days: t('zoom_days'), weeks: t('zoom_weeks'), months: t('zoom_months') })

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
function px2date(px: number, zoom: ZoomLevel, origin: Date, unitW: number): Date {
	if (zoom === 'days')  return addDays(origin, Math.round(px / unitW))
	if (zoom === 'weeks') return addDays(origin, Math.round(px / unitW * 7))
	return addMonths(origin, Math.floor(px / unitW))
}

interface HCell { key: string; left: number; width: number; label: string }
function computeHeader(zoom: ZoomLevel, origin: Date, unitW: number, total: number): { top: HCell[]; bottom: HCell[] } {
	const bottom: HCell[] = []
	const top: HCell[]    = []

	if (zoom === 'months') {
		for (let i = 0; i < total; i++) {
			const d = addMonths(origin, i)
			bottom.push({ key: `m${i}`, left: i * unitW, width: unitW, label: MONTHS_SHORT()[d.getMonth()] })
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
					label: `${MONTHS_SHORT()[d0.getMonth()]} ${d0.getFullYear()}` })
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
					label: `${MONTHS_SHORT()[d0.getMonth()]} ${d0.getFullYear()}` })
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

	const { rows, config, loading, activeFilters, setActiveFilters } = useDatabaseRows({
		app, dbFile, manager, includeSubfolders: externalView.includeSubfolders, externalView,
	})
	const [activeView, setActiveView] = useState<ViewConfig>(externalView)

	const [filterMenuOpen, setFilterMenuOpen] = useState(false)
	const [fieldsMenuOpen, setFieldsMenuOpen] = useState(false)
	const [startMenuOpen,  setStartMenuOpen]  = useState(false)
	const [endMenuOpen,    setEndMenuOpen]    = useState(false)
	const [groupMenuOpen,  setGroupMenuOpen]  = useState(false)
	const [noIntervalOpen, setNoIntervalOpen] = useState(true)

	const [resizing, setResizing] = useState<{
		filePath: string; handle: 'left' | 'right'
		startX: number; origBarLeft: number; origBarWidth: number
		startFieldId: string | null; endFieldId: string | null
	} | null>(null)
	const [resizeDelta, setResizeDelta] = useState(0)
	const [contextMenuFile, setContextMenuFile] = useState<TFile | null>(null)

	const filterMenuRef = useRef<HTMLDivElement>(null)
	const fieldsMenuRef = useRef<HTMLDivElement>(null)
	const startMenuRef  = useRef<HTMLDivElement>(null)
	const endMenuRef    = useRef<HTMLDivElement>(null)
	const groupMenuRef  = useRef<HTMLDivElement>(null)
	const scrollRef     = useRef<HTMLDivElement>(null)
	const mobileActionBarRef = useRef<HTMLDivElement>(null)
	const justResized   = useRef(false)

	useEffect(() => { setActiveView(externalView) }, [externalView.id])

	const saveView = useCallback(async (v: ViewConfig) => {
		setActiveView(v); await onViewChange(v)
	}, [onViewChange])

	// ── Close menus on outside click ──────────────────────────────────────────

	const mkCloseEffect = (open: boolean, ref: React.RefObject<HTMLDivElement>, setter: (v: boolean) => void) =>
		useEffect(() => {
			if (!open) return
			const h = (e: MouseEvent) => {
				if (mobileActionBarRef.current?.contains(e.target as Node)) return
				if (ref.current && !ref.current.contains(e.target as Node)) setter(false)
			}
			document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
		}, [open])

	mkCloseEffect(filterMenuOpen, filterMenuRef, setFilterMenuOpen)
	mkCloseEffect(fieldsMenuOpen, fieldsMenuRef, setFieldsMenuOpen)
	mkCloseEffect(startMenuOpen,  startMenuRef,  setStartMenuOpen)
	mkCloseEffect(endMenuOpen,    endMenuRef,    setEndMenuOpen)
	mkCloseEffect(groupMenuOpen,  groupMenuRef,  setGroupMenuOpen)	// ── Canvas geometry ────────────────────────────────────────────────────────

	const zoom   = activeView.timelineZoom ?? 'months'
	const unitW  = UNIT_W[zoom]
	const total  = TOTAL_U[zoom]
	const origin = useMemo(() => computeOrigin(zoom, today), [zoom, today])
	const canvasWidth = total * unitW
	const header  = useMemo(() => computeHeader(zoom, origin, unitW, total), [zoom, origin, unitW, total])
	const todayPx = useMemo(() => d2px(today, zoom, origin, unitW), [today, zoom, origin, unitW])

	// ── Bar resize ─────────────────────────────────────────────────────

	useEffect(() => {
		if (!resizing) return
		const onMove = (e: MouseEvent) => setResizeDelta(e.clientX - resizing.startX)
		const onUp   = async (e: MouseEvent) => {
			const delta = e.clientX - resizing.startX
			setResizing(null); setResizeDelta(0)
			document.body.classList.remove('nb-tl-resizing')
			if (Math.abs(delta) < 2) return
			justResized.current = true
			setTimeout(() => { justResized.current = false }, 200)
			const { handle, origBarLeft, origBarWidth, startFieldId, endFieldId, filePath } = resizing
			let newLeft = origBarLeft, newWidth = origBarWidth
			if (handle === 'left') { newLeft = origBarLeft + delta; newWidth = origBarWidth - delta }
			else                   { newWidth = origBarWidth + delta }
			if (newWidth < unitW) return
			const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
			const file = app.vault.getAbstractFileByPath(filePath) as TFile | null
			if (!file) return
			await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
				if (handle === 'left'  && startFieldId) fm[startFieldId] = fmt(px2date(newLeft,                    zoom, origin, unitW))
				if (handle === 'right' && endFieldId)   fm[endFieldId]   = fmt(px2date(newLeft + newWidth - unitW, zoom, origin, unitW))
			})
		}
		document.body.classList.add('nb-tl-resizing')
		const voidOnUp = (e: MouseEvent) => { void onUp(e) }
		window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', voidOnUp)
		return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', voidOnUp) }
	}, [resizing, zoom, origin, unitW, app])

	// Scroll to today on zoom change and initial mount
	useEffect(() => {
		requestAnimationFrame(() => {
			if (!scrollRef.current) return
			const target = Math.max(0, todayPx - scrollRef.current.clientWidth * 0.3)
			scrollRef.current.scrollLeft = target
		})
	}, [zoom])

	// ── Derived data ──────────────────────────────────────────────────────────

	const debouncedFilters = useDebouncedValue(activeFilters, 200)
	const filteredRows  = useMemo(() => applyFilters(rows, debouncedFilters), [rows, debouncedFilters])
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
			const val = String((row[groupField.id] as string | number | boolean | null | undefined) ?? '')
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
			result.push({ kind: 'group', label: key || t('no_value'), color: opt?.color })
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
		setActiveFilters(next); void saveActivePills(next); setFilterMenuOpen(false)
	}
	const removeFilter = (id: string) => { const n = activeFilters.filter(f => f.id !== id); setActiveFilters(n); void saveActivePills(n) }
	const updateFilter = (id: string, op: FilterOperator, val: string) => { const n = activeFilters.map(f => f.id === id ? { ...f, operator: op, value: val } : f); setActiveFilters(n); void saveActivePills(n) }
	const toggleConj   = (id: string) => { const n = activeFilters.map(f => f.id === id ? { ...f, conjunction: f.conjunction === 'and' ? 'or' as const : 'and' as const } : f); setActiveFilters(n); void saveActivePills(n) }

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

	const isMobile = useIsMobile()

	if (!dbFile) return <div className="nb-empty-state"><p>{t('no_database_open')}</p></div>
	if (loading)  return <div className="nb-loading">{t('loading')}</div>

	const todayInRange = todayPx >= 0 && todayPx <= canvasWidth

	// Helper for date field picker dropdown
	const DateFieldDropdown = ({ label, valueKey, open, setOpen, menuRef: ref }: {
		label: string; valueKey: 'timelineStartField' | 'timelineEndField'; open: boolean
		setOpen: (v: boolean) => void; menuRef: React.RefObject<HTMLDivElement>
	}) => {
		const fieldName = config.schema.find(c => c.id === activeView[valueKey])?.name ?? t('none_value')
		return (
			<div className="nb-fields-menu-wrapper" ref={ref}>
				<button className={`nb-toolbar-btn${open ? ' nb-toolbar-btn--active' : ''}`} onClick={() => setOpen(!open)}>
					{label}: <strong>{fieldName}</strong>
				</button>
				{open && (
					<div className="nb-fields-dropdown">
						<div className="nb-fields-dropdown-label">{label}</div>
						<button className={`nb-menu-item${!activeView[valueKey] ? ' nb-menu-item--active' : ''}`}
							onClick={() => { void saveView({ ...activeView, [valueKey]: undefined }); setOpen(false) }}>
							<span className="nb-menu-item-icon">—</span><span>{t('none_value')}</span>
						</button>
						{config.schema.filter(c => c.type === 'date').map(col => (
							<button key={col.id} className={`nb-menu-item${activeView[valueKey] === col.id ? ' nb-menu-item--active' : ''}`}
								onClick={() => { void saveView({ ...activeView, [valueKey]: col.id }); setOpen(false) }}>
								<span className="nb-menu-item-icon">📅</span><span>{col.name}</span>
							</button>
						))}
					</div>
				)}
			</div>
		)
	}

	const closeMobileMenus = (except?: string) => {
		if (except !== 'start') setStartMenuOpen(false)
		if (except !== 'end') setEndMenuOpen(false)
		if (except !== 'group') setGroupMenuOpen(false)
		if (except !== 'fields') setFieldsMenuOpen(false)
		if (except !== 'filter') setFilterMenuOpen(false)
	}

	const toolbarContent = isMobile ? (
		<MobileToolbar
			actionBarRef={mobileActionBarRef}
			actions={[
				{ id: 'start', label: t('start_field'), icon: <IconFields />, active: startMenuOpen, onClick: () => { closeMobileMenus('start'); setStartMenuOpen(v => !v) } },
				{ id: 'end', label: t('end_field'), icon: <IconFields />, active: endMenuOpen, onClick: () => { closeMobileMenus('end'); setEndMenuOpen(v => !v) } },
				{ id: 'group', label: t('group_field'), icon: <IconSort />, active: groupMenuOpen, onClick: () => { closeMobileMenus('group'); setGroupMenuOpen(v => !v) } },
				{ id: 'fields', label: t('fields'), icon: <IconFields />, active: fieldsMenuOpen, onClick: () => { closeMobileMenus('fields'); setFieldsMenuOpen(v => !v) } },
				{ id: 'subfolders', label: t('tooltip_include_subfolders'), icon: <IconSubfolders />, active: !!activeView.includeSubfolders, onClick: () => { closeMobileMenus(); void saveView({ ...activeView, includeSubfolders: !activeView.includeSubfolders }) } },
				{ id: 'filter', label: t('filter'), icon: <IconFilter />, active: filterMenuOpen, badge: activeFilters.length || undefined, onClick: () => { closeMobileMenus('filter'); setFilterMenuOpen(v => !v) } },
			]}
			rowCount={filteredRows.length}
			rowCountLabel={filteredRows.length === 1 ? t('item_singular').toLowerCase() : t('item_plural').toLowerCase()}
			filters={activeFilters}
			onFilterUpdate={updateFilter}
			onFilterRemove={removeFilter}
			onConjunctionToggle={toggleConj}
		>
			<BottomSheet open={startMenuOpen} onClose={() => setStartMenuOpen(false)} title={t('start_field')}>
				<button className={`nb-menu-item${!activeView.timelineStartField ? ' nb-menu-item--active' : ''}`}
					onClick={() => { void saveView({ ...activeView, timelineStartField: undefined }); setStartMenuOpen(false) }}>
					<span className="nb-menu-item-icon">—</span><span>{t('none_value')}</span>
				</button>
				{config.schema.filter(c => c.type === 'date').map(col => (
					<button key={col.id} className={`nb-menu-item${activeView.timelineStartField === col.id ? ' nb-menu-item--active' : ''}`}
						onClick={() => { void saveView({ ...activeView, timelineStartField: col.id }); setStartMenuOpen(false) }}>
						<span className="nb-menu-item-icon">📅</span><span>{col.name}</span>
					</button>
				))}
			</BottomSheet>
			<BottomSheet open={endMenuOpen} onClose={() => setEndMenuOpen(false)} title={t('end_field')}>
				<button className={`nb-menu-item${!activeView.timelineEndField ? ' nb-menu-item--active' : ''}`}
					onClick={() => { void saveView({ ...activeView, timelineEndField: undefined }); setEndMenuOpen(false) }}>
					<span className="nb-menu-item-icon">—</span><span>{t('none_value')}</span>
				</button>
				{config.schema.filter(c => c.type === 'date').map(col => (
					<button key={col.id} className={`nb-menu-item${activeView.timelineEndField === col.id ? ' nb-menu-item--active' : ''}`}
						onClick={() => { void saveView({ ...activeView, timelineEndField: col.id }); setEndMenuOpen(false) }}>
						<span className="nb-menu-item-icon">📅</span><span>{col.name}</span>
					</button>
				))}
			</BottomSheet>
			<BottomSheet open={groupMenuOpen} onClose={() => setGroupMenuOpen(false)} title={t('group_field')}>
				<button className={`nb-menu-item${!activeView.timelineGroupByField ? ' nb-menu-item--active' : ''}`}
					onClick={() => { void saveView({ ...activeView, timelineGroupByField: undefined }); setGroupMenuOpen(false) }}>
					<span className="nb-menu-item-icon">—</span><span>{t('none_value')}</span>
				</button>
				{config.schema.filter(c => c.type === 'select' || c.type === 'status').map(col => (
					<button key={col.id} className={`nb-menu-item${activeView.timelineGroupByField === col.id ? ' nb-menu-item--active' : ''}`}
						onClick={() => { void saveView({ ...activeView, timelineGroupByField: col.id }); setGroupMenuOpen(false) }}>
						<span className="nb-menu-item-icon">{getColumnIconStatic(col.type)}</span><span>{col.name}</span>
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
						<span className="nb-menu-item-icon">{getColumnIconStatic(col.type)}</span><span>{col.name}</span>
					</button>
				))}
			</BottomSheet>
			{/* Navigation + Zoom */}
			<div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px' }}>
				<div className="nb-cal-nav">
					<button className="nb-toolbar-btn nb-cal-nav-arrow" onClick={handlePrev} title={t('timeline_scroll_prev')}>‹</button>
					<button className="nb-toolbar-btn nb-cal-today-btn" onClick={handleToday}>{t('calendar_today')}</button>
					<button className="nb-toolbar-btn nb-cal-nav-arrow" onClick={handleNext} title={t('timeline_scroll_next')}>›</button>
				</div>
				<div className="nb-tl-zoom-group">
					{(['days', 'weeks', 'months'] as const).map(z => (
						<button key={z} className={`nb-tl-zoom-btn${zoom === z ? ' nb-tl-zoom-btn--active' : ''}`}
							onClick={() => { void saveView({ ...activeView, timelineZoom: z }) }}>
							{ZOOM_LBL()[z]}
						</button>
					))}
				</div>
			</div>
		</MobileToolbar>
	) : (
		<>
			{/* Desktop Toolbar */}
			<div className="nb-toolbar">
				<DateFieldDropdown label={t('start_field')} valueKey="timelineStartField" open={startMenuOpen} setOpen={setStartMenuOpen} menuRef={startMenuRef} />
				<DateFieldDropdown label={t('end_field')}    valueKey="timelineEndField"   open={endMenuOpen}   setOpen={setEndMenuOpen}   menuRef={endMenuRef} />

				{/* Agrupar por */}
				<div className="nb-fields-menu-wrapper" ref={groupMenuRef}>
					<button className={`nb-toolbar-btn${groupMenuOpen ? ' nb-toolbar-btn--active' : ''}`} onClick={() => setGroupMenuOpen(v => !v)}>
						{t('group_field')}: <strong>{groupField?.name ?? t('none_value')}</strong>
					</button>
					{groupMenuOpen && (
						<div className="nb-fields-dropdown">
							<div className="nb-fields-dropdown-label">{t('group_by_label')}</div>
							<button className={`nb-menu-item${!activeView.timelineGroupByField ? ' nb-menu-item--active' : ''}`}
								onClick={() => { void saveView({ ...activeView, timelineGroupByField: undefined }); setGroupMenuOpen(false) }}>
								<span className="nb-menu-item-icon">—</span><span>{t('none_value')}</span>
							</button>
							{config.schema.filter(c => c.type === 'select' || c.type === 'status').map(col => (
								<button key={col.id} className={`nb-menu-item${activeView.timelineGroupByField === col.id ? ' nb-menu-item--active' : ''}`}
									onClick={() => { void saveView({ ...activeView, timelineGroupByField: col.id }); setGroupMenuOpen(false) }}>
									<span className="nb-menu-item-icon">{getColumnIconStatic(col.type)}</span><span>{col.name}</span>
								</button>
							))}
						</div>
					)}
				</div>

				{/* Campos */}
				<div className="nb-fields-menu-wrapper" ref={fieldsMenuRef}>
					<button className={`nb-toolbar-btn${fieldsMenuOpen ? ' nb-toolbar-btn--active' : ''}`} onClick={() => setFieldsMenuOpen(v => !v)}>{t('fields')}</button>
					{fieldsMenuOpen && (
						<div className="nb-fields-dropdown">
							<div className="nb-fields-dropdown-label">{t('fields_on_bars')}</div>
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
					<button className="nb-toolbar-btn nb-cal-nav-arrow" onClick={handlePrev} title={t('timeline_scroll_prev')}>‹</button>
					<button className="nb-toolbar-btn nb-cal-today-btn" onClick={handleToday}>{t('calendar_today')}</button>
					<button className="nb-toolbar-btn nb-cal-nav-arrow" onClick={handleNext} title={t('timeline_scroll_next')}>›</button>
				</div>

				{/* Zoom */}
				<div className="nb-tl-zoom-group">
					{(['days', 'weeks', 'months'] as ZoomLevel[]).map(z => (
						<button key={z} className={`nb-tl-zoom-btn${zoom === z ? ' nb-tl-zoom-btn--active' : ''}`}
							onClick={() => { void saveView({ ...activeView, timelineZoom: z }) }}>
							{ZOOM_LBL()[z]}
						</button>
					))}
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

			{/* Timeline body */}
			{!startField ? (
				<div className="nb-cal-no-field">
					<p>{t('timeline_no_start_field')}</p>
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
									onClick={() => { void app.workspace.getLeaf().openFile(item.row._file) }}>
									<span className="nb-tl-row-label">{item.row._title}</span>
									{(() => {
										const dbFolder = dbFile?.parent?.path ?? ''
										const fileFolder = item.row._file.parent?.path ?? ''
										const relPath = activeView.includeSubfolders && fileFolder.length > dbFolder.length
											? fileFolder.slice(dbFolder.length + 1) : ''
										return relPath ? <div className="nb-folder-path">{relPath}</div> : null
									})()}
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
										{item.barLeft !== null && item.barWidth !== null && (() => {
											const isRes = resizing?.filePath === item.row._file.path
											let bLeft = item.barLeft, bWidth = item.barWidth
											if (isRes && resizing) {
												if (resizing.handle === 'left') { bLeft = item.barLeft + resizeDelta; bWidth = item.barWidth - resizeDelta }
												else { bWidth = item.barWidth + resizeDelta }
											}
											bWidth = Math.max(8, bWidth)
											return (
												<div className="nb-tl-bar"
													style={{ left: bLeft, width: bWidth, top: (ROW_H - 22) / 2, height: 22 }}
													onClick={() => { if (justResized.current) return; if (isMobile) { setContextMenuFile(item.row._file) } else { void app.workspace.getLeaf().openFile(item.row._file) } }}
													onContextMenu={!isMobile ? e => { e.preventDefault(); setContextMenuFile(item.row._file) } : undefined}
													title={!isMobile ? item.row._title : undefined}>
													<div className="nb-tl-bar-handle nb-tl-bar-handle--left"
														onMouseDown={e => {
															e.stopPropagation(); e.preventDefault()
															setResizing({ filePath: item.row._file.path, handle: 'left', startX: e.clientX,
																origBarLeft: item.barLeft!, origBarWidth: item.barWidth!,
																startFieldId: startField?.id ?? null, endFieldId: endField?.id ?? null })
															setResizeDelta(0)
														}} />
													<span className="nb-tl-bar-title">{item.row._title}</span>
													{(() => {
														const dbFolder = dbFile?.parent?.path ?? ''
														const fileFolder = item.row._file.parent?.path ?? ''
														const relPath = activeView.includeSubfolders && fileFolder.length > dbFolder.length
															? fileFolder.slice(dbFolder.length + 1) : ''
														return relPath ? <span className="nb-folder-path" style={{ marginLeft: 4 }}>{relPath}</span> : null
													})()}
													{visibleCols.map(col => {
														const val = item.row[col.id]
														if (!val || String(val as string | number | boolean).trim() === '') return null
														const display = Array.isArray(val) ? (val as string[]).join(', ') : String(val as string | number | boolean)
														return <span key={col.id} className="nb-tl-bar-field"> · {display}</span>
													})}
													<div className="nb-tl-bar-handle nb-tl-bar-handle--right"
														onMouseDown={e => {
															e.stopPropagation(); e.preventDefault()
															setResizing({ filePath: item.row._file.path, handle: 'right', startX: e.clientX,
																origBarLeft: item.barLeft!, origBarWidth: item.barWidth!,
																startFieldId: startField?.id ?? null, endFieldId: endField?.id ?? null })
															setResizeDelta(0)
														}} />
												</div>
											)
										})()
										}
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
						{noIntervalOpen ? '▾' : '▸'} {t('timeline_no_interval')} ({noIntervalRows.length})
					</div>
					{noIntervalOpen && (
						<div className="nb-tl-no-interval-list">
							{noIntervalRows.map(row => (
								<div key={row._file.path} className="nb-cal-card nb-cal-card--no-date"
									onClick={() => { void app.workspace.getLeaf().openFile(row._file) }}>
									<span className="nb-cal-card-title">{row._title}</span>
								</div>
							))}
						</div>
					)}
				</div>
			)}

			{/* Bar context menu (mobile tap) */}
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
