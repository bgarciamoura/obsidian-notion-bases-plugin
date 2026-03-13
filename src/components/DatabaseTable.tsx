import {
	useReactTable,
	getCoreRowModel,
	getSortedRowModel,
	getFilteredRowModel,
	flexRender,
	ColumnDef,
	SortingState,
	RowSelectionState,
} from '@tanstack/react-table'
import {
	DndContext,
	DragEndEvent,
	closestCenter,
	PointerSensor,
	useSensor,
	useSensors,
} from '@dnd-kit/core'
import {
	SortableContext,
	horizontalListSortingStrategy,
	arrayMove,
	useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { TFile } from 'obsidian'
import { ReactNode, useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useApp } from '../context'
import { DatabaseManager } from '../database-manager'
import { ColumnSchema, DatabaseConfig, FilterOperator, NoteRow, DEFAULT_DATABASE_CONFIG } from '../types'
import { ColumnHeader } from './ColumnHeader'
import { CellRenderer, CellContext } from './cells/CellRenderer'
import { FolderPickerModal } from '../folder-picker-modal'

// ── Helpers estáticos ────────────────────────────────────────────────────────

function getColumnIconStatic(type: string): string {
	const icons: Record<string, string> = {
		title: '📄', text: 'Aa', number: '#', select: '◉',
		multiselect: '◈', date: '📅', checkbox: '☑', formula: 'ƒ',
	}
	return icons[type] ?? '·'
}

interface ActiveFilter {
	columnId: string
	columnName: string
	icon: string
	operator: FilterOperator
	value: string
}

const FILTER_OPERATORS: FilterOperator[] = [
	'is', 'is_not', 'contains', 'not_contains', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty',
]

const OPERATOR_LABELS: Record<FilterOperator, string> = {
	is: 'É',
	is_not: 'Não é',
	contains: 'Contém',
	not_contains: 'Não contém',
	starts_with: 'Começa com',
	ends_with: 'Termina com',
	is_empty: 'Está vazio',
	is_not_empty: 'Não está vazio',
}

function matchesFilter(row: NoteRow, f: ActiveFilter): boolean {
	if (f.operator !== 'is_empty' && f.operator !== 'is_not_empty' && f.value === '') return true
	const raw = f.columnId === '_title' ? row._title : row[f.columnId]
	const cell = Array.isArray(raw)
		? (raw as string[]).join(', ').toLowerCase()
		: String(raw ?? '').toLowerCase()
	const v = f.value.toLowerCase()
	switch (f.operator) {
		case 'is': return cell === v
		case 'is_not': return cell !== v
		case 'contains': return cell.includes(v)
		case 'not_contains': return !cell.includes(v)
		case 'starts_with': return cell.startsWith(v)
		case 'ends_with': return cell.endsWith(v)
		case 'is_empty': return raw === null || raw === undefined || cell === ''
		case 'is_not_empty': return raw !== null && raw !== undefined && cell !== ''
		default: return true
	}
}

// ── Cabeçalho de coluna arrastável ───────────────────────────────────────────

function SortableTh({ id, size, children }: { id: string; size: number; children: ReactNode }) {
	const {
		attributes,
		listeners,
		setNodeRef,
		setActivatorNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id })

	return (
		<th
			ref={setNodeRef}
			className={`nb-th${isDragging ? ' nb-th--dragging' : ''}`}
			style={{
				width: size,
				transform: CSS.Transform.toString(transform),
				transition,
				zIndex: isDragging ? 1 : undefined,
			}}
		>
			<div className="nb-th-inner">
				<span
					ref={setActivatorNodeRef}
					{...listeners}
					{...attributes}
					className="nb-col-drag-handle"
					title="Arrastar para reordenar"
				>⠿</span>
				{children}
				<span className="nb-col-drag-spacer" aria-hidden="true" />
			</div>
		</th>
	)
}

interface DatabaseTableProps {
	dbFile: TFile | null
	manager: DatabaseManager
}

export function DatabaseTable({ dbFile, manager }: DatabaseTableProps) {
	const app = useApp()
	const [config, setConfig] = useState<DatabaseConfig>(DEFAULT_DATABASE_CONFIG)
	const [rows, setRows] = useState<NoteRow[]>([])
	const [sorting, setSorting] = useState<SortingState>([])
	const [globalFilter, setGlobalFilter] = useState('')
	const [editingCell, setEditingCell] = useState<{ rowIndex: number; columnId: string } | null>(null)
	const [loading, setLoading] = useState(true)
	const [fieldsMenuOpen, setFieldsMenuOpen] = useState(false)
	const fieldsMenuRef = useRef<HTMLDivElement>(null)
	const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
	const [actionsMenuOpen, setActionsMenuOpen] = useState(false)
	const actionsMenuRef = useRef<HTMLDivElement>(null)
	const lastCreatedPath = useRef<string | null>(null)
	const [filterMenuOpen, setFilterMenuOpen] = useState(false)
	const filterMenuRef = useRef<HTMLDivElement>(null)
	const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([])
	const [openFilterPill, setOpenFilterPill] = useState<string | null>(null)
	const filterPillRefs = useRef<Record<string, HTMLDivElement | null>>({})
	const [openOperatorPicker, setOpenOperatorPicker] = useState<string | null>(null)
	const operatorPickerRefs = useRef<Record<string, HTMLDivElement | null>>({})
	const filtersInitialized = useRef(false)
	const [searchExpanded, setSearchExpanded] = useState(false)
	const searchInputRef = useRef<HTMLInputElement>(null)
	const searchInactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
	)

	// ── Carregar config e linhas ─────────────────────────────────────────────

	const loadData = useCallback(async () => {
		if (!dbFile) { setLoading(false); return }
		setLoading(true)

		const cfg = await manager.readConfig(dbFile)
		const notes = manager.getNotesInDatabase(dbFile)

		// Inferir schema se vazio
		if (cfg.schema.length === 0 && notes.length > 0) {
			cfg.schema = manager.inferSchema(notes)
			await manager.writeConfig(dbFile, cfg)
		}

		const noteRows = notes.map(f => manager.getNoteData(f, cfg.schema))

		// Garantir que a linha recém-criada apareça no final
		if (lastCreatedPath.current) {
			const idx = noteRows.findIndex(r => r._file.path === lastCreatedPath.current)
			if (idx !== -1) noteRows.push(...noteRows.splice(idx, 1))
			lastCreatedPath.current = null
		}

		// Restaurar pills (apenas na primeira carga por arquivo)
		if (!filtersInitialized.current) {
			filtersInitialized.current = true
			const pills = cfg.views[0]?.activePills ?? []
			if (pills.length > 0) {
				const restored = pills.flatMap(p => {
					if (p.columnId === '_title') return [{ columnId: '_title', columnName: 'Nome', icon: '📄', operator: p.operator, value: p.value }]
					const col = cfg.schema.find(sc => sc.id === p.columnId)
					if (!col) return []
					return [{ columnId: col.id, columnName: col.name, icon: getColumnIconStatic(col.type), operator: p.operator, value: p.value }]
				})
				setActiveFilters(restored as ActiveFilter[])
			}
		}

		setConfig(cfg)
		setRows(noteRows)
		setLoading(false)
	}, [dbFile, manager])

	useEffect(() => { filtersInitialized.current = false }, [dbFile])

	useEffect(() => {
		loadData()
	}, [loadData])

	// Reagir a mudanças no vault (novo arquivo, renomeação, etc.)
	useEffect(() => {
		const onVaultChange = () => { loadData() }
		app.vault.on('create', onVaultChange)
		app.vault.on('delete', onVaultChange)
		app.vault.on('rename', onVaultChange)
		app.metadataCache.on('changed', onVaultChange)
		return () => {
			app.vault.off('create', onVaultChange)
			app.vault.off('delete', onVaultChange)
			app.vault.off('rename', onVaultChange)
			app.metadataCache.off('changed', onVaultChange)
		}
	}, [app, loadData])

	// ── Atualizar célula (salva no frontmatter) ──────────────────────────────

	const updateCell = useCallback(async (rowIndex: number, columnId: string, value: unknown) => {
		const row = rows[rowIndex]
		if (!row) return

		// Atualização otimista
		setRows(prev => prev.map((r, i) =>
			i === rowIndex ? { ...r, [columnId]: value } : r
		))

		if (columnId === '_title') {
			await manager.renameNote(row._file, String(value))
		} else {
			await manager.updateNoteField(row._file, columnId, value)
		}
	}, [rows, manager])

	// ── Atualizar schema (salva no _database.md) ─────────────────────────────

	const updateSchema = useCallback(async (newSchema: ColumnSchema[]) => {
		if (!dbFile) return
		const newConfig = { ...config, schema: newSchema }
		setConfig(newConfig)
		await manager.writeConfig(dbFile, newConfig)
	}, [dbFile, config, manager])

	// ── Renomear coluna (id + nome + chave do frontmatter nas notas) ──────────

	const renameColumn = useCallback(async (oldId: string, newName: string) => {
		if (!dbFile) return
		const newConfig = await manager.renameColumn(dbFile, config, oldId, newName)
		setConfig(newConfig)
	}, [dbFile, config, manager])

	// ── Colunas TanStack Table ───────────────────────────────────────────────

	const columns = useMemo<ColumnDef<NoteRow>[]>(() => {
		const cols: ColumnDef<NoteRow>[] = []

		// Coluna seleção (sempre primeira)
		cols.push({
			id: '_select',
			size: 40,
			enableSorting: false,
			enableColumnFilter: false,
			header: () => null,
			cell: ({ row }) => (
				<div className="nb-cell-checkbox-wrapper">
					<input
						type="checkbox"
						className="nb-cell-checkbox"
						checked={row.getIsSelected()}
						onChange={row.getToggleSelectedHandler()}
					/>
				</div>
			),
		})

		// Coluna título (sempre segunda)
		cols.push({
			id: '_title',
			accessorFn: row => row._title,
			size: config.views[0]?.columnWidths['_title'] ?? 260,
			enableColumnFilter: true,
			enableSorting: true,
			sortingFn: 'text',
			header: ({ column }) => {
				const sorted = column.getIsSorted()
				return (
					<div className="nb-header-title">
						<span>📄</span>
						<span>Nome</span>
						<button
							className={`nb-sort-btn ${sorted ? 'nb-sort-btn--sorted' : ''}`}
							onClick={e => { e.stopPropagation(); column.toggleSorting(sorted === 'asc') }}
							title={sorted === 'asc' ? 'Ordenar Z→A' : sorted === 'desc' ? 'Remover ordenação' : 'Ordenar A→Z'}
						>
							<span className={sorted === 'asc' ? 'nb-sort-chevron--active' : 'nb-sort-chevron'}>⌃</span>
							<span className={sorted === 'desc' ? 'nb-sort-chevron--active' : 'nb-sort-chevron'}>⌄</span>
						</button>
					</div>
				)
			},
			cell: info => (
				<CellRenderer
					col={{ id: '_title', name: 'Nome', type: 'title', visible: true }}
					value={info.getValue<string>()}
					rowIndex={info.row.index}
					columnId="_title"
					file={info.row.original._file}
				/>
			),
		})

		// Colunas do schema
		const visibleSchema = config.schema.filter(col => col.visible)
		for (const col of visibleSchema) {
			cols.push({
				id: col.id,
				accessorFn: row => row[col.id],
				size: config.views[0]?.columnWidths[col.id] ?? (col.width ?? 150),
				enableColumnFilter: col.type !== 'formula',
				enableSorting: col.type !== 'formula',
				header: () => (
					<ColumnHeader
						col={col}
						schema={config.schema}
						onUpdateSchema={updateSchema}
						onRenameColumn={renameColumn}
					/>
				),
				cell: info => (
					<CellRenderer
						col={col}
						value={info.getValue()}
						rowIndex={info.row.index}
						columnId={col.id}
					/>
				),
			})
		}

		return cols
	}, [config, updateSchema])

	// ── Instância da tabela ──────────────────────────────────────────────────

	const filteredRows = useMemo(
		() => activeFilters.length === 0
			? rows
			: rows.filter(row => activeFilters.every(f => matchesFilter(row, f))),
		[rows, activeFilters]
	)

	const table = useReactTable({
		data: filteredRows,
		columns,
		state: { sorting, globalFilter, rowSelection },
		onSortingChange: setSorting,
		onGlobalFilterChange: setGlobalFilter,
		onRowSelectionChange: setRowSelection,
		enableRowSelection: true,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		meta: {
			updateCell,
			editingCell,
			setEditingCell,
			schema: config.schema,
		},
	})

	// ── Adicionar linha ──────────────────────────────────────────────────────

	const handleAddRow = async () => {
		if (!dbFile) return
		setSorting([])
		const newFile = await manager.createNote(dbFile)
		lastCreatedPath.current = newFile.path
		// loadData será chamado pelo evento vault.on('create')
	}

	// ── Fechar menu de campos ao clicar fora ─────────────────────────────────

	useEffect(() => {
		if (!fieldsMenuOpen) return
		const handler = (e: MouseEvent) => {
			if (fieldsMenuRef.current && !fieldsMenuRef.current.contains(e.target as Node)) {
				setFieldsMenuOpen(false)
			}
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [fieldsMenuOpen])

	// ── Fechar menu de ações ao clicar fora ──────────────────────────────────

	useEffect(() => {
		if (!actionsMenuOpen) return
		const handler = (e: MouseEvent) => {
			if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
				setActionsMenuOpen(false)
			}
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [actionsMenuOpen])

	// ── Ações em lote ────────────────────────────────────────────────────────

	const getSelectedFiles = useCallback(() => {
		return table.getSelectedRowModel().rows.map(r => r.original._file)
	}, [table])

	const handleDeleteSelected = useCallback(async () => {
		const files = getSelectedFiles()
		if (files.length === 0) return
		if (!window.confirm(`Apagar ${files.length} nota(s)? Esta ação não pode ser desfeita.`)) return
		await manager.deleteNotes(files)
		setRowSelection({})
		setActionsMenuOpen(false)
	}, [getSelectedFiles, manager])

	const handleMoveSelected = useCallback(() => {
		const files = getSelectedFiles()
		if (files.length === 0) return
		const modal = new FolderPickerModal(app, async folder => {
			await manager.moveNotes(files, folder.path)
			setRowSelection({})
		})
		modal.open()
		setActionsMenuOpen(false)
	}, [app, getSelectedFiles, manager])

	const handleDuplicateSelected = useCallback(async () => {
		const files = getSelectedFiles()
		if (files.length === 0) return
		await manager.duplicateNotes(files)
		setRowSelection({})
		setActionsMenuOpen(false)
	}, [getSelectedFiles, manager])

	// ── Fechar menu de filtros ao clicar fora ────────────────────────────────

	useEffect(() => {
		if (!filterMenuOpen) return
		const handler = (e: MouseEvent) => {
			if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
				setFilterMenuOpen(false)
			}
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [filterMenuOpen])

	// ── Fechar pill de filtro ao clicar fora ──────────────────────────────────

	useEffect(() => {
		if (!openFilterPill) return
		const handler = (e: MouseEvent) => {
			const pillEl = filterPillRefs.current[openFilterPill]
			if (pillEl && !pillEl.contains(e.target as Node)) {
				setOpenFilterPill(null)
			}
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [openFilterPill])

	// ── Fechar operator picker ao clicar fora ────────────────────────────

	useEffect(() => {
		if (!openOperatorPicker) return
		const handler = (e: MouseEvent) => {
			const el = operatorPickerRefs.current[openOperatorPicker]
			if (el && !el.contains(e.target as Node)) setOpenOperatorPicker(null)
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [openOperatorPicker])

		// ── Filtros ───────────────────────────────────────────────────────────────

	const getColumnIcon = getColumnIconStatic

	const saveActivePills = useCallback(async (filters: { columnId: string }[]) => {
		if (!dbFile) return
		const newConfig = {
			...config,
			views: config.views.map((v, i) =>
				i === 0 ? { ...v, activePills: (filters as ActiveFilter[]).map(f => ({ columnId: f.columnId, operator: f.operator, value: f.value })) } : v
			),
		}
		await manager.writeConfig(dbFile, newConfig)
	}, [dbFile, config, manager])

	const addFilter = (columnId: string, columnName: string, icon: string) => {
		if (activeFilters.some(f => f.columnId === columnId)) return
		const next: ActiveFilter[] = [...activeFilters, { columnId, columnName, icon, operator: 'contains' as FilterOperator, value: '' }]
		setActiveFilters(next)
		saveActivePills(next)
		setFilterMenuOpen(false)
	}

	const removeFilter = (columnId: string) => {
		const next = activeFilters.filter(f => f.columnId !== columnId)
		setActiveFilters(next)
		saveActivePills(next)
		if (openFilterPill === columnId) setOpenFilterPill(null)
		if (openOperatorPicker === columnId) setOpenOperatorPicker(null)
	}

	const updateFilter = (columnId: string, operator: FilterOperator, value: string) => {
		const next = activeFilters.map(f =>
			f.columnId === columnId ? { ...f, operator, value } : f
		)
		setActiveFilters(next)
		saveActivePills(next)
	}

	// ── Busca colapsável ──────────────────────────────────────────────────────

	const shouldCollapse = activeFilters.length >= 3 || activeFilters.some(f => f.columnName.length > 10)

	useEffect(() => {
		if (!shouldCollapse) {
			setSearchExpanded(false)
			if (searchInactivityTimer.current) clearTimeout(searchInactivityTimer.current)
		}
	}, [shouldCollapse])

	useEffect(() => {
		return () => { if (searchInactivityTimer.current) clearTimeout(searchInactivityTimer.current) }
	}, [])

	const clearSearchTimer = () => {
		if (searchInactivityTimer.current) {
			clearTimeout(searchInactivityTimer.current)
			searchInactivityTimer.current = null
		}
	}

	const startSearchTimer = () => {
		clearSearchTimer()
		searchInactivityTimer.current = setTimeout(() => setSearchExpanded(false), 6000)
	}

	const expandSearch = () => {
		setSearchExpanded(true)
		startSearchTimer()
		requestAnimationFrame(() => searchInputRef.current?.focus())
	}

	const collapseSearch = () => {
		clearSearchTimer()
		setSearchExpanded(false)
	}

	// ── Toggle visibilidade de um campo ──────────────────────────────────────

	const toggleFieldVisibility = useCallback(async (fieldId: string) => {
		const newSchema = config.schema.map(col =>
			col.id === fieldId ? { ...col, visible: !col.visible } : col
		)
		await updateSchema(newSchema)
	}, [config.schema, updateSchema])

	// ── Reordenar colunas via drag ────────────────────────────────────────────

	const handleColumnDragEnd = useCallback(async (event: DragEndEvent) => {
		const { active, over } = event
		if (!over || active.id === over.id) return

		const oldIndex = config.schema.findIndex(c => c.id === active.id)
		const newIndex = config.schema.findIndex(c => c.id === over.id)
		if (oldIndex === -1 || newIndex === -1) return

		await updateSchema(arrayMove(config.schema, oldIndex, newIndex))
	}, [config.schema, updateSchema])

	// ── Adicionar coluna ─────────────────────────────────────────────────────

	const handleAddColumn = async () => {
		const id = `campo_${Date.now()}`
		const newCol: ColumnSchema = {
			id,
			name: 'Novo campo',
			type: 'text',
			visible: true,
			width: 150,
		}
		await updateSchema([...config.schema, newCol])
	}

	// ── Render ───────────────────────────────────────────────────────────────

	if (!dbFile) {
		return (
			<div className="nb-empty-state">
				<p>Nenhum banco de dados aberto.</p>
				<p>Use o botão na ribbon ou o comando <strong>Criar novo banco de dados</strong>.</p>
			</div>
		)
	}

	if (loading) {
		return <div className="nb-loading">Carregando...</div>
	}

	const tableRows = table.getRowModel().rows

	return (
		<div className="nb-container">
			{/* Toolbar */}
			<div className="nb-toolbar">
				<div className={`nb-search-container${shouldCollapse ? (searchExpanded ? ' nb-search-container--expanded' : ' nb-search-container--collapsed') : ''}`}>
					{shouldCollapse && (
						<button className="nb-search-icon-btn" onClick={expandSearch} title="Buscar">
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
								<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
							</svg>
						</button>
					)}
					<input
						ref={searchInputRef}
						className="nb-search"
						type="text"
						placeholder="Buscar..."
						value={globalFilter}
						onChange={e => { setGlobalFilter(e.target.value); if (shouldCollapse && searchExpanded) startSearchTimer() }}
						onKeyDown={e => { if (e.key === 'Enter' && shouldCollapse && searchExpanded) collapseSearch() }}
						onBlur={() => { if (shouldCollapse && searchExpanded) collapseSearch() }}
					/>
				</div>

				{/* Botão Campos */}
				<div className="nb-fields-menu-wrapper" ref={fieldsMenuRef}>
					<button
						className={`nb-toolbar-btn ${fieldsMenuOpen ? 'nb-toolbar-btn--active' : ''}`}
						onClick={() => setFieldsMenuOpen(v => !v)}
						title="Gerenciar campos"
					>
						Campos {config.schema.some(c => !c.visible) && (
							<span className="nb-hidden-badge">
								{config.schema.filter(c => !c.visible).length}
							</span>
						)}
					</button>

					{fieldsMenuOpen && (
						<div className="nb-fields-dropdown">
							<div className="nb-fields-dropdown-label">Campos</div>
							{config.schema.map(col => (
								<label key={col.id} className="nb-field-row">
									<input
										type="checkbox"
										className="nb-field-checkbox"
										checked={col.visible}
										onChange={() => toggleFieldVisibility(col.id)}
									/>
									<span className="nb-field-icon">{
										col.type === 'text' ? 'Aa' :
										col.type === 'number' ? '#' :
										col.type === 'select' ? '◉' :
										col.type === 'multiselect' ? '◈' :
										col.type === 'date' ? '📅' :
										col.type === 'checkbox' ? '☑' :
										col.type === 'formula' ? 'ƒ' : '·'
									}</span>
									<span className="nb-field-name">{col.name}</span>
								</label>
							))}
						</div>
					)}
				</div>

				{/* Botão Ações */}
				<div className="nb-fields-menu-wrapper" ref={actionsMenuRef}>
					<button
						className={`nb-toolbar-btn ${actionsMenuOpen ? 'nb-toolbar-btn--active' : ''}`}
						onClick={() => setActionsMenuOpen(v => !v)}
						title="Ações em lote"
					>
						Ações
						{table.getSelectedRowModel().rows.length > 0 && (
							<span className="nb-hidden-badge">
								{table.getSelectedRowModel().rows.length}
							</span>
						)}
					</button>

					{actionsMenuOpen && (
						<div className="nb-fields-dropdown nb-actions-dropdown">
							<button
								className="nb-menu-item"
								onClick={handleDeleteSelected}
								disabled={table.getSelectedRowModel().rows.length === 0}
							>
								<span className="nb-menu-item-icon">🗑</span>
								<span>Apagar todos selecionados</span>
							</button>
							<button
								className="nb-menu-item"
								onClick={handleMoveSelected}
								disabled={table.getSelectedRowModel().rows.length === 0}
							>
								<span className="nb-menu-item-icon">📁</span>
								<span>Mover todos selecionados</span>
							</button>
							<button
								className="nb-menu-item"
								onClick={handleDuplicateSelected}
								disabled={table.getSelectedRowModel().rows.length === 0}
							>
								<span className="nb-menu-item-icon">📋</span>
								<span>Duplicar todos selecionados</span>
							</button>
						</div>
					)}
				</div>

				{/* Pills de filtros ativos */}
				{activeFilters.map(filter => (
					<div
						key={filter.columnId}
						className={`nb-filter-pill-wrapper${shouldCollapse && searchExpanded ? ' nb-filter-pill-wrapper--hidden' : ''}`}
						ref={el => { filterPillRefs.current[filter.columnId] = el }}
					>
						<button
							className={`nb-filter-pill ${openFilterPill === filter.columnId ? 'nb-filter-pill--active' : ''}`}
							onClick={() => setOpenFilterPill(v => v === filter.columnId ? null : filter.columnId)}
						>
							<span className="nb-filter-pill-icon">{filter.icon}</span>
							<span className="nb-filter-pill-name">{filter.columnName}</span>
							<span
								className="nb-filter-pill-remove"
								onClick={e => { e.stopPropagation(); removeFilter(filter.columnId) }}
								title="Remover filtro"
							>×</span>
						</button>

						{openFilterPill === filter.columnId && (
							<div className="nb-filter-pill-dropdown">
								<div className="nb-filter-query-row">
									<span className="nb-filter-query-name">{filter.columnName}</span>
									<div
										className="nb-filter-op-wrapper"
										ref={el => { operatorPickerRefs.current[filter.columnId] = el }}
									>
										<button
											className={`nb-filter-op-btn ${openOperatorPicker === filter.columnId ? 'nb-filter-op-btn--open' : ''}`}
											onClick={e => { e.stopPropagation(); setOpenOperatorPicker(v => v === filter.columnId ? null : filter.columnId) }}
										>
											{OPERATOR_LABELS[filter.operator]}
											<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
										</button>
										{openOperatorPicker === filter.columnId && (
											<div className="nb-filter-op-dropdown">
												{FILTER_OPERATORS.map(op => (
													<button
														key={op}
														className={`nb-menu-item ${filter.operator === op ? 'nb-menu-item--active' : ''}`}
														onClick={e => { e.stopPropagation(); updateFilter(filter.columnId, op, filter.value); setOpenOperatorPicker(null) }}
													>
														{OPERATOR_LABELS[op]}
													</button>
												))}
											</div>
										)}
									</div>
									<button
										className="nb-filter-query-clear"
										onClick={e => { e.stopPropagation(); removeFilter(filter.columnId) }}
										title="Remover filtro"
									>×</button>
								</div>
								{filter.operator !== 'is_empty' && filter.operator !== 'is_not_empty' && (
									<input
										className="nb-filter-value-input"
										type="text"
										placeholder="Digite um valor..."
										value={filter.value}
										autoFocus
										onChange={e => updateFilter(filter.columnId, filter.operator, e.target.value)}
									/>
								)}
							</div>
						)}
					</div>
				))}

				<span className="nb-row-count">
					{tableRows.length} {tableRows.length === 1 ? 'item' : 'itens'}
				</span>

				{/* Botão Filtros */}
				<div className="nb-fields-menu-wrapper" ref={filterMenuRef} style={{ marginLeft: 'auto' }}>
					<button
						className={`nb-toolbar-btn nb-toolbar-btn--icon ${filterMenuOpen ? 'nb-toolbar-btn--active' : ''}`}
						onClick={() => setFilterMenuOpen(v => !v)}
						title="Filtros"
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
						</svg>
						{activeFilters.length > 0 && (
							<span className="nb-hidden-badge">{activeFilters.length}</span>
						)}
					</button>

					{filterMenuOpen && (
						<div className="nb-fields-dropdown nb-filter-menu-dropdown">
							<div className="nb-fields-dropdown-label">Filtrar por</div>
							<button
								className="nb-menu-item"
								onClick={() => addFilter('_title', 'Nome', '📄')}
								disabled={activeFilters.some(f => f.columnId === '_title')}
							>
								<span className="nb-menu-item-icon">📄</span>
								<span>Nome</span>
							</button>
							{config.schema.map(col => (
								<button
									key={col.id}
									className="nb-menu-item"
									onClick={() => addFilter(col.id, col.name, getColumnIcon(col.type))}
									disabled={activeFilters.some(f => f.columnId === col.id)}
								>
									<span className="nb-menu-item-icon">{getColumnIcon(col.type)}</span>
									<span>{col.name}</span>
								</button>
							))}
							<div className="nb-menu-separator" />
							<button className="nb-menu-item" onClick={() => setFilterMenuOpen(false)}>
								<span className="nb-menu-item-icon">⚡</span>
								<span>Adicionar filtro avançado</span>
							</button>
						</div>
					)}
				</div>
			</div>

			{/* Tabela */}
			<CellContext.Provider value={{ editingCell, setEditingCell, updateCell, schema: config.schema }}>
			<div className="nb-table-wrapper">
				<table className="nb-table">
					<thead className="nb-thead">
						{table.getHeaderGroups().map(group => {
							const visibleSchemaIds = config.schema
								.filter(c => c.visible)
								.map(c => c.id)
							return (
								<DndContext
									key={group.id}
									sensors={sensors}
									collisionDetection={closestCenter}
									onDragEnd={handleColumnDragEnd}
								>
									<SortableContext
										items={visibleSchemaIds}
										strategy={horizontalListSortingStrategy}
									>
										<tr className="nb-header-row">
											{group.headers.map(header =>
												header.id === '_select' ? (
													<th
														key={header.id}
														className="nb-th nb-th-select"
														style={{ width: header.getSize() }}
													>
														<div className="nb-cell-checkbox-wrapper">
															<input
																type="checkbox"
																className="nb-cell-checkbox"
																checked={table.getIsAllRowsSelected()}
																ref={el => { if (el) el.indeterminate = table.getIsSomeRowsSelected() }}
																onChange={table.getToggleAllRowsSelectedHandler()}
															/>
														</div>
													</th>
												) : header.id === '_title' ? (
													<th
														key={header.id}
														className="nb-th"
														style={{ width: header.getSize() }}
													>
														{flexRender(header.column.columnDef.header, header.getContext())}
													</th>
												) : (
													<SortableTh
														key={header.id}
														id={header.id}
														size={header.getSize()}
													>
														{flexRender(header.column.columnDef.header, header.getContext())}
													</SortableTh>
												)
											)}
											<th className="nb-th nb-th-add-col">
												<button className="nb-add-col-btn" onClick={handleAddColumn} title="Adicionar campo">
													+
												</button>
											</th>
										</tr>
									</SortableContext>
								</DndContext>
							)
						})}
					</thead>

					<tbody className="nb-tbody">
						{tableRows.length === 0 ? (
							<tr>
								<td
									colSpan={columns.length + 1}
									className="nb-empty-rows"
								>
									Nenhum item encontrado
								</td>
							</tr>
						) : (
							tableRows.map(row => (
								<tr
									key={row.id}
									className="nb-row"
									onClick={() => setEditingCell(null)}
								>
									{row.getVisibleCells().map(cell => (
										<td
											key={cell.id}
											className="nb-td"
											style={{ width: cell.column.getSize() }}
											onClick={e => e.stopPropagation()}
										>
											{flexRender(cell.column.columnDef.cell, cell.getContext())}
										</td>
									))}
									<td className="nb-td nb-td-empty" />
								</tr>
							))
						)}
						<tr>
							<td colSpan={columns.length + 1} className="nb-add-row-td">
								<button className="nb-add-row-btn" onClick={handleAddRow}>
									+ Nova linha
								</button>
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			</CellContext.Provider>
		</div>
	)
}
