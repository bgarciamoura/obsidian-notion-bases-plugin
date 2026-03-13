import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { TFile } from 'obsidian'
import { ColumnSchema, ColumnType, NumberFormat } from '../types'
import { validateFormulaSyntax } from '../formula-engine'
import { useApp } from '../context'
import { DatabaseManager } from '../database-manager'

const TYPE_ICONS: Record<ColumnType, string> = {
	title:       '📄',
	text:        'Aa',
	number:      '#',
	select:      '◉',
	multiselect: '◈',
	date:        '📅',
	checkbox:    '☑',
	formula:     'ƒ',
	relation:    '🔗',
	lookup:      '↗',
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
	relation:    'Relação',
	lookup:      'Lookup',
}

interface ColumnHeaderProps {
	col: ColumnSchema
	schema: ColumnSchema[]
	onUpdateSchema: (schema: ColumnSchema[]) => Promise<void>
	onRenameColumn: (oldId: string, newName: string) => Promise<void>
	onChangeType: (newType: ColumnType) => Promise<boolean>
	manager: DatabaseManager
	dbFile: TFile | null
}

export function ColumnHeader({ col, schema, onUpdateSchema, onRenameColumn, onChangeType, manager, dbFile }: ColumnHeaderProps) {
	const app = useApp()
	const [menuOpen, setMenuOpen] = useState(false)
	const [renaming, setRenaming] = useState(false)
	const [nameValue, setNameValue] = useState(col.name)
	const [editingFormula, setEditingFormula] = useState(false)
	const [formulaValue, setFormulaValue] = useState(col.formula ?? '')
	const [formulaError, setFormulaError] = useState<string | null>(null)
	const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null)
	const menuRef = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLInputElement>(null)
	const formulaRef = useRef<HTMLTextAreaElement>(null)
	const dragOffset = useRef<{ x: number; y: number } | null>(null)
	const panelRef = useRef<HTMLDivElement>(null)

	// Lookup state
	const [editingLookup, setEditingLookup] = useState(false)
	const [lookupPanelPos, setLookupPanelPos] = useState<{ x: number; y: number } | null>(null)
	const [lookupDbPath, setLookupDbPath] = useState(col.refDatabasePath ?? '')
	const [lookupRefColId, setLookupRefColId] = useState(col.refColumnId ?? '')
	const [lookupMatchColId, setLookupMatchColId] = useState(col.refMatchColumnId ?? '')
	const [availableDbs, setAvailableDbs] = useState<Array<{ path: string; name: string }>>([])
	const [refDbSchema, setRefDbSchema] = useState<ColumnSchema[]>([])
	const lookupPanelRef = useRef<HTMLDivElement>(null)
	const lookupDragOffset = useRef<{ x: number; y: number } | null>(null)

	// Number format state
	const [editingNumberFmt, setEditingNumberFmt] = useState(false)
	const [fmtPanelPos, setFmtPanelPos] = useState<{ x: number; y: number } | null>(null)
	const [fmtDecimals, setFmtDecimals] = useState(col.numberFormat?.decimals ?? 2)
	const [fmtThousands, setFmtThousands] = useState(col.numberFormat?.thousandsSeparator ?? false)
	const [fmtPrefix, setFmtPrefix] = useState(col.numberFormat?.prefix ?? '')
	const [fmtSuffix, setFmtSuffix] = useState(col.numberFormat?.suffix ?? '')
	const fmtPanelRef = useRef<HTMLDivElement>(null)
	const fmtDragOffset = useRef<{ x: number; y: number } | null>(null)

	// Fechar menu ao clicar fora
	useEffect(() => {
		if (!menuOpen) return
		const handler = (e: MouseEvent) => {
			const target = e.target as Node
			const inMenu = menuRef.current?.contains(target)
			const inPanel = panelRef.current?.contains(target) || lookupPanelRef.current?.contains(target) || fmtPanelRef.current?.contains(target)
			if (!inMenu && !inPanel) {
				setMenuOpen(false)
				setEditingFormula(false)
				setEditingLookup(false)
				setEditingNumberFmt(false)
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

	// Focar textarea ao abrir editor de fórmula e posicionar painel
	useEffect(() => {
		if (!editingFormula) return
		if (menuRef.current) {
			const rect = menuRef.current.getBoundingClientRect()
			const panelWidth = 320
			const panelHeight = 420
			let x = rect.left
			let y = rect.bottom + 4
			if (x + panelWidth > window.innerWidth) x = window.innerWidth - panelWidth - 8
			if (y + panelHeight > window.innerHeight) y = rect.top - panelHeight - 4
			setPanelPos({ x, y })
		}
		setTimeout(() => formulaRef.current?.focus(), 50)
	}, [editingFormula])

	// Drag logic para o painel de fórmula
	useEffect(() => {
		if (!editingFormula) return
		const onMove = (e: MouseEvent) => {
			if (!dragOffset.current) return
			setPanelPos({
				x: e.clientX - dragOffset.current.x,
				y: e.clientY - dragOffset.current.y,
			})
		}
		const onUp = () => { dragOffset.current = null }
		document.addEventListener('mousemove', onMove)
		document.addEventListener('mouseup', onUp)
		return () => {
			document.removeEventListener('mousemove', onMove)
			document.removeEventListener('mouseup', onUp)
		}
	}, [editingFormula])

	// Validar fórmula em tempo real
	useEffect(() => {
		setFormulaError(validateFormulaSyntax(formulaValue))
	}, [formulaValue])

	// Load databases and position panel when lookup opens
	useEffect(() => {
		if (!editingLookup) return
		const dbs = manager.getAllDatabases()
			.filter(f => f.path !== dbFile?.path)
			.map(f => ({ path: f.path, name: f.parent?.name ?? f.basename }))
		setAvailableDbs(dbs)
		if (menuRef.current) {
			const rect = menuRef.current.getBoundingClientRect()
			const panelWidth = 320
			const panelHeight = 380
			let x = rect.left
			let y = rect.bottom + 4
			if (x + panelWidth > window.innerWidth) x = window.innerWidth - panelWidth - 8
			if (y + panelHeight > window.innerHeight) y = rect.top - panelHeight - 4
			setLookupPanelPos({ x, y })
		}
	}, [editingLookup, manager, dbFile])

	// Load ref schema when db path changes
	useEffect(() => {
		if (!lookupDbPath) { setRefDbSchema([]); return }
		const refDbFile = app.vault.getFileByPath(lookupDbPath)
		if (!refDbFile) { setRefDbSchema([]); return }
		manager.readConfig(refDbFile).then(cfg => setRefDbSchema(cfg.schema))
	}, [lookupDbPath, app, manager])

	// Sync lookup state with col when not editing
	useEffect(() => {
		if (!editingLookup) {
			setLookupDbPath(col.refDatabasePath ?? '')
			setLookupRefColId(col.refColumnId ?? '')
			setLookupMatchColId(col.refMatchColumnId ?? '')
		}
	}, [col.refDatabasePath, col.refColumnId, col.refMatchColumnId, editingLookup])

	// Drag for lookup panel
	useEffect(() => {
		if (!editingLookup) return
		const onMove = (e: MouseEvent) => {
			if (!lookupDragOffset.current) return
			setLookupPanelPos({ x: e.clientX - lookupDragOffset.current.x, y: e.clientY - lookupDragOffset.current.y })
		}
		const onUp = () => { lookupDragOffset.current = null }
		document.addEventListener('mousemove', onMove)
		document.addEventListener('mouseup', onUp)
		return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
	}, [editingLookup])

	// Position panel when number format opens
	useEffect(() => {
		if (!editingNumberFmt) return
		if (menuRef.current) {
			const rect = menuRef.current.getBoundingClientRect()
			const panelWidth = 300; const panelHeight = 300
			let x = rect.left; let y = rect.bottom + 4
			if (x + panelWidth > window.innerWidth) x = window.innerWidth - panelWidth - 8
			if (y + panelHeight > window.innerHeight) y = rect.top - panelHeight - 4
			setFmtPanelPos({ x, y })
		}
	}, [editingNumberFmt])

	// Sync state with col when not editing
	useEffect(() => {
		if (!editingNumberFmt) {
			setFmtDecimals(col.numberFormat?.decimals ?? 2)
			setFmtThousands(col.numberFormat?.thousandsSeparator ?? false)
			setFmtPrefix(col.numberFormat?.prefix ?? '')
			setFmtSuffix(col.numberFormat?.suffix ?? '')
		}
	}, [col.numberFormat, editingNumberFmt])

	// Drag for number format panel
	useEffect(() => {
		if (!editingNumberFmt) return
		const onMove = (e: MouseEvent) => {
			if (!fmtDragOffset.current) return
			setFmtPanelPos({ x: e.clientX - fmtDragOffset.current.x, y: e.clientY - fmtDragOffset.current.y })
		}
		const onUp = () => { fmtDragOffset.current = null }
		document.addEventListener('mousemove', onMove)
		document.addEventListener('mouseup', onUp)
		return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
	}, [editingNumberFmt])

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
		const allowed = await onChangeType(type)
		if (!allowed) return
		await updateCol({ type })
		if (type === 'formula') {
			setEditingFormula(true)
		} else if (type === 'lookup' || type === 'relation') {
			setEditingLookup(true)
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

	const handleCloseFormula = () => {
		setEditingFormula(false)
		setMenuOpen(false)
	}

	const handleTitleBarMouseDown = (e: React.MouseEvent) => {
		if (!panelPos) return
		dragOffset.current = {
			x: e.clientX - panelPos.x,
			y: e.clientY - panelPos.y,
		}
		e.preventDefault()
	}

	const handleSaveLookup = async () => {
		await updateCol({
			refDatabasePath: lookupDbPath,
			refColumnId: lookupRefColId,
			...(col.type === 'lookup' ? { refMatchColumnId: lookupMatchColId } : {}),
		})
		setEditingLookup(false)
		setMenuOpen(false)
	}

	const handleCloseLookup = () => {
		setEditingLookup(false)
		setMenuOpen(false)
	}

	const handleLookupTitleBarMouseDown = (e: React.MouseEvent) => {
		if (!lookupPanelPos) return
		lookupDragOffset.current = { x: e.clientX - lookupPanelPos.x, y: e.clientY - lookupPanelPos.y }
		e.preventDefault()
	}

	const handleSaveNumberFmt = async () => {
		const fmt: NumberFormat = {
			decimals: fmtDecimals,
			thousandsSeparator: fmtThousands,
			...(fmtPrefix.trim() ? { prefix: fmtPrefix.trim() } : {}),
			...(fmtSuffix.trim() ? { suffix: fmtSuffix.trim() } : {}),
		}
		await updateCol({ numberFormat: fmt })
		setEditingNumberFmt(false)
		setMenuOpen(false)
	}

	const handleCloseNumberFmt = () => {
		setEditingNumberFmt(false)
		setMenuOpen(false)
	}

	const handleRemoveNumberFmt = async () => {
		await updateCol({ numberFormat: undefined })
		setEditingNumberFmt(false)
		setMenuOpen(false)
	}

	const handleFmtTitleBarMouseDown = (e: React.MouseEvent) => {
		if (!fmtPanelPos) return
		fmtDragOffset.current = { x: e.clientX - fmtPanelPos.x, y: e.clientY - fmtPanelPos.y }
		e.preventDefault()
	}

	const [refOpen, setRefOpen] = useState(false)
	const otherCols = schema.filter(c => c.id !== col.id && c.type !== 'formula')

	const FORMULA_REF = [
		{ group: 'Lógica', items: [
			{ fn: 'IF(cond, a, b)',          desc: 'Se cond for verdadeiro retorna a, senão b' },
			{ fn: 'IFS(c1, v1, c2, v2…)',   desc: 'Testa condições em sequência' },
			{ fn: 'AND(a, b, …)',            desc: 'Verdadeiro se todos forem verdadeiros' },
			{ fn: 'OR(a, b, …)',             desc: 'Verdadeiro se algum for verdadeiro' },
			{ fn: 'NOT(a)',                  desc: 'Inverte o valor lógico' },
		]},
		{ group: 'Comparadores', items: [
			{ fn: '= <> != > < >= <=', desc: 'Compara dois valores; use com IF' },
		]},
		{ group: 'Agregadores', items: [
			{ fn: 'SUM(col)',   desc: 'Soma todos os valores da coluna' },
			{ fn: 'AVG(col)',   desc: 'Média dos valores da coluna' },
			{ fn: 'COUNT(col)', desc: 'Conta valores não vazios da coluna' },
			{ fn: 'MIN(col)',   desc: 'Menor valor da coluna' },
			{ fn: 'MAX(col)',   desc: 'Maior valor da coluna' },
		]},
		{ group: 'Texto', items: [
			{ fn: 'CONCAT(a, b, …)',       desc: 'Concatena textos (ou use &)' },
			{ fn: 'LEN(texto)',             desc: 'Número de caracteres' },
			{ fn: 'UPPER / LOWER(texto)',   desc: 'Maiúsculas / minúsculas' },
			{ fn: 'TRIM(texto)',            desc: 'Remove espaços nas bordas' },
			{ fn: 'LEFT(texto, n)',         desc: 'Primeiros n caracteres' },
			{ fn: 'RIGHT(texto, n)',        desc: 'Últimos n caracteres' },
			{ fn: 'MID(texto, início, n)',  desc: 'Substring a partir de início' },
			{ fn: 'SUBSTITUTE(t, de, para)', desc: 'Substitui ocorrências' },
		]},
		{ group: 'Matemática', items: [
			{ fn: 'ROUND(n, d)',  desc: 'Arredonda n com d casas decimais' },
			{ fn: 'FLOOR / CEIL(n)', desc: 'Arredonda para baixo / cima' },
			{ fn: 'ABS(n)',       desc: 'Valor absoluto' },
			{ fn: 'MOD(n, d)',    desc: 'Resto da divisão' },
			{ fn: 'POWER(b, e)',  desc: 'Base elevado ao expoente' },
			{ fn: 'SQRT(n)',      desc: 'Raiz quadrada' },
		]},
		{ group: 'Utilitários', items: [
			{ fn: 'ISNULL(v)',         desc: 'Verdadeiro se v for vazio ou nulo' },
			{ fn: 'COALESCE(a, b, …)', desc: 'Primeiro valor não vazio' },
			{ fn: 'TEXT(v)',            desc: 'Converte para texto' },
			{ fn: 'VALUE(v)',           desc: 'Converte para número' },
		]},
	]

	const fmtPreview = (() => {
		const sample = 1234.5678
		const opts: Intl.NumberFormatOptions = {
			minimumFractionDigits: fmtDecimals,
			maximumFractionDigits: fmtDecimals,
			useGrouping: fmtThousands,
		}
		let result = new Intl.NumberFormat('pt-BR', opts).format(sample)
		if (fmtPrefix.trim()) result = `${fmtPrefix.trim()} ${result}`
		if (fmtSuffix.trim()) result = `${result} ${fmtSuffix.trim()}`
		return result
	})()

	const formulaPanel = editingFormula && panelPos ? createPortal(
		<div
			ref={panelRef}
			className="nb-formula-floating-panel"
			style={{ top: panelPos.y, left: panelPos.x }}
		>
			{/* Barra de título arrastável */}
			<div
				className="nb-formula-titlebar"
				onMouseDown={handleTitleBarMouseDown}
			>
				<span className="nb-formula-titlebar-icon">ƒ</span>
				<span className="nb-formula-titlebar-title">Fórmula: {col.name}</span>
				<button className="nb-formula-close" onClick={handleCloseFormula} title="Fechar">×</button>
			</div>

			{/* Conteúdo do painel */}
			<div className="nb-formula-body">
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
						if (e.key === 'Escape') handleCloseFormula()
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

				{/* Referência de funções */}
				<div className="nb-formula-ref">
					<button className="nb-formula-ref-toggle" onClick={() => setRefOpen(v => !v)}>
						<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: refOpen ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }}><polyline points="9 18 15 12 9 6"/></svg>
						Referência de funções
					</button>
					{refOpen && (
						<div className="nb-formula-ref-body">
							{FORMULA_REF.map(group => (
								<div key={group.group} className="nb-formula-ref-group">
									<div className="nb-formula-ref-group-title">{group.group}</div>
									<table className="nb-formula-ref-table">
										<tbody>
											{group.items.map(item => (
												<tr key={item.fn}>
													<td className="nb-formula-ref-fn"><code>{item.fn}</code></td>
													<td className="nb-formula-ref-desc">{item.desc}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							))}
						</div>
					)}
				</div>

				<div className="nb-formula-actions">
					<button
						className="nb-formula-save"
						disabled={!!formulaError}
						onClick={handleSaveFormula}
						title="Salvar (Ctrl+Enter)"
					>Salvar</button>
					<button className="nb-formula-cancel" onClick={handleCloseFormula}>Cancelar</button>
				</div>
			</div>
		</div>,
		document.body
	) : null

	const numberFmtPanel = editingNumberFmt && fmtPanelPos ? createPortal(
		<div ref={fmtPanelRef} className="nb-formula-floating-panel" style={{ top: fmtPanelPos.y, left: fmtPanelPos.x }}>
			<div className="nb-formula-titlebar" onMouseDown={handleFmtTitleBarMouseDown}>
				<span className="nb-formula-titlebar-icon">#</span>
				<span className="nb-formula-titlebar-title">Formatar: {col.name}</span>
				<button className="nb-formula-close" onClick={handleCloseNumberFmt} title="Fechar">×</button>
			</div>
			<div className="nb-formula-body">
				<div className="nb-numfmt-preview">{fmtPreview}</div>
				<div className="nb-lookup-section">
					<label className="nb-lookup-label">Casas decimais</label>
					<select className="nb-lookup-select" value={fmtDecimals} onChange={e => setFmtDecimals(Number(e.target.value))}>
						{[0,1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
					</select>
				</div>
				<div className="nb-numfmt-checkbox-row">
					<input
						type="checkbox"
						id="nb-fmt-thousands"
						checked={fmtThousands}
						onChange={e => setFmtThousands(e.target.checked)}
						className="nb-cell-checkbox"
					/>
					<label htmlFor="nb-fmt-thousands" className="nb-lookup-label" style={{ cursor: 'pointer' }}>
						Separador de milhar
					</label>
				</div>
				<div className="nb-lookup-section">
					<label className="nb-lookup-label">Prefixo</label>
					<input
						type="text"
						className="nb-numfmt-text-input"
						value={fmtPrefix}
						onChange={e => setFmtPrefix(e.target.value)}
						placeholder="Ex: R$, $, €"
					/>
				</div>
				<div className="nb-lookup-section">
					<label className="nb-lookup-label">Sufixo</label>
					<input
						type="text"
						className="nb-numfmt-text-input"
						value={fmtSuffix}
						onChange={e => setFmtSuffix(e.target.value)}
						placeholder="Ex: %, kg, km"
					/>
				</div>
				<div className="nb-formula-actions">
					<button className="nb-formula-save" onClick={handleSaveNumberFmt}>Salvar</button>
					<button className="nb-formula-cancel" onClick={handleCloseNumberFmt}>Cancelar</button>
				</div>
				{col.numberFormat && (
					<div style={{ marginTop: '8px', textAlign: 'center' }}>
						<button className="nb-formula-cancel" onClick={handleRemoveNumberFmt} style={{ color: 'var(--text-error)', width: '100%' }}>
							Remover formatação
						</button>
					</div>
				)}
			</div>
		</div>,
		document.body
	) : null

	const lookupPanel = editingLookup && lookupPanelPos ? createPortal(
		<div ref={lookupPanelRef} className="nb-formula-floating-panel" style={{ top: lookupPanelPos.y, left: lookupPanelPos.x }}>
			<div className="nb-formula-titlebar" onMouseDown={handleLookupTitleBarMouseDown}>
				<span className="nb-formula-titlebar-icon">{col.type === 'relation' ? '🔗' : '↗'}</span>
				<span className="nb-formula-titlebar-title">{col.type === 'relation' ? 'Relação' : 'Lookup'}: {col.name}</span>
				<button className="nb-formula-close" onClick={handleCloseLookup} title="Fechar">×</button>
			</div>
			<div className="nb-formula-body">
				<div className="nb-lookup-section">
					<label className="nb-lookup-label">1. Tabela de referência</label>
					<select className="nb-lookup-select" value={lookupDbPath} onChange={e => { setLookupDbPath(e.target.value); setLookupRefColId('') }}>
						<option value="">Selecionar tabela...</option>
						{availableDbs.map(db => <option key={db.path} value={db.path}>{db.name}</option>)}
					</select>
				</div>
				<div className="nb-lookup-section">
					<label className="nb-lookup-label">2. {col.type === 'relation' ? 'Campo de origem dos valores' : 'Coluna a exibir'}</label>
					<select className="nb-lookup-select" value={lookupRefColId} onChange={e => setLookupRefColId(e.target.value)} disabled={!lookupDbPath}>
						<option value="">Selecionar coluna...</option>
						<option value="_title">📄 Nome do arquivo</option>
						{refDbSchema.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
					</select>
				</div>
				{col.type === 'lookup' && (
					<div className="nb-lookup-section">
						<label className="nb-lookup-label">3. Coluna de junção (nesta tabela)</label>
						<select className="nb-lookup-select" value={lookupMatchColId} onChange={e => setLookupMatchColId(e.target.value)}>
							<option value="">Selecionar coluna...</option>
							<option value="_title">📄 Nome do arquivo (junção por título)</option>
							{schema.filter(c => c.id !== col.id && c.type !== 'formula' && c.type !== 'lookup').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
						</select>
						<p className="nb-lookup-hint">O valor desta coluna deve ser igual ao nome do arquivo da nota na tabela referenciada (ex: "A" para encontrar "A.md")</p>
					</div>
				)}
				<div className="nb-formula-actions">
					<button className="nb-formula-save" disabled={!lookupDbPath || !lookupRefColId || (col.type === 'lookup' && !lookupMatchColId)} onClick={handleSaveLookup}>Salvar</button>
					<button className="nb-formula-cancel" onClick={handleCloseLookup}>Cancelar</button>
				</div>
			</div>
		</div>,
		document.body
	) : null

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
					onClick={() => { setMenuOpen(v => !v); setEditingFormula(false); setEditingLookup(false); setEditingNumberFmt(false) }}
					title={col.name}
				>
					<span className="nb-header-icon">{TYPE_ICONS[col.type]}</span>
					<span className="nb-header-name">{col.name}</span>
				</button>
			)}

			{/* Menu dropdown */}
			{menuOpen && !editingFormula && !editingLookup && !editingNumberFmt && (
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

					{col.type === 'lookup' && (
						<button className="nb-menu-item" onClick={() => setEditingLookup(true)}>
							<span className="nb-menu-item-icon">↗</span>
							<span>Configurar lookup</span>
						</button>
					)}

					{col.type === 'relation' && (
						<button className="nb-menu-item" onClick={() => setEditingLookup(true)}>
							<span className="nb-menu-item-icon">🔗</span>
							<span>Configurar relação</span>
						</button>
					)}

					{col.type === 'number' && (
						<button className="nb-menu-item" onClick={() => setEditingNumberFmt(true)}>
							<span className="nb-menu-item-icon">#</span>
							<span>Formatar número</span>
						</button>
					)}

					<div className="nb-menu-separator" />
					<div className="nb-menu-label">Tipo de campo</div>
					{(['text', 'number', 'select', 'multiselect', 'date', 'checkbox', 'formula', 'relation', 'lookup'] as ColumnType[]).map(type => (
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

			{/* Painel de fórmula flutuante via portal */}
			{formulaPanel}
			{lookupPanel}
			{numberFmtPanel}
		</div>
	)
}
