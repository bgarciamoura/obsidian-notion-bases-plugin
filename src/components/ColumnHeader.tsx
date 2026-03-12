import { useState, useRef, useEffect } from 'react'
import { ColumnSchema, ColumnType } from '../types'

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
	const menuRef = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLInputElement>(null)

	// Fechar menu ao clicar fora
	useEffect(() => {
		if (!menuOpen) return
		const handler = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setMenuOpen(false)
			}
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [menuOpen])

	// Sincronizar nameValue com col.name (caso o schema atualize externamente)
	useEffect(() => {
		if (!renaming) setNameValue(col.name)
	}, [col.name, renaming])

	// Focar e selecionar o input ao entrar em modo rename
	useEffect(() => {
		if (!renaming) return
		const input = inputRef.current
		if (!input) return
		input.focus()
		input.select()
	}, [renaming])

	const updateCol = async (changes: Partial<ColumnSchema>) => {
		const newSchema = schema.map(s => s.id === col.id ? { ...s, ...changes } : s)
		await onUpdateSchema(newSchema)
	}

	const handleRename = async () => {
		const trimmed = nameValue.trim()
		if (trimmed && trimmed !== col.name) {
			// Delega ao pai: atualiza id + name + frontmatter das notas
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
		setMenuOpen(false)
	}

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
					onClick={() => setMenuOpen(v => !v)}
					title={col.name}
				>
					<span className="nb-header-icon">{TYPE_ICONS[col.type]}</span>
					<span className="nb-header-name">{col.name}</span>
				</button>
			)}

			{/* Menu dropdown */}
			{menuOpen && (
				<div className="nb-column-menu">
					<button className="nb-menu-item" onClick={() => { setMenuOpen(false); setRenaming(true) }}>
						✏️ Renomear
					</button>

					<div className="nb-menu-separator" />
					<div className="nb-menu-label">Tipo de campo</div>
					{(['text', 'number', 'select', 'multiselect', 'date', 'checkbox', 'formula'] as ColumnType[]).map(type => (
						<button
							key={type}
							className={`nb-menu-item nb-menu-type-item ${col.type === type ? 'nb-menu-item--active' : ''}`}
							onClick={() => handleTypeChange(type)}
						>
							<span>{TYPE_ICONS[type]}</span>
							<span>{type}</span>
						</button>
					))}

					<div className="nb-menu-separator" />
					<button className="nb-menu-item" onClick={handleHide}>
						👁 Ocultar campo
					</button>
					<button className="nb-menu-item nb-menu-item--danger" onClick={handleDelete}>
						🗑 Excluir campo
					</button>
				</div>
			)}
		</div>
	)
}
