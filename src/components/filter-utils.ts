import { FilterOperator, NoteRow, SortConfig } from '../types'

export interface ActiveFilter {
	id: string
	columnId: string
	columnName: string
	columnType: string
	icon: string
	operator: FilterOperator
	value: string
	conjunction: 'and' | 'or'
}

export const TEXT_OPERATORS: FilterOperator[] = ['contains', 'not_contains', 'starts_with', 'ends_with', 'is', 'is_not', 'is_empty', 'is_not_empty']
export const NUMBER_OPERATORS: FilterOperator[] = ['is', 'is_not', 'gt', 'gte', 'lt', 'lte', 'is_empty', 'is_not_empty']
export const DATE_OPERATORS: FilterOperator[] = ['is', 'is_not', 'gt', 'gte', 'lt', 'lte', 'is_empty', 'is_not_empty']
export const SELECT_OPERATORS: FilterOperator[] = ['is', 'is_not', 'is_empty', 'is_not_empty']
export const CHECKBOX_OPERATORS: FilterOperator[] = ['is_checked', 'is_unchecked', 'is_empty', 'is_not_empty']

export function getOperatorsForType(type: string): FilterOperator[] {
	switch (type) {
		case 'number': return NUMBER_OPERATORS
		case 'date': return DATE_OPERATORS
		case 'select': return SELECT_OPERATORS
		case 'multiselect': return SELECT_OPERATORS
		case 'checkbox': return CHECKBOX_OPERATORS
		default: return TEXT_OPERATORS
	}
}

export function getDefaultOperator(type: string): FilterOperator {
	switch (type) {
		case 'number': case 'date': return 'is'
		case 'checkbox': return 'is_checked'
		case 'select': case 'multiselect': return 'is'
		default: return 'contains'
	}
}

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
	is: 'É', is_not: 'Não é', contains: 'Contém', not_contains: 'Não contém',
	starts_with: 'Começa com', ends_with: 'Termina com',
	gt: 'Maior que', gte: 'Maior ou igual', lt: 'Menor que', lte: 'Menor ou igual',
	is_checked: 'Está marcado', is_unchecked: 'Não está marcado',
	is_empty: 'Está vazio', is_not_empty: 'Não está vazio',
}

export const NO_VALUE_OPERATORS = new Set<FilterOperator>(['is_empty', 'is_not_empty', 'is_checked', 'is_unchecked'])

export function getColumnIconStatic(type: string): string {
	const icons: Record<string, string> = {
		title: '📄', text: 'Aa', number: '#', select: '◉',
		multiselect: '◈', date: '📅', checkbox: '☑', formula: 'ƒ', relation: '🔗', lookup: '↗',
	}
	return icons[type] ?? '·'
}

export function matchesFilter(row: NoteRow, f: ActiveFilter): boolean {
	const noValue = NO_VALUE_OPERATORS.has(f.operator)
	if (!noValue && f.value === '') return true
	const raw = f.columnId === '_title' ? row._title : row[f.columnId]

	if (f.operator === 'is_empty') return raw === null || raw === undefined || String((raw as string | number | boolean | null | undefined) ?? '').trim() === ''
	if (f.operator === 'is_not_empty') return raw !== null && raw !== undefined && String((raw as string | number | boolean | null | undefined) ?? '').trim() !== ''
	if (f.operator === 'is_checked') return raw === true || raw === 'true'
	if (f.operator === 'is_unchecked') return raw !== true && raw !== 'true'

	if (f.columnType === 'number') {
		const n = parseFloat(String((raw as string | number | boolean | null | undefined) ?? ''))
		const v = parseFloat(f.value)
		if (isNaN(n) || isNaN(v)) return false
		switch (f.operator) {
			case 'is': return n === v
			case 'is_not': return n !== v
			case 'gt': return n > v
			case 'gte': return n >= v
			case 'lt': return n < v
			case 'lte': return n <= v
			default: return true
		}
	}

	if (f.columnType === 'date') {
		const d = new Date(String((raw as string | number | boolean | null | undefined) ?? '')).getTime()
		const v = new Date(f.value).getTime()
		if (isNaN(d) || isNaN(v)) return false
		switch (f.operator) {
			case 'is': return d === v
			case 'is_not': return d !== v
			case 'gt': return d > v
			case 'gte': return d >= v
			case 'lt': return d < v
			case 'lte': return d <= v
			default: return true
		}
	}

	const cell = Array.isArray(raw)
		? (raw as string[]).join(', ').toLowerCase()
		: String((raw as string | number | boolean | null | undefined) ?? '').toLowerCase()
	const v = f.value.toLowerCase()
	switch (f.operator) {
		case 'is': return cell === v
		case 'is_not': return cell !== v
		case 'contains': return cell.includes(v)
		case 'not_contains': return !cell.includes(v)
		case 'starts_with': return cell.startsWith(v)
		case 'ends_with': return cell.endsWith(v)
		default: return true
	}
}

export function applyFilters(rows: NoteRow[], filters: ActiveFilter[]): NoteRow[] {
	if (filters.length === 0) return rows
	const groups: ActiveFilter[][] = []
	let current: ActiveFilter[] = []
	for (const f of filters) {
		if (f.conjunction === 'or' && current.length > 0) {
			groups.push(current)
			current = []
		}
		current.push(f)
	}
	if (current.length > 0) groups.push(current)
	return rows.filter(row => groups.some(group => group.every(f => matchesFilter(row, f))))
}

export function applySorts(rows: NoteRow[], sorts: SortConfig[]): NoteRow[] {
	if (sorts.length === 0) return rows
	return [...rows].sort((a, b) => {
		for (const sort of sorts) {
			const aVal = sort.columnId === '_title' ? a._title : a[sort.columnId]
			const bVal = sort.columnId === '_title' ? b._title : b[sort.columnId]
			let cmp = 0
			if (aVal === null || aVal === undefined) cmp = -1
			else if (bVal === null || bVal === undefined) cmp = 1
			else {
				const aNum = parseFloat(String(aVal as string | number | boolean))
				const bNum = parseFloat(String(bVal as string | number | boolean))
				if (!isNaN(aNum) && !isNaN(bNum)) {
					cmp = aNum - bNum
				} else {
					cmp = String((aVal as string | number | boolean | null | undefined) ?? '').toLowerCase().localeCompare(String((bVal as string | number | boolean | null | undefined) ?? '').toLowerCase())
				}
			}
			if (cmp !== 0) return sort.direction === 'asc' ? cmp : -cmp
		}
		return 0
	})
}
