import { getLanguage } from 'obsidian'
import { ColumnSchema, NumberFormat, SelectOption } from './types'

/** Locale de exibição para datas e números — segue o idioma da UI do Obsidian. */
export function displayLocale(): string {
	try {
		const lang = getLanguage()
		new Intl.NumberFormat(lang)
		return lang
	} catch {
		return 'en'
	}
}

const SELECT_COLORS = [
	'#e0e7ff', '#fce7f3', '#fef3c7', '#dcfce7', '#dbeafe', '#e9d5ff',
	'#fed7aa', '#fecaca', '#d1fae5', '#e0f2fe', '#fae8ff', '#fef9c3',
	'#ffd6d6', '#d6f0f0', '#f0d6f0', '#f0f0d6',
]

export function getOptionColor(options: SelectOption[], value: string): string {
	const opt = options.find(o => o.value === value)
	if (opt?.color) return opt.color
	const idx = options.findIndex(o => o.value === value)
	return SELECT_COLORS[idx % SELECT_COLORS.length] ?? '#e8e8e8'
}

export function getContrastTextColor(hex: string): string {
	const c = hex.replace('#', '')
	const r = parseInt(c.substring(0, 2), 16)
	const g = parseInt(c.substring(2, 4), 16)
	const b = parseInt(c.substring(4, 6), 16)
	const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
	return luminance > 0.5 ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.9)'
}

function formatNumber(value: number, fmt: NumberFormat | undefined): string {
	if (!fmt) return String(value)
	const opts: Intl.NumberFormatOptions = {
		minimumFractionDigits: fmt.decimals,
		maximumFractionDigits: fmt.decimals,
		useGrouping: fmt.thousandsSeparator,
	}
	let result = new Intl.NumberFormat(displayLocale(), opts).format(value)
	if (fmt.prefix) result = `${fmt.prefix} ${result}`
	if (fmt.suffix) result = `${result} ${fmt.suffix}`
	return result
}

export function getMoment(): ((d?: Date | string) => { format: (fmt: string) => string }) | null {
	return (window as unknown as { moment?: (d?: Date | string) => { format: (fmt: string) => string } }).moment ?? null
}

/**
 * Formats a raw date value for display. Precedence: explicit hint (embed
 * placeholder) → column dateFormat → locale-aware default without seconds
 * (moment 'L' / 'L LT', which follow the Obsidian UI language).
 */
export function formatDateText(raw: string, dateFormat?: string, formatHint?: string): string {
	if (!raw) return ''
	const moment = getMoment()
	if (!moment) return raw
	const hasTime = raw.includes('T') || / \d{1,2}:\d{2}/.test(raw)
	const fmt = formatHint || dateFormat || (hasTime ? 'L LT' : 'L')
	try { return moment(raw).format(fmt) } catch { return raw }
}

function toStr(v: unknown): string {
	if (v == null) return ''
	if (typeof v === 'string') return v
	if (typeof v === 'number' || typeof v === 'boolean') return String(v)
	if (typeof v === 'bigint') return v.toString()
	try { return JSON.stringify(v) } catch { return '' }
}

/** Plain text representation of a cell value, honoring the column's type and format. */
export function formatCellValueText(value: unknown, col: ColumnSchema | undefined, formatHint?: string): string {
	if (value == null || value === '') return ''

	if (!col) {
		if (Array.isArray(value)) return value.map(toStr).join(', ')
		return toStr(value)
	}

	switch (col.type) {
		case 'number': {
			const n = typeof value === 'number' ? value : Number(toStr(value))
			if (Number.isNaN(n)) return toStr(value)
			return formatNumber(n, col.numberFormat)
		}
		case 'date':
			return formatDateText(toStr(value), col.dateFormat, formatHint)
		case 'checkbox':
			return value ? '✓' : '✗'
		case 'multiselect':
		case 'relation':
			if (Array.isArray(value)) return value.map(toStr).join(', ')
			return toStr(value)
		default:
			if (Array.isArray(value)) return value.map(toStr).join(', ')
			return toStr(value)
	}
}

function makePill(text: string, color: string): HTMLSpanElement {
	const span = createSpan()
	span.className = 'nb-placeholder-pill'
	span.textContent = text
	span.style.background = color
	span.style.color = getContrastTextColor(color)
	return span
}

/**
 * Render a cell value as DOM nodes, honoring column type. For select/status the value is wrapped
 * in a colored pill; for multiselect, each option becomes its own pill separated by spaces.
 * For everything else a single text node is returned.
 */
export function formatCellValueNodes(value: unknown, col: ColumnSchema | undefined, formatHint?: string): Node[] {
	if (value == null || value === '') return [activeDocument.createTextNode('')]

	if (col?.type === 'select' || col?.type === 'status') {
		const text = toStr(value)
		return [makePill(text, getOptionColor(col.options ?? [], text))]
	}

	if (col?.type === 'multiselect' && Array.isArray(value)) {
		const nodes: Node[] = []
		value.forEach((v, i) => {
			const text = toStr(v)
			if (i > 0) nodes.push(activeDocument.createTextNode(' '))
			nodes.push(makePill(text, getOptionColor(col.options ?? [], text)))
		})
		return nodes
	}

	return [activeDocument.createTextNode(formatCellValueText(value, col, formatHint))]
}
