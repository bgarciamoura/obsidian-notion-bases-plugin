import React, { useRef, useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { TFile } from 'obsidian'
import { ColumnSchema, NumberFormat, SelectOption } from '../../types'
import { useApp } from '../../context'
import { t } from '../../i18n'

interface CellProps {
	col: ColumnSchema
	value: unknown
	rowIndex: number
	columnId: string
	file?: TFile
}

// Hook para acessar o meta da tabela via contexto implícito
// Como não temos acesso ao `table` aqui, recebemos callbacks via prop do DatabaseTable
// Usamos um contexto React separado para isso
import { createContext, useContext } from 'react'

interface CellContextType {
	editingCell: { rowIndex: number; columnId: string } | null
	setEditingCell: (cell: { rowIndex: number; columnId: string } | null) => void
	updateCell: (rowIndex: number, columnId: string, value: unknown) => Promise<void>
	schema: ColumnSchema[]
	relationOptions: Map<string, string[]>
	updateSchema: (newSchema: ColumnSchema[]) => Promise<void>
}

export const CellContext = createContext<CellContextType | null>(null)

export function useCellContext(): CellContextType {
	const ctx = useContext(CellContext)
	if (!ctx) throw new Error('CellContext não encontrado')
	return ctx
}

// ── Number format helper ─────────────────────────────────────────────────────

function formatNumber(value: number, fmt: NumberFormat | undefined): string {
	if (!fmt) return String(value)
	const opts: Intl.NumberFormatOptions = {
		minimumFractionDigits: fmt.decimals,
		maximumFractionDigits: fmt.decimals,
		useGrouping: fmt.thousandsSeparator,
	}
	let result = new Intl.NumberFormat('pt-BR', opts).format(value)
	if (fmt.prefix) result = `${fmt.prefix} ${result}`
	if (fmt.suffix) result = `${result} ${fmt.suffix}`
	return result
}

// ── Componente principal ─────────────────────────────────────────────────────

const DEFAULT_STATUS_OPTIONS: SelectOption[] = [
	{ value: t('status_not_started'), color: '#9E9E9E' },
	{ value: t('status_in_progress'), color: '#2196F3' },
	{ value: t('status_done'), color: '#4CAF50' },
	{ value: t('status_cancelled'), color: '#F44336' },
]

function applyPhoneMask(v: string): string {
	const digits = v.replace(/\D/g, '').slice(0, 11)
	if (digits.length <= 2) return `(${digits}`
	if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
	if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
	return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function LinkCell({ value, href, isEditing, inputType, onStartEdit, onCommit, onCancel, validate }: {
	value: string | null
	href: string | null
	inputType: string
	isEditing: boolean
	onStartEdit: () => void
	onCommit: (v: string | null) => void
	onCancel: () => void
	validate?: (v: string) => string | null
}) {
	const [error, setError] = useState<string | null>(null)

	const openLink = (e: React.MouseEvent) => {
		e.stopPropagation()
		if (href) window.open(href, '_blank')
	}

	const handleCommit = (v: string | null) => {
		if (v && validate) {
			const err = validate(v)
			if (err) { setError(err); return }
		}
		setError(null)
		onCommit(v)
	}

	if (isEditing) {
		return (
			<div className="nb-link-edit-wrapper">
				<input
					className={`nb-cell-input${error ? ' nb-cell-input--error' : ''}`}
					autoFocus
					type={inputType}
					defaultValue={value ?? ''}
					onBlur={e => handleCommit(e.target.value || null)}
					onKeyDown={e => {
						if (e.key === 'Enter') handleCommit((e.target as HTMLInputElement).value || null)
						if (e.key === 'Escape') { setError(null); onCancel() }
					}}
				/>
				{error && <span className="nb-cell-error-msg">{error}</span>}
			</div>
		)
	}

	return (
		<div className="nb-cell-clickable" onClick={onStartEdit}>
			{value ? (
				<span className="nb-cell-link-wrapper">
					<span className="nb-cell-link" onClick={openLink}>{value}</span>
					<span className="nb-cell-link-icon" onClick={openLink}>↗</span>
				</span>
			) : (
				<span className="nb-cell-empty">—</span>
			)}
		</div>
	)
}

export function CellRenderer({ col, value, rowIndex, columnId, file }: CellProps) {
	const { editingCell, setEditingCell, updateCell, relationOptions } = useCellContext()
	const app = useApp()
	const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.columnId === columnId

	const startEditing = () => {
		if (col.type === 'formula' || col.type === 'lookup' || col.type === 'checkbox') return
		setEditingCell({ rowIndex, columnId })
	}

	switch (col.type) {
		case 'title':
			return (
				<TextCell
					value={String((value as string | number | boolean | null | undefined) ?? '')}
					isEditing={isEditing}
					onStartEdit={startEditing}
					onCommit={v => { void updateCell(rowIndex, columnId, v) }}
					onCancel={() => setEditingCell(null)}
					onOpen={file ? () => { void app.workspace.getLeaf(false).openFile(file) } : undefined}
				/>
			)

		case 'text':
			return (
				<TextCell
					value={String((value as string | number | boolean | null | undefined) ?? '')}
					isEditing={isEditing}
					onStartEdit={startEditing}
					onCommit={v => { void updateCell(rowIndex, columnId, v) }}
					onCancel={() => setEditingCell(null)}
				/>
			)

		case 'number':
			return (
				<NumberCell
					value={value as number | null}
					isEditing={isEditing}
					onStartEdit={startEditing}
					onCommit={v => { void updateCell(rowIndex, columnId, v) }}
					onCancel={() => setEditingCell(null)}
					format={col.numberFormat}
				/>
			)

		case 'select':
			return (
				<SelectCell
					value={value as string | null}
					col={col}
					isEditing={isEditing}
					onStartEdit={startEditing}
					onCommit={v => { void updateCell(rowIndex, columnId, v); setEditingCell(null) }}
					onCancel={() => setEditingCell(null)}
				/>
			)

		case 'multiselect':
			return (
				<MultiSelectCell
					value={Array.isArray(value) ? value as string[] : []}
					col={col}
					isEditing={isEditing}
					onStartEdit={startEditing}
					onCommit={v => { void updateCell(rowIndex, columnId, v); setEditingCell(null) }}
					onCancel={() => setEditingCell(null)}
				/>
			)

		case 'date':
			return (
				<DateCell
					value={value as string | null}
					isEditing={isEditing}
					onStartEdit={startEditing}
					onCommit={v => { void updateCell(rowIndex, columnId, v); setEditingCell(null) }}
					onCancel={() => setEditingCell(null)}
				/>
			)

		case 'checkbox':
			return (
				<CheckboxCell
					value={Boolean(value)}
					onCommit={v => { void updateCell(rowIndex, columnId, v) }}
				/>
			)

		case 'relation':
			return (
				<RelationCell
					value={value as string | null}
					options={relationOptions.get(columnId) ?? []}
					isEditing={isEditing}
					onStartEdit={startEditing}
					onCommit={v => { void updateCell(rowIndex, columnId, v); setEditingCell(null) }}
					onCancel={() => setEditingCell(null)}
				/>
			)

		case 'url':
			return (
				<LinkCell
					value={value as string | null}
					href={value ? String(value as string | number | boolean) : null}
					inputType="url"
					isEditing={isEditing}
					onStartEdit={startEditing}
					onCommit={v => { void updateCell(rowIndex, columnId, v); setEditingCell(null) }}
					onCancel={() => setEditingCell(null)}
				/>
			)

		case 'email':
			return (
				<LinkCell
					value={value as string | null}
					href={value ? `mailto:${value as string}` : null}
					inputType="email"
					isEditing={isEditing}
					onStartEdit={startEditing}
					onCommit={v => { void updateCell(rowIndex, columnId, v); setEditingCell(null) }}
					onCancel={() => setEditingCell(null)}
					validate={v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : t('email_invalid')}
				/>
			)

		case 'phone':
			return (
				<PhoneCell
					value={value as string | null}
					isEditing={isEditing}
					onStartEdit={startEditing}
					onCommit={v => { void updateCell(rowIndex, columnId, v); setEditingCell(null) }}
					onCancel={() => setEditingCell(null)}
				/>
			)

		case 'status':
			return (
				<StatusCell
					value={value as string | null}
					col={col}
					isEditing={isEditing}
					onStartEdit={startEditing}
					onCommit={v => { void updateCell(rowIndex, columnId, v); setEditingCell(null) }}
					onCancel={() => setEditingCell(null)}
				/>
			)

		case 'formula':
			return <FormulaCell value={value} col={col} />

		case 'lookup':
			return <LookupCell value={value} col={col} />

		case 'image':
			return (
				<ImageCell
					col={col}
					value={value as string | null}
					isEditing={isEditing}
					onStartEdit={startEditing}
					onCommit={v => { void updateCell(rowIndex, columnId, v); setEditingCell(null) }}
					onCancel={() => setEditingCell(null)}
				/>
			)

		default:
			return <span className="nb-cell-text">{String((value as string | number | boolean | null | undefined) ?? '')}</span>
	}
}

// ── TextCell ─────────────────────────────────────────────────────────────────

function TextCell({ value, isEditing, onStartEdit, onCommit, onCancel, onOpen }: {
	value: string
	isEditing: boolean
	onStartEdit: () => void
	onCommit: (v: string) => void
	onCancel: () => void
	onOpen?: () => void
}) {
	const inputRef = useRef<HTMLInputElement>(null)
	const [draft, setDraft] = useState(value)
	const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(() => {
		if (isEditing) {
			setDraft(value)
			requestAnimationFrame(() => inputRef.current?.select())
		}
	}, [isEditing, value])

	useEffect(() => {
		return () => { if (clickTimer.current) clearTimeout(clickTimer.current) }
	}, [])

	const handleTextClick = () => {
		if (!onOpen) return
		if (clickTimer.current !== null) {
			clearTimeout(clickTimer.current)
			clickTimer.current = null
			return
		}
		clickTimer.current = setTimeout(() => {
			clickTimer.current = null
			onOpen()
		}, 250)
	}

	const handleDoubleClick = () => {
		if (clickTimer.current) {
			clearTimeout(clickTimer.current)
			clickTimer.current = null
		}
		onStartEdit()
	}

	if (!isEditing) {
		return (
			<div
				className="nb-cell-text nb-cell-clickable nb-cell-editable"
				onDoubleClick={handleDoubleClick}
			>
				{onOpen ? (
					<span className="nb-cell-title-link" onClick={handleTextClick}>
						{value || <span className="nb-cell-empty">—</span>}
					</span>
				) : (
					value || <span className="nb-cell-empty">—</span>
				)}
			</div>
		)
	}

	return (
		<input
			ref={inputRef}
			className="nb-cell-input"
			value={draft}
			onChange={e => setDraft(e.target.value)}
			onBlur={() => { onCommit(draft); onCancel() }}
			onKeyDown={e => {
				if (e.key === 'Enter') { onCommit(draft); onCancel() }
				if (e.key === 'Escape') { onCancel() }
			}}
		/>
	)
}

// ── NumberCell ───────────────────────────────────────────────────────────────

function NumberCell({ value, isEditing, onStartEdit, onCommit, onCancel, format }: {
	value: number | null
	isEditing: boolean
	onStartEdit: () => void
	onCommit: (v: number | null) => void
	onCancel: () => void
	format?: NumberFormat
}) {
	const inputRef = useRef<HTMLInputElement>(null)
	const [draft, setDraft] = useState(value?.toString() ?? '')

	useEffect(() => {
		if (isEditing) {
			setDraft(value?.toString() ?? '')
			requestAnimationFrame(() => inputRef.current?.select())
		}
	}, [isEditing, value])

	if (!isEditing) {
		return (
			<div className="nb-cell-text nb-cell-clickable nb-cell-number" onDoubleClick={onStartEdit}>
				{value !== null && value !== undefined ? formatNumber(value, format) : <span className="nb-cell-empty">—</span>}
			</div>
		)
	}

	return (
		<input
			ref={inputRef}
			type="number"
			className="nb-cell-input nb-cell-input--number"
			value={draft}
			onChange={e => setDraft(e.target.value)}
			onBlur={() => {
				const n = draft === '' ? null : Number(draft)
				onCommit(isNaN(n as number) ? null : n)
				onCancel()
			}}
			onKeyDown={e => {
				if (e.key === 'Enter') {
					const n = draft === '' ? null : Number(draft)
					onCommit(isNaN(n as number) ? null : n)
					onCancel()
				}
				if (e.key === 'Escape') onCancel()
			}}
		/>
	)
}

// ── PhoneCell ────────────────────────────────────────────────────────────────

function PhoneCell({ value, isEditing, onStartEdit, onCommit, onCancel }: {
	value: string | null
	isEditing: boolean
	onStartEdit: () => void
	onCommit: (v: string | null) => void
	onCancel: () => void
}) {
	const [draft, setDraft] = useState('')

	useEffect(() => {
		if (isEditing) setDraft(applyPhoneMask(value ?? ''))
	}, [isEditing, value])

	const openTel = (e: React.MouseEvent) => {
		e.stopPropagation()
		if (value) window.open(`tel:${value}`, '_blank')
	}

	if (isEditing) {
		return (
			<input
				className="nb-cell-input"
				autoFocus
				type="tel"
				value={draft}
				onChange={e => setDraft(applyPhoneMask(e.target.value))}
				onBlur={() => onCommit(draft || null)}
				onKeyDown={e => {
					if (e.key === 'Enter') onCommit(draft || null)
					if (e.key === 'Escape') onCancel()
				}}
			/>
		)
	}

	return (
		<div className="nb-cell-clickable" onClick={onStartEdit}>
			{value ? (
				<span className="nb-cell-link-wrapper">
					<span className="nb-cell-link" onClick={openTel}>{applyPhoneMask(value)}</span>
					<span className="nb-cell-link-icon" onClick={openTel}>📞</span>
				</span>
			) : (
				<span className="nb-cell-empty">—</span>
			)}
		</div>
	)
}

// ── SelectCell ───────────────────────────────────────────────────────────────

const SELECT_COLORS = [
	'#e2d9f3', '#d1e8ff', '#d4f1c0', '#fde8c8',
	'#ffd6d6', '#d6f0f0', '#f0d6f0', '#f0f0d6',
]

function getOptionColor(options: SelectOption[], value: string): string {
	const opt = options.find(o => o.value === value)
	if (opt?.color) return opt.color
	const idx = options.findIndex(o => o.value === value)
	return SELECT_COLORS[idx % SELECT_COLORS.length] ?? '#e8e8e8'
}

function getContrastTextColor(hex: string): string {
	const c = hex.replace('#', '')
	const r = parseInt(c.substring(0, 2), 16)
	const g = parseInt(c.substring(2, 4), 16)
	const b = parseInt(c.substring(4, 6), 16)
	// Relative luminance (sRGB)
	const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
	return luminance > 0.5 ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.9)'
}

function SelectCell({ value, col, isEditing, onStartEdit, onCommit, onCancel }: {
	value: string | null
	col: ColumnSchema
	isEditing: boolean
	onStartEdit: () => void
	onCommit: (v: string | null) => void
	onCancel: () => void
}) {
	const { updateSchema, schema } = useCellContext()
	const wrapperRef = useRef<HTMLDivElement>(null)
	const dropdownRef = useRef<HTMLDivElement>(null)
	const colorPickerRef = useRef<HTMLDivElement>(null)
	const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null)
	const [newOptionName, setNewOptionName] = useState('')
	const [colorPickerFor, setColorPickerFor] = useState<string | null>(null)
	const [colorPickerPos, setColorPickerPos] = useState<{ top: number; left: number } | null>(null)
	const [localColors, setLocalColors] = useState<Record<string, string>>({})
	const baseOptions = col.options ?? []
	const options = baseOptions.map(o => localColors[o.value] ? { ...o, color: localColors[o.value] } : o)
	const pendingColorsRef = useRef<Record<string, string>>({})
	const PICKER_W = 176

	const COLOR_PALETTE = [
		'#9E9E9E', '#F44336', '#E91E63', '#9C27B0', '#673AB7',
		'#3F51B5', '#2196F3', '#03A9F4', '#00BCD4', '#009688',
		'#4CAF50', '#8BC34A', '#FFEB3B', '#FF9800', '#FF5722', '#795548',
	]

	const updateOptionColor = (optValue: string, color: string) => {
		setLocalColors(prev => ({ ...prev, [optValue]: color }))
		pendingColorsRef.current[optValue] = color
	}

	const flushPendingColors = useCallback(() => {
		const pending = pendingColorsRef.current
		if (Object.keys(pending).length === 0) return
		const newOptions = baseOptions.map(o => pending[o.value] ? { ...o, color: pending[o.value] } : o)
		const newSchema = schema.map(c => c.id === col.id ? { ...c, options: newOptions } : c)
		pendingColorsRef.current = {}
		setLocalColors({})
		void updateSchema(newSchema)
	}, [baseOptions, schema, col.id, updateSchema])

	useEffect(() => {
		if (!isEditing) return
		const handler = (e: MouseEvent) => {
			const inWrapper = wrapperRef.current?.contains(e.target as Node)
			const inDropdown = dropdownRef.current?.contains(e.target as Node)
			const inColorPicker = colorPickerRef.current?.contains(e.target as Node)
			if (!inWrapper && !inDropdown && !inColorPicker) {
				flushPendingColors()
				onCancel()
			}
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [isEditing, onCancel, flushPendingColors])

	useEffect(() => {
		if (!isEditing) {
			setColorPickerFor(null)
			return
		}
		setNewOptionName('')
		setLocalColors({})
		pendingColorsRef.current = {}
		if (wrapperRef.current) {
			const rect = wrapperRef.current.getBoundingClientRect()
			setDropPos({ top: rect.bottom, left: rect.left, width: rect.width })
		}
	}, [isEditing])

	useEffect(() => {
		if (!colorPickerFor) return
		const handler = (e: MouseEvent) => {
			if (!colorPickerRef.current?.contains(e.target as Node)) setColorPickerFor(null)
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [colorPickerFor])

	const addNewOption = async (name: string) => {
		const trimmed = name.trim()
		if (!trimmed || options.some(o => o.value === trimmed)) return
		const color = SELECT_COLORS[options.length % SELECT_COLORS.length]
		const newOptions = [...options, { value: trimmed, color }]
		const newSchema = schema.map(c => c.id === col.id ? { ...c, options: newOptions } : c)
		await updateSchema(newSchema)
		onCommit(trimmed)
		setNewOptionName('')
	}

	const deleteOption = async (optValue: string, e: React.MouseEvent) => {
		e.stopPropagation()
		const newOptions = options.filter(o => o.value !== optValue)
		const newSchema = schema.map(c => c.id === col.id ? { ...c, options: newOptions } : c)
		await updateSchema(newSchema)
		if (value === optValue) onCommit(null)
	}

	const dropdown = isEditing && dropPos ? createPortal(
		<div
			ref={dropdownRef}
			className="nb-select-dropdown"
			style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, minWidth: dropPos.width, zIndex: 9999 }}
		>
			<input
				className="nb-select-new-input"
				type="text"
				placeholder={t('select_create_placeholder')}
				value={newOptionName}
				autoFocus
				onChange={e => setNewOptionName(e.target.value)}
				onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void addNewOption(newOptionName) } }}
			/>
			<button className="nb-select-option nb-select-clear" onClick={() => onCommit(null)}>
				{t('select_clear')}
			</button>
			{options.map(opt => (
				<div key={opt.value} className="nb-select-option-row">
					<button
						className={`nb-select-option ${value === opt.value ? 'nb-select-option--active' : ''}`}
						onClick={() => onCommit(opt.value)}
					>
						<span
							className="nb-select-badge"
							style={{ background: getOptionColor(options, opt.value), color: getContrastTextColor(getOptionColor(options, opt.value)) }}
						>
							{opt.value}
						</span>
					</button>
					<button
						className={`nb-status-color-swatch ${colorPickerFor === opt.value ? 'nb-status-color-swatch--active' : ''}`}
						title={t('tooltip_change_color')}
						style={{ background: getOptionColor(options, opt.value) }}
						onClick={e => {
							e.stopPropagation()
							const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
							setColorPickerPos({ top: rect.bottom + 4, left: Math.min(rect.right - PICKER_W, window.innerWidth - PICKER_W - 8) })
							setColorPickerFor(prev => prev === opt.value ? null : opt.value)
						}}
					/>
					<button
						className="nb-select-option-delete"
						onClick={e => void deleteOption(opt.value, e)}
						title={t('select_clear')}
					>×</button>
				</div>
			))}
		</div>,
		document.body
	) : null

	const colorPicker = colorPickerFor && colorPickerPos ? createPortal(
		<div
			ref={colorPickerRef}
			className="nb-status-color-picker"
			style={{ position: 'fixed', top: colorPickerPos.top, left: colorPickerPos.left, zIndex: 10000 }}
		>
			<div className="nb-status-color-grid">
				{COLOR_PALETTE.map(color => (
					<button
						key={color}
						className="nb-status-color-dot"
						style={{ background: color }}
						title={color}
						onClick={e => { e.stopPropagation(); void updateOptionColor(colorPickerFor, color) }}
					/>
				))}
			</div>
			<div className="nb-status-color-custom">
				<label className="nb-status-color-custom-label">
					{t('color_custom')}
					<input
						type="color"
						className="nb-status-color-input"
						defaultValue={getOptionColor(options, colorPickerFor)}
						onChange={e => { void updateOptionColor(colorPickerFor, e.target.value) }}
					/>
				</label>
			</div>
		</div>,
		document.body
	) : null

	return (
		<div className="nb-cell-select-wrapper" ref={wrapperRef}>
			<div className="nb-cell-clickable" onClick={onStartEdit}>
				{value ? (
					<span
						className="nb-select-badge"
						style={{ background: getOptionColor(options, value), color: getContrastTextColor(getOptionColor(options, value)) }}
					>
						{value}
					</span>
				) : (
					<span className="nb-cell-empty">—</span>
				)}
			</div>
			{dropdown}
			{colorPicker}
		</div>
	)
}


// ── StatusCell ───────────────────────────────────────────────────────────────

function StatusCell({ value, col, isEditing, onStartEdit, onCommit, onCancel }: {
	value: string | null
	col: ColumnSchema
	isEditing: boolean
	onStartEdit: () => void
	onCommit: (v: string | null) => void
	onCancel: () => void
}) {
	const { updateSchema, schema } = useCellContext()
	const wrapperRef = useRef<HTMLDivElement>(null)
	const dropdownRef = useRef<HTMLDivElement>(null)
	const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null)
	const [newStatusName, setNewStatusName] = useState('')
	const [colorPickerFor, setColorPickerFor] = useState<string | null>(null)
	const [colorPickerPos, setColorPickerPos] = useState<{ top: number; left: number } | null>(null)
	const colorPickerRef = useRef<HTMLDivElement>(null)
	const [localColors, setLocalColors] = useState<Record<string, string>>({})
	const pendingColorsRef = useRef<Record<string, string>>({})
	const PICKER_W = 176

	const STATUS_COLOR_PALETTE = [
		'#9E9E9E', '#F44336', '#E91E63', '#9C27B0', '#673AB7',
		'#3F51B5', '#2196F3', '#03A9F4', '#00BCD4', '#009688',
		'#4CAF50', '#8BC34A', '#FFEB3B', '#FF9800', '#FF5722', '#795548',
	]

	const baseOptions = col.options?.length ? col.options : DEFAULT_STATUS_OPTIONS
	const options = baseOptions.map(o => localColors[o.value] ? { ...o, color: localColors[o.value] } : o)

	const updateOptionColor = (optValue: string, color: string) => {
		setLocalColors(prev => ({ ...prev, [optValue]: color }))
		pendingColorsRef.current[optValue] = color
	}

	const flushPendingColors = useCallback(() => {
		const pending = pendingColorsRef.current
		if (Object.keys(pending).length === 0) return
		const newOptions = baseOptions.map(o => pending[o.value] ? { ...o, color: pending[o.value] } : o)
		const newSchema = schema.map(c => c.id === col.id ? { ...c, options: newOptions } : c)
		pendingColorsRef.current = {}
		setLocalColors({})
		void updateSchema(newSchema)
	}, [baseOptions, schema, col.id, updateSchema])

	useEffect(() => {
		if (!isEditing) return
		const handler = (e: MouseEvent) => {
			const inWrapper = wrapperRef.current?.contains(e.target as Node)
			const inDropdown = dropdownRef.current?.contains(e.target as Node)
			const inColorPicker = colorPickerRef.current?.contains(e.target as Node)
			if (!inWrapper && !inDropdown && !inColorPicker) {
				flushPendingColors()
				onCancel()
			}
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [isEditing, onCancel, flushPendingColors])

	useEffect(() => {
		if (!isEditing) {
			setColorPickerFor(null)
			return
		}
		setNewStatusName('')
		setLocalColors({})
		pendingColorsRef.current = {}
		if (wrapperRef.current) {
			const rect = wrapperRef.current.getBoundingClientRect()
			setDropPos({ top: rect.bottom, left: rect.left, width: rect.width })
		}
	}, [isEditing])

	useEffect(() => {
		if (!colorPickerFor) return
		const handler = (e: MouseEvent) => {
			if (!colorPickerRef.current?.contains(e.target as Node)) setColorPickerFor(null)
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [colorPickerFor])

	const addNewStatus = async () => {
		const name = newStatusName.trim()
		if (!name) return
		const color = SELECT_COLORS[options.length % SELECT_COLORS.length]
		const newOption: SelectOption = { value: name, color }
		const newOptions = [...options, newOption]
		const newSchema = schema.map(c => c.id === col.id ? { ...c, options: newOptions } : c)
		await updateSchema(newSchema)
		setNewStatusName('')
		onCommit(name)
	}

	const dropdown = isEditing && dropPos ? createPortal(
		<div
			ref={dropdownRef}
			className="nb-select-dropdown"
			style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, minWidth: dropPos.width, zIndex: 9999 }}
		>
			<button className="nb-select-option nb-select-clear" onClick={() => onCommit(null)}>
				Limpar
			</button>
			{options.map(opt => (
				<div key={opt.value} className="nb-status-option-row">
					<button
						className={`nb-select-option nb-status-option-btn ${value === opt.value ? 'nb-select-option--active' : ''}`}
						onClick={() => onCommit(opt.value)}
					>
						<span
							className="nb-select-badge"
							style={{ background: getOptionColor(options, opt.value), color: getContrastTextColor(getOptionColor(options, opt.value)) }}
						>
							{opt.value}
						</span>
					</button>
					<button
						className={`nb-status-color-swatch ${colorPickerFor === opt.value ? 'nb-status-color-swatch--active' : ''}`}
						title={t('tooltip_change_color')}
						style={{ background: getOptionColor(options, opt.value), color: getContrastTextColor(getOptionColor(options, opt.value)) }}
						onClick={e => {
							e.stopPropagation()
							const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
							setColorPickerPos({ top: rect.bottom + 4, left: Math.min(rect.right - PICKER_W, window.innerWidth - PICKER_W - 8) })
							setColorPickerFor(prev => prev === opt.value ? null : opt.value)
						}}
					/>
					<button
						className="nb-status-delete-btn"
						title={t('tooltip_delete_status')}
						onClick={(e) => {
							e.stopPropagation()
							const newOptions = options.filter(o => o.value !== opt.value)
							const newSchema = schema.map(c => c.id === col.id ? { ...c, options: newOptions } : c)
							void updateSchema(newSchema)
							if (value === opt.value) onCommit(null)
						}}
					>×</button>
				</div>
			))}
			<div className="nb-status-new-row">
				<input
					className="nb-status-new-input"
					placeholder={t('status_new_placeholder')}
					value={newStatusName}
					onChange={e => setNewStatusName(e.target.value)}
					onKeyDown={e => {
						if (e.key === 'Enter') { e.preventDefault(); void addNewStatus() }
						if (e.key === 'Escape') onCancel()
						e.stopPropagation()
					}}
				/>
				<button
					className="nb-status-new-btn"
					onClick={() => { void addNewStatus() }}
					disabled={!newStatusName.trim()}
				>+</button>
			</div>
		</div>,
		document.body
	) : null

	const colorPicker = colorPickerFor && colorPickerPos ? createPortal(
		<div
			ref={colorPickerRef}
			className="nb-status-color-picker"
			style={{ position: 'fixed', top: colorPickerPos.top, left: colorPickerPos.left, zIndex: 10000 }}
		>
			<div className="nb-status-color-grid">
				{STATUS_COLOR_PALETTE.map(color => (
					<button
						key={color}
						className="nb-status-color-dot"
						style={{ background: color }}
						title={color}
						onClick={(e) => { e.stopPropagation(); void updateOptionColor(colorPickerFor, color) }}
					/>
				))}
			</div>
			<div className="nb-status-color-custom">
				<label className="nb-status-color-custom-label">
					{t('color_custom')}
					<input
						type="color"
						className="nb-status-color-input"
						defaultValue={getOptionColor(options, colorPickerFor)}
						onChange={e => { void updateOptionColor(colorPickerFor, e.target.value) }}
					/>
				</label>
			</div>
		</div>,
		document.body
	) : null

	return (
		<div className="nb-cell-select-wrapper" ref={wrapperRef}>
			<div className="nb-cell-clickable" onClick={onStartEdit}>
				{value ? (
					<span
						className="nb-select-badge"
						style={{ background: getOptionColor(options, value), color: getContrastTextColor(getOptionColor(options, value)) }}
					>
						{value}
					</span>
				) : (
					<span className="nb-cell-empty">—</span>
				)}
			</div>
			{dropdown}
			{colorPicker}
		</div>
	)
}

// ── MultiSelectCell ──────────────────────────────────────────────────────────

function MultiSelectCell({ value, col, isEditing, onStartEdit, onCommit, onCancel }: {
	value: string[]
	col: ColumnSchema
	isEditing: boolean
	onStartEdit: () => void
	onCommit: (v: string[]) => void
	onCancel: () => void
}) {
	const { updateSchema, schema } = useCellContext()
	const wrapperRef = useRef<HTMLDivElement>(null)
	const dropdownRef = useRef<HTMLDivElement>(null)
	const colorPickerRef = useRef<HTMLDivElement>(null)
	const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null)
	const [newOptionName, setNewOptionName] = useState('')
	const [colorPickerFor, setColorPickerFor] = useState<string | null>(null)
	const [colorPickerPos, setColorPickerPos] = useState<{ top: number; left: number } | null>(null)
	const [localColors, setLocalColors] = useState<Record<string, string>>({})
	const pendingColorsRef = useRef<Record<string, string>>({})
	const baseOptions = col.options ?? []
	const options = baseOptions.map(o => localColors[o.value] ? { ...o, color: localColors[o.value] } : o)
	const PICKER_W = 176

	const COLOR_PALETTE = [
		'#9E9E9E', '#F44336', '#E91E63', '#9C27B0', '#673AB7',
		'#3F51B5', '#2196F3', '#03A9F4', '#00BCD4', '#009688',
		'#4CAF50', '#8BC34A', '#FFEB3B', '#FF9800', '#FF5722', '#795548',
	]

	const updateOptionColor = (optValue: string, color: string) => {
		setLocalColors(prev => ({ ...prev, [optValue]: color }))
		pendingColorsRef.current[optValue] = color
	}

	const flushPendingColors = useCallback(() => {
		const pending = pendingColorsRef.current
		if (Object.keys(pending).length === 0) return
		const newOptions = baseOptions.map(o => pending[o.value] ? { ...o, color: pending[o.value] } : o)
		const newSchema = schema.map(c => c.id === col.id ? { ...c, options: newOptions } : c)
		pendingColorsRef.current = {}
		setLocalColors({})
		void updateSchema(newSchema)
	}, [baseOptions, schema, col.id, updateSchema])

	useEffect(() => {
		if (!isEditing) return
		const handler = (e: MouseEvent) => {
			const inWrapper = wrapperRef.current?.contains(e.target as Node)
			const inDropdown = dropdownRef.current?.contains(e.target as Node)
			const inColorPicker = colorPickerRef.current?.contains(e.target as Node)
			if (!inWrapper && !inDropdown && !inColorPicker) {
				flushPendingColors()
				onCancel()
			}
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [isEditing, onCancel, flushPendingColors])

	useEffect(() => {
		if (!isEditing) {
			setColorPickerFor(null)
			return
		}
		setNewOptionName('')
		setLocalColors({})
		pendingColorsRef.current = {}
		if (wrapperRef.current) {
			const rect = wrapperRef.current.getBoundingClientRect()
			setDropPos({ top: rect.bottom, left: rect.left, width: rect.width })
		}
	}, [isEditing])

	useEffect(() => {
		if (!colorPickerFor) return
		const handler = (e: MouseEvent) => {
			if (!colorPickerRef.current?.contains(e.target as Node)) setColorPickerFor(null)
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [colorPickerFor])

	const toggle = (opt: string) => {
		const next = value.includes(opt)
			? value.filter(v => v !== opt)
			: [...value, opt]
		onCommit(next)
	}

	const addNewOption = async (name: string) => {
		const trimmed = name.trim()
		if (!trimmed || options.some(o => o.value === trimmed)) return
		const color = SELECT_COLORS[options.length % SELECT_COLORS.length]
		const newOptions = [...options, { value: trimmed, color }]
		const newSchema = schema.map(c => c.id === col.id ? { ...c, options: newOptions } : c)
		await updateSchema(newSchema)
		onCommit([...value, trimmed])
		setNewOptionName('')
	}

	const deleteOption = async (optValue: string, e: React.MouseEvent) => {
		e.stopPropagation()
		const newOptions = options.filter(o => o.value !== optValue)
		const newSchema = schema.map(c => c.id === col.id ? { ...c, options: newOptions } : c)
		await updateSchema(newSchema)
		if (value.includes(optValue)) onCommit(value.filter(v => v !== optValue))
	}

	const dropdown = isEditing && dropPos ? createPortal(
		<div
			ref={dropdownRef}
			className="nb-select-dropdown"
			style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, minWidth: dropPos.width, zIndex: 9999 }}
		>
			<input
				className="nb-select-new-input"
				type="text"
				placeholder={t('select_create_placeholder')}
				value={newOptionName}
				autoFocus
				onChange={e => setNewOptionName(e.target.value)}
				onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void addNewOption(newOptionName) } }}
			/>
			{options.map(opt => (
				<div key={opt.value} className="nb-select-option-row">
					<button
						className={`nb-select-option ${value.includes(opt.value) ? 'nb-select-option--active' : ''}`}
						onClick={() => toggle(opt.value)}
					>
						<span className={`nb-checkbox-indicator ${value.includes(opt.value) ? 'nb-checkbox-indicator--checked' : ''}`} />
						<span
							className="nb-select-badge"
							style={{ background: getOptionColor(options, opt.value), color: getContrastTextColor(getOptionColor(options, opt.value)) }}
						>
							{opt.value}
						</span>
					</button>
					<button
						className={`nb-status-color-swatch ${colorPickerFor === opt.value ? 'nb-status-color-swatch--active' : ''}`}
						title={t('tooltip_change_color')}
						style={{ background: getOptionColor(options, opt.value), color: getContrastTextColor(getOptionColor(options, opt.value)) }}
						onClick={e => {
							e.stopPropagation()
							const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
							setColorPickerPos({ top: rect.bottom + 4, left: Math.min(rect.right - PICKER_W, window.innerWidth - PICKER_W - 8) })
							setColorPickerFor(prev => prev === opt.value ? null : opt.value)
						}}
					/>
					<button
						className="nb-select-option-delete"
						onClick={e => void deleteOption(opt.value, e)}
						title={t('select_clear')}
					>×</button>
				</div>
			))}
		</div>,
		document.body
	) : null

	const colorPicker = colorPickerFor && colorPickerPos ? createPortal(
		<div
			ref={colorPickerRef}
			className="nb-status-color-picker"
			style={{ position: 'fixed', top: colorPickerPos.top, left: colorPickerPos.left, zIndex: 10000 }}
		>
			<div className="nb-status-color-grid">
				{COLOR_PALETTE.map(color => (
					<button
						key={color}
						className="nb-status-color-dot"
						style={{ background: color }}
						title={color}
						onClick={e => { e.stopPropagation(); void updateOptionColor(colorPickerFor, color) }}
					/>
				))}
			</div>
			<div className="nb-status-color-custom">
				<label className="nb-status-color-custom-label">
					{t('color_custom')}
					<input
						type="color"
						className="nb-status-color-input"
						defaultValue={getOptionColor(options, colorPickerFor)}
						onChange={e => { void updateOptionColor(colorPickerFor, e.target.value) }}
					/>
				</label>
			</div>
		</div>,
		document.body
	) : null

	return (
		<div className="nb-cell-select-wrapper" ref={wrapperRef}>
			<div className="nb-cell-clickable nb-cell-multiselect" onClick={onStartEdit}>
				{value.length > 0
					? value.map(v => (
						<span
							key={v}
							className="nb-select-badge"
							style={{ background: getOptionColor(options, v), color: getContrastTextColor(getOptionColor(options, v)) }}
						>
							{v}
						</span>
					))
					: <span className="nb-cell-empty">—</span>
				}
			</div>
			{dropdown}
			{colorPicker}
		</div>
	)
}

// ── DateCell ─────────────────────────────────────────────────────────────────

function DateCell({ value, isEditing, onStartEdit, onCommit, onCancel }: {
	value: string | null
	isEditing: boolean
	onStartEdit: () => void
	onCommit: (v: string | null) => void
	onCancel: () => void
}) {
	const inputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		if (isEditing) requestAnimationFrame(() => inputRef.current?.showPicker?.())
	}, [isEditing])

	const formatted = value
		? (([y,m,d]) => new Date(+y, +m - 1, +d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }))(value.split('-'))
		: null

	if (!isEditing) {
		return (
			<div className="nb-cell-text nb-cell-clickable nb-cell-date" onClick={onStartEdit}>
				{formatted ?? <span className="nb-cell-empty">—</span>}
			</div>
		)
	}

	return (
		<input
			ref={inputRef}
			type="date"
			className="nb-cell-input nb-cell-input--date"
			defaultValue={value ?? ''}
			onChange={e => onCommit(e.target.value || null)}
			onBlur={onCancel}
			onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
		/>
	)
}

// ── CheckboxCell ─────────────────────────────────────────────────────────────

function CheckboxCell({ value, onCommit }: {
	value: boolean
	onCommit: (v: boolean) => void
}) {
	return (
		<div className="nb-cell-checkbox-wrapper">
			<input
				type="checkbox"
				className="nb-cell-checkbox"
				checked={value}
				onChange={e => onCommit(e.target.checked)}
			/>
		</div>
	)
}

// ── FormulaCell ──────────────────────────────────────────────────────────────

function FormulaCell({ value, col }: { value: unknown; col: ColumnSchema }) {
	const display = value === null || value === undefined ? '—' : String(value as string | number | boolean)
	return (
		<div className="nb-cell-formula" title={t('formula_panel_title') + ': ' + (col.formula ?? '')}>
			{display}
		</div>
	)
}

// ── LookupCell ───────────────────────────────────────────────────────────────

function LookupCell({ value, col }: { value: unknown; col: ColumnSchema }) {
	const display = value === null || value === undefined ? '—' : String(value as string | number | boolean)
	return (
		<div className="nb-cell-formula nb-cell-lookup" title={t('lookup_panel_title') + ' de ' + (col.refDatabasePath ?? '')}>
			{display}
		</div>
	)
}

// ── RelationCell ─────────────────────────────────────────────────────────────

function RelationCell({ value, options, isEditing, onStartEdit, onCommit, onCancel }: {
	value: string | null
	options: string[]
	isEditing: boolean
	onStartEdit: () => void
	onCommit: (v: string | null) => void
	onCancel: () => void
}) {
	const wrapperRef = useRef<HTMLDivElement>(null)
	const dropdownRef = useRef<HTMLDivElement>(null)
	const [search, setSearch] = useState('')
	const inputRef = useRef<HTMLInputElement>(null)
	const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null)

	useEffect(() => {
		if (!isEditing) return
		const handler = (e: MouseEvent) => {
			const inWrapper = wrapperRef.current?.contains(e.target as Node)
			const inDropdown = dropdownRef.current?.contains(e.target as Node)
			if (!inWrapper && !inDropdown) onCancel()
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [isEditing, onCancel])

	useEffect(() => {
		if (!isEditing) return
		setSearch('')
		if (wrapperRef.current) {
			const rect = wrapperRef.current.getBoundingClientRect()
			setDropPos({ top: rect.bottom, left: rect.left, width: rect.width })
		}
		setTimeout(() => inputRef.current?.focus(), 0)
	}, [isEditing])

	const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()))

	const dropdown = isEditing && dropPos ? createPortal(
		<div
			ref={dropdownRef}
			className="nb-select-dropdown nb-relation-dropdown"
			style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, minWidth: dropPos.width, zIndex: 9999 }}
		>
			<input
				ref={inputRef}
				className="nb-relation-search"
				placeholder={t('relation_search_placeholder')}
				value={search}
				onChange={e => setSearch(e.target.value)}
				onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
			/>
			<button className="nb-select-option nb-select-clear" onClick={() => onCommit(null)}>{t('relation_clear')}</button>
			{filtered.map(opt => (
				<button
					key={opt}
					className={`nb-select-option ${value === opt ? 'nb-select-option--active' : ''}`}
					onClick={() => onCommit(opt)}
				>
					<span className="nb-relation-badge">{opt}</span>
				</button>
			))}
			{filtered.length === 0 && <div className="nb-relation-empty">{t('relation_no_results')}</div>}
		</div>,
		document.body
	) : null

	return (
		<div className="nb-cell-select-wrapper" ref={wrapperRef}>
			<div className="nb-cell-clickable" onClick={onStartEdit}>
				{value
					? <span className="nb-relation-badge">{value}</span>
					: <span className="nb-cell-empty">—</span>
				}
			</div>
			{dropdown}
		</div>
	)
}

// ── ImageCell ────────────────────────────────────────────────────────────────

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'])

function ImageCell({ col, value, isEditing, onStartEdit, onCommit, onCancel }: {
	col: ColumnSchema
	value: string | null
	isEditing: boolean
	onStartEdit: () => void
	onCommit: (v: string | null) => void
	onCancel: () => void
}) {
	const app = useApp()
	const [images, setImages] = useState<TFile[]>([])
	const [dropdownPos, setDropdownPos] = useState<{ x: number; y: number } | null>(null)
	const cellRef = useRef<HTMLDivElement>(null)
	const dropdownRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!isEditing) return
		const folder = col.imageSourceFolder
		const allFiles = app.vault.getFiles()
		const filtered = folder
			? allFiles.filter(f => IMAGE_EXTS.has(f.extension.toLowerCase()) && (f.path.startsWith(folder + '/') || f.parent?.path === folder))
			: allFiles.filter(f => IMAGE_EXTS.has(f.extension.toLowerCase()))
		setImages(filtered.sort((a, b) => a.name.localeCompare(b.name)))
		if (cellRef.current) {
			const rect = cellRef.current.getBoundingClientRect()
			let x = rect.left
			const y = rect.bottom + 4
			if (x + 280 > window.innerWidth) x = window.innerWidth - 288
			setDropdownPos({ x, y })
		}
	}, [isEditing, col.imageSourceFolder])

	useEffect(() => {
		if (!isEditing) return
		const h = (e: MouseEvent) => {
			if (dropdownRef.current?.contains(e.target as Node)) return
			if (cellRef.current?.contains(e.target as Node)) return
			onCancel()
		}
		document.addEventListener('mousedown', h)
		return () => document.removeEventListener('mousedown', h)
	}, [isEditing, onCancel])

	const imageFile = value ? app.vault.getFileByPath(value) : null
	const imageUrl = imageFile ? app.vault.getResourcePath(imageFile) : null

	const openImage = (e: React.MouseEvent) => {
		e.stopPropagation()
		if (imageFile) void app.workspace.getLeaf(true).openFile(imageFile)
	}

	return (
		<>
			<div ref={cellRef} className="nb-cell-image" onClick={onStartEdit}>
				{imageUrl ? (
					<div className="nb-image-cell-content">
						<img src={imageUrl} alt="" className="nb-image-cell-thumb" />
						<a className="nb-image-cell-link" onClick={openImage} title={value ?? ''}>
							{imageFile?.name ?? value ?? ''}
						</a>
					</div>
				) : (
					<span className="nb-cell-text nb-cell-placeholder">{t('image_select_placeholder')}</span>
				)}
			</div>
			{isEditing && dropdownPos && createPortal(
				<div ref={dropdownRef} className="nb-image-picker" style={{ position: 'fixed', top: dropdownPos.y, left: dropdownPos.x }}>
					<div className="nb-image-picker-header">
						<span>{t('image_picker_title')}</span>
						{value && <button className="nb-image-picker-clear" onClick={e => { e.stopPropagation(); onCommit(null) }}>{t('image_picker_clear')}</button>}
					</div>
					{images.length === 0 ? (
						<div className="nb-image-picker-empty">
							{col.imageSourceFolder ? `${t('image_picker_empty_folder')} "${col.imageSourceFolder}"` : t('image_picker_empty_vault')}
						</div>
					) : (
						<div className="nb-image-picker-grid">
							{images.map(img => {
								const url = app.vault.getResourcePath(img)
								return (
									<div
										key={img.path}
										className={`nb-image-picker-item${value === img.path ? ' nb-image-picker-item--selected' : ''}`}
										onClick={e => { e.stopPropagation(); onCommit(img.path) }}
										title={img.path}
									>
										<img src={url} alt={img.name} className="nb-image-picker-thumb" />
										<span className="nb-image-picker-name">{img.name}</span>
									</div>
								)
							})}
						</div>
					)}
				</div>,
				document.body
			)}
		</>
	)
}
