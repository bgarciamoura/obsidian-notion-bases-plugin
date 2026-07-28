import React from 'react'
import { ColumnSchema } from '../types'
import { getColumnIconStatic } from './filter-utils'
import { t } from '../i18n'

// ── Group header ────────────────────────────────────────────────────────────

export interface GroupHeaderProps {
	label: string
	color?: string
	count: number
	collapsed: boolean
	onToggle: () => void
	onAdd: () => void
}

export function GroupHeader({ label, color, count, collapsed, onToggle, onAdd }: GroupHeaderProps) {
	return (
		<div className="nb-group-header" onClick={onToggle}>
			<button
				className="nb-hierarchy-toggle"
				aria-expanded={!collapsed}
				title={collapsed ? t('expand_all') : t('collapse_all')}
			>
				{collapsed ? '▶' : '▼'}
			</button>
			{color ? <span className="nb-group-header-dot" style={{ backgroundColor: color }} /> : null}
			<span className="nb-group-header-label">{label}</span>
			<span className="nb-group-header-count">{count}</span>
			<button
				className="nb-group-header-add"
				onClick={e => { e.stopPropagation(); onAdd() }}
				title={t('add_entry')}
			>
				+
			</button>
		</div>
	)
}

// ── Group by dropdown ───────────────────────────────────────────────────────

export interface GroupByMenuProps {
	groupableColumns: ColumnSchema[]
	activeColumnId?: string
	hideEmpty: boolean
	hideNoValue: boolean
	onSelect: (columnId: string | undefined) => void
	onToggleHideEmpty: (next: boolean) => void
	onToggleHideNoValue: (next: boolean) => void
	onCollapseAll: () => void
	onExpandAll: () => void
}

export function GroupByMenu({
	groupableColumns, activeColumnId, hideEmpty, hideNoValue,
	onSelect, onToggleHideEmpty, onToggleHideNoValue, onCollapseAll, onExpandAll,
}: GroupByMenuProps) {
	const grouped = groupableColumns.some(c => c.id === activeColumnId)
	return (
		<div className="nb-fields-dropdown">
			<div className="nb-fields-dropdown-label">{t('group_by_label')}</div>
			<button
				className={`nb-menu-item${!activeColumnId ? ' nb-menu-item--active' : ''}`}
				onClick={() => onSelect(undefined)}
			>
				<span>{t('group_none')}</span>
			</button>
			{groupableColumns.map(col => (
				<button
					key={col.id}
					className={`nb-menu-item${activeColumnId === col.id ? ' nb-menu-item--active' : ''}`}
					onClick={() => onSelect(col.id)}
				>
					<span className="nb-menu-item-icon">{getColumnIconStatic(col.type)}</span>
					<span>{col.name}</span>
				</button>
			))}
			{grouped && (
				<>
					<div className="nb-menu-separator" />
					<label className="nb-field-row">
						<input
							type="checkbox"
							className="nb-field-checkbox"
							checked={hideEmpty}
							onChange={e => onToggleHideEmpty(e.target.checked)}
						/>
						<span className="nb-field-name">{t('hide_empty_cols')}</span>
					</label>
					<label className="nb-field-row">
						<input
							type="checkbox"
							className="nb-field-checkbox"
							checked={hideNoValue}
							onChange={e => onToggleHideNoValue(e.target.checked)}
						/>
						<span className="nb-field-name">{t('hide_no_value_cols')}</span>
					</label>
					<div className="nb-menu-separator" />
					<button className="nb-menu-item" onClick={onCollapseAll}><span>{t('collapse_all')}</span></button>
					<button className="nb-menu-item" onClick={onExpandAll}><span>{t('expand_all')}</span></button>
				</>
			)}
		</div>
	)
}
