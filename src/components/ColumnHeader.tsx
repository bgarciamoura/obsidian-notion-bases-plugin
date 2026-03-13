import { useState, useRef, useEffect } from 'react'
import { ColumnSchema, ColumnType } from '../types'
import { validateFormulaSyntax } from '../formula-engine'

const TYPE_ICONS: Record<ColumnType, string> = {
	title:       '📄',
	text:        'Aa',
	number:      '#',
	select:      '◉',
	multiselect: '◈',
	date:        '📅',
	checkbox:    '☑',
	formula:     'ƒ',
}

const TYPE_LABELS: Record<ColumnType, string> = {
	title:       'Título',
	text:        'Texto',
	number:      'Número',
	select:      'Seleção',
	multiselect: 'Multi-seleção',
	date:        'Data',
	checkbox:    'Checkbox',
	formula:     'Fórmula',
}

interface ColumnHeaderProps {
	col: ColumnSchema
	schema: ColumnSchema[]
	onUpdateSchema: (schema: ColumnSchema[]) => Promise<void>
	onRenameColumn: (oldId: string, newName: string) => Promise<void>
}

export function ColumnHeader({ col, schema, onUpdateSchema, onRenameColumn }: ColumnHeaderProps) {
	const [menuOpen, setMenuOpen] = useState(false)
	const [renaming, setRenaming] = useState(false)
	const [nameValue, setNameValue] = useState(col.name)
	const [editingFormula, setEditingFormula] = useState(false)
	const [formulaValue, setFormulaValue] = useState(col.formula ?? '')
	const [formulaError, setFormulaError] = useState<string | null>(null)
	const menuRef = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLInputElement>(null)
	const formulaRef = useRef<HTMLTextAreaElement>(null)

	// Fechar menu ao clicar fora
	useEffect(() => {
		if (!menuOpen) return
		const handler = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setMenuOpen(false)
				setEditingFormula(false)
			}
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [menuOpen])

	// Sincronizar nameValue com col.name
	useEffect(() => {
		if (!renaming) setNameValue(col.name)
	}, [col.name, renaming])

	// Sincronizar formulaValue com col.formula
	useEffect(() => {
		if (!editingFormula) setFormulaValue(col.formula ?? '')
	}, [col.formula, editingFormula])

	// Focar input ao renomear
	useEffect(() => {
		if (!renaming) return
		const input = inputRef.current
		if (!input) return
		input.focus()
		input.select()
	}, [renaming])

	// Focar textarea ao abrir editor de fórmula
	useEffect(() => {
		if (!editingFormula) return
		setTimeout(() => formulaRef.current?.focus(), 50)
	}, [editingFormula])

	// Validar fórmula em tempo real
	useEffect(() => {
		setFormulaError(validateFormulaSyntax(formulaValue))
	}, [formulaValue])

	const updateCol = async (changes: Partial<ColumnSchema>) => {
		const newSchema = schema.map(s => s.id === col.id ? { ...s, ...changes } : s)
		await onUpdateSchema(newSchema)
	}

	const handleRename = async () => {
		const trimmed = nameValue.trim()
		if (trimmed && trimmed !== col.name) {
			await onRenameColumn(col.id, trimmed)
		}
		setRenaming(false)
		setMenuOpen(false)
	}

	const handleHide = async () => {
		await updateCol({ visible: false })
		setMenuOpen(false)
	}

	const handleDelete = async () => {
		const newSchema = schema.filter(s => s.id !== col.id)
		await onUpdateSchema(newSchema)
		setMenuOpen(false)
	}

	const handleTypeChange = async (type: ColumnType) => {
		await updateCol({ type })
		if (type === 'formula') {
			setEditingFormula(true)
		} else {
			setMenuOpen(false)
		}
	}

	const handleSaveFormula = async () => {
		if (formulaError) return
		await updateCol({ formula: formulaValue.trim() || undefined })
		setEditingFormula(false)
		setMenuOpen(false)
	}

	const otherCols = schema.filter(c => c.id !== col.id && c.type !== 'formula')

	return (
		<div className="nb-column-header" ref={menuRef}>
			{/* Label da coluna */}
			{renaming ? (
				<input
					ref={inputRef}
					className="nb-header-rename-input"
					value={nameValue}
					onChange={e => setNameValue(e.target.value)}
					onBlur={handleRename}
					onKeyDown={e => {
						if (e.key === 'Enter') handleRename()
						if (e.key === 'Escape') { setRenaming(false); setMenuOpen(false) }
					}}
					onClick={e => e.stopPropagation()}
				/>
			) : (
				<button
					className="nb-header-label"
					onClick={() => { setMenuOpen(v => !v); setEditingFormula(false) }}
					title={col.name}
				>
					<span className="nb-header-icon">{TYPE_ICONS[col.type]}</span>
					<span className="nb-header-name">{col.name}</span>
				</button>
			)}

			{/* Menu dropdown */}
			{menuOpen && !editingFormula && (
				<div className="nb-column-menu">
					<button className="nb-menu-item" onClick={() => { setMenuOpen(false); setRenaming(true) }}>
						<span className="nb-menu-item-icon">✏️</span>
						<span>Renomear</span>
					</button>

					{col.type === 'formula' && (
						<button className="nb-menu-item" onClick={() => setEditingFormula(true)}>
							<span className="nb-menu-item-icon">ƒ</span>
							<span>Editar fórmula</span>
						</button>
					)}

					<div className="nb-menu-separator" />
					<div className="nb-menu-label">Tipo de campo</div>
					{(['text', 'number', 'select', 'multiselect', 'date', 'checkbox', 'formula'] as ColumnType[]).map(type => (
						<button
							key={type}
							className={`nb-menu-item nb-menu-type-item ${col.type === type ? 'nb-menu-item--active' : ''}`}
							onClick={() => handleTypeChange(type)}
						>
							<span className="nb-menu-item-icon">{TYPE_ICONS[type]}</span>
							<span>{TYPE_LABELS[type]}</span>
						</button>
					))}

					<div className="nb-menu-separator" />
					<button className="nb-menu-item" onClick={handleHide}>
						<span className="nb-menu-item-icon">👁</span>
						<span>Ocultar campo</span>
					</button>
					<button className="nb-menu-item nb-menu-item--danger" onClick={handleDelete}>
						<span className="nb-menu-item-icon">🗑</span>
						<span>Excluir campo</span>
					</button>
				</div>
			)}

			{/* Editor de fórmula */}
			{menuOpen && editingFormula && (
				<div className="nb-column-menu nb-formula-panel">
					<div className="nb-formula-panel-header">
						<button className="nb-formula-back" onClick={() => setEditingFormula(false)}>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
						</button>
						<span className="nb-formula-panel-title">Fórmula: {col.name}</span>
					</div>

					<textarea
						ref={formulaRef}
						className={`nb-formula-textarea${formulaError ? ' nb-formula-textarea--error' : formulaValue.trim() ? ' nb-formula-textarea--ok' : ''}`}
						value={formulaValue}
						onChange={e => setFormulaValue(e.target.value)}
						placeholder={'Ex: IF(status = "feito", 1, 0)'}
						rows={3}
						spellCheck={false}
						onKeyDown={e => {
							if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSaveFormula() }
							if (e.key === 'Escape') setEditingFormula(false)
						}}
					/>

					{formulaError && (
						<div className="nb-formula-feedback nb-formula-feedback--error">
							<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
							{formulaError}
						</div>
					)}
					{!formulaError && formulaValue.trim() && (
						<div className="nb-formula-feedback nb-formula-feedback--ok">
							<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
							Sintaxe válida
						</div>
					)}

					{otherCols.length > 0 && (
						<div className="nb-formula-cols-hint">
							<span className="nb-formula-cols-label">Colunas disponíveis:</span>
							<div className="nb-formula-cols-list">
								{otherCols.map(c => (
									<code
										key={c.id}
										className="nb-formula-col-chip"
										title={`ID: ${c.id}`}
										onClick={() => {
											const name = /\s/.test(c.name) ? `[${c.name}]` : c.name
											setFormulaValue(v => v + name)
											formulaRef.current?.focus()
										}}
									>{c.name}</code>
								))}
							</div>
						</div>
					)}

					<div className="nb-formula-actions">
						<button
							className="nb-formula-save"
							disabled={!!formulaError}
							onClick={handleSaveFormula}
							title="Salvar (Ctrl+Enter)"
						>Salvar</button>
						<button className="nb-formula-cancel" onClick={() => setEditingFormula(false)}>Cancelar</button>
					</div>
				</div>
			)}
		</div>
	)
}
