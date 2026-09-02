import React, { useState } from 'react'
import { ColumnSchema, FilterOperator, SummaryStat } from '../types'
import { getOperatorsForType, getDefaultOperator, NO_VALUE_OPERATORS, OPERATOR_LABELS } from './filter-utils'
import { t } from '../i18n'

interface SummaryStatsPanelProps {
	stats: SummaryStat[]
	schema: ColumnSchema[]
	onChange: (stats: SummaryStat[]) => void
	onClose: () => void
}

export function SummaryStatsPanel({ stats, schema, onChange, onClose }: SummaryStatsPanelProps) {
	const [editingStat, setEditingStat] = useState<SummaryStat | null>(null)

	const availableCols = schema.filter(c => c.visible)

	const addStat = () => {
		const col = availableCols[0]
		if (!col) return
		setEditingStat({
			id: crypto.randomUUID(),
			label: '',
			columnId: col.id,
			operator: getDefaultOperator(col.type),
			value: '',
		})
	}

	const saveStat = (stat: SummaryStat) => {
		const exists = stats.find(s => s.id === stat.id)
		onChange(exists ? stats.map(s => s.id === stat.id ? stat : s) : [...stats, stat])
		setEditingStat(null)
	}

	const removeStat = (id: string) => {
		onChange(stats.filter(s => s.id !== id))
		if (editingStat?.id === id) setEditingStat(null)
	}

	const getColType = (colId: string) => schema.find(c => c.id === colId)?.type ?? 'text'
	const getColName = (colId: string) => schema.find(c => c.id === colId)?.name ?? colId

	return (
		<div className="nb-cf-panel nb-fields-dropdown nb-summary-panel">
			<div className="nb-cf-panel-header">
				<span className="nb-cf-panel-title">{t('summary_stats')}</span>
				<button className="nb-cf-panel-close" onClick={onClose}>×</button>
			</div>

			{stats.length === 0 && !editingStat && (
				<div className="nb-cf-panel-empty">{t('no_summary_stats')}</div>
			)}

			{stats.map(stat => (
				<div key={stat.id} className="nb-cf-rule" onClick={() => setEditingStat({ ...stat })}>
					<span className="nb-cf-rule-desc">
						<strong>{stat.label || getColName(stat.columnId)}</strong>
						{' — '}
						{getColName(stat.columnId)} {OPERATOR_LABELS[stat.operator]} {NO_VALUE_OPERATORS.has(stat.operator) ? '' : stat.value}
					</span>
					<button className="nb-cf-rule-remove" onClick={e => { e.stopPropagation(); removeStat(stat.id) }}>×</button>
				</div>
			))}

			{editingStat && (
				<StatEditor
					stat={editingStat}
					schema={schema}
					availableCols={availableCols}
					getColType={getColType}
					onSave={saveStat}
					onCancel={() => setEditingStat(null)}
				/>
			)}

			{!editingStat && (
				<button className="nb-cf-add-btn" onClick={addStat}>
					{'+ ' + t('add_stat')}
				</button>
			)}
		</div>
	)
}

function StatEditor({ stat, schema, availableCols, getColType, onSave, onCancel }: {
	stat: SummaryStat
	schema: ColumnSchema[]
	availableCols: ColumnSchema[]
	getColType: (colId: string) => string
	onSave: (stat: SummaryStat) => void
	onCancel: () => void
}) {
	const [draft, setDraft] = useState(stat)
	const colType = getColType(draft.columnId)
	const operators = getOperatorsForType(colType)
	const needsValue = !NO_VALUE_OPERATORS.has(draft.operator)

	const col = schema.find(c => c.id === draft.columnId)
	const selectOptions = col?.options?.map(o => o.value).filter(Boolean) ?? []
	const isSelectType = colType === 'select' || colType === 'multiselect' || colType === 'status'

	return (
		<div className="nb-cf-editor">
			<div className="nb-cf-editor-row">
				<input
					className="nb-cf-input"
					type="text"
					value={draft.label}
					onChange={e => setDraft({ ...draft, label: e.target.value })}
					placeholder={t('stat_label')}
					autoFocus
				/>
			</div>
			<div className="nb-cf-editor-row">
				<select
					className="nb-cf-select"
					value={draft.columnId}
					onChange={e => {
						const newType = getColType(e.target.value)
						setDraft({ ...draft, columnId: e.target.value, operator: getDefaultOperator(newType), value: '' })
					}}
				>
					{availableCols.map(c => (
						<option key={c.id} value={c.id}>{c.name}</option>
					))}
				</select>
				<select
					className="nb-cf-select"
					value={draft.operator}
					onChange={e => setDraft({ ...draft, operator: e.target.value as FilterOperator })}
				>
					{operators.map(op => (
						<option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
					))}
				</select>
			</div>
			{needsValue && (
				<div className="nb-cf-editor-row">
					{isSelectType && selectOptions.length > 0 ? (
						<select
							className="nb-cf-select nb-cf-value"
							value={draft.value}
							onChange={e => setDraft({ ...draft, value: e.target.value })}
						>
							<option value="">{t('select_value')}</option>
							{selectOptions.map(opt => (
								<option key={opt} value={opt}>{opt}</option>
							))}
						</select>
					) : (
						<input
							className="nb-cf-input"
							type={colType === 'number' ? 'number' : colType === 'date' ? 'date' : 'text'}
							value={draft.value}
							onChange={e => setDraft({ ...draft, value: e.target.value })}
							placeholder={t('value')}
						/>
					)}
				</div>
			)}
			<div className="nb-cf-editor-actions">
				<button className="nb-cf-btn nb-cf-btn--save" onClick={() => onSave(draft)}>{t('save')}</button>
				<button className="nb-cf-btn nb-cf-btn--cancel" onClick={onCancel}>{t('cancel')}</button>
			</div>
		</div>
	)
}
