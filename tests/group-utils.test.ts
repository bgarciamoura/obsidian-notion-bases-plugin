import { describe, it, expect } from 'vitest'
import { buildGroups, getGroupableColumns } from '../src/components/group-utils'
import { ColumnSchema } from '../src/types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function selectCol(overrides: Partial<ColumnSchema> = {}): ColumnSchema {
	return {
		id: 'subject',
		name: 'Subject',
		type: 'select',
		visible: true,
		options: [
			{ value: 'network', color: '#ff0000' },
			{ value: 'database', color: '#00ff00' },
		],
		...overrides,
	}
}

interface Row { subject?: unknown }

function rows(...values: unknown[]): Row[] {
	return values.map(v => ({ subject: v }))
}

const getSubject = (r: Row) => r.subject

// ── Tests ────────────────────────────────────────────────────────────────────

describe('getGroupableColumns', () => {
	it('keeps only select and status columns', () => {
		const schema: ColumnSchema[] = [
			{ id: 'a', name: 'A', type: 'select', visible: true },
			{ id: 'b', name: 'B', type: 'status', visible: true },
			{ id: 'c', name: 'C', type: 'multiselect', visible: true },
			{ id: 'd', name: 'D', type: 'text', visible: true },
		]
		expect(getGroupableColumns(schema).map(c => c.id)).toEqual(['a', 'b'])
	})
})

describe('buildGroups', () => {
	it('keeps declared option order and appends the no-value group last', () => {
		const result = buildGroups(rows('database', 'network', null), getSubject, selectCol())
		expect(result.map(g => g.value)).toEqual(['network', 'database', ''])
	})

	it('counts items per group', () => {
		const result = buildGroups(rows('network', 'network', 'database'), getSubject, selectCol())
		expect(result.map(g => g.items.length)).toEqual([2, 1, 0])
	})

	it('carries the option color onto the group', () => {
		const result = buildGroups(rows('network'), getSubject, selectCol())
		expect(result[0].color).toBe('#ff0000')
	})

	it('treats null, undefined, empty string and whitespace as no value', () => {
		const result = buildGroups(rows(null, undefined, '', '   '), getSubject, selectCol())
		const noValue = result.find(g => g.value === '')
		expect(noValue?.items).toHaveLength(4)
	})

	it('groups values present in the data but missing from the options, after the declared ones', () => {
		const result = buildGroups(rows('network', 'storage', 'kubernetes'), getSubject, selectCol())
		expect(result.map(g => g.value)).toEqual(['network', 'database', 'storage', 'kubernetes', ''])
	})

	it('drops empty groups when hideEmpty is set', () => {
		const result = buildGroups(rows('network'), getSubject, selectCol(), { hideEmpty: true })
		expect(result.map(g => g.value)).toEqual(['network'])
	})

	it('drops the no-value group when hideNoValue is set', () => {
		const result = buildGroups(rows('network', null), getSubject, selectCol(), { hideNoValue: true })
		expect(result.map(g => g.value)).toEqual(['network', 'database'])
	})

	it('applies a saved order first and appends the rest in natural order', () => {
		const result = buildGroups(rows('network', 'database', 'storage'), getSubject, selectCol(), {
			order: ['database', 'network'],
		})
		expect(result.map(g => g.value)).toEqual(['database', 'network', 'storage', ''])
	})

	it('ignores saved order entries whose group no longer exists', () => {
		const result = buildGroups(rows('network'), getSubject, selectCol(), { order: ['gone', 'database'] })
		expect(result.map(g => g.value)).toEqual(['database', 'network', ''])
	})

	it('falls back to the four default options for a status column with no options', () => {
		const col = selectCol({ type: 'status', options: undefined })
		const result = buildGroups([], getSubject, col)
		expect(result).toHaveLength(5)
		expect(result[result.length - 1].value).toBe('')
	})

	it('returns every declared group with zero items for an empty input', () => {
		const result = buildGroups([], getSubject, selectCol())
		expect(result.map(g => g.value)).toEqual(['network', 'database', ''])
		expect(result.every(g => g.items.length === 0)).toBe(true)
	})

	it('matches numeric frontmatter values against string options', () => {
		const col = selectCol({ options: [{ value: '1' }, { value: '2' }] })
		const result = buildGroups(rows(1, 2, 2), getSubject, col)
		expect(result.map(g => g.items.length)).toEqual([1, 2, 0])
	})
})
