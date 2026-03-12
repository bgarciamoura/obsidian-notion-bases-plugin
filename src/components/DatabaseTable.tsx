import {
	useReactTable,
	getCoreRowModel,
	getSortedRowModel,
	getFilteredRowModel,
	flexRender,
	ColumnDef,
	SortingState,
	ColumnFiltersState,
} from '@tanstack/react-table'
import { TFile } from 'obsidian'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { useApp } from '../context'
import { DatabaseManager } from '../database-manager'
import { ColumnSchema, DatabaseConfig, NoteRow, DEFAULT_DATABASE_CONFIG } from '../types'
import { ColumnHeader } from './ColumnHeader'
import { CellRenderer, CellContext } from './cells/CellRenderer'

interface DatabaseTableProps {
	dbFile: TFile | null
	manager: DatabaseManager
}

export function DatabaseTable({ dbFile, manager }: DatabaseTableProps) {
	const app = useApp()
	const [config, setConfig] = useState<DatabaseConfig>(DEFAULT_DATABASE_CONFIG)
	const [rows, setRows] = useState<NoteRow[]>([])
	const [sorting, setSorting] = useState<SortingState>([])
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
	const [globalFilter, setGlobalFilter] = useState('')
	const [editingCell, setEditingCell] = useState<{ rowIndex: number; columnId: string } | null>(null)
	const [loading, setLoading] = useState(true)

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

		setConfig(cfg)
		setRows(noteRows)
		setLoading(false)
	}, [dbFile, manager])

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

	// ── Colunas TanStack Table ───────────────────────────────────────────────

	const columns = useMemo<ColumnDef<NoteRow>[]>(() => {
		const cols: ColumnDef<NoteRow>[] = []

		// Coluna título (sempre primeira)
		cols.push({
			id: '_title',
			accessorFn: row => row._title,
			size: config.views[0]?.columnWidths['_title'] ?? 260,
			enableColumnFilter: true,
			header: () => (
				<div className="nb-header-title">
					<span>📄</span>
					<span>Nome</span>
				</div>
			),
			cell: info => (
				<CellRenderer
					col={{ id: '_title', name: 'Nome', type: 'title', visible: true }}
					value={info.getValue<string>()}
					rowIndex={info.row.index}
					columnId="_title"
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
				filterFn: col.type === 'multiselect' ? 'arrIncludesSome' : 'includesString',
			})
		}

		return cols
	}, [config, updateSchema])

	// ── Instância da tabela ──────────────────────────────────────────────────

	const table = useReactTable({
		data: rows,
		columns,
		state: { sorting, columnFilters, globalFilter },
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		onGlobalFilterChange: setGlobalFilter,
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
		await manager.createNote(dbFile)
		// loadData será chamado pelo evento vault.on('create')
	}

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
				<input
					className="nb-search"
					type="text"
					placeholder="Buscar..."
					value={globalFilter}
					onChange={e => setGlobalFilter(e.target.value)}
				/>
				<span className="nb-row-count">
					{tableRows.length} {tableRows.length === 1 ? 'item' : 'itens'}
				</span>
			</div>

			{/* Tabela */}
			<CellContext.Provider value={{ editingCell, setEditingCell, updateCell, schema: config.schema }}>
			<div className="nb-table-wrapper">
				<table className="nb-table">
					<thead className="nb-thead">
						{table.getHeaderGroups().map(group => (
							<tr key={group.id} className="nb-header-row">
								{group.headers.map(header => (
									<th
										key={header.id}
										className="nb-th"
										style={{ width: header.getSize() }}
									>
										{flexRender(header.column.columnDef.header, header.getContext())}
									</th>
								))}
								{/* Botão adicionar coluna */}
								<th className="nb-th nb-th-add-col">
									<button className="nb-add-col-btn" onClick={handleAddColumn} title="Adicionar campo">
										+
									</button>
								</th>
							</tr>
						))}
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
					</tbody>
				</table>
			</div>

			</CellContext.Provider>

			{/* Botão adicionar linha */}
			<button className="nb-add-row-btn" onClick={handleAddRow}>
				+ Nova linha
			</button>
		</div>
	)
}
