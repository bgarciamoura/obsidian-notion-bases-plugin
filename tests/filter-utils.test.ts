import { describe, it, expect } from 'vitest'
import {
	matchesFilter,
	applyFilters,
	applySorts,
	getOperatorsForType,
	getDefaultOperator,
	parseMultiValue,
	toggleMultiValue,
	isMultiValueFilter,
	ActiveFilter,
	MULTI_VALUE_SEPARATOR,
} from '../src/components/filter-utils'
import { NoteRow } from '../src/types'
import { TFile } from 'obsidian'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRow(data: Record<string, unknown>): NoteRow {
	return { _file: new TFile(), _title: data._title as string ?? 'Test', ...data }
}

function makeFilter(overrides: Partial<ActiveFilter> = {}): ActiveFilter {
	return {
		id: '1',
		columnId: 'name',
		columnName: 'Name',
		columnType: 'text',
		icon: 'Aa',
		operator: 'contains',
		value: '',
		conjunction: 'and',
		...overrides,
	}
}

// ── getOperatorsForType ──────────────────────────────────────────────────────

describe('getOperatorsForType', () => {
	it('returns number operators for number type', () => {
		const ops = getOperatorsForType('number')
		expect(ops).toContain('gt')
		expect(ops).toContain('lte')
		expect(ops).not.toContain('contains')
	})

	it('returns text operators for unknown types', () => {
		const ops = getOperatorsForType('custom')
		expect(ops).toContain('contains')
		expect(ops).toContain('starts_with')
	})

	it('returns checkbox operators for checkbox type', () => {
		const ops = getOperatorsForType('checkbox')
		expect(ops).toContain('is_checked')
		expect(ops).toContain('is_unchecked')
	})

	it('returns select operators for select/multiselect/status', () => {
		for (const type of ['select', 'multiselect', 'status']) {
			const ops = getOperatorsForType(type)
			expect(ops).toContain('is')
			expect(ops).toContain('is_not')
		}
	})
})

// ── getDefaultOperator ───────────────────────────────────────────────────────

describe('getDefaultOperator', () => {
	it('returns "contains" for text', () => {
		expect(getDefaultOperator('text')).toBe('contains')
	})

	it('returns "is" for number/date/select', () => {
		expect(getDefaultOperator('number')).toBe('is')
		expect(getDefaultOperator('date')).toBe('is')
		expect(getDefaultOperator('select')).toBe('is')
	})

	it('returns "is_checked" for checkbox', () => {
		expect(getDefaultOperator('checkbox')).toBe('is_checked')
	})
})

// ── Multi-value utilities ────────────────────────────────────────────────────

describe('parseMultiValue', () => {
	it('splits by separator', () => {
		expect(parseMultiValue(`a${MULTI_VALUE_SEPARATOR}b`)).toEqual(['a', 'b'])
	})

	it('filters empty strings', () => {
		expect(parseMultiValue('')).toEqual([])
	})
})

describe('toggleMultiValue', () => {
	it('adds value if not present', () => {
		const result = toggleMultiValue('a', 'b')
		expect(result).toBe(`a${MULTI_VALUE_SEPARATOR}b`)
	})

	it('removes value if present', () => {
		const result = toggleMultiValue(`a${MULTI_VALUE_SEPARATOR}b`, 'a')
		expect(result).toBe('b')
	})
})

describe('isMultiValueFilter', () => {
	it('returns true for select with is operator', () => {
		expect(isMultiValueFilter(makeFilter({ columnType: 'select', operator: 'is' }))).toBe(true)
	})

	it('returns false for text type', () => {
		expect(isMultiValueFilter(makeFilter({ columnType: 'text', operator: 'is' }))).toBe(false)
	})

	it('returns false for contains operator on select', () => {
		expect(isMultiValueFilter(makeFilter({ columnType: 'select', operator: 'contains' }))).toBe(false)
	})
})

// ── matchesFilter ────────────────────────────────────────────────────────────

describe('matchesFilter', () => {
	describe('text filters', () => {
		it('contains', () => {
			const row = makeRow({ name: 'Hello World' })
			expect(matchesFilter(row, makeFilter({ value: 'world' }))).toBe(true)
			expect(matchesFilter(row, makeFilter({ value: 'xyz' }))).toBe(false)
		})

		it('not_contains', () => {
			const row = makeRow({ name: 'Hello' })
			expect(matchesFilter(row, makeFilter({ operator: 'not_contains', value: 'xyz' }))).toBe(true)
			expect(matchesFilter(row, makeFilter({ operator: 'not_contains', value: 'hello' }))).toBe(false)
		})

		it('is / is_not (case insensitive)', () => {
			const row = makeRow({ name: 'Hello' })
			expect(matchesFilter(row, makeFilter({ operator: 'is', value: 'hello' }))).toBe(true)
			expect(matchesFilter(row, makeFilter({ operator: 'is_not', value: 'hello' }))).toBe(false)
		})

		it('starts_with / ends_with', () => {
			const row = makeRow({ name: 'Hello World' })
			expect(matchesFilter(row, makeFilter({ operator: 'starts_with', value: 'hello' }))).toBe(true)
			expect(matchesFilter(row, makeFilter({ operator: 'ends_with', value: 'world' }))).toBe(true)
		})

		it('empty value returns true (no filter applied)', () => {
			const row = makeRow({ name: 'anything' })
			expect(matchesFilter(row, makeFilter({ operator: 'is', value: '' }))).toBe(true)
		})
	})

	describe('empty/not_empty filters', () => {
		it('is_empty matches null/undefined/empty string', () => {
			expect(matchesFilter(makeRow({ name: null }), makeFilter({ operator: 'is_empty' }))).toBe(true)
			expect(matchesFilter(makeRow({ name: undefined }), makeFilter({ operator: 'is_empty' }))).toBe(true)
			expect(matchesFilter(makeRow({ name: '  ' }), makeFilter({ operator: 'is_empty' }))).toBe(true)
			expect(matchesFilter(makeRow({ name: 'value' }), makeFilter({ operator: 'is_empty' }))).toBe(false)
		})

		it('is_not_empty matches values', () => {
			expect(matchesFilter(makeRow({ name: 'test' }), makeFilter({ operator: 'is_not_empty' }))).toBe(true)
			expect(matchesFilter(makeRow({ name: '' }), makeFilter({ operator: 'is_not_empty' }))).toBe(false)
		})
	})

	describe('checkbox filters', () => {
		it('is_checked', () => {
			expect(matchesFilter(makeRow({ done: true }), makeFilter({ columnId: 'done', columnType: 'checkbox', operator: 'is_checked' }))).toBe(true)
			expect(matchesFilter(makeRow({ done: false }), makeFilter({ columnId: 'done', columnType: 'checkbox', operator: 'is_checked' }))).toBe(false)
		})

		it('is_unchecked', () => {
			expect(matchesFilter(makeRow({ done: false }), makeFilter({ columnId: 'done', columnType: 'checkbox', operator: 'is_unchecked' }))).toBe(true)
		})
	})

	describe('number filters', () => {
		const numFilter = (op: string, value: string) =>
			makeFilter({ columnId: 'price', columnType: 'number', operator: op as any, value })

		it('numeric comparisons', () => {
			const row = makeRow({ price: 50 })
			expect(matchesFilter(row, numFilter('is', '50'))).toBe(true)
			expect(matchesFilter(row, numFilter('is_not', '50'))).toBe(false)
			expect(matchesFilter(row, numFilter('gt', '40'))).toBe(true)
			expect(matchesFilter(row, numFilter('gt', '60'))).toBe(false)
			expect(matchesFilter(row, numFilter('gte', '50'))).toBe(true)
			expect(matchesFilter(row, numFilter('lt', '60'))).toBe(true)
			expect(matchesFilter(row, numFilter('lte', '50'))).toBe(true)
		})

		it('returns false for NaN values', () => {
			const row = makeRow({ price: 'abc' })
			expect(matchesFilter(row, numFilter('is', '50'))).toBe(false)
		})
	})

	describe('date filters', () => {
		const dateFilter = (op: string, value: string) =>
			makeFilter({ columnId: 'date', columnType: 'date', operator: op as any, value })

		it('date comparisons', () => {
			const row = makeRow({ date: '2025-06-15' })
			expect(matchesFilter(row, dateFilter('is', '2025-06-15'))).toBe(true)
			expect(matchesFilter(row, dateFilter('gt', '2025-06-01'))).toBe(true)
			expect(matchesFilter(row, dateFilter('lt', '2025-07-01'))).toBe(true)
		})
	})

	describe('multi-value select filters', () => {
		it('matches any of selected values', () => {
			const row = makeRow({ status: 'done' })
			const f = makeFilter({
				columnId: 'status',
				columnType: 'select',
				operator: 'is',
				value: `todo${MULTI_VALUE_SEPARATOR}done`,
			})
			expect(matchesFilter(row, f)).toBe(true)
		})

		it('is_not excludes all selected values', () => {
			const row = makeRow({ status: 'done' })
			const f = makeFilter({
				columnId: 'status',
				columnType: 'select',
				operator: 'is_not',
				value: `todo${MULTI_VALUE_SEPARATOR}done`,
			})
			expect(matchesFilter(row, f)).toBe(false)
		})
	})

	describe('title column', () => {
		it('filters by _title', () => {
			const row = makeRow({ _title: 'My Note' })
			expect(matchesFilter(row, makeFilter({ columnId: '_title', value: 'note' }))).toBe(true)
		})
	})
})

// ── applyFilters ─────────────────────────────────────────────────────────────

describe('applyFilters', () => {
	const rows = [
		makeRow({ _title: 'Alpha', status: 'done', price: 10 }),
		makeRow({ _title: 'Beta', status: 'todo', price: 20 }),
		makeRow({ _title: 'Gamma', status: 'done', price: 30 }),
	]

	it('returns all rows with no filters', () => {
		expect(applyFilters(rows, [])).toHaveLength(3)
	})

	it('AND filters intersect', () => {
		const filters = [
			makeFilter({ columnId: 'status', operator: 'is', value: 'done', conjunction: 'and' }),
			makeFilter({ id: '2', columnId: 'price', columnType: 'number', operator: 'gt', value: '15', conjunction: 'and' }),
		]
		const result = applyFilters(rows, filters)
		expect(result).toHaveLength(1)
		expect(result[0]._title).toBe('Gamma')
	})

	it('OR filters union groups', () => {
		const filters = [
			makeFilter({ columnId: '_title', operator: 'is', value: 'alpha', conjunction: 'and' }),
			makeFilter({ id: '2', columnId: '_title', operator: 'is', value: 'beta', conjunction: 'or' }),
		]
		const result = applyFilters(rows, filters)
		expect(result).toHaveLength(2)
	})
})

// ── applySorts ───────────────────────────────────────────────────────────────

describe('applySorts', () => {
	const rows = [
		makeRow({ _title: 'Charlie', price: 30 }),
		makeRow({ _title: 'Alpha', price: 10 }),
		makeRow({ _title: 'Beta', price: 20 }),
	]

	it('sorts ascending by title', () => {
		const sorted = applySorts(rows, [{ columnId: '_title', direction: 'asc' }])
		expect(sorted.map(r => r._title)).toEqual(['Alpha', 'Beta', 'Charlie'])
	})

	it('sorts descending by title', () => {
		const sorted = applySorts(rows, [{ columnId: '_title', direction: 'desc' }])
		expect(sorted.map(r => r._title)).toEqual(['Charlie', 'Beta', 'Alpha'])
	})

	it('sorts numerically', () => {
		const sorted = applySorts(rows, [{ columnId: 'price', direction: 'asc' }])
		expect(sorted.map(r => r.price)).toEqual([10, 20, 30])
	})

	it('handles null values (null first in asc)', () => {
		const withNull = [...rows, makeRow({ _title: 'Delta', price: null })]
		const sorted = applySorts(withNull, [{ columnId: 'price', direction: 'asc' }])
		expect(sorted[0].price).toBeNull()
	})

	it('multi-column sort', () => {
		const data = [
			makeRow({ _title: 'A', status: 'done', price: 20 }),
			makeRow({ _title: 'B', status: 'todo', price: 10 }),
			makeRow({ _title: 'C', status: 'done', price: 10 }),
		]
		const sorted = applySorts(data, [
			{ columnId: 'status', direction: 'asc' },
			{ columnId: 'price', direction: 'asc' },
		])
		expect(sorted.map(r => r._title)).toEqual(['C', 'A', 'B'])
	})

	it('returns original order with no sorts', () => {
		expect(applySorts(rows, [])).toEqual(rows)
	})

	it('does not mutate original array', () => {
		const original = [...rows]
		applySorts(rows, [{ columnId: '_title', direction: 'asc' }])
		expect(rows).toEqual(original)
	})
})
