// ── Dataview inline field parser (pure, no Obsidian deps) ───────────────────

export type InlineFieldFormat = 'standalone' | 'bracketed' | 'parenthesized'

export interface InlineField {
	key: string              // sanitized: lowercase, spaces→dashes, no markdown formatting
	rawKey: string           // original key as written
	value: unknown           // type-inferred value
	format: InlineFieldFormat
	rawValue: string         // original value string before type inference
	lineNumber: number       // 0-based line index within body (after frontmatter)
	fullMatch: string        // complete matched text for replacement
}

const FENCED_CODE_OPEN = /^(`{3,}|~{3,})/
const INLINE_CODE_RE = /`[^`]+`/g
const STANDALONE_RE = /^([A-Za-z0-9\u00C0-\u024F_ -]+)::\s*(.*)$/
const BRACKETED_RE = /\[([A-Za-z0-9\u00C0-\u024F_ -]+)::\s*([^\]]*)\]/g
const PARENTHESIZED_RE = /\(([A-Za-z0-9\u00C0-\u024F_ -]+)::\s*([^)]*)\)/g

function stripFrontmatter(content: string): string {
	const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/)
	return match ? content.slice(match[0].length) : content
}

export function frontmatterLineCount(content: string): number {
	const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/)
	if (!match) return 0
	return match[0].split(/\r?\n/).length - 1
}

export function sanitizeKey(raw: string): string {
	return raw
		.replace(/[*_~]/g, '')  // remove markdown formatting
		.trim()
		.toLowerCase()
		.replace(/\s+/g, '-')
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/
const WIKI_LINK_RE = /^\[\[.+\]\]$/
const NUMBER_RE = /^-?\d+(\.\d+)?$/

export function inferInlineFieldValue(raw: string): unknown {
	const trimmed = raw.trim()
	if (trimmed === '') return null
	if (trimmed === 'true') return true
	if (trimmed === 'false') return false
	if (NUMBER_RE.test(trimmed)) return Number(trimmed)
	if (ISO_DATE_RE.test(trimmed)) return trimmed
	if (WIKI_LINK_RE.test(trimmed)) return trimmed
	return trimmed
}

export function parseInlineFields(content: string): InlineField[] {
	const body = stripFrontmatter(content)
	const lines = body.split(/\r?\n/)
	const fields: InlineField[] = []

	let inCodeBlock = false
	let codeFence = ''

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]

		// Track fenced code blocks
		const fenceMatch = line.match(FENCED_CODE_OPEN)
		if (fenceMatch) {
			if (!inCodeBlock) {
				inCodeBlock = true
				codeFence = fenceMatch[1][0] // ` or ~
			} else if (line.trim().startsWith(codeFence)) {
				inCodeBlock = false
				codeFence = ''
			}
			continue
		}
		if (inCodeBlock) continue

		// Remove inline code spans before scanning
		const cleaned = line.replace(INLINE_CODE_RE, '')

		// Standalone: Key:: Value (must be at start of line, ignoring leading whitespace/list markers)
		const standaloneMatch = cleaned.match(STANDALONE_RE)
		if (standaloneMatch) {
			const rawKey = standaloneMatch[1].trim()
			const rawValue = standaloneMatch[2]
			fields.push({
				key: sanitizeKey(rawKey),
				rawKey,
				value: inferInlineFieldValue(rawValue),
				format: 'standalone',
				rawValue,
				lineNumber: i,
				fullMatch: `${rawKey}:: ${rawValue}`,
			})
		}

		// Bracketed: [key:: value]
		let match: RegExpExecArray | null
		BRACKETED_RE.lastIndex = 0
		while ((match = BRACKETED_RE.exec(cleaned)) !== null) {
			const rawKey = match[1].trim()
			const rawValue = match[2]
			fields.push({
				key: sanitizeKey(rawKey),
				rawKey,
				value: inferInlineFieldValue(rawValue),
				format: 'bracketed',
				rawValue,
				lineNumber: i,
				fullMatch: `[${match[1]}:: ${rawValue}]`,
			})
		}

		// Parenthesized: (key:: value)
		PARENTHESIZED_RE.lastIndex = 0
		while ((match = PARENTHESIZED_RE.exec(cleaned)) !== null) {
			const rawKey = match[1].trim()
			const rawValue = match[2]
			fields.push({
				key: sanitizeKey(rawKey),
				rawKey,
				value: inferInlineFieldValue(rawValue),
				format: 'parenthesized',
				rawValue,
				lineNumber: i,
				fullMatch: `(${match[1]}:: ${rawValue})`,
			})
		}
	}

	return fields
}
