import {
	App, Editor, EditorPosition, EditorSuggest, EditorSuggestContext,
	EditorSuggestTriggerInfo, TFile,
} from 'obsidian'
import { DatabaseManager } from './database-manager'
import { ColumnSchema } from './types'

/**
 * Autocomplete for select/multiselect/status values while typing frontmatter
 * in source mode (#71). When the edited note lives in a database folder and
 * the property matches a choice column of its schema, the schema options are
 * suggested — same list that drives the views.
 *
 * The native Properties panel cannot be extended through the public API, so
 * this covers the source-editing path only.
 */
export class SelectOptionSuggest extends EditorSuggest<string> {
	private options: string[] = []

	constructor(app: App, private manager: DatabaseManager) {
		super(app)
	}

	onTrigger(cursor: EditorPosition, editor: Editor, file: TFile | null): EditorSuggestTriggerInfo | null {
		if (!file) return null

		// Only inside the frontmatter block
		const fmEnd = this.app.metadataCache.getFileCache(file)?.frontmatterPosition?.end.line
		if (fmEnd === undefined || cursor.line >= fmEnd || cursor.line === 0) return null

		const line = editor.getLine(cursor.line)
		let key: string | null = null
		let valueStart: number

		const inline = /^([^\s:][^:]*):\s*/.exec(line)
		const listItem = /^(\s*-\s+)/.exec(line)
		if (inline) {
			key = inline[1].trim()
			valueStart = inline[0].length
		} else if (listItem) {
			// A "- item" line: the key is the closest "key:" line above it
			valueStart = listItem[1].length
			for (let l = cursor.line - 1; l > 0; l--) {
				const prev = editor.getLine(l)
				if (/^\s*-\s+/.test(prev)) continue
				const m = /^([^\s:][^:]*):\s*$/.exec(prev)
				key = m ? m[1].trim() : null
				break
			}
		} else {
			return null
		}
		if (!key || cursor.ch < valueStart) return null

		const col = this.findChoiceColumn(file, key)
		if (!col?.options?.length) return null
		this.options = col.options.map(o => o.value).filter(Boolean)
		if (this.options.length === 0) return null

		return {
			start: { line: cursor.line, ch: valueStart },
			end: { line: cursor.line, ch: line.length },
			query: line.slice(valueStart, cursor.ch),
		}
	}

	private findChoiceColumn(file: TFile, key: string): ColumnSchema | null {
		const dbFile = this.manager.findGoverningDatabase(file)
		if (!dbFile) return null
		const { schema } = this.manager.readConfig(dbFile)
		return schema.find(c =>
			(c.type === 'select' || c.type === 'multiselect' || c.type === 'status') &&
			(c.id === key || c.name.toLowerCase() === key.toLowerCase())
		) ?? null
	}

	getSuggestions(context: EditorSuggestContext): string[] {
		const q = context.query.trim().toLowerCase()
		const matches = q ? this.options.filter(o => o.toLowerCase().includes(q)) : this.options
		return matches.slice(0, 20)
	}

	renderSuggestion(value: string, el: HTMLElement): void {
		el.setText(value)
	}

	selectSuggestion(value: string): void {
		const ctx = this.context
		if (!ctx) return
		ctx.editor.replaceRange(value, ctx.start, ctx.end)
		ctx.editor.setCursor({ line: ctx.start.line, ch: ctx.start.ch + value.length })
		this.close()
	}
}
