import { ColumnSchema, SelectOption } from '../types'
import { stringifyScalar } from '../value-utils'
import { t } from '../i18n'

/**
 * A single group axis bucket. `value` is the raw frontmatter value written when
 * adding an item to the group; the no-value bucket uses ''.
 */
export interface GroupDef<T> {
	value: string
	label: string
	color?: string
	items: T[]
}

export interface BuildGroupsOptions {
	/** Saved manual group order (board views persist this as boardColumnOrder). */
	order?: string[]
	hideEmpty?: boolean
	hideNoValue?: boolean
}

/** Grouping requires a single-value axis, so only select and status qualify. */
export function getGroupableColumns(schema: ColumnSchema[]): ColumnSchema[] {
	return schema.filter(c => c.type === 'select' || c.type === 'status')
}

/** Called on every render so the labels follow the active locale. */
function DEFAULT_STATUS_OPTIONS(): SelectOption[] {
	return [
		{ value: t('status_not_started'), color: '#9E9E9E' },
		{ value: t('status_in_progress'), color: '#2196F3' },
		{ value: t('status_done'), color: '#4CAF50' },
		{ value: t('status_cancelled'), color: '#F44336' },
	]
}

function getGroupOptions(column: ColumnSchema): SelectOption[] {
	if (column.type === 'status' && !column.options?.length) return DEFAULT_STATUS_OPTIONS()
	return column.options ?? []
}

function normalize(value: unknown): string {
	return stringifyScalar(value).trim()
}

/**
 * Bucket items by a select/status column.
 *
 * Order: declared options, then values found in the data but missing from the
 * options, then the no-value bucket. The undeclared pass exists so a stale
 * schema cannot silently drop rows.
 */
export function buildGroups<T>(
	items: T[],
	getValue: (item: T) => unknown,
	column: ColumnSchema,
	opts: BuildGroupsOptions = {},
): GroupDef<T>[] {
	const declared = getGroupOptions(column)
	const buckets = new Map<string, T[]>()
	for (const opt of declared) buckets.set(opt.value, [])

	const undeclared: string[] = []
	const noValue: T[] = []

	for (const item of items) {
		const value = normalize(getValue(item))
		if (value === '') { noValue.push(item); continue }
		let bucket = buckets.get(value)
		if (!bucket) { bucket = []; buckets.set(value, bucket); undeclared.push(value) }
		bucket.push(item)
	}

	const all: GroupDef<T>[] = [
		...declared.map(opt => ({
			value: opt.value,
			label: opt.value,
			color: opt.color,
			items: buckets.get(opt.value) ?? [],
		})),
		...undeclared.map(value => ({ value, label: value, items: buckets.get(value) ?? [] })),
		{ value: '', label: t('no_value'), items: noValue },
	]

	let ordered = all
	const order = opts.order
	if (order && order.length > 0) {
		const inOrder = order.flatMap(v => { const g = all.find(x => x.value === v); return g ? [g] : [] })
		ordered = [...inOrder, ...all.filter(x => !order.includes(x.value))]
	}

	let result = opts.hideEmpty ? ordered.filter(g => g.items.length > 0) : ordered
	if (opts.hideNoValue) result = result.filter(g => g.value !== '')
	return result
}
