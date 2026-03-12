import { App, TFile, normalizePath } from 'obsidian'
import {
	ColumnSchema,
	ColumnType,
	DatabaseConfig,
	DEFAULT_DATABASE_CONFIG,
	DEFAULT_VIEW,
	NoteRow,
} from './types'

export const DATABASE_MARKER = 'notion-bases'

export class DatabaseManager {
	constructor(private app: App, private databaseFileName: string) {}

	// ── Identificação ──────────────────────────────────────────────────────

	isDatabaseFile(file: TFile): boolean {
		const cache = this.app.metadataCache.getFileCache(file)
		return cache?.frontmatter?.[DATABASE_MARKER] === true
	}

	getDatabaseFileInFolder(folderPath: string): TFile | null {
		const path = normalizePath(
			folderPath ? `${folderPath}/${this.databaseFileName}` : this.databaseFileName
		)
		return this.app.vault.getFileByPath(path) ?? null
	}

	// ── Config (schema + views) ────────────────────────────────────────────

	async readConfig(file: TFile): Promise<DatabaseConfig> {
		const cache = this.app.metadataCache.getFileCache(file)
		const fm = cache?.frontmatter
		if (!fm || !fm[DATABASE_MARKER]) return structuredClone(DEFAULT_DATABASE_CONFIG)

		return {
			schema: Array.isArray(fm.schema) ? fm.schema as ColumnSchema[] : [],
			views: Array.isArray(fm.views) && fm.views.length > 0 ? fm.views : [DEFAULT_VIEW],
		}
	}

	async writeConfig(file: TFile, config: DatabaseConfig): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, fm => {
			fm[DATABASE_MARKER] = true
			fm.schema = config.schema
			fm.views = config.views
		})
	}

	// ── Notas / linhas ─────────────────────────────────────────────────────

	getNotesInDatabase(dbFile: TFile): TFile[] {
		const folder = dbFile.parent
		if (!folder) return []

		return folder.children
			.filter((child): child is TFile =>
				child instanceof TFile &&
				child.extension === 'md' &&
				child.path !== dbFile.path
			)
			.sort((a, b) => a.basename.localeCompare(b.basename))
	}

	getNoteData(file: TFile, schema: ColumnSchema[]): NoteRow {
		const cache = this.app.metadataCache.getFileCache(file)
		const fm = cache?.frontmatter ?? {}

		const row: NoteRow = {
			_file: file,
			_title: file.basename,
		}

		for (const col of schema) {
			if (col.type === 'formula') continue
			row[col.id] = fm[col.id] ?? null
		}

		return row
	}

	async updateNoteField(file: TFile, fieldId: string, value: unknown): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, fm => {
			if (value === null || value === undefined || value === '') {
				delete fm[fieldId]
			} else {
				fm[fieldId] = value
			}
		})
	}

	async renameNote(file: TFile, newBasename: string): Promise<void> {
		if (!newBasename.trim() || newBasename === file.basename) return
		const newPath = normalizePath(
			`${file.parent?.path ?? ''}/${newBasename.trim()}.md`
		)
		await this.app.fileManager.renameFile(file, newPath)
	}

	async createNote(dbFile: TFile): Promise<TFile> {
		const folderPath = dbFile.parent?.path ?? ''
		const base = normalizePath(`${folderPath}/Sem título`)
		let path = `${base}.md`
		let i = 1
		while (this.app.vault.getFileByPath(path)) {
			path = `${base} ${i++}.md`
		}
		return this.app.vault.create(path, '---\n---\n')
	}

	// ── Operações em lote ──────────────────────────────────────────────────

	async deleteNotes(files: TFile[]): Promise<void> {
		for (const file of files) {
			await this.app.vault.delete(file)
		}
	}

	async duplicateNotes(files: TFile[]): Promise<void> {
		for (const file of files) {
			const folderPath = file.parent?.path ?? ''
			let path = normalizePath(`${folderPath}/${file.basename} (cópia).md`)
			let i = 2
			while (this.app.vault.getFileByPath(path)) {
				path = normalizePath(`${folderPath}/${file.basename} (cópia ${i++}).md`)
			}
			const content = await this.app.vault.read(file)
			await this.app.vault.create(path, content)
		}
	}

	async moveNotes(files: TFile[], targetFolderPath: string): Promise<void> {
		for (const file of files) {
			const newPath = normalizePath(`${targetFolderPath}/${file.name}`)
			await this.app.fileManager.renameFile(file, newPath)
		}
	}

	// ── Criar banco de dados ───────────────────────────────────────────────

	async createDatabase(folderPath: string): Promise<TFile> {
		const path = normalizePath(
			folderPath
				? `${folderPath}/${this.databaseFileName}`
				: this.databaseFileName
		)

		if (this.app.vault.getFileByPath(path)) {
			throw new Error(`Já existe um banco de dados em "${folderPath || '/'}"`)
		}

		const content = [
			'---',
			`${DATABASE_MARKER}: true`,
			'schema: []',
			'views:',
			'  - id: default',
			'    type: table',
			'    filters: []',
			'    sorts: []',
			'    hiddenColumns: []',
			'    columnWidths: {}',
			'---',
			'',
			'> [!tip] Notion Bases',
			'> Este arquivo é um banco de dados. Abra-o para ver a visualização de tabela.',
			'',
		].join('\n')

		return this.app.vault.create(path, content)
	}

	// ── Inferir schema ─────────────────────────────────────────────────────

	inferSchema(notes: TFile[]): ColumnSchema[] {
		const fieldMap = new Map<string, unknown[]>()

		for (const note of notes) {
			const cache = this.app.metadataCache.getFileCache(note)
			const fm = cache?.frontmatter
			if (!fm) continue

			for (const [key, value] of Object.entries(fm)) {
				if (key === 'position') continue // chave interna do Obsidian
				if (!fieldMap.has(key)) fieldMap.set(key, [])
				if (value !== null && value !== undefined) {
					fieldMap.get(key)!.push(value)
				}
			}
		}

		return Array.from(fieldMap.entries()).map(([key, values]) => {
			const type = this.inferType(key, values)
			const options = (type === 'select' || type === 'multiselect')
				? this.extractOptions(values, type)
				: undefined

			return {
				id: key,
				name: this.toDisplayName(key),
				type,
				visible: true,
				width: type === 'title' || type === 'text' ? 200 : 140,
				options,
			} satisfies ColumnSchema
		})
	}

	private inferType(key: string, values: unknown[]): ColumnType {
		if (key === 'tags') return 'multiselect'
		if (['date', 'created', 'modified', 'due'].includes(key) ||
			key.endsWith('_date') || key.endsWith('_at') || key.endsWith('At')) {
			return 'date'
		}
		if (['status', 'priority', 'type', 'category', 'stage'].includes(key)) {
			return 'select'
		}
		if (['done', 'completed', 'archived', 'published', 'pinned'].includes(key)) {
			return 'checkbox'
		}

		const nonNull = values.filter(v => v !== null && v !== undefined)
		if (nonNull.length === 0) return 'text'

		if (nonNull.every(v => typeof v === 'boolean')) return 'checkbox'
		if (nonNull.every(v => typeof v === 'number')) return 'number'
		if (nonNull.every(v => Array.isArray(v))) return 'multiselect'

		// Baixa cardinalidade → select
		const unique = new Set(nonNull.map(String))
		if (unique.size <= 8) return 'select'

		return 'text'
	}

	private extractOptions(values: unknown[], type: ColumnType) {
		const unique = new Set<string>()

		for (const v of values) {
			if (type === 'multiselect' && Array.isArray(v)) {
				for (const item of v) unique.add(String(item))
			} else if (v !== null && v !== undefined) {
				unique.add(String(v))
			}
		}

		return Array.from(unique).map(value => ({ value }))
	}

	private toDisplayName(key: string): string {
		return key
			.replace(/_/g, ' ')
			.replace(/([a-z])([A-Z])/g, '$1 $2')
			.replace(/^./, c => c.toUpperCase())
	}

	// ── Renomear coluna (id + nome + frontmatter das notas) ────────────────

	async renameColumn(
		dbFile: TFile,
		config: DatabaseConfig,
		oldId: string,
		newName: string,
	): Promise<DatabaseConfig> {
		const newId = this.uniqueSlug(newName, config.schema, oldId)
		const keyChanged = newId !== oldId

		// Atualizar frontmatter de todas as notas que possuem a chave antiga
		if (keyChanged) {
			const notes = this.getNotesInDatabase(dbFile)
			for (const note of notes) {
				const cache = this.app.metadataCache.getFileCache(note)
				if (cache?.frontmatter && oldId in cache.frontmatter) {
					await this.app.fileManager.processFrontMatter(note, fm => {
						fm[newId] = fm[oldId]
						delete fm[oldId]
					})
				}
			}
		}

		// Atualizar schema
		const newSchema = config.schema.map(col =>
			col.id === oldId ? { ...col, id: newId, name: newName } : col
		)
		const newConfig: DatabaseConfig = { ...config, schema: newSchema }
		await this.writeConfig(dbFile, newConfig)

		return newConfig
	}

	private slugify(name: string): string {
		return name
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')   // remove acentos
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '')
			.replace(/_+/g, '_')
			|| 'campo'
	}

	private uniqueSlug(name: string, schema: ColumnSchema[], excludeId?: string): string {
		const base = this.slugify(name)
		const taken = new Set(schema.filter(c => c.id !== excludeId).map(c => c.id))
		if (!taken.has(base)) return base
		let i = 2
		while (taken.has(`${base}_${i}`)) i++
		return `${base}_${i}`
	}
}
