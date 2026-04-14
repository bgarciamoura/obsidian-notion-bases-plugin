import { App, MarkdownPostProcessorContext, TFile } from 'obsidian'
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

function resolvePlaceholder(
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

function processTextNode(
	textNode: Text,
	schema: ColumnSchema[],
	frontmatter: Record<string, unknown>,
	file: TFile,
): void {
	const text = textNode.nodeValue ?? ''
	if (!text.includes('{{')) return

	let match: RegExpExecArray | null
	let lastIdx = 0
	const parts: Node[] = []
	let matched = false

	PLACEHOLDER_RE.lastIndex = 0
	while ((match = PLACEHOLDER_RE.exec(text)) !== null) {
		const replacement = resolvePlaceholder(match[1], match[2], schema, frontmatter, file)
		if (replacement === null) continue

		matched = true
		if (match.index > lastIdx) parts.push(document.createTextNode(text.slice(lastIdx, match.index)))
		parts.push(...replacement)
		lastIdx = match.index + match[0].length
	}

	if (!matched) return
	if (lastIdx < text.length) parts.push(document.createTextNode(text.slice(lastIdx)))

	const parent = textNode.parentNode
	if (!parent) return
	for (const part of parts) parent.insertBefore(part, textNode)
	parent.removeChild(textNode)
}

function walkTextNodes(
	root: Node,
	schema: ColumnSchema[],
	frontmatter: Record<string, unknown>,
	file: TFile,
): void {
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
	for (const node of nodes) processTextNode(node, schema, frontmatter, file)
}

export function createLivePlaceholderProcessor(app: App, manager: DatabaseManager) {
	return (el: HTMLElement, ctx: MarkdownPostProcessorContext): void => {
		const file = app.vault.getFileByPath(ctx.sourcePath)
		if (!file) return
		// Skip the database file itself — its body shouldn't be substituted.
		if (manager.isDatabaseFile(file)) return

		const fm = app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined
		const frontmatter = fm ?? {}

		const folderPath = file.parent?.path ?? ''
		const dbFile = manager.getDatabaseFileInFolder(folderPath)
		const schema: ColumnSchema[] = dbFile ? manager.readConfig(dbFile).schema : []

		walkTextNodes(el, schema, frontmatter, file)
	}
}
