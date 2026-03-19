import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { TFile } from 'obsidian'
import { ColumnSchema, ColumnType, NumberFormat } from '../types'
import { validateFormulaSyntax } from '../formula-engine'
import { useApp } from '../context'
import { t } from '../i18n'
import { DatabaseManager } from '../database-manager'

const TYPE_ICONS: Record<ColumnType, string> = {
	title:       '📄',
	text:        'Aa',
	number:      '#',
	select:      '◉',
	multiselect: '◈',
	date:        '📅',
	checkbox:    '☑',
	url:         '↗',
	email:       '✉',
	phone:       '📞',
	status:      '◎',
	formula:     'ƒ',
	relation:    '🔗',
	lookup:      '↗',
	image:       '🖼',
	audio:       '🎵',
}

const TYPE_LABELS = (): Record<ColumnType, string> => ({
	title:       t('type_title'),
	text:        t('type_text'),
	number:      t('type_number'),
	select:      t('type_select'),
	multiselect: t('type_multiselect'),
	date:        t('type_date'),
	checkbox:    t('type_checkbox'),
	url:         t('type_url'),
	email:       t('type_email'),
	phone:       t('type_phone'),
	status:      t('type_status'),
	formula:     t('type_formula'),
	relation:    t('type_relation'),
	lookup:      t('type_lookup'),
	image:       t('type_image'),
	audio:       t('type_audio'),
})

interface ColumnHeaderProps {
	col: ColumnSchema
	schema: ColumnSchema[]
	onUpdateSchema: (schema: ColumnSchema[]) => Promise<void>
	onRenameColumn: (oldId: string, newName: string) => Promise<void>
	onChangeType: (newType: ColumnType) => boolean | Promise<boolean>
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
	const [twoWay, setTwoWay] = useState(!!col.pairedColumnId)
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

	// Image config state
	const [editingImageConfig, setEditingImageConfig] = useState(false)
	const [imagePanelPos, setImagePanelPos] = useState<{ x: number; y: number } | null>(null)
	const [imageFolderInput, setImageFolderInput] = useState(col.imageSourceFolder ?? '')
	const imgPanelRef = useRef<HTMLDivElement>(null)
	const imgDragOffset = useRef<{ x: number; y: number } | null>(null)

	// Audio config state
	const [editingAudioConfig, setEditingAudioConfig] = useState(false)
	const [audioPanelPos, setAudioPanelPos] = useState<{ x: number; y: number } | null>(null)
	const [audioFolderInput, setAudioFolderInput] = useState(col.audioSourceFolder ?? '')
	const audioPanelRef = useRef<HTMLDivElement>(null)
	const audioDragOffset = useRef<{ x: number; y: number } | null>(null)

	// Fechar menu ao clicar fora
	useEffect(() => {
		if (!menuOpen) return
		const handler = (e: MouseEvent) => {
			const target = e.target as Node
			const inMenu = menuRef.current?.contains(target)
			const inPanel = panelRef.current?.contains(target) || lookupPanelRef.current?.contains(target) || fmtPanelRef.current?.contains(target) || imgPanelRef.current?.contains(target) || audioPanelRef.current?.contains(target)
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
			.map(f => ({ path: f.path, name: f.parent?.name || t('picker_root') }))
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
		setRefDbSchema(manager.readConfig(refDbFile).schema)
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

	// Sync image folder input with col
	useEffect(() => {
		if (!editingImageConfig) setImageFolderInput(col.imageSourceFolder ?? '')
	}, [col.imageSourceFolder, editingImageConfig])

	// Position panel when image config opens
	useEffect(() => {
		if (!editingImageConfig) return
		if (menuRef.current) {
			const rect = menuRef.current.getBoundingClientRect()
			const pw = 280, ph = 160
			let x = rect.left
			let y = rect.bottom + 4
			if (x + pw > window.innerWidth) x = window.innerWidth - pw - 8
			if (y + ph > window.innerHeight) y = rect.top - ph - 4
			setImagePanelPos({ x, y })
		}
	}, [editingImageConfig])

	// Drag for image config panel
	useEffect(() => {
		if (!editingImageConfig) return
		const onMove = (e: MouseEvent) => {
			if (!imgDragOffset.current) return
			setImagePanelPos({ x: e.clientX - imgDragOffset.current.x, y: e.clientY - imgDragOffset.current.y })
		}
		const onUp = () => { imgDragOffset.current = null }
		document.addEventListener('mousemove', onMove)
		document.addEventListener('mouseup', onUp)
		return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
	}, [editingImageConfig])

	// Sync audio folder input with col
	useEffect(() => {
		if (!editingAudioConfig) setAudioFolderInput(col.audioSourceFolder ?? '')
	}, [col.audioSourceFolder, editingAudioConfig])

	// Position panel when audio config opens
	useEffect(() => {
		if (!editingAudioConfig) return
		if (menuRef.current) {
			const rect = menuRef.current.getBoundingClientRect()
			const pw = 280, ph = 160
			let x = rect.left
			let y = rect.bottom + 4
			if (x + pw > window.innerWidth) x = window.innerWidth - pw - 8
			if (y + ph > window.innerHeight) y = rect.top - ph - 4
			setAudioPanelPos({ x, y })
		}
	}, [editingAudioConfig])

	// Drag for audio config panel
	useEffect(() => {
		if (!editingAudioConfig) return
		const onMove = (e: MouseEvent) => {
			if (!audioDragOffset.current) return
			setAudioPanelPos({ x: e.clientX - audioDragOffset.current.x, y: e.clientY - audioDragOffset.current.y })
		}
		const onUp = () => { audioDragOffset.current = null }
		document.addEventListener('mousemove', onMove)
		document.addEventListener('mouseup', onUp)
		return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
	}, [editingAudioConfig])

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

	const handleSaveImageConfig = async () => {
		await updateCol({ imageSourceFolder: imageFolderInput.trim() || undefined })
		setEditingImageConfig(false)
		setMenuOpen(false)
	}

	const handleCloseImageConfig = () => {
		setEditingImageConfig(false)
		setMenuOpen(false)
	}

	const handleImageTitleBarMouseDown = (e: React.MouseEvent) => {
		if (!imagePanelPos) return
		imgDragOffset.current = { x: e.clientX - imagePanelPos.x, y: e.clientY - imagePanelPos.y }
		e.preventDefault()
	}

	const handleSaveAudioConfig = async () => {
		await updateCol({ audioSourceFolder: audioFolderInput.trim() || undefined })
		setEditingAudioConfig(false)
		setMenuOpen(false)
	}

	const handleCloseAudioConfig = () => {
		setEditingAudioConfig(false)
		setMenuOpen(false)
	}

	const handleAudioTitleBarMouseDown = (e: React.MouseEvent) => {
		if (!audioPanelPos) return
		audioDragOffset.current = { x: e.clientX - audioPanelPos.x, y: e.clientY - audioPanelPos.y }
		e.preventDefault()
	}

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
		} else if (type === 'image') {
			setEditingImageConfig(true)
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
		let pairedColumnId: string | undefined = col.pairedColumnId

		if (col.type === 'relation' && twoWay && lookupDbPath && !col.pairedColumnId) {
			// Create paired column in target database
			const refDbFile = app.vault.getFileByPath(lookupDbPath)
			if (refDbFile) {
				const refConfig = manager.readConfig(refDbFile)
				const reverseColId = `rel_${col.id}_${Date.now()}`
				const sourceName = dbFile?.parent?.name || app.vault.getName()
				const reverseCol: ColumnSchema = {
					id: reverseColId,
					name: sourceName,
					type: 'relation',
					visible: true,
					refDatabasePath: dbFile?.path.replace(/\/[^/]+$/, '/_database.md') ?? '',
					refColumnId: '_title',
					pairedColumnId: col.id,
				}
				refConfig.schema.push(reverseCol)
				await manager.writeConfig(refDbFile, refConfig)
				pairedColumnId = reverseColId
			}
		} else if (col.type === 'relation' && !twoWay && col.pairedColumnId) {
			// Remove paired column from target database
			const refDbFile = app.vault.getFileByPath(lookupDbPath || col.refDatabasePath || '')
			if (refDbFile) {
				const refConfig = manager.readConfig(refDbFile)
				refConfig.schema = refConfig.schema.filter(c => c.id !== col.pairedColumnId)
				await manager.writeConfig(refDbFile, refConfig)
			}
			pairedColumnId = undefined
		}

		await updateCol({
			refDatabasePath: lookupDbPath,
			refColumnId: lookupRefColId,
			...(col.type === 'lookup' ? { refMatchColumnId: lookupMatchColId } : {}),
			...(col.type === 'relation' ? { pairedColumnId } : {}),
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
		{ group: t('formula_group_logic'), items: [
			{ fn: 'IF(cond, a, b)',          desc: 'Se cond for verdadeiro retorna a, senão b' },
			{ fn: 'IFS(c1, v1, c2, v2…)',   desc: 'Testa condições em sequência' },
			{ fn: 'AND(a, b, …)',            desc: 'Verdadeiro se todos forem verdadeiros' },
			{ fn: 'OR(a, b, …)',             desc: 'Verdadeiro se algum for verdadeiro' },
			{ fn: 'NOT(a)',                  desc: 'Inverte o valor lógico' },
		]},
		{ group: t('formula_group_comparators'), items: [
			{ fn: '= <> != > < >= <=', desc: 'Compara dois valores; use com IF' },
		]},
		{ group: t('formula_group_aggregators'), items: [
			{ fn: 'SUM(col)',   desc: 'Soma todos os valores da coluna' },
			{ fn: 'AVG(col)',   desc: 'Média dos valores da coluna' },
			{ fn: 'COUNT(col)', desc: 'Conta valores não vazios da coluna' },
			{ fn: 'MIN(col)',   desc: 'Menor valor da coluna' },
			{ fn: 'MAX(col)',   desc: 'Maior valor da coluna' },
		]},
		{ group: t('formula_group_text'), items: [
			{ fn: 'CONCAT(a, b, …)',       desc: 'Concatena textos (ou use &)' },
			{ fn: 'LEN(texto)',             desc: 'Número de caracteres' },
			{ fn: 'UPPER / LOWER(texto)',   desc: 'Maiúsculas / minúsculas' },
			{ fn: 'TRIM(texto)',            desc: 'Remove espaços nas bordas' },
			{ fn: 'LEFT(texto, n)',         desc: 'Primeiros n caracteres' },
			{ fn: 'RIGHT(texto, n)',        desc: 'Últimos n caracteres' },
			{ fn: 'MID(texto, início, n)',  desc: 'Substring a partir de início' },
			{ fn: 'SUBSTITUTE(t, de, para)', desc: 'Substitui ocorrências' },
		]},
		{ group: t('formula_group_math'), items: [
			{ fn: 'ROUND(n, d)',  desc: 'Arredonda n com d casas decimais' },
			{ fn: 'FLOOR / CEIL(n)', desc: 'Arredonda para baixo / cima' },
			{ fn: 'ABS(n)',       desc: 'Valor absoluto' },
			{ fn: 'MOD(n, d)',    desc: 'Resto da divisão' },
			{ fn: 'POWER(b, e)',  desc: 'Base elevado ao expoente' },
			{ fn: 'SQRT(n)',      desc: 'Raiz quadrada' },
		]},
		{ group: t('formula_group_utils'), items: [
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
				<span className="nb-formula-titlebar-title">{t('formula_panel_title')}: {col.name}</span>
				<button className="nb-formula-close" onClick={handleCloseFormula} title={t('tooltip_close')}>×</button>
			</div>

			{/* Conteúdo do painel */}
			<div className="nb-formula-body">
				<textarea
					ref={formulaRef}
					className={`nb-formula-textarea${formulaError ? ' nb-formula-textarea--error' : formulaValue.trim() ? ' nb-formula-textarea--ok' : ''}`}
					value={formulaValue}
					onChange={e => setFormulaValue(e.target.value)}
					placeholder={t('formula_placeholder')}
					rows={3}
					spellCheck={false}
					onKeyDown={e => {
						if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void handleSaveFormula() }
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
						{t('formula_valid')}
					</div>
				)}

				{otherCols.length > 0 && (
					<div className="nb-formula-cols-hint">
						<span className="nb-formula-cols-label">{t('formula_available_cols')}</span>
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
						{t('formula_ref_toggle')}
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
						onClick={() => { void handleSaveFormula() }}
						title={t('formula_save_hint')}
					>{t('formula_save')}</button>
					<button className="nb-formula-cancel" onClick={handleCloseFormula}>{t('formula_cancel')}</button>
				</div>
			</div>
		</div>,
		document.body
	) : null

	const numberFmtPanel = editingNumberFmt && fmtPanelPos ? createPortal(
		<div ref={fmtPanelRef} className="nb-formula-floating-panel" style={{ top: fmtPanelPos.y, left: fmtPanelPos.x }}>
			<div className="nb-formula-titlebar" onMouseDown={handleFmtTitleBarMouseDown}>
				<span className="nb-formula-titlebar-icon">#</span>
				<span className="nb-formula-titlebar-title">{t('number_format_title')}: {col.name}</span>
				<button className="nb-formula-close" onClick={handleCloseNumberFmt} title={t('tooltip_close')}>×</button>
			</div>
			<div className="nb-formula-body">
				<div className="nb-numfmt-preview">{fmtPreview}</div>
				<div className="nb-lookup-section">
					<label className="nb-lookup-label">{t('number_decimals_label')}</label>
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
						{t('number_thousands_label')}
					</label>
				</div>
				<div className="nb-lookup-section">
					<label className="nb-lookup-label">{t('number_prefix_label')}</label>
					<input
						type="text"
						className="nb-numfmt-text-input"
						value={fmtPrefix}
						onChange={e => setFmtPrefix(e.target.value)}
						placeholder={t('number_prefix_placeholder')}
					/>
				</div>
				<div className="nb-lookup-section">
					<label className="nb-lookup-label">{t('number_suffix_label')}</label>
					<input
						type="text"
						className="nb-numfmt-text-input"
						value={fmtSuffix}
						onChange={e => setFmtSuffix(e.target.value)}
						placeholder={t('number_suffix_placeholder')}
					/>
				</div>
				<div className="nb-formula-actions">
					<button className="nb-formula-save" onClick={() => { void handleSaveNumberFmt() }}>{t('formula_save')}</button>
					<button className="nb-formula-cancel" onClick={handleCloseNumberFmt}>{t('formula_cancel')}</button>
				</div>
				{col.numberFormat && (
					<div style={{ marginTop: '8px', textAlign: 'center' }}>
						<button className="nb-formula-cancel" onClick={() => { void handleRemoveNumberFmt() }} style={{ color: 'var(--text-error)', width: '100%' }}>
							{t('number_remove_format')}
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
				<span className="nb-formula-titlebar-title">{col.type === 'relation' ? t('relation_panel_title') : t('lookup_panel_title')}: {col.name}</span>
				<button className="nb-formula-close" onClick={handleCloseLookup} title={t('tooltip_close')}>×</button>
			</div>
			<div className="nb-formula-body">
				<div className="nb-lookup-section">
					<label className="nb-lookup-label">{t('lookup_ref_table')}</label>
					<select className="nb-lookup-select" value={lookupDbPath} onChange={e => { setLookupDbPath(e.target.value); setLookupRefColId('') }}>
						<option value="">{t('lookup_select_table')}</option>
						{availableDbs.map(db => <option key={db.path} value={db.path}>{db.name}</option>)}
					</select>
				</div>
				<div className="nb-lookup-section">
					<label className="nb-lookup-label">{col.type === 'relation' ? t('lookup_origin_col') : t('lookup_col_to_display')}</label>
					<select className="nb-lookup-select" value={lookupRefColId} onChange={e => setLookupRefColId(e.target.value)} disabled={!lookupDbPath}>
						<option value="">{t('lookup_select_col')}</option>
						<option value="_title">{'📄 ' + t('lookup_file_name')}</option>
						{refDbSchema.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
					</select>
				</div>
				{col.type === 'lookup' && (
					<div className="nb-lookup-section">
						<label className="nb-lookup-label">{t('lookup_join_col')}</label>
						<select className="nb-lookup-select" value={lookupMatchColId} onChange={e => setLookupMatchColId(e.target.value)}>
							<option value="">{t('lookup_select_col')}</option>
							<option value="_title">{'📄 ' + t('lookup_join_col_title')}</option>
							{schema.filter(c => c.id !== col.id && c.type !== 'formula' && c.type !== 'lookup').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
						</select>
						<p className="nb-lookup-hint">{t('lookup_hint')}</p>
					</div>
				)}
				{col.type === 'relation' && lookupDbPath && (
					<div className="nb-lookup-section">
						<label className="nb-lookup-checkbox">
							<input type="checkbox" checked={twoWay} onChange={e => setTwoWay(e.target.checked)} />
							{t('relation_two_way')}
						</label>
						<p className="nb-lookup-hint">{t('relation_two_way_hint')}</p>
					</div>
				)}
				<div className="nb-formula-actions">
					<button className="nb-formula-save" disabled={!lookupDbPath || !lookupRefColId || (col.type === 'lookup' && !lookupMatchColId)} onClick={() => { void handleSaveLookup() }}>{t('formula_save')}</button>
					<button className="nb-formula-cancel" onClick={handleCloseLookup}>{t('formula_cancel')}</button>
				</div>
			</div>
		</div>,
		document.body
	) : null

	const imageCfgPanel = editingImageConfig && imagePanelPos ? createPortal(
		<div ref={imgPanelRef} className="nb-formula-floating-panel" style={{ top: imagePanelPos.y, left: imagePanelPos.x, minWidth: 280 }}>
			<div className="nb-formula-titlebar" onMouseDown={handleImageTitleBarMouseDown}>
				<span className="nb-formula-titlebar-icon">🖼</span>
				<span className="nb-formula-titlebar-title">{t('image_panel_title')}: {col.name}</span>
				<button className="nb-formula-close" onClick={handleCloseImageConfig} title={t('tooltip_close')}>×</button>
			</div>
			<div className="nb-formula-body" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
				<label style={{ fontSize: 'var(--font-ui-small)', color: 'var(--text-muted)' }}>
					{t('image_folder_label')}
				</label>
				<input
					type="text"
					className="nb-header-rename-input"
					value={imageFolderInput}
					onChange={e => setImageFolderInput(e.target.value)}
					placeholder={t('image_folder_placeholder')}
				/>
				<div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
					<button className="nb-menu-item" onClick={handleCloseImageConfig} style={{ flex: 1 }}>{t('formula_cancel')}</button>
					<button className="nb-menu-item" onClick={() => { void handleSaveImageConfig() }} style={{ flex: 1, color: 'var(--interactive-accent)' }}>{t('formula_save')}</button>
				</div>
			</div>
		</div>,
		document.body
	) : null

	const audioCfgPanel = editingAudioConfig && audioPanelPos ? createPortal(
		<div ref={audioPanelRef} className="nb-formula-floating-panel" style={{ top: audioPanelPos.y, left: audioPanelPos.x, minWidth: 280 }}>
			<div className="nb-formula-titlebar" onMouseDown={handleAudioTitleBarMouseDown}>
				<span className="nb-formula-titlebar-icon">🎵</span>
				<span className="nb-formula-titlebar-title">{t('audio_panel_title')}: {col.name}</span>
				<button className="nb-formula-close" onClick={handleCloseAudioConfig} title={t('tooltip_close')}>×</button>
			</div>
			<div className="nb-formula-body" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
				<label style={{ fontSize: 'var(--font-ui-small)', color: 'var(--text-muted)' }}>
					{t('audio_folder_label')}
				</label>
				<input
					type="text"
					className="nb-header-rename-input"
					value={audioFolderInput}
					onChange={e => setAudioFolderInput(e.target.value)}
					placeholder={t('audio_folder_placeholder')}
				/>
				<div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
					<button className="nb-menu-item" onClick={handleCloseAudioConfig} style={{ flex: 1 }}>{t('formula_cancel')}</button>
					<button className="nb-menu-item" onClick={() => { void handleSaveAudioConfig() }} style={{ flex: 1, color: 'var(--interactive-accent)' }}>{t('formula_save')}</button>
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
					onBlur={() => { void handleRename() }}
					onKeyDown={e => {
						if (e.key === 'Enter') void handleRename()
						if (e.key === 'Escape') { setRenaming(false); setMenuOpen(false) }
					}}
					onClick={e => e.stopPropagation()}
				/>
			) : (
				<button
					className="nb-header-label"
					onClick={() => { setMenuOpen(v => !v); setEditingFormula(false); setEditingLookup(false); setEditingNumberFmt(false); setEditingImageConfig(false) }}
					title={col.name}
				>
					<span className="nb-header-icon">{TYPE_ICONS[col.type]}</span>
					<span className="nb-header-name">{col.name}</span>
				</button>
			)}

			{/* Menu dropdown */}
			{menuOpen && !editingFormula && !editingLookup && !editingNumberFmt && !editingImageConfig && (
				<div className="nb-column-menu">
					<button className="nb-menu-item" onClick={() => { setMenuOpen(false); setRenaming(true) }}>
						<span className="nb-menu-item-icon">✏️</span>
						<span>{t('rename_column')}</span>
					</button>

					{col.type === 'formula' && (
						<button className="nb-menu-item" onClick={() => setEditingFormula(true)}>
							<span className="nb-menu-item-icon">ƒ</span>
							<span>{t('edit_formula')}</span>
						</button>
					)}

					{col.type === 'lookup' && (
						<button className="nb-menu-item" onClick={() => setEditingLookup(true)}>
							<span className="nb-menu-item-icon">↗</span>
							<span>{t('configure_lookup')}</span>
						</button>
					)}

					{col.type === 'relation' && (
						<button className="nb-menu-item" onClick={() => setEditingLookup(true)}>
							<span className="nb-menu-item-icon">🔗</span>
							<span>{t('configure_relation')}</span>
						</button>
					)}

					{col.type === 'number' && (
						<button className="nb-menu-item" onClick={() => setEditingNumberFmt(true)}>
							<span className="nb-menu-item-icon">#</span>
							<span>{t('format_number')}</span>
						</button>
					)}

					{col.type === 'image' && (
						<button className="nb-menu-item" onClick={() => setEditingImageConfig(true)}>
							<span className="nb-menu-item-icon">🖼</span>
							<span>{t('configure_image_folder')}</span>
						</button>
					)}

					{col.type === 'audio' && (
						<button className="nb-menu-item" onClick={() => setEditingAudioConfig(true)}>
							<span className="nb-menu-item-icon">🎵</span>
							<span>{t('configure_audio_folder')}</span>
						</button>
					)}

					<div className="nb-menu-separator" />
					<div className="nb-menu-label">{t('field_type_label')}</div>
					{(['text', 'number', 'select', 'multiselect', 'date', 'checkbox', 'url', 'email', 'phone', 'status', 'formula', 'relation', 'lookup', 'image', 'audio'] as ColumnType[]).map(type => (
						<button
							key={type}
							className={`nb-menu-item nb-menu-type-item ${col.type === type ? 'nb-menu-item--active' : ''}`}
							onClick={() => { void handleTypeChange(type) }}
						>
							<span className="nb-menu-item-icon">{TYPE_ICONS[type]}</span>
							<span>{TYPE_LABELS()[type]}</span>
						</button>
					))}

					<div className="nb-menu-separator" />
					<button className="nb-menu-item" onClick={() => { void handleHide() }}>
						<span className="nb-menu-item-icon">👁</span>
						<span>{t('hide_field')}</span>
					</button>
					<button className="nb-menu-item nb-menu-item--danger" onClick={() => { void handleDelete() }}>
						<span className="nb-menu-item-icon">🗑</span>
						<span>{t('delete_field')}</span>
					</button>
				</div>
			)}

			{/* Painel de fórmula flutuante via portal */}
			{formulaPanel}
			{lookupPanel}
			{numberFmtPanel}
			{imageCfgPanel}
			{audioCfgPanel}
		</div>
	)
}
