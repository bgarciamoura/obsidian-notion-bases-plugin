import { App, TFile } from 'obsidian'
import { MutableRefObject, useCallback, useEffect, useRef, useState, Dispatch, SetStateAction } from 'react'
import { DatabaseManager } from '../database-manager'
import {
	ColumnSchema, DatabaseConfig, DEFAULT_DATABASE_CONFIG, NoteRow, ViewConfig,
} from '../types'
import { evaluateFormulas } from '../formula-engine'
import { ActiveFilter, getColumnIconStatic } from '../components/filter-utils'
import { t } from '../i18n'

const CHUNK_SIZE = 200
const CHUNK_THRESHOLD = 100
const DEBOUNCE_MS = 50

interface UseDatabaseRowsOptions {
	app: App
	dbFile: TFile | null
	manager: DatabaseManager
	includeSubfolders?: boolean
	externalView: ViewConfig
	onLoaded?: (cfg: DatabaseConfig, rows: NoteRow[]) => void
}

interface UseDatabaseRowsResult {
	rows: NoteRow[]
	config: DatabaseConfig
	loading: boolean
	activeFilters: ActiveFilter[]
	setActiveFilters: Dispatch<SetStateAction<ActiveFilter[]>>
	reload: () => Promise<void>
}

async function processRowsInChunks(
	notes: TFile[],
	schema: ColumnSchema[],
	manager: DatabaseManager,
	versionRef: MutableRefObject<number>,
	currentVersion: number,
): Promise<NoteRow[] | null> {
	if (notes.length <= CHUNK_THRESHOLD) {
		return notes.map(f => manager.getNoteData(f, schema))
	}

	const result: NoteRow[] = []
	for (let i = 0; i < notes.length; i += CHUNK_SIZE) {
		if (versionRef.current !== currentVersion) return null

		const chunk = notes.slice(i, i + CHUNK_SIZE)
		result.push(...chunk.map(f => manager.getNoteData(f, schema)))

		if (i + CHUNK_SIZE < notes.length) {
			await new Promise<void>(resolve => setTimeout(resolve, 0))
		}
	}

	return versionRef.current === currentVersion ? result : null
}

function restoreFilterPills(
	pills: ViewConfig['activePills'],
	schema: ColumnSchema[],
): ActiveFilter[] {
	if (!pills || pills.length === 0) return []
	return pills.flatMap(p => {
		if (p.columnId === '_title') {
			return [{
				id: p.id ?? crypto.randomUUID(),
				columnId: '_title',
				columnName: t('name_column'),
				columnType: 'title',
				icon: '📄',
				operator: p.operator,
				value: p.value,
				conjunction: p.conjunction ?? 'and',
			}]
		}
		const col = schema.find(sc => sc.id === p.columnId)
		if (!col) return []
		return [{
			id: p.id ?? crypto.randomUUID(),
			columnId: col.id,
			columnName: col.name,
			columnType: col.type,
			icon: getColumnIconStatic(col.type),
			operator: p.operator,
			value: p.value,
			conjunction: p.conjunction ?? 'and',
		}]
	}) as ActiveFilter[]
}

export function useDatabaseRows(options: UseDatabaseRowsOptions): UseDatabaseRowsResult {
	const { app, dbFile, manager, includeSubfolders, externalView, onLoaded } = options

	const [rows, setRows] = useState<NoteRow[]>([])
	const [config, setConfig] = useState<DatabaseConfig>(DEFAULT_DATABASE_CONFIG)
	const [loading, setLoading] = useState(true)
	const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([])

	const loadVersion = useRef(0)
	const filtersInitialized = useRef(false)

	const loadData = useCallback(async () => {
		if (!dbFile) { setLoading(false); return }
		setLoading(true)
		const version = ++loadVersion.current

		const cfg = manager.readConfig(dbFile)
		const notes = manager.getNotesInDatabase(dbFile, includeSubfolders)

		if (cfg.schema.length === 0 && notes.length > 0) {
			cfg.schema = manager.inferSchema(notes)
			await manager.writeConfig(dbFile, cfg)
		}

		const rawRows = await processRowsInChunks(notes, cfg.schema, manager, loadVersion, version)
		if (!rawRows) return

		const noteRows = manager.resolveRollupsForRows(
			manager.resolveLookupsForRows(
				evaluateFormulas(rawRows, cfg.schema),
				cfg.schema,
			),
			cfg.schema,
		)

		if (loadVersion.current !== version) return

		if (!filtersInitialized.current) {
			filtersInitialized.current = true
			const pills = externalView.activePills ?? []
			setActiveFilters(restoreFilterPills(pills, cfg.schema))
		}

		setConfig(prev => ({ schema: cfg.schema, views: prev.views }))
		setRows(noteRows)
		onLoaded?.(cfg, noteRows)
		setLoading(false)
	}, [dbFile, manager, includeSubfolders, app, externalView, onLoaded])

	useEffect(() => { filtersInitialized.current = false }, [dbFile])

	useEffect(() => { void loadData() }, [loadData])

	useEffect(() => {
		let debounceTimer: ReturnType<typeof setTimeout> | null = null
		const onChange = () => {
			if (debounceTimer) clearTimeout(debounceTimer)
			debounceTimer = setTimeout(() => { void loadData() }, DEBOUNCE_MS)
		}
		app.vault.on('create', onChange)
		app.vault.on('delete', onChange)
		app.vault.on('rename', onChange)
		app.metadataCache.on('changed', onChange)
		return () => {
			if (debounceTimer) clearTimeout(debounceTimer)
			app.vault.off('create', onChange)
			app.vault.off('delete', onChange)
			app.vault.off('rename', onChange)
			app.metadataCache.off('changed', onChange)
		}
	}, [app, loadData])

	return { rows, config, loading, activeFilters, setActiveFilters, reload: loadData }
}
