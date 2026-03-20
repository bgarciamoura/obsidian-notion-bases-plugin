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
import { MobileToolbar, IconSort, IconFilter, IconSubfolders } from './MobileToolbar'
import { BottomSheet } from './BottomSheet'

interface DatabaseChartsProps {
	dbFile: TFile | null
	manager: DatabaseManager
	externalView: ViewConfig
	onViewChange: (view: ViewConfig) => Promise<void>
}

// ── Chart color palette ──────────────────────────────────────────────────────

const CHART_COLORS = [
	'#4c6ef5', '#7950f2', '#e64980', '#f76707', '#fab005',
	'#40c057', '#15aabf', '#be4bdb', '#fd7e14', '#20c997',
	'#228be6', '#845ef7', '#f06595', '#ff922b', '#fcc419',
	'#51cf66', '#22b8cf', '#cc5de8', '#ff6b6b', '#38d9a9',
]

// ── Data aggregation ─────────────────────────────────────────────────────────

interface ChartDataPoint {
	label: string
	value: number
	color: string
}

function formatAxisValue(v: number): string {
	const abs = Math.abs(v)
	if (abs >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
	if (abs >= 10_000) return (v / 1_000).toFixed(0) + 'k'
	if (abs >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'k'
	if (Number.isInteger(v)) return String(v)
	return v.toFixed(1)
}

function formatTooltipValue(v: number): string {
	if (Number.isInteger(v)) return v.toLocaleString()
	return v.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function computeTicks(maxVal: number, count: number): number[] {
	if (maxVal <= count && Number.isInteger(maxVal)) {
		return Array.from({ length: Math.floor(maxVal) + 1 }, (_, i) => i)
	}
	const rawStep = maxVal / count
	const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
	const residual = rawStep / magnitude
	const niceStep = residual <= 1.5 ? magnitude : residual <= 3 ? 2 * magnitude : residual <= 7 ? 5 * magnitude : 10 * magnitude
	const ticks: number[] = []
	for (let v = 0; v <= maxVal + niceStep * 0.01; v += niceStep) {
		ticks.push(Math.round(v * 1000) / 1000)
	}
	if (ticks[ticks.length - 1] < maxVal) ticks.push(ticks[ticks.length - 1] + niceStep)
	return ticks
}

function aggregateData(
	rows: NoteRow[],
	xAxis: string,
	yAxis: string | undefined,
	aggregation: string,
	schema: ColumnSchema[],
): ChartDataPoint[] {
	const groups = new Map<string, NoteRow[]>()

	for (const row of rows) {
		const rawX = xAxis === '_title' ? row._title : row[xAxis]
		const labels = Array.isArray(rawX)
			? (rawX as string[])
			: [rawX == null ? t('no_value') : String(rawX as string | number | boolean)]
		for (const label of labels) {
			const key = label.trim() || t('no_value')
			const list = groups.get(key) ?? []
			list.push(row)
			groups.set(key, list)
		}
	}

	const points: ChartDataPoint[] = []
	let colorIdx = 0

	for (const [label, groupRows] of groups) {
		let value: number

		if (!yAxis || yAxis === '_count') {
			value = groupRows.length
		} else {
			const nums = groupRows
				.map(r => {
					const v = r[yAxis]
					return typeof v === 'number' ? v : parseFloat(v == null ? '' : String(v as string | number | boolean))
				})
				.filter(n => !isNaN(n))

			switch (aggregation) {
				case 'sum': value = nums.reduce((a, b) => a + b, 0); break
				case 'avg': value = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0; break
				case 'min': value = nums.length > 0 ? Math.min(...nums) : 0; break
				case 'max': value = nums.length > 0 ? Math.max(...nums) : 0; break
				default: value = nums.reduce((a, b) => a + b, 0); break
			}
		}

		points.push({ label, value, color: CHART_COLORS[colorIdx % CHART_COLORS.length] })
		colorIdx++
	}

	return points
}

// ── SVG Bar Chart ────────────────────────────────────────────────────────────

function BarChart({ data, width, height }: { data: ChartDataPoint[]; width: number; height: number }) {
	if (data.length === 0) return <text x={width / 2} y={height / 2} textAnchor="middle" fill="var(--text-muted)">{t('no_results')}</text>

	const margin = { top: 20, right: 20, bottom: 60, left: 60 }
	const chartW = width - margin.left - margin.right
	const chartH = height - margin.top - margin.bottom
	const maxVal = Math.max(...data.map(d => d.value), 1)
	const barWidth = Math.min(Math.max(chartW / data.length - 4, 8), 60)
	const totalBarsW = data.length * (barWidth + 4)
	const offsetX = Math.max((chartW - totalBarsW) / 2, 0)

	const tickValues = computeTicks(maxVal, 5)
	const scaleMax = tickValues[tickValues.length - 1] || maxVal

	const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

	return (
		<g transform={`translate(${margin.left},${margin.top})`}>
			{/* Y axis grid + labels */}
			{tickValues.map((v, i) => {
				const y = chartH - (v / scaleMax) * chartH
				return (
					<g key={i}>
						<line x1={0} y1={y} x2={chartW} y2={y} stroke="var(--background-modifier-border)" strokeDasharray="2,2" />
						<text x={-8} y={y + 4} textAnchor="end" fontSize={11} fill="var(--text-muted)">
							{formatAxisValue(v)}
						</text>
					</g>
				)
			})}

			{/* Bars */}
			{data.map((d, i) => {
				const barH = (d.value / scaleMax) * chartH
				const x = offsetX + i * (barWidth + 4)
				const y = chartH - barH
				const tooltipText = `${d.label}: ${formatTooltipValue(d.value)}`
				const tooltipW = Math.max(tooltipText.length * 7, 60)
				return (
					<g key={i}
						onMouseEnter={() => setHoveredIdx(i)}
						onMouseLeave={() => setHoveredIdx(null)}
					>
						<rect
							x={x} y={y} width={barWidth} height={barH}
							rx={2} fill={d.color}
							opacity={hoveredIdx === null || hoveredIdx === i ? 1 : 0.4}
							style={{ transition: 'opacity 0.15s, height 0.3s, y 0.3s' }}
						/>
						{/* X label */}
						<text
							x={x + barWidth / 2} y={chartH + 14}
							textAnchor="end" fontSize={11} fill="var(--text-normal)"
							transform={`rotate(-35, ${x + barWidth / 2}, ${chartH + 14})`}
						>
							{d.label.length > 12 ? d.label.slice(0, 11) + '…' : d.label}
						</text>
						{/* Tooltip */}
						{hoveredIdx === i && (
							<g>
								<rect
									x={x + barWidth / 2 - tooltipW / 2} y={y - 28}
									width={tooltipW} height={22} rx={4}
									fill="var(--background-primary)" stroke="var(--background-modifier-border)"
								/>
								<text x={x + barWidth / 2} y={y - 13} textAnchor="middle" fontSize={12} fontWeight="600" fill="var(--text-normal)">
									{tooltipText}
								</text>
							</g>
						)}
					</g>
				)
			})}

			{/* Axes */}
			<line x1={0} y1={0} x2={0} y2={chartH} stroke="var(--background-modifier-border)" />
			<line x1={0} y1={chartH} x2={chartW} y2={chartH} stroke="var(--background-modifier-border)" />
		</g>
	)
}

// ── SVG Pie Chart ────────────────────────────────────────────────────────────

function PieChart({ data, width, height }: { data: ChartDataPoint[]; width: number; height: number }) {
	if (data.length === 0) return <text x={width / 2} y={height / 2} textAnchor="middle" fill="var(--text-muted)">{t('no_results')}</text>

	const total = data.reduce((s, d) => s + d.value, 0)
	if (total === 0) return <text x={width / 2} y={height / 2} textAnchor="middle" fill="var(--text-muted)">{t('no_results')}</text>

	const cx = width * 0.4
	const cy = height / 2
	const r = Math.min(cx, cy) - 20
	const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

	let cumAngle = -Math.PI / 2

	const slices = data.map((d, i) => {
		const angle = (d.value / total) * 2 * Math.PI
		const startAngle = cumAngle
		cumAngle += angle
		const endAngle = cumAngle

		const x1 = cx + r * Math.cos(startAngle)
		const y1 = cy + r * Math.sin(startAngle)
		const x2 = cx + r * Math.cos(endAngle)
		const y2 = cy + r * Math.sin(endAngle)
		const largeArc = angle > Math.PI ? 1 : 0

		const midAngle = startAngle + angle / 2
		const labelR = r + 16
		const lx = cx + labelR * Math.cos(midAngle)
		const ly = cy + labelR * Math.sin(midAngle)

		const path = data.length === 1
			? `M ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx + r - 0.001} ${cy}`
			: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`

		const isHovered = hoveredIdx === i
		const scale = isHovered ? 'scale(1.04)' : 'scale(1)'
		const pct = ((d.value / total) * 100).toFixed(1)

		return (
			<g key={i}
				onMouseEnter={() => setHoveredIdx(i)}
				onMouseLeave={() => setHoveredIdx(null)}
				style={{ transformOrigin: `${cx}px ${cy}px`, transform: scale, transition: 'transform 0.15s' }}
			>
				<path d={path} fill={d.color} opacity={hoveredIdx === null || isHovered ? 1 : 0.5} stroke="var(--background-primary)" strokeWidth={2} />
				{angle > 0.3 && (
					<text x={lx} y={ly} textAnchor="middle" fontSize={11} fill="var(--text-muted)">{pct}%</text>
				)}
			</g>
		)
	})

	// Legend
	const legendX = width * 0.75
	const legendItems = data.slice(0, 12)

	return (
		<g>
			{slices}
			{legendItems.map((d, i) => (
				<g key={i} transform={`translate(${legendX}, ${30 + i * 22})`}
					onMouseEnter={() => setHoveredIdx(i)}
					onMouseLeave={() => setHoveredIdx(null)}
					style={{ cursor: 'default' }}
				>
					<rect width={12} height={12} rx={2} fill={d.color} />
					<text x={18} y={10} fontSize={12} fill="var(--text-normal)">
						{d.label.length > 16 ? d.label.slice(0, 15) + '…' : d.label} ({formatTooltipValue(d.value)})
					</text>
				</g>
			))}
			{data.length > 12 && (
				<text x={legendX} y={30 + 12 * 22 + 10} fontSize={11} fill="var(--text-muted)">
					+{data.length - 12} {t('board_show_more').toLowerCase()}
				</text>
			)}
		</g>
	)
}

// ── SVG Line Chart ───────────────────────────────────────────────────────────

function LineChart({ data, width, height }: { data: ChartDataPoint[]; width: number; height: number }) {
	if (data.length === 0) return <text x={width / 2} y={height / 2} textAnchor="middle" fill="var(--text-muted)">{t('no_results')}</text>

	const margin = { top: 20, right: 20, bottom: 60, left: 60 }
	const chartW = width - margin.left - margin.right
	const chartH = height - margin.top - margin.bottom
	const maxVal = Math.max(...data.map(d => d.value), 1)
	const padX = 30
	const usableW = chartW - padX * 2
	const stepX = data.length > 1 ? usableW / (data.length - 1) : 0

	const tickValues = computeTicks(maxVal, 5)
	const scaleMax = tickValues[tickValues.length - 1] || maxVal

	const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

	const points = data.map((d, i) => ({
		x: padX + (data.length === 1 ? usableW / 2 : i * stepX),
		y: chartH - (d.value / scaleMax) * chartH,
	}))

	const polyline = points.map(p => `${p.x},${p.y}`).join(' ')

	// Area fill
	const areaPath = `M ${points[0].x} ${chartH} ` +
		points.map(p => `L ${p.x} ${p.y}`).join(' ') +
		` L ${points[points.length - 1].x} ${chartH} Z`

	return (
		<g transform={`translate(${margin.left},${margin.top})`}>
			{/* Y axis grid + labels */}
			{tickValues.map((v, i) => {
				const y = chartH - (v / scaleMax) * chartH
				return (
					<g key={i}>
						<line x1={0} y1={y} x2={chartW} y2={y} stroke="var(--background-modifier-border)" strokeDasharray="2,2" />
						<text x={-8} y={y + 4} textAnchor="end" fontSize={11} fill="var(--text-muted)">
							{formatAxisValue(v)}
						</text>
					</g>
				)
			})}

			{/* Area */}
			<path d={areaPath} fill={CHART_COLORS[0]} opacity={0.1} />

			{/* Line */}
			<polyline
				points={polyline}
				fill="none" stroke={CHART_COLORS[0]} strokeWidth={2.5}
				strokeLinejoin="round" strokeLinecap="round"
			/>

			{/* Dots + labels */}
			{data.map((d, i) => {
				const tooltipText = `${d.label}: ${formatTooltipValue(d.value)}`
				const tooltipW = Math.max(tooltipText.length * 7, 60)
				return (
					<g key={i}
						onMouseEnter={() => setHoveredIdx(i)}
						onMouseLeave={() => setHoveredIdx(null)}
					>
						<circle
							cx={points[i].x} cy={points[i].y} r={hoveredIdx === i ? 6 : 4}
							fill={CHART_COLORS[0]} stroke="var(--background-primary)" strokeWidth={2}
							style={{ transition: 'r 0.15s' }}
						/>
						{/* X label */}
						<text
							x={points[i].x} y={chartH + 14}
							textAnchor="end" fontSize={11} fill="var(--text-normal)"
							transform={`rotate(-35, ${points[i].x}, ${chartH + 14})`}
						>
							{d.label.length > 12 ? d.label.slice(0, 11) + '…' : d.label}
						</text>
						{/* Tooltip */}
						{hoveredIdx === i && (
							<g>
								<rect
									x={points[i].x - tooltipW / 2} y={points[i].y - 28}
									width={tooltipW} height={22} rx={4}
									fill="var(--background-primary)" stroke="var(--background-modifier-border)"
								/>
								<text x={points[i].x} y={points[i].y - 13} textAnchor="middle" fontSize={12} fontWeight="600" fill="var(--text-normal)">
									{tooltipText}
								</text>
							</g>
						)}
					</g>
				)
			})}

			{/* Axes */}
			<line x1={0} y1={0} x2={0} y2={chartH} stroke="var(--background-modifier-border)" />
			<line x1={0} y1={chartH} x2={chartW} y2={chartH} stroke="var(--background-modifier-border)" />
		</g>
	)
}

// ── Sort Panel (reused pattern from DatabaseList) ────────────────────────────

function ChartSortPanel({ sorts, schema, onSortChange, onClose, anchorRect, panelRef }: {
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

// ── Filter pill (reused pattern) ─────────────────────────────────────────────

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
				<button className={`nb-pill-conjunction${filter.conjunction === 'or' ? ' nb-pill-conjunction--or' : ''}`} onClick={onToggleConjunction}>
					{filter.conjunction === 'or' ? t('conjunction_or') : t('conjunction_and')}
				</button>
			)}
			<span className="nb-filter-pill">
				<span className="nb-pill-icon">{filter.icon}</span>
				<span className="nb-pill-name">{filter.columnName}</span>
				<select className="nb-pill-op-select" value={filter.operator} onChange={e => onUpdate(e.target.value as FilterOperator, filter.value)}>
					{ops.map(op => <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>)}
				</select>
				{!NO_VALUE_OPERATORS.has(filter.operator) && (
					<input className="nb-pill-value-input" type="text" value={filter.value} onChange={e => onUpdate(filter.operator, e.target.value)} />
				)}
				<button className="nb-pill-remove" onClick={onRemove}>×</button>
			</span>
		</Fragment>
	)
}

// ── Chart type icons ─────────────────────────────────────────────────────────

function IconBar() {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<rect x="3" y="12" width="4" height="9" /><rect x="10" y="5" width="4" height="16" /><rect x="17" y="9" width="4" height="12" />
		</svg>
	)
}

function IconLine() {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<polyline points="3 18 9 11 13 15 21 5" />
		</svg>
	)
}

function IconPie() {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" />
		</svg>
	)
}

// ── Main component ───────────────────────────────────────────────────────────

export function DatabaseCharts({ dbFile, manager, externalView, onViewChange }: DatabaseChartsProps) {
	const app = useApp()
	const { rows, config, loading, activeFilters, setActiveFilters } = useDatabaseRows({
		app, dbFile, manager, includeSubfolders: externalView.includeSubfolders, externalView,
	})
	const [activeView, setActiveView] = useState<ViewConfig>(externalView)
	const [filterMenuOpen, setFilterMenuOpen] = useState(false)
	const [sortPanelOpen, setSortPanelOpen] = useState(false)
	const [sortAnchorRect, setSortAnchorRect] = useState<DOMRect | null>(null)
	const [configPanelOpen, setConfigPanelOpen] = useState(false)
	const filterMenuRef = useRef<HTMLDivElement>(null)
	const sortPanelRef = useRef<HTMLDivElement>(null)
	const sortButtonRef = useRef<HTMLButtonElement>(null)
	const configPanelRef = useRef<HTMLDivElement>(null)
	const mobileActionBarRef = useRef<HTMLDivElement>(null)
	const chartContainerRef = useRef<HTMLDivElement>(null)
	const [chartSize, setChartSize] = useState({ width: 600, height: 400 })

	useEffect(() => { setActiveView(externalView) }, [externalView.id])

	const saveView = useCallback(async (updated: ViewConfig) => {
		setActiveView(updated)
		await onViewChange(updated)
	}, [onViewChange])

	// ── Chart config ─────────────────────────────────────────────────────────

	const chartType = activeView.chartType ?? 'bar'
	const chartXAxis = activeView.chartXAxis ?? ''
	const chartYAxis = activeView.chartYAxis ?? '_count'
	const chartAggregation = activeView.chartAggregation ?? 'count'

	// ── Resize observer ──────────────────────────────────────────────────────

	useEffect(() => {
		const el = chartContainerRef.current
		if (!el) return
		const observer = new ResizeObserver(entries => {
			for (const entry of entries) {
				const w = entry.contentRect.width
				const h = Math.max(entry.contentRect.height, 300)
				setChartSize({ width: Math.max(w, 300), height: Math.min(h, 600) })
			}
		})
		observer.observe(el)
		return () => observer.disconnect()
	}, [loading])

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
		if (!sortPanelOpen) return
		const h = (e: MouseEvent) => {
			if (mobileActionBarRef.current?.contains(e.target as Node)) return
			if (sortButtonRef.current?.contains(e.target as Node)) return
			if (sortPanelRef.current && !sortPanelRef.current.contains(e.target as Node)) setSortPanelOpen(false)
		}
		document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
	}, [sortPanelOpen])

	useEffect(() => {
		if (!configPanelOpen) return
		const h = (e: MouseEvent) => {
			if (mobileActionBarRef.current?.contains(e.target as Node)) return
			if (configPanelRef.current && !configPanelRef.current.contains(e.target as Node)) setConfigPanelOpen(false)
		}
		document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
	}, [configPanelOpen])

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

	const handleSortChange = useCallback(async (newSorts: SortConfig[]) => {
		await saveView({ ...activeView, sorts: newSorts })
	}, [activeView, saveView])

	// ── Derived data ─────────────────────────────────────────────────────────

	const filteredRows = useMemo(() => applyFilters(rows, activeFilters), [rows, activeFilters])
	const displayRows = useMemo(() => applySorts(filteredRows, activeView.sorts), [filteredRows, activeView.sorts])

	const chartData = useMemo(() => {
		if (!chartXAxis) return []
		const points = aggregateData(displayRows, chartXAxis, chartYAxis === '_count' ? undefined : chartYAxis, chartAggregation, config.schema)
		if (activeView.sorts.length === 0) points.sort((a, b) => b.value - a.value)
		return points
	}, [displayRows, chartXAxis, chartYAxis, chartAggregation, config.schema, activeView.sorts.length])

	// ── Column options for config ────────────────────────────────────────────

	const xAxisOptions = useMemo(() => {
		const cols = config.schema.filter(c => c.visible && ['text', 'select', 'multiselect', 'status', 'date', 'checkbox'].includes(c.type))
		return [{ id: '_title', name: t('name_column'), type: 'title' }, ...cols]
	}, [config.schema])

	const yAxisOptions = useMemo(() => {
		const cols = config.schema.filter(c => c.visible && c.type === 'number')
		return [{ id: '_count', name: t('chart_count_records'), type: 'count' }, ...cols]
	}, [config.schema])

	// ── Render ───────────────────────────────────────────────────────────────

	const isMobile = useIsMobile()

	if (!dbFile) return <div className="nb-empty-state"><p>{t('no_database_open')}</p></div>
	if (loading) return <div className="nb-loading">{t('loading')}</div>

	const closeMobileMenus = (except?: string) => {
		if (except !== 'filter') setFilterMenuOpen(false)
		if (except !== 'sort') setSortPanelOpen(false)
		if (except !== 'config') setConfigPanelOpen(false)
	}

	// ── Config panel content ─────────────────────────────────────────────────

	const configContent = (
		<div className="nb-chart-config-body">
			{/* Chart type */}
			<div className="nb-chart-config-row">
				<label className="nb-chart-config-label">{t('chart_type')}</label>
				<div className="nb-chart-type-btns">
					{(['bar', 'line', 'pie'] as const).map(ct => (
						<button
							key={ct}
							className={`nb-chart-type-btn${chartType === ct ? ' nb-chart-type-btn--active' : ''}`}
							onClick={() => { void saveView({ ...activeView, chartType: ct }) }}
							title={t(`chart_type_${ct}`)}
						>
							{ct === 'bar' && <IconBar />}
							{ct === 'line' && <IconLine />}
							{ct === 'pie' && <IconPie />}
						</button>
					))}
				</div>
			</div>

			{/* X axis */}
			<div className="nb-chart-config-row">
				<label className="nb-chart-config-label">{t('chart_x_axis')}</label>
				<select
					className="nb-chart-config-select"
					value={chartXAxis}
					onChange={e => { void saveView({ ...activeView, chartXAxis: e.target.value }) }}
				>
					<option value="">{t('chart_select_column')}</option>
					{xAxisOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
				</select>
			</div>

			{/* Y axis */}
			<div className="nb-chart-config-row">
				<label className="nb-chart-config-label">{t('chart_y_axis')}</label>
				<select
					className="nb-chart-config-select"
					value={chartYAxis}
					onChange={e => { void saveView({ ...activeView, chartYAxis: e.target.value }) }}
				>
					{yAxisOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
				</select>
			</div>

			{/* Aggregation (only when Y is a number column) */}
			{chartYAxis !== '_count' && (
				<div className="nb-chart-config-row">
					<label className="nb-chart-config-label">{t('chart_aggregation')}</label>
					<select
						className="nb-chart-config-select"
						value={chartAggregation}
						onChange={e => { void saveView({ ...activeView, chartAggregation: e.target.value as ViewConfig['chartAggregation'] }) }}
					>
						<option value="sum">{t('agg_sum')}</option>
						<option value="avg">{t('agg_avg')}</option>
						<option value="min">{t('agg_min')}</option>
						<option value="max">{t('agg_max')}</option>
					</select>
				</div>
			)}
		</div>
	)

	const toolbarContent = isMobile ? (
		<MobileToolbar
			actionBarRef={mobileActionBarRef}
			actions={[
				{ id: 'config', label: t('chart_configure'), icon: <IconBar />, active: configPanelOpen, onClick: () => { closeMobileMenus('config'); setConfigPanelOpen(v => !v) } },
				{ id: 'subfolders', label: t('tooltip_include_subfolders'), icon: <IconSubfolders />, active: !!activeView.includeSubfolders, onClick: () => { closeMobileMenus(); void saveView({ ...activeView, includeSubfolders: !activeView.includeSubfolders }) } },
				{ id: 'sort', label: t('sort'), icon: <IconSort />, active: activeView.sorts.length > 0, badge: activeView.sorts.length || undefined, onClick: () => { closeMobileMenus('sort'); if (!sortPanelOpen && sortButtonRef.current) setSortAnchorRect(sortButtonRef.current.getBoundingClientRect()); setSortPanelOpen(v => !v) } },
				{ id: 'filter', label: t('filter'), icon: <IconFilter />, active: filterMenuOpen, badge: activeFilters.length || undefined, onClick: () => { closeMobileMenus('filter'); setFilterMenuOpen(v => !v) } },
			]}
			rowCount={displayRows.length}
			rowCountLabel={displayRows.length === 1 ? t('record_singular').toLowerCase() : t('record_plural').toLowerCase()}
			filters={activeFilters}
			onFilterUpdate={updateFilter}
			onFilterRemove={removeFilter}
			onConjunctionToggle={toggleConjunction}
		>
			<BottomSheet open={configPanelOpen} onClose={() => setConfigPanelOpen(false)} title={t('chart_configure')}>
				{configContent}
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
				<div className="nb-fields-menu-wrapper" ref={configPanelRef}>
					<button className={`nb-toolbar-btn ${configPanelOpen ? 'nb-toolbar-btn--active' : ''}`} onClick={() => setConfigPanelOpen(v => !v)}>
						{t('chart_configure')}
					</button>
					{configPanelOpen && (
						<div className="nb-fields-dropdown nb-chart-config-dropdown">
							<div className="nb-fields-dropdown-label">{t('chart_configure')}</div>
							{configContent}
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
				<span className="nb-row-count">{displayRows.length} {displayRows.length === 1 ? t('record_singular').toLowerCase() : t('record_plural').toLowerCase()}</span>
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
					<ChartSortPanel sorts={activeView.sorts} schema={config.schema} onSortChange={s => { void handleSortChange(s) }} onClose={() => setSortPanelOpen(false)} anchorRect={sortAnchorRect} panelRef={sortPanelRef} />
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

	// ── Empty state when no X axis selected ──────────────────────────────────

	if (!chartXAxis) {
		return (
			<div className="nb-container">
				{toolbarContent}
				<div className="nb-chart-empty">
					<p>{t('chart_no_config')}</p>
					<p className="nb-chart-empty-hint">{t('chart_no_config_hint')}</p>
				</div>
			</div>
		)
	}

	return (
		<div className="nb-container">
			{toolbarContent}
			<div className="nb-chart-wrapper" ref={chartContainerRef}>
				<svg
					className="nb-chart-svg"
					width={chartSize.width}
					height={chartSize.height}
					viewBox={`0 0 ${chartSize.width} ${chartSize.height}`}
				>
					{chartType === 'bar' && <BarChart data={chartData} width={chartSize.width} height={chartSize.height} />}
					{chartType === 'pie' && <PieChart data={chartData} width={chartSize.width} height={chartSize.height} />}
					{chartType === 'line' && <LineChart data={chartData} width={chartSize.width} height={chartSize.height} />}
				</svg>
			</div>
		</div>
	)
}
