import { useRef, useState, useEffect } from 'react'
import { useReactTable } from '@tanstack/react-table'
import { ColumnSchema, NoteRow, SelectOption } from '../../types'
import { useApp } from '../../context'

interface CellProps {
	col: ColumnSchema
	value: unknown
	rowIndex: number
	columnId: string
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
}

export const CellContext = createContext<CellContextType | null>(null)

export function useCellContext(): CellContextType {
	const ctx = useContext(CellContext)
	if (!ctx) throw new Error('CellContext não encontrado')
	return ctx
}

// ── Componente principal ─────────────────────────────────────────────────────

export function CellRenderer({ col, value, rowIndex, columnId }: CellProps) {
	const { editingCell, setEditingCell, updateCell } = useCellContext()
	const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.columnId === columnId

	const startEditing = () => {
		if (col.type === 'formula' || col.type === 'checkbox') return
		setEditingCell({ rowIndex, columnId })
	}

	switch (col.type) {
		case 'title':
		case 'text':
			return (
				<TextCell
					value={String(value ?? '')}
					isEditing={isEditing}
					onStartEdit={startEditing}
					onCommit={v => updateCell(rowIndex, columnId, v)}
					onCancel={() => setEditingCell(null)}
				/>
			)

		case 'number':
			return (
				<NumberCell
					value={value as number | null}
					isEditing={isEditing}
					onStartEdit={startEditing}
					onCommit={v => updateCell(rowIndex, columnId, v)}
					onCancel={() => setEditingCell(null)}
				/>
			)

		case 'select':
			return (
				<SelectCell
					value={value as string | null}
					options={col.options ?? []}
					isEditing={isEditing}
					onStartEdit={startEditing}
					onCommit={v => { updateCell(rowIndex, columnId, v); setEditingCell(null) }}
					onCancel={() => setEditingCell(null)}
				/>
			)

		case 'multiselect':
			return (
				<MultiSelectCell
					value={Array.isArray(value) ? value as string[] : []}
					options={col.options ?? []}
					isEditing={isEditing}
					onStartEdit={startEditing}
					onCommit={v => { updateCell(rowIndex, columnId, v); setEditingCell(null) }}
					onCancel={() => setEditingCell(null)}
				/>
			)

		case 'date':
			return (
				<DateCell
					value={value as string | null}
					isEditing={isEditing}
					onStartEdit={startEditing}
					onCommit={v => { updateCell(rowIndex, columnId, v); setEditingCell(null) }}
					onCancel={() => setEditingCell(null)}
				/>
			)

		case 'checkbox':
			return (
				<CheckboxCell
					value={Boolean(value)}
					onCommit={v => updateCell(rowIndex, columnId, v)}
				/>
			)

		case 'formula':
			return <FormulaCell value={value} col={col} />

		default:
			return <span className="nb-cell-text">{String(value ?? '')}</span>
	}
}

// ── TextCell ─────────────────────────────────────────────────────────────────

function TextCell({ value, isEditing, onStartEdit, onCommit, onCancel }: {
	value: string
	isEditing: boolean
	onStartEdit: () => void
	onCommit: (v: string) => void
	onCancel: () => void
}) {
	const inputRef = useRef<HTMLInputElement>(null)
	const [draft, setDraft] = useState(value)

	useEffect(() => {
		if (isEditing) {
			setDraft(value)
			requestAnimationFrame(() => inputRef.current?.select())
		}
	}, [isEditing, value])

	if (!isEditing) {
		return (
			<div className="nb-cell-text nb-cell-clickable" onDoubleClick={onStartEdit}>
				{value || <span className="nb-cell-empty">—</span>}
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

function NumberCell({ value, isEditing, onStartEdit, onCommit, onCancel }: {
	value: number | null
	isEditing: boolean
	onStartEdit: () => void
	onCommit: (v: number | null) => void
	onCancel: () => void
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
				{value !== null && value !== undefined ? value : <span className="nb-cell-empty">—</span>}
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

function SelectCell({ value, options, isEditing, onStartEdit, onCommit, onCancel }: {
	value: string | null
	options: SelectOption[]
	isEditing: boolean
	onStartEdit: () => void
	onCommit: (v: string | null) => void
	onCancel: () => void
}) {
	const menuRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!isEditing) return
		const handler = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) onCancel()
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [isEditing, onCancel])

	return (
		<div className="nb-cell-select-wrapper" ref={menuRef}>
			<div className="nb-cell-clickable" onClick={onStartEdit}>
				{value ? (
					<span
						className="nb-select-badge"
						style={{ background: getOptionColor(options, value) }}
					>
						{value}
					</span>
				) : (
					<span className="nb-cell-empty">—</span>
				)}
			</div>

			{isEditing && (
				<div className="nb-select-dropdown">
					<button className="nb-select-option nb-select-clear" onClick={() => onCommit(null)}>
						Limpar
					</button>
					{options.map(opt => (
						<button
							key={opt.value}
							className={`nb-select-option ${value === opt.value ? 'nb-select-option--active' : ''}`}
							onClick={() => onCommit(opt.value)}
						>
							<span
								className="nb-select-badge"
								style={{ background: getOptionColor(options, opt.value) }}
							>
								{opt.value}
							</span>
						</button>
					))}
				</div>
			)}
		</div>
	)
}

// ── MultiSelectCell ──────────────────────────────────────────────────────────

function MultiSelectCell({ value, options, isEditing, onStartEdit, onCommit, onCancel }: {
	value: string[]
	options: SelectOption[]
	isEditing: boolean
	onStartEdit: () => void
	onCommit: (v: string[]) => void
	onCancel: () => void
}) {
	const menuRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!isEditing) return
		const handler = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) onCancel()
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [isEditing, onCancel])

	const toggle = (opt: string) => {
		const next = value.includes(opt)
			? value.filter(v => v !== opt)
			: [...value, opt]
		onCommit(next)
	}

	return (
		<div className="nb-cell-select-wrapper" ref={menuRef}>
			<div className="nb-cell-clickable nb-cell-multiselect" onClick={onStartEdit}>
				{value.length > 0
					? value.map(v => (
						<span
							key={v}
							className="nb-select-badge"
							style={{ background: getOptionColor(options, v) }}
						>
							{v}
						</span>
					))
					: <span className="nb-cell-empty">—</span>
				}
			</div>

			{isEditing && (
				<div className="nb-select-dropdown">
					{options.map(opt => (
						<button
							key={opt.value}
							className={`nb-select-option ${value.includes(opt.value) ? 'nb-select-option--active' : ''}`}
							onClick={() => toggle(opt.value)}
						>
							<span className={`nb-checkbox-indicator ${value.includes(opt.value) ? 'nb-checkbox-indicator--checked' : ''}`} />
							<span
								className="nb-select-badge"
								style={{ background: getOptionColor(options, opt.value) }}
							>
								{opt.value}
							</span>
						</button>
					))}
				</div>
			)}
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
		? new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
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
	const display = value === null || value === undefined ? '—' : String(value)
	return (
		<div className="nb-cell-formula" title={`Fórmula: ${col.formula ?? ''}`}>
			{display}
		</div>
	)
}
