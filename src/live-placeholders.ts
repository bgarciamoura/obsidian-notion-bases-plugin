import { App, MarkdownPostProcessorContext, MarkdownRenderChild, TFile } from 'obsidian'
import { DatabaseManager } from './database-manager'
import { ColumnSchema } from './types'
import { formatCellValueNodes } from './format-cell-value'

const PLACEHOLDER_RE = /\{\{([a-zA-Z0-9_-]+)(?::([^}]+))?\}\}/g
const SKIP_TAGS = new Set(['CODE', 'PRE', 'SCRIPT', 'STYLE', 'KBD'])

function getMoment(): ((d?: Date | string) => { format: (fmt: string) => string }) | null {
	return (window as unknown as { moment?: (d?: Date | string) => { format: (fmt: string) => string } }).moment ?? null
}

function resolveBuiltin(id: string, formatHint: string | undefined, file: TFile): string | null {
	const moment = getMoment()
	const now = new Date()
	switch (id) {
		case 'title': return file.basename
		case 'folder': return file.parent?.path ?? ''
		case 'date': return moment ? moment(now).format(formatHint || 'YYYY-MM-DD') : now.toISOString().slice(0, 10)
		case 'time': return moment ? moment(now).format(formatHint || 'HH:mm') : now.toTimeString().slice(0, 5)
		default: return null
	}
}

function resolveNodes(
	id: string,
	formatHint: string | undefined,
	schema: ColumnSchema[],
	frontmatter: Record<string, unknown>,
	file: TFile,
): Node[] | null {
	const builtin = resolveBuiltin(id, formatHint, file)
	if (builtin !== null) return [document.createTextNode(builtin)]
	const col = schema.find(c => c.id === id)
	const value = frontmatter[id]
	if (value === undefined) return null
	return formatCellValueNodes(value, col, formatHint)
}

function makePlaceholderSpan(id: string, formatHint: string | undefined): HTMLSpanElement {
	const span = document.createElement('span')
	span.className = 'nb-placeholder'
	span.dataset.token = id
	if (formatHint) span.dataset.format = formatHint
	span.textContent = formatHint ? `{{${id}:${formatHint}}}` : `{{${id}}}`
	return span
}

function wrapTextNode(textNode: Text): boolean {
	const text = textNode.nodeValue ?? ''
	if (!text.includes('{{')) return false

	PLACEHOLDER_RE.lastIndex = 0
	const parts: Node[] = []
	let lastIdx = 0
	let match: RegExpExecArray | null
	let matched = false

	while ((match = PLACEHOLDER_RE.exec(text)) !== null) {
		matched = true
		if (match.index > lastIdx) parts.push(document.createTextNode(text.slice(lastIdx, match.index)))
		parts.push(makePlaceholderSpan(match[1], match[2]))
		lastIdx = match.index + match[0].length
	}

	if (!matched) return false
	if (lastIdx < text.length) parts.push(document.createTextNode(text.slice(lastIdx)))

	const parent = textNode.parentNode
	if (!parent) return false
	for (const part of parts) parent.insertBefore(part, textNode)
	parent.removeChild(textNode)
	return true
}

function wrapAllPlaceholders(root: HTMLElement): boolean {
	const nodes: Text[] = []
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
		acceptNode: (node) => {
			let parent = node.parentElement
			while (parent) {
				if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT
				if (parent.classList.contains('nb-database-embed')) return NodeFilter.FILTER_REJECT
				parent = parent.parentElement
			}
			return (node.nodeValue && node.nodeValue.includes('{{')) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
		},
	})
	let n = walker.nextNode()
	while (n) { nodes.push(n as Text); n = walker.nextNode() }
	let any = false
	for (const node of nodes) { if (wrapTextNode(node)) any = true }
	return any
}

class PlaceholderChild extends MarkdownRenderChild {
	private listener?: (file: TFile) => void

	constructor(
		containerEl: HTMLElement,
		private app: App,
		private manager: DatabaseManager,
		private file: TFile,
	) {
		super(containerEl)
	}

	onload(): void {
		this.render()
		this.listener = (file: TFile) => {
			if (file.path === this.file.path) this.render()
		}
		this.app.metadataCache.on('changed', this.listener)
	}

	onunload(): void {
		if (this.listener) this.app.metadataCache.off('changed', this.listener)
	}

	private render(): void {
		const fm = this.app.metadataCache.getFileCache(this.file)?.frontmatter as Record<string, unknown> | undefined
		const frontmatter = fm ?? {}
		const folderPath = this.file.parent?.path ?? ''
		const dbFile = this.manager.getDatabaseFileInFolder(folderPath)
		const schema: ColumnSchema[] = dbFile ? this.manager.readConfig(dbFile).schema : []

		const spans = this.containerEl.querySelectorAll<HTMLSpanElement>('span.nb-placeholder')
		spans.forEach(span => {
			const id = span.dataset.token ?? ''
			const fmt = span.dataset.format || undefined
			if (!id) return
			const nodes = resolveNodes(id, fmt, schema, frontmatter, this.file)
			if (nodes === null) {
				span.textContent = fmt ? `{{${id}:${fmt}}}` : `{{${id}}}`
				return
			}
			span.replaceChildren(...nodes)
		})
	}
}

export function createLivePlaceholderProcessor(app: App, manager: DatabaseManager) {
	return (el: HTMLElement, ctx: MarkdownPostProcessorContext): void => {
		const file = app.vault.getFileByPath(ctx.sourcePath)
		if (!file) return
		if (manager.isDatabaseFile(file)) return

		const anyWrapped = wrapAllPlaceholders(el)
		if (!anyWrapped) return

		ctx.addChild(new PlaceholderChild(el, app, manager, file))
	}
}
