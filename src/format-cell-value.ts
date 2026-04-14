import { ColumnSchema, NumberFormat, SelectOption } from './types'

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
	let result = new Intl.NumberFormat('pt-BR', opts).format(value)
	if (fmt.prefix) result = `${fmt.prefix} ${result}`
	if (fmt.suffix) result = `${result} ${fmt.suffix}`
	return result
}

function getMoment(): ((d?: Date | string) => { format: (fmt: string) => string }) | null {
	return (window as unknown as { moment?: (d?: Date | string) => { format: (fmt: string) => string } }).moment ?? null
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
		case 'date': {
			const moment = getMoment()
			const raw = toStr(value)
			if (!moment) return raw
			const fmt = formatHint || 'YYYY-MM-DD'
			try { return moment(raw).format(fmt) } catch { return raw }
		}
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
	const span = document.createElement('span')
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
	if (value == null || value === '') return [document.createTextNode('')]

	if (col?.type === 'select' || col?.type === 'status') {
		const text = toStr(value)
		return [makePill(text, getOptionColor(col.options ?? [], text))]
	}

	if (col?.type === 'multiselect' && Array.isArray(value)) {
		const nodes: Node[] = []
		value.forEach((v, i) => {
			const text = toStr(v)
			if (i > 0) nodes.push(document.createTextNode(' '))
			nodes.push(makePill(text, getOptionColor(col.options ?? [], text)))
		})
		return nodes
	}

	return [document.createTextNode(formatCellValueText(value, col, formatHint))]
}
