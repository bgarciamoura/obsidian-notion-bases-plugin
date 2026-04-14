import React, { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ColumnSchema, FilterOperator } from '../types'
import { t } from '../i18n'
import { useIsMobile } from '../hooks/useIsMobile'
import {
	ActiveFilter, OPERATOR_LABELS, NO_VALUE_OPERATORS, getOperatorsForType,
	isMultiValueFilter, parseMultiValue, toggleMultiValue,
} from './filter-utils'

interface FilterPillsRowProps {
	activeFilters: ActiveFilter[]
	schema: ColumnSchema[]
	onUpdate: (id: string, operator: FilterOperator, value: string) => void
	onRemove: (id: string) => void
	onToggleConjunction: (id: string) => void
	collapsed?: boolean
	onToggleCollapsed?: () => void
}

export function FilterPillsRow({
	activeFilters, schema, onUpdate, onRemove, onToggleConjunction,
	collapsed = false, onToggleCollapsed,
}: FilterPillsRowProps) {
	const isMobile = useIsMobile()
	const [openFilterPill, setOpenFilterPill] = useState<string | null>(null)
	const [openOperatorPicker, setOpenOperatorPicker] = useState<string | null>(null)
	const [pillDropdownPos, setPillDropdownPos] = useState<{ top: number; left: number } | null>(null)
	const pillRefs = useRef<Record<string, HTMLButtonElement | null>>({})
	const operatorPickerRefs = useRef<Record<string, HTMLDivElement | null>>({})
	const pillDropdownRef = useRef<HTMLDivElement | null>(null)

	useLayoutEffect(() => {
		if (!openFilterPill) { setPillDropdownPos(null); return }
		const btn = pillRefs.current[openFilterPill]
		if (!btn) return
		const r = btn.getBoundingClientRect()
		setPillDropdownPos({ top: r.bottom + 4, left: r.left })
	}, [openFilterPill])

	useEffect(() => {
		if (!openFilterPill) return
		const h = (e: MouseEvent) => {
			const btn = pillRefs.current[openFilterPill]
			const target = e.target as Node
			const clickedBtn = btn?.contains(target)
			const clickedDropdown = pillDropdownRef.current?.contains(target)
			if (!clickedBtn && !clickedDropdown) setOpenFilterPill(null)
		}
		document.addEventListener('mousedown', h)
		return () => document.removeEventListener('mousedown', h)
	}, [openFilterPill])

	useEffect(() => {
		if (!openOperatorPicker) return
		const h = (e: MouseEvent) => {
			const el = operatorPickerRefs.current[openOperatorPicker]
			if (el && !el.contains(e.target as Node)) setOpenOperatorPicker(null)
		}
		document.addEventListener('mousedown', h)
		return () => document.removeEventListener('mousedown', h)
	}, [openOperatorPicker])

	useEffect(() => {
		if (!activeFilters.find(f => f.id === openFilterPill)) setOpenFilterPill(null)
	}, [activeFilters, openFilterPill])

	const filter = activeFilters.find(f => f.id === openFilterPill)

	return (
		<>
			{activeFilters.length > 0 && (
				<div className={`nb-filter-pills-row${collapsed ? ' nb-filter-pills-row--collapsed' : ''}`}>
					{!collapsed && activeFilters.map((f, idx) => (
						<Fragment key={f.id}>
							{idx > 0 && (
								<button
									className={`nb-pill-conjunction${f.conjunction === 'or' ? ' nb-pill-conjunction--or' : ''}`}
									onClick={() => onToggleConjunction(f.id)}
									title="Clique para alternar entre E / OU"
								>
									{f.conjunction === 'or' ? t('conjunction_or') : t('conjunction_and')}
								</button>
							)}
							<button
								ref={el => { pillRefs.current[f.id] = el }}
								className={`nb-filter-pill ${openFilterPill === f.id ? 'nb-filter-pill--active' : ''}`}
								onClick={() => setOpenFilterPill(v => v === f.id ? null : f.id)}
							>
								<span className="nb-filter-pill-icon">{f.icon}</span>
								<span className="nb-filter-pill-name">{f.columnName}</span>
								<span
									className="nb-filter-pill-remove"
									onClick={e => { e.stopPropagation(); onRemove(f.id) }}
									title={t('tooltip_remove_filter')}
								>×</span>
							</button>
						</Fragment>
					))}
					{collapsed && (
						<span className="nb-filter-pills-collapsed-label">
							{activeFilters.length === 1 ? t('filters_count_one') : t('filters_count_other').replace('{n}', String(activeFilters.length))}
						</span>
					)}
					{onToggleCollapsed && (
						<button
							className="nb-filter-pills-toggle"
							onClick={onToggleCollapsed}
							title={collapsed ? t('show_filters') : t('hide_filters')}
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
								{collapsed ? <polyline points="6 9 12 15 18 9"/> : <polyline points="18 15 12 9 6 15"/>}
							</svg>
						</button>
					)}
				</div>
			)}

			{filter && !collapsed && pillDropdownPos && createPortal(
				<div
					ref={pillDropdownRef}
					className="nb-filter-pill-dropdown"
					style={{ position: 'fixed', top: pillDropdownPos.top, left: pillDropdownPos.left, zIndex: 1000 }}
				>
					<div className="nb-filter-query-row">
						<span className="nb-filter-query-name">{filter.columnName}</span>
						<div
							className="nb-filter-op-wrapper"
							ref={el => { operatorPickerRefs.current[filter.id] = el }}
						>
							<button
								className={`nb-filter-op-btn ${openOperatorPicker === filter.id ? 'nb-filter-op-btn--open' : ''}`}
								onClick={e => { e.stopPropagation(); setOpenOperatorPicker(v => v === filter.id ? null : filter.id) }}
							>
								{OPERATOR_LABELS[filter.operator]}
								<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
							</button>
							{openOperatorPicker === filter.id && (
								<div className="nb-filter-op-dropdown">
									{getOperatorsForType(filter.columnType).map(op => (
										<button
											key={op}
											className={`nb-menu-item ${filter.operator === op ? 'nb-menu-item--active' : ''}`}
											onClick={e => { e.stopPropagation(); onUpdate(filter.id, op, ''); setOpenOperatorPicker(null) }}
										>
											{OPERATOR_LABELS[op]}
										</button>
									))}
								</div>
							)}
						</div>
						<button
							className="nb-filter-query-clear"
							onClick={e => { e.stopPropagation(); onRemove(filter.id) }}
							title={t('tooltip_remove_filter')}
						>×</button>
					</div>
					{!NO_VALUE_OPERATORS.has(filter.operator) && (
						isMultiValueFilter(filter) ? (
							<div className="nb-filter-multi-select">
								{(() => {
									const col = schema.find(c => c.id === filter.columnId)
									const options = col?.options ?? []
									const selectedValues = parseMultiValue(filter.value)
									return options.length > 0 ? options.map(opt => (
										<label key={opt.value} className="nb-filter-multi-option">
											<input
												type="checkbox"
												checked={selectedValues.includes(opt.value)}
												onChange={() => onUpdate(filter.id, filter.operator, toggleMultiValue(filter.value, opt.value))}
											/>
											<span className="nb-filter-option-badge" style={opt.color ? { backgroundColor: opt.color } : undefined}>{opt.value}</span>
										</label>
									)) : (
										<input
											className="nb-filter-value-input"
											type="text"
											placeholder={t('filter_value_placeholder')}
											value={filter.value}
											autoFocus={!isMobile}
											onChange={e => onUpdate(filter.id, filter.operator, e.target.value)}
										/>
									)
								})()}
							</div>
						) : (
							<input
								className="nb-filter-value-input"
								type={filter.columnType === 'number' ? 'number' : filter.columnType === 'date' ? 'date' : 'text'}
								placeholder={filter.columnType === 'number' ? t('filter_number_placeholder') : filter.columnType === 'date' ? '' : t('filter_value_placeholder')}
								value={filter.value}
								autoFocus={!isMobile}
								onChange={e => onUpdate(filter.id, filter.operator, e.target.value)}
							/>
						)
					)}
				</div>,
				document.body
			)}
		</>
	)
}
