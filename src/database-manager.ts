import { App, TFile, TFolder, normalizePath, parseYaml } from 'obsidian'
import { t } from './i18n'
import {
	ColumnSchema,
	ColumnType,
	DatabaseConfig,
	DEFAULT_DATABASE_CONFIG,
	DEFAULT_VIEW,
	FolderArrangementConfig,
	InlineFieldMeta,
	NoteRow,
	RollupFunction,
	ViewConfig,
} from './types'
import { parseInlineFields, frontmatterLineCount } from './inline-fields'
import { TemplatePickerModal } from './template-picker-modal'

export const DATABASE_MARKER = 'notion-bases'

export function sanitizeSegment(s: string): string {
	return s.replace(/[/\\:*?"<>|]/g, '').replace(/\s+/g, ' ').trim()
}

export class DatabaseManager {
	readInlineFields = false
	pageSize = 0

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

	readConfig(file: TFile): DatabaseConfig {
		const cache = this.app.metadataCache.getFileCache(file)
		const fm = cache?.frontmatter as Record<string, unknown> | undefined
		if (!fm || !fm[DATABASE_MARKER]) return structuredClone(DEFAULT_DATABASE_CONFIG)

		const rawSchema = Array.isArray(fm['schema']) ? fm['schema'] as ColumnSchema[] : []
		// Sanitize: remove corrupted or internal entries
		const schema = rawSchema.filter(col =>
			col.id &&
			typeof col.id === 'string' &&
			!col.id.startsWith('notion-bases') &&
			col.type &&
			!(col.options?.some(o => o.value === '[object Object]'))
		)

		const rawArrangement = fm['folderArrangement']
		let folderArrangement: FolderArrangementConfig | undefined
		if (rawArrangement && typeof rawArrangement === 'object' && !Array.isArray(rawArrangement)) {
			const r = rawArrangement as Record<string, unknown>
			const ids = Array.isArray(r['propertyIds']) ? (r['propertyIds'] as unknown[]).filter((v): v is string => typeof v === 'string') : []
			folderArrangement = { enabled: r['enabled'] === true, propertyIds: ids }
		}

		return {
			schema,
			views: Array.isArray(fm['views']) && (fm['views'] as unknown[]).length > 0 ? fm['views'] as ViewConfig[] : [DEFAULT_VIEW],
			templatePath: typeof fm['templatePath'] === 'string' && fm['templatePath'] ? fm['templatePath'] : undefined,
			askTemplateOnCreate: fm['askTemplateOnCreate'] === true,
			folderArrangement,
		}
	}

	async writeConfig(file: TFile, config: DatabaseConfig): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			fm[DATABASE_MARKER] = true
			fm['schema'] = config.schema
			fm['views'] = config.views
			if (config.templatePath) fm['templatePath'] = config.templatePath
			else delete fm['templatePath']
			if (config.askTemplateOnCreate) fm['askTemplateOnCreate'] = true
			else delete fm['askTemplateOnCreate']
			if (config.folderArrangement && config.folderArrangement.propertyIds.length > 0) {
				fm['folderArrangement'] = {
					enabled: !!config.folderArrangement.enabled,
					propertyIds: config.folderArrangement.propertyIds,
				}
			} else {
				delete fm['folderArrangement']
			}
		})
	}

	// ── Notas / linhas ─────────────────────────────────────────────────────

	getNotesInDatabase(dbFile: TFile, includeSubfolders?: boolean): TFile[] {
		const folder = dbFile.parent ?? this.app.vault.getRoot()
		if (!folder) return []

		if (includeSubfolders) {
			const files: TFile[] = []
			const collect = (f: TFolder) => {
				for (const child of f.children) {
					if (child instanceof TFile && child.extension === 'md' && child.path !== dbFile.path) {
						files.push(child)
					} else if (child instanceof TFolder) {
						collect(child)
					}
				}
			}
			collect(folder)
			return files.sort((a, b) => a.basename.localeCompare(b.basename))
		}

		return folder.children
			.filter((child): child is TFile =>
				child instanceof TFile &&
				child.extension === 'md' &&
				child.path !== dbFile.path
			)
			.sort((a, b) => a.basename.localeCompare(b.basename))
	}

	/** Sync read from frontmatter only — used by lookup/rollup resolvers */
	getNoteDataSync(file: TFile, schema: ColumnSchema[]): NoteRow {
		const cache = this.app.metadataCache.getFileCache(file)
		const fm = cache?.frontmatter ?? {}

		const row: NoteRow = {
			_file: file,
			_title: file.basename,
		}

		for (const col of schema) {
			if (col.type === 'formula' || col.type === 'lookup' || col.type === 'rollup') continue
			row[col.id] = fm[col.id] ?? null
		}

		return row
	}

	async getNoteData(file: TFile, schema: ColumnSchema[]): Promise<NoteRow> {
		const row = this.getNoteDataSync(file, schema)

		// Merge inline fields (frontmatter wins on conflicts)
		if (this.readInlineFields) {
			const content = await this.app.vault.cachedRead(file)
			const inlineFields = parseInlineFields(content)
			const fmLines = frontmatterLineCount(content)
			const inlineMeta: Record<string, InlineFieldMeta> = {}

			for (const field of inlineFields) {
				const col = schema.find(c => c.id === field.key)
				if (col && row[col.id] == null) {
					// Convert comma-separated strings to arrays for multiselect columns
					if (col.type === 'multiselect' && typeof field.value === 'string') {
						row[col.id] = field.value.split(',').map(s => s.trim()).filter(Boolean)
					} else {
						row[col.id] = field.value
					}
					inlineMeta[col.id] = {
						format: field.format,
						rawKey: field.rawKey,
						rawValue: field.rawValue,
						lineNumber: fmLines + field.lineNumber,
						fullMatch: field.fullMatch,
					}
				}
			}

			if (Object.keys(inlineMeta).length > 0) {
				row._inlineFields = inlineMeta
			}
		}

		return row
	}

	async updateNoteField(
		file: TFile,
		fieldId: string,
		value: unknown,
		inlineFields?: Record<string, InlineFieldMeta>,
	): Promise<void> {
		const meta = inlineFields?.[fieldId]

		if (meta && this.readInlineFields) {
			if (value === null || value === undefined || value === '') {
				await this.removeInlineField(file, meta)
			} else {
				await this.updateInlineField(file, value, meta)
			}
		} else {
			await this.updateFrontmatterField(file, fieldId, value)
		}
	}

	private async updateFrontmatterField(file: TFile, fieldId: string, value: unknown): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			if (value === null || value === undefined || value === '') {
				delete fm[fieldId]
			} else {
				fm[fieldId] = value
			}
		})
	}

	private async updateInlineField(file: TFile, value: unknown, meta: InlineFieldMeta): Promise<void> {
		const content = await this.app.vault.read(file)
		const idx = content.indexOf(meta.fullMatch)

		if (idx === -1) {
			// Fallback: field was moved/deleted externally, write to frontmatter
			await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
				fm[meta.rawKey] = value
			})
			return
		}

		const serialized = this.serializeInlineValue(value)
		let newMatch: string
		switch (meta.format) {
		case 'standalone':
			newMatch = `${meta.rawKey}:: ${serialized}`
			break
		case 'bracketed':
			newMatch = `[${meta.rawKey}:: ${serialized}]`
			break
		case 'parenthesized':
			newMatch = `(${meta.rawKey}:: ${serialized})`
			break
		}

		const newContent = content.slice(0, idx) + newMatch + content.slice(idx + meta.fullMatch.length)
		await this.app.vault.modify(file, newContent)
	}

	private async removeInlineField(file: TFile, meta: InlineFieldMeta): Promise<void> {
		const content = await this.app.vault.read(file)
		const idx = content.indexOf(meta.fullMatch)
		if (idx === -1) return

		let newContent: string
		if (meta.format === 'standalone') {
			// Remove the entire line including the newline
			const lineStart = content.lastIndexOf('\n', idx - 1) + 1
			let lineEnd = content.indexOf('\n', idx + meta.fullMatch.length)
			if (lineEnd === -1) lineEnd = content.length
			else lineEnd += 1 // include the newline
			newContent = content.slice(0, lineStart) + content.slice(lineEnd)
		} else {
			// Bracketed/parenthesized: remove just the match
			newContent = content.slice(0, idx) + content.slice(idx + meta.fullMatch.length)
		}

		await this.app.vault.modify(file, newContent)
	}

	private serializeInlineValue(value: unknown): string {
		if (value === null || value === undefined) return ''
		if (Array.isArray(value)) return (value as string[]).join(', ')
		if (typeof value === 'string') return value
		if (typeof value === 'number' || typeof value === 'boolean') return String(value)
		return JSON.stringify(value)
	}

	async syncTwoWayRelation(
		sourceFile: TFile,
		col: ColumnSchema,
		oldValues: string[],
		newValues: string[],
	): Promise<void> {
		if (!col.pairedColumnId || !col.refDatabasePath) return

		const refDbFile = this.app.vault.getFileByPath(col.refDatabasePath)
		if (!refDbFile) return

		const refNotes = this.getNotesInDatabase(refDbFile)
		const sourceTitle = sourceFile.basename

		const added = newValues.filter(v => !oldValues.includes(v))
		const removed = oldValues.filter(v => !newValues.includes(v))

		for (const note of refNotes) {
			const cache = this.app.metadataCache.getFileCache(note)
			const fm = cache?.frontmatter ?? {}
			const noteVal = col.refColumnId === '_title' ? note.basename : String(fm[col.refColumnId!] ?? '')

			if (added.includes(noteVal)) {
				await this.app.fileManager.processFrontMatter(note, (fm2: Record<string, unknown>) => {
					const current = Array.isArray(fm2[col.pairedColumnId!]) ? fm2[col.pairedColumnId!] as string[] : (fm2[col.pairedColumnId!] ? [String(fm2[col.pairedColumnId!])] : [])
					if (!current.includes(sourceTitle)) {
						fm2[col.pairedColumnId!] = [...current, sourceTitle]
					}
				})
			}

			if (removed.includes(noteVal)) {
				await this.app.fileManager.processFrontMatter(note, (fm2: Record<string, unknown>) => {
					const current = Array.isArray(fm2[col.pairedColumnId!]) ? fm2[col.pairedColumnId!] as string[] : (fm2[col.pairedColumnId!] ? [String(fm2[col.pairedColumnId!])] : [])
					const updated = current.filter(v => v !== sourceTitle)
					if (updated.length > 0) {
						fm2[col.pairedColumnId!] = updated
					} else {
						delete fm2[col.pairedColumnId!]
					}
				})
			}
		}
	}

	async renameNote(file: TFile, newBasename: string): Promise<void> {
		if (!newBasename.trim() || newBasename === file.basename) return
		const newPath = normalizePath(
			`${file.parent?.path ?? ''}/${newBasename.trim()}.md`
		)
		await this.app.fileManager.renameFile(file, newPath)
	}

	async createNote(
		dbFile: TFile,
		initialFrontmatter?: Record<string, unknown>,
		templatePath?: string | null,
	): Promise<TFile> {
		const folderPath = dbFile.parent?.path ?? ''
		const base = normalizePath(`${folderPath}/${t('db_untitled_note')}`)
		let path = `${base}.md`
		let i = 1
		while (this.app.vault.getFileByPath(path)) {
			path = `${base} ${i++}.md`
		}
		const newFile = await this.app.vault.create(path, '---\n---\n')
		if (initialFrontmatter && Object.keys(initialFrontmatter).length > 0) {
			await this.app.fileManager.processFrontMatter(newFile, (fm: Record<string, unknown>) => {
				for (const [key, value] of Object.entries(initialFrontmatter)) {
					fm[key] = value
				}
			})
		}
		if (templatePath) {
			await this.applyTemplate(newFile, templatePath)
		}
		return newFile
	}

	/** createNote + automatic template resolution based on db config. Opens picker if askTemplateOnCreate is on. */
	async createNoteWithTemplate(dbFile: TFile, initialFrontmatter?: Record<string, unknown>): Promise<TFile> {
		const config = this.readConfig(dbFile)
		if (config.askTemplateOnCreate) {
			const templatePath = await new Promise<string | null>(resolve => {
				new TemplatePickerModal(this.app, (path) => resolve(path), config.templatePath ? this.folderOf(config.templatePath) : null).open()
			})
			return this.createNote(dbFile, initialFrontmatter, templatePath)
		}
		return this.createNote(dbFile, initialFrontmatter, config.templatePath ?? null)
	}

	private folderOf(path: string): string | null {
		const idx = path.lastIndexOf('/')
		return idx > 0 ? path.slice(0, idx) : null
	}

	/**
	 * Apply a template to a note: merges template frontmatter (existing row values win) and
	 * appends the template body. Substitutes {{title}}, {{folder}}, {{date}}, {{time}} (with
	 * optional moment format) in both frontmatter values and body.
	 */
	async applyTemplate(targetFile: TFile, templatePath: string): Promise<void> {
		const templateFile = this.app.vault.getFileByPath(normalizePath(templatePath))
		if (!templateFile) return

		const raw = await this.app.vault.read(templateFile)
		const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?/)
		const body = raw.replace(/^---\n[\s\S]*?\n---\n?/, '')

		const moment = (window as unknown as { moment?: (d?: Date) => { format: (fmt: string) => string } }).moment
		const now = new Date()
		const fmtDate = (fmt: string) => moment ? moment(now).format(fmt) : now.toISOString().slice(0, 10)
		const fmtTime = (fmt: string) => moment ? moment(now).format(fmt) : now.toTimeString().slice(0, 5)

		const substitute = (s: string) => s
			.replace(/\{\{title\}\}/g, targetFile.basename)
			.replace(/\{\{folder\}\}/g, targetFile.parent?.path ?? '')
			.replace(/\{\{date:([^}]+)\}\}/g, (_m, f) => fmtDate(String(f)))
			.replace(/\{\{time:([^}]+)\}\}/g, (_m, f) => fmtTime(String(f)))
			.replace(/\{\{date\}\}/g, fmtDate('YYYY-MM-DD'))
			.replace(/\{\{time\}\}/g, fmtTime('HH:mm'))

		const substituteDeep = (v: unknown): unknown => {
			if (typeof v === 'string') return substitute(v)
			if (Array.isArray(v)) return v.map(substituteDeep)
			if (v && typeof v === 'object') {
				const out: Record<string, unknown> = {}
				for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = substituteDeep(val)
				return out
			}
			return v
		}

		if (fmMatch) {
			let tplFm: Record<string, unknown> = {}
			try {
				const parsed: unknown = parseYaml(fmMatch[1])
				if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
					tplFm = substituteDeep(parsed) as Record<string, unknown>
				}
			} catch {
				tplFm = {}
			}
			if (Object.keys(tplFm).length > 0) {
				await this.app.fileManager.processFrontMatter(targetFile, (fm: Record<string, unknown>) => {
					for (const [k, v] of Object.entries(tplFm)) {
						const existing = fm[k]
						const isEmpty = existing === undefined || existing === null || existing === ''
						if (isEmpty) fm[k] = v
					}
				})
			}
		}

		if (body.trim()) {
			const current = await this.app.vault.read(targetFile)
			await this.app.vault.modify(targetFile, current + substitute(body))
		}
	}

	// ── Folder arrangement ─────────────────────────────────────────────────

	private folderArrangementInProgress = new Set<string>()

	/** Returns the database file that "governs" a row file (db located in any ancestor folder). */
	findGoverningDatabase(file: TFile): TFile | null {
		let folder = file.parent
		while (folder) {
			const db = this.getDatabaseFileInFolder(folder.path)
			if (db && db.path !== file.path) return db
			folder = folder.parent
		}
		return null
	}

	/**
	 * Compute the path a row file should live at given the database's folderArrangement config.
	 * Returns null if the file is already at the right place, the db file itself, or arrangement is off.
	 */
	computeArrangedPath(file: TFile, dbFile: TFile, config: DatabaseConfig): string | null {
		const arr = config.folderArrangement
		if (!arr || !arr.enabled || arr.propertyIds.length === 0) return null
		if (file.path === dbFile.path) return null

		const fm = this.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined
		const segments: string[] = []
		for (const id of arr.propertyIds) {
			const v = fm?.[id]
			if (v == null || v === '') break
			const raw = Array.isArray(v) ? (v[0] as unknown) : v
			if (raw == null || raw === '') break
			let str: string
			if (typeof raw === 'string') str = raw
			else if (typeof raw === 'number' || typeof raw === 'boolean' || typeof raw === 'bigint') str = String(raw)
			else continue
			const seg = sanitizeSegment(str)
			if (!seg) break
			segments.push(seg)
		}

		const dbFolder = dbFile.parent?.path ?? ''
		const targetFolder = [dbFolder, ...segments].filter(Boolean).join('/')
		const target = normalizePath(`${targetFolder ? `${targetFolder}/` : ''}${file.basename}.md`)
		if (target === file.path) return null
		return target
	}

	isArrangementInProgress(path: string): boolean {
		return this.folderArrangementInProgress.has(path)
	}

	/** Move the file to its arranged location if needed. Returns true if a move happened. */
	async applyArrangement(file: TFile, dbFile: TFile, config: DatabaseConfig): Promise<boolean> {
		const target = this.computeArrangedPath(file, dbFile, config)
		if (!target) return false
		if (this.folderArrangementInProgress.has(file.path)) return false

		const targetFolder = target.slice(0, target.lastIndexOf('/'))
		if (targetFolder) await this.ensureFolder(targetFolder)

		// Skip if a sibling with the same basename already exists at target
		if (this.app.vault.getFileByPath(target)) return false

		this.folderArrangementInProgress.add(file.path)
		this.folderArrangementInProgress.add(target)
		try {
			await this.app.fileManager.renameFile(file, target)
		} finally {
			setTimeout(() => {
				this.folderArrangementInProgress.delete(file.path)
				this.folderArrangementInProgress.delete(target)
			}, 500)
		}
		return true
	}

	/** Apply arrangement to every row in the database. Returns the list of moves performed. */
	async applyArrangementToAll(dbFile: TFile, config: DatabaseConfig, restrictToPaths?: Set<string>): Promise<{ from: string; to: string }[]> {
		const moves: { from: string; to: string }[] = []
		const notes = this.getNotesInDatabase(dbFile, true)
			.filter(n => !restrictToPaths || restrictToPaths.has(n.path))
		for (const note of notes) {
			const target = this.computeArrangedPath(note, dbFile, config)
			if (!target) continue
			const from = note.path
			const moved = await this.applyArrangement(note, dbFile, config)
			if (moved) moves.push({ from, to: target })
		}
		return moves
	}

	/** Compute (without applying) the moves that would happen for every row. */
	previewArrangement(dbFile: TFile, config: DatabaseConfig, restrictToPaths?: Set<string>): { file: TFile; from: string; to: string | null }[] {
		const notes = this.getNotesInDatabase(dbFile, true)
			.filter(n => !restrictToPaths || restrictToPaths.has(n.path))
		return notes.map(note => ({
			file: note,
			from: note.path,
			to: this.computeArrangedPath(note, dbFile, config),
		}))
	}

	private async ensureFolder(path: string): Promise<void> {
		const parts = path.split('/').filter(Boolean)
		let cur = ''
		for (const p of parts) {
			cur = cur ? `${cur}/${p}` : p
			if (!this.app.vault.getFolderByPath(cur)) {
				try { await this.app.vault.createFolder(cur) } catch { /* race: another caller created it */ }
			}
		}
	}

	// ── Lookup helpers ─────────────────────────────────────────────────────

	getAllDatabases(): TFile[] {
		return this.app.vault.getMarkdownFiles().filter(f => this.isDatabaseFile(f))
	}

	resolveLookupsForRows(rows: NoteRow[], schema: ColumnSchema[]): NoteRow[] {
		const lookupCols = schema.filter(c =>
			c.type === 'lookup' && c.refDatabasePath && c.refColumnId && c.refMatchColumnId
		)
		if (lookupCols.length === 0) return rows

		const refDataCache = new Map<string, NoteRow[]>()
		for (const col of lookupCols) {
			const path = col.refDatabasePath!
			if (!refDataCache.has(path)) {
				const refDbFile = this.app.vault.getFileByPath(path)
				if (!refDbFile) { refDataCache.set(path, []); continue }
				const refConfig = this.readConfig(refDbFile)
				const refNotes = this.getNotesInDatabase(refDbFile)
				const refRows = refNotes.map(f => this.getNoteDataSync(f, refConfig.schema))
				refDataCache.set(path, refRows)
			}
		}

		return rows.map(row => {
			const result = { ...row }
			for (const col of lookupCols) {
				const refRows = refDataCache.get(col.refDatabasePath!) ?? []
				const rawMatch = col.refMatchColumnId === '_title' ? row._title : row[col.refMatchColumnId!]
				const matchValue = String((rawMatch as string | number | boolean | null | undefined) ?? '')
				if (!matchValue) { result[col.id] = null; continue }
				const refRow = refRows.find(r => r._title === matchValue)
				result[col.id] = refRow ? (refRow[col.refColumnId!] ?? null) : null
			}
			return result
		})
	}

	resolveRollupsForRows(rows: NoteRow[], schema: ColumnSchema[]): NoteRow[] {
		const rollupCols = schema.filter(c =>
			c.type === 'rollup' && c.rollupRelationColumnId && c.rollupTargetColumnId && c.rollupFunction
		)
		if (rollupCols.length === 0) return rows

		const refDataCache = new Map<string, NoteRow[]>()
		for (const col of rollupCols) {
			const relationCol = schema.find(c => c.id === col.rollupRelationColumnId)
			if (!relationCol || relationCol.type !== 'relation' || !relationCol.refDatabasePath) continue
			const path = relationCol.refDatabasePath
			if (!refDataCache.has(path)) {
				const refDbFile = this.app.vault.getFileByPath(path)
				if (!refDbFile) { refDataCache.set(path, []); continue }
				const refConfig = this.readConfig(refDbFile)
				const refNotes = this.getNotesInDatabase(refDbFile)
				refDataCache.set(path, refNotes.map(f => this.getNoteDataSync(f, refConfig.schema)))
			}
		}

		return rows.map(row => {
			const result = { ...row }
			for (const col of rollupCols) {
				const relationCol = schema.find(c => c.id === col.rollupRelationColumnId)
				if (!relationCol || !relationCol.refDatabasePath) { result[col.id] = null; continue }
				const refRows = refDataCache.get(relationCol.refDatabasePath) ?? []
				const rawRelation = row[relationCol.id]
				const relatedTitles: string[] = Array.isArray(rawRelation)
					? rawRelation.filter((v): v is string => typeof v === 'string')
					: (typeof rawRelation === 'string' && rawRelation ? [rawRelation] : [])
				if (relatedTitles.length === 0) { result[col.id] = null; continue }
				const matchingRows = refRows.filter(r => relatedTitles.includes(r._title))
				const targetId = col.rollupTargetColumnId!
				const values = matchingRows.map(r => targetId === '_title' ? r._title : r[targetId]).filter(v => v !== null && v !== undefined)
				result[col.id] = this.applyRollupFunction(values, col.rollupFunction!)
			}
			return result
		})
	}

	private applyRollupFunction(values: unknown[], fn: RollupFunction): unknown {
		if (values.length === 0) return null
		switch (fn) {
			case 'count': return values.length
			case 'count_values': return new Set(values.map(v => String(v as string | number | boolean))).size
			case 'list': return values.map(v => String(v as string | number | boolean)).join(', ')
			case 'sum': { const nums = values.map(Number).filter(n => !isNaN(n)); return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) : null }
			case 'avg': { const nums = values.map(Number).filter(n => !isNaN(n)); return nums.length > 0 ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100 : null }
			case 'min': { const nums = values.map(Number).filter(n => !isNaN(n)); return nums.length > 0 ? Math.min(...nums) : null }
			case 'max': { const nums = values.map(Number).filter(n => !isNaN(n)); return nums.length > 0 ? Math.max(...nums) : null }
			default: return null
		}
	}

	// ── Operações em lote ──────────────────────────────────────────────────

	async deleteNotes(files: TFile[]): Promise<void> {
		for (const file of files) {
			await this.app.fileManager.trashFile(file)
		}
	}

	async duplicateNotes(files: TFile[]): Promise<void> {
		for (const file of files) {
			const folderPath = file.parent?.path ?? ''
			let path = normalizePath(`${folderPath}/${file.basename} ${t('db_copy_suffix')}.md`)
			let i = 2
			while (this.app.vault.getFileByPath(path)) {
				path = normalizePath(`${folderPath}/${file.basename} ${t('db_copy_suffix_n').replace('$n', String(i++))}.md`)
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
			throw new Error(t('db_already_exists').replace('$folder', folderPath || '/'))
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
			'> ' + t('db_tip_body'),
			'',
		].join('\n')

		return this.app.vault.create(path, content)
	}

	// ── Inferir schema ─────────────────────────────────────────────────────

	async inferSchema(notes: TFile[]): Promise<ColumnSchema[]> {
		const fieldMap = new Map<string, unknown[]>()

		for (const note of notes) {
			const cache = this.app.metadataCache.getFileCache(note)
			const fm = cache?.frontmatter
			if (!fm) continue

			for (const [key, value] of Object.entries(fm)) {
				if (key === 'position' || key.startsWith('notion-bases')) continue // internal keys
				if (!fieldMap.has(key)) fieldMap.set(key, [])
				if (value !== null && value !== undefined) {
					fieldMap.get(key)!.push(value)
				}
			}
		}

		// Also scan inline fields when enabled
		if (this.readInlineFields) {
			for (const note of notes) {
				const content = await this.app.vault.cachedRead(note)
				const inlineFields = parseInlineFields(content)
				for (const field of inlineFields) {
					if (!fieldMap.has(field.key)) fieldMap.set(field.key, [])
					if (field.value !== null && field.value !== undefined) {
						fieldMap.get(field.key)!.push(field.value)
					}
				}
			}
		}

		return Array.from(fieldMap.entries()).map(([key, values]) => {
			const type = this.inferType(key, values)
			const options = (type === 'select' || type === 'multiselect' || type === 'status')
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
		if (['audio', 'sound', 'music', 'recording'].includes(key) ||
			key.endsWith('_audio') || key.endsWith('_sound')) {
			return 'audio'
		}
		if (['video', 'clip', 'movie'].includes(key) ||
			key.endsWith('_video') || key.endsWith('_clip')) {
			return 'video'
		}

		const nonNull = values.filter(v => v !== null && v !== undefined)
		if (nonNull.length === 0) return 'text'

		if (nonNull.every(v => typeof v === 'boolean')) return 'checkbox'
		if (nonNull.every(v => typeof v === 'number')) return 'number'
		if (nonNull.every(v => Array.isArray(v))) return 'multiselect'

		const strs: string[] = nonNull.map(v => {
			if (typeof v === 'object' && v !== null) return JSON.stringify(v)
			if (typeof v === 'string') return v
			if (typeof v === 'number' || typeof v === 'boolean') return String(v)
			return ''
		})
		const looksLikeSentence = strs.some(s => s.length > 40 || (/\s/.test(s) && /[.!?,;:]/.test(s)))
		if (looksLikeSentence) return 'text'

		const unique = new Set(strs)
		if (unique.size <= 8 && unique.size < nonNull.length) return 'select'

		return 'text'
	}

	private extractOptions(values: unknown[], type: ColumnType) {
		const unique = new Set<string>()

		for (const v of values) {
			if (type === 'multiselect' && Array.isArray(v)) {
				for (const item of v) unique.add(String(item))
			} else if (v !== null && v !== undefined) {
				unique.add(String(v as string | number | boolean))
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
					await this.app.fileManager.processFrontMatter(note, (fm: Record<string, unknown>) => {
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
