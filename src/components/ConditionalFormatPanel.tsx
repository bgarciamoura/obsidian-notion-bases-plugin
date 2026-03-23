import React, { useState } from 'react'
import { ColumnSchema, ConditionalFormatRule, FilterOperator } from '../types'
import { getOperatorsForType, getDefaultOperator, NO_VALUE_OPERATORS, OPERATOR_LABELS } from './filter-utils'
import { t } from '../i18n'

interface ConditionalFormatPanelProps {
	rules: ConditionalFormatRule[]
	schema: ColumnSchema[]
	onChange: (rules: ConditionalFormatRule[]) => void
	onClose: () => void
}

const PRESET_COLORS = [
	{ bg: '#dcfce7', text: '' },  // green light
	{ bg: '#fef9c3', text: '' },  // yellow light
	{ bg: '#fee2e2', text: '' },  // red light
	{ bg: '#dbeafe', text: '' },  // blue light
	{ bg: '#f3e8ff', text: '' },  // purple light
	{ bg: '#ffedd5', text: '' },  // orange light
	{ bg: '', text: '#16a34a' },  // green text
	{ bg: '', text: '#dc2626' },  // red text
	{ bg: '', text: '#2563eb' },  // blue text
	{ bg: '#dc2626', text: '#ffffff' }, // red bg + white text
	{ bg: '#16a34a', text: '#ffffff' }, // green bg + white text
	{ bg: '#2563eb', text: '#ffffff' }, // blue bg + white text
]

export function ConditionalFormatPanel({ rules, schema, onChange, onClose }: ConditionalFormatPanelProps) {
	const [editingRule, setEditingRule] = useState<ConditionalFormatRule | null>(null)

	const availableCols = schema.filter(c => c.visible && c.type !== 'formula' && c.type !== 'lookup' && c.type !== 'rollup')

	const addRule = () => {
		const col = availableCols[0]
		if (!col) return
		const newRule: ConditionalFormatRule = {
			id: crypto.randomUUID(),
			columnId: col.id,
			operator: getDefaultOperator(col.type),
			value: '',
			bgColor: '#dcfce7',
			textColor: '',
		}
		setEditingRule(newRule)
	}

	const saveRule = (rule: ConditionalFormatRule) => {
		const exists = rules.find(r => r.id === rule.id)
		const updated = exists ? rules.map(r => r.id === rule.id ? rule : r) : [...rules, rule]
		onChange(updated)
		setEditingRule(null)
	}

	const removeRule = (id: string) => {
		onChange(rules.filter(r => r.id !== id))
		if (editingRule?.id === id) setEditingRule(null)
	}

	const getColType = (colId: string) => schema.find(c => c.id === colId)?.type ?? 'text'
	const getColName = (colId: string) => schema.find(c => c.id === colId)?.name ?? colId

	return (
		<div className="nb-cf-panel nb-fields-dropdown">
			<div className="nb-cf-panel-header">
				<span className="nb-cf-panel-title">{t('conditional_formatting')}</span>
				<button className="nb-cf-panel-close" onClick={onClose}>×</button>
			</div>

			{rules.length === 0 && !editingRule && (
				<div className="nb-cf-panel-empty">{t('no_conditional_formats')}</div>
			)}

			{rules.map(rule => (
				<div key={rule.id} className="nb-cf-rule" onClick={() => setEditingRule({ ...rule })}>
					<span
						className="nb-cf-rule-preview"
						style={{ backgroundColor: rule.bgColor || undefined, color: rule.textColor || undefined }}
					>
						Aa
					</span>
					<span className="nb-cf-rule-desc">
						{getColName(rule.columnId)} {OPERATOR_LABELS[rule.operator]} {NO_VALUE_OPERATORS.has(rule.operator) ? '' : rule.value}
					</span>
					<button className="nb-cf-rule-remove" onClick={e => { e.stopPropagation(); removeRule(rule.id) }}>×</button>
				</div>
			))}

			{editingRule && (
				<RuleEditor
					rule={editingRule}
					schema={schema}
					availableCols={availableCols}
					getColType={getColType}
					onSave={saveRule}
					onCancel={() => setEditingRule(null)}
				/>
			)}

			{!editingRule && (
				<button className="nb-cf-add-btn" onClick={addRule}>
					{'+ ' + t('add_rule')}
				</button>
			)}
		</div>
	)
}

function RuleEditor({ rule, schema, availableCols, getColType, onSave, onCancel }: {
	rule: ConditionalFormatRule
	schema: ColumnSchema[]
	availableCols: ColumnSchema[]
	getColType: (colId: string) => string
	onSave: (rule: ConditionalFormatRule) => void
	onCancel: () => void
}) {
	const [draft, setDraft] = useState(rule)
	const colType = getColType(draft.columnId)
	const operators = getOperatorsForType(colType)
	const needsValue = !NO_VALUE_OPERATORS.has(draft.operator)

	const col = schema.find(c => c.id === draft.columnId)
	const selectOptions = col?.options?.map(o => o.value) ?? []
	const isSelectType = colType === 'select' || colType === 'multiselect' || colType === 'status'

	return (
		<div className="nb-cf-editor">
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
							autoFocus
						/>
					)}
				</div>
			)}
			<div className="nb-cf-editor-row">
				<span className="nb-cf-color-label">{t('style')}</span>
			</div>
			<div className="nb-cf-presets">
				{PRESET_COLORS.map((preset, i) => (
					<button
						key={i}
						className={`nb-cf-preset${draft.bgColor === preset.bg && draft.textColor === preset.text ? ' nb-cf-preset--active' : ''}`}
						style={{ backgroundColor: preset.bg || 'transparent', color: preset.text || 'var(--text-normal)', borderColor: preset.bg || preset.text || 'var(--background-modifier-border)' }}
						onClick={() => setDraft({ ...draft, bgColor: preset.bg, textColor: preset.text })}
					>
						Aa
					</button>
				))}
			</div>
			<div className="nb-cf-editor-row nb-cf-custom-colors">
				<label className="nb-cf-color-field">
					<span>{t('background')}</span>
					<input type="color" value={draft.bgColor || '#ffffff'} onChange={e => setDraft({ ...draft, bgColor: e.target.value === '#ffffff' ? '' : e.target.value })} />
				</label>
				<label className="nb-cf-color-field">
					<span>{t('text_color')}</span>
					<input type="color" value={draft.textColor || '#000000'} onChange={e => setDraft({ ...draft, textColor: e.target.value === '#000000' ? '' : e.target.value })} />
				</label>
			</div>
			<div className="nb-cf-editor-actions">
				<button className="nb-cf-btn nb-cf-btn--save" onClick={() => onSave(draft)}>{t('save')}</button>
				<button className="nb-cf-btn nb-cf-btn--cancel" onClick={onCancel}>{t('cancel')}</button>
			</div>
		</div>
	)
}
