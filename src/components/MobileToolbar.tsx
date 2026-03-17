import { Fragment, ReactNode, RefObject, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FilterOperator } from '../types'
import {
	ActiveFilter, OPERATOR_LABELS, NO_VALUE_OPERATORS, getOperatorsForType,
} from './filter-utils'
import { t } from '../i18n'

// ── SVG Icons (16px, matching mockup) ────────────────────────────────────────

const IconFilter = () => (
	<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
		<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
	</svg>
)

const IconSort = () => (
	<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
		<line x1="4" y1="6" x2="16" y2="6"/><line x1="4" y1="12" x2="12" y2="12"/><line x1="4" y1="18" x2="8" y2="18"/>
	</svg>
)

const IconFields = () => (
	<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
		<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
	</svg>
)

const IconActions = () => (
	<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
		<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
	</svg>
)

const IconSubfolders = () => (
	<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
		<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
		<line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
	</svg>
)

// ── Types ────────────────────────────────────────────────────────────────────

export interface MobileActionItem {
	id: string
	label: string
	icon?: ReactNode
	active?: boolean
	badge?: number
	onClick: () => void
}

interface MobileToolbarProps {
	search?: { value: string; onChange: (v: string) => void; expanded?: boolean; onToggle?: () => void }
	actions: MobileActionItem[]
	rowCount: number
	rowCountLabel: string
	filters: ActiveFilter[]
	onFilterUpdate: (id: string, operator: FilterOperator, value: string) => void
	onFilterRemove: (id: string) => void
	onConjunctionToggle: (id: string) => void
	actionBarRef?: RefObject<HTMLDivElement>
	children?: ReactNode
}

// ── Component ────────────────────────────────────────────────────────────────

export function MobileToolbar({
	search,
	actions,
	rowCount,
	rowCountLabel,
	filters,
	onFilterUpdate,
	onFilterRemove,
	onConjunctionToggle,
	actionBarRef: externalRef,
	children,
}: MobileToolbarProps) {
	const internalRef = useRef<HTMLDivElement>(null)
	const actionBarRef = externalRef ?? internalRef
	const [searchOpen, setSearchOpen] = useState(false)
	const searchInputRef = useRef<HTMLInputElement>(null)

	return (
		<div className="nb-mobile-toolbar">
			{/* Search strip — tapping opens a BottomSheet so the keyboard does not hide the view content */}
			{search && (
				<div className="nb-mobile-search-strip">
					<div className="nb-mobile-search-wrapper" onClick={() => setSearchOpen(true)}>
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nb-mobile-search-icon">
							<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
						</svg>
						<div className={`nb-mobile-search-input nb-mobile-search-fake${search.value ? " nb-mobile-search-fake--has-value" : ""}`}
							role="button"
							tabIndex={-1}
						>
							{search.value || t('filter_value_placeholder').replace('...', '') + '...'}
						</div>
					</div>
				</div>
			)}

			{/* Search overlay — rendered via portal to document.body, positioned at top */
			/* so the keyboard (at bottom) does not cover the input */}
			{search && searchOpen && createPortal(
				<div className="nb-mobile-search-overlay" onMouseDown={() => setSearchOpen(false)}>
					<div className="nb-mobile-search-overlay-bar" onMouseDown={e => e.stopPropagation()}>
						<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nb-mobile-search-overlay-icon">
							<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
						</svg>
						<input
							ref={searchInputRef}
							className="nb-mobile-search-overlay-input"
							type="text"
							placeholder={t('filter_value_placeholder').replace('...', '') + '...'}
							value={search.value}
							onChange={e => search.onChange(e.target.value)}
							onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); setSearchOpen(false) } }}
							autoFocus
						/>
						<button className="nb-mobile-search-overlay-close" onClick={() => setSearchOpen(false)}>
							×
						</button>
					</div>
				</div>,
				document.body
			)}

			{/* Action bar */}
			<div className="nb-mobile-action-bar" ref={actionBarRef}>
				{actions.map(item => (
					<button
						key={item.id}
						className={`nb-mobile-action-btn${item.active ? ' nb-mobile-action-btn--active' : ''}`}
						onMouseDown={e => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation() }}
						onClick={item.onClick}
					>
						{item.icon}
						<span className="nb-mobile-action-label">{item.label}</span>
						{item.badge != null && item.badge > 0 && (
							<span className="nb-mobile-action-badge">{item.badge}</span>
						)}
					</button>
				))}
			</div>

			{/* Extra controls (dropdowns rendered by the parent) */}
			{children}

			{/* Filter pills + row count */}
			<MobilePillsStrip
				filters={filters}
				rowCount={rowCount}
				rowCountLabel={rowCountLabel}
				onFilterUpdate={onFilterUpdate}
				onFilterRemove={onFilterRemove}
				onConjunctionToggle={onConjunctionToggle}
			/>
		</div>
	)
}

// ── Mobile Pills with expandable dropdown ───────────────────────────────────

function MobilePillsStrip({ filters, rowCount, rowCountLabel, onFilterUpdate, onFilterRemove, onConjunctionToggle }: {
	filters: ActiveFilter[]
	rowCount: number
	rowCountLabel: string
	onFilterUpdate: (id: string, operator: FilterOperator, value: string) => void
	onFilterRemove: (id: string) => void
	onConjunctionToggle: (id: string) => void
}) {
	const [expandedPill, setExpandedPill] = useState<string | null>(null)

	if (filters.length === 0 && rowCount < 0) return null

	return (
		<>
			<div className="nb-mobile-pills-strip">
				{filters.map((f, idx) => (
					<Fragment key={f.id}>
						{idx > 0 && (
							<button
								className={`nb-pill-conjunction${f.conjunction === 'or' ? ' nb-pill-conjunction--or' : ''}`}
								onClick={() => onConjunctionToggle(f.id)}
							>
								{f.conjunction === 'or' ? t('conjunction_or') : t('conjunction_and')}
							</button>
						)}
						<button
							className={`nb-filter-pill${expandedPill === f.id ? ' nb-filter-pill--expanded' : ''}`}
							onClick={() => setExpandedPill(v => v === f.id ? null : f.id)}
						>
							<span className="nb-pill-name">{f.columnName}</span>
							<span
								className="nb-pill-remove"
								onClick={e => { e.stopPropagation(); onFilterRemove(f.id) }}
							>×</span>
						</button>
					</Fragment>
				))}
				<span className="nb-mobile-row-count">{rowCount} {rowCountLabel}</span>
			</div>

			{/* Expanded pill — top overlay (portal to body) so keyboard does not cover it */}
			{(() => {
				const f = expandedPill ? filters.find(fi => fi.id === expandedPill) : null
				if (!f) return null
				return createPortal(
					<div className="nb-mobile-search-overlay" onMouseDown={() => setExpandedPill(null)}>
						<div className="nb-mobile-search-overlay-bar nb-mobile-filter-overlay-bar" onMouseDown={e => e.stopPropagation()}>
							<span className="nb-mobile-filter-overlay-title">{f.columnName}</span>
							<select
								className="nb-mobile-filter-overlay-select"
								value={f.operator}
								onChange={e => onFilterUpdate(f.id, e.target.value as FilterOperator, f.value)}
							>
								{getOperatorsForType(f.columnType).map(op => (
									<option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
								))}
							</select>
							{!NO_VALUE_OPERATORS.has(f.operator) && (
								<input
									className="nb-mobile-search-overlay-input"
									type="text"
									value={f.value}
									placeholder={t('filter_value_placeholder')}
									onChange={e => onFilterUpdate(f.id, f.operator, e.target.value)}
									autoFocus
								/>
							)}
							<button className="nb-mobile-search-overlay-close" onClick={() => setExpandedPill(null)}>
								×
							</button>
						</div>
					</div>,
					document.body
				)
			})()}
		</>
	)
}

// ── Re-export icons for use in view components ──────────────────────────────

export { IconFilter, IconSort, IconFields, IconActions, IconSubfolders }
