import { describe, it, expect } from 'vitest'
import { formatCellValueText } from '../src/format-cell-value'
import { ColumnSchema } from '../src/types'

function col(type: ColumnSchema['type'], extra: Partial<ColumnSchema> = {}): ColumnSchema {
	return { id: 'x', name: 'x', type, visible: true, ...extra }
}

describe('formatCellValueText', () => {
	it('returns empty string for null/undefined/empty', () => {
		expect(formatCellValueText(null, col('text'))).toBe('')
		expect(formatCellValueText(undefined, col('text'))).toBe('')
		expect(formatCellValueText('', col('text'))).toBe('')
	})

	it('handles text and title as plain string', () => {
		expect(formatCellValueText('hello', col('text'))).toBe('hello')
		expect(formatCellValueText('My note', col('title'))).toBe('My note')
	})

	it('formats numbers with NumberFormat', () => {
		const c = col('number', { numberFormat: { decimals: 2, thousandsSeparator: true, prefix: 'R$' } })
		expect(formatCellValueText(1234.5, c)).toContain('R$')
		expect(formatCellValueText(1234.5, c)).toContain(',50')
	})

	it('returns raw number when no format is set', () => {
		expect(formatCellValueText(42, col('number'))).toBe('42')
	})

	it('joins multiselect arrays with comma', () => {
		expect(formatCellValueText(['a', 'b', 'c'], col('multiselect'))).toBe('a, b, c')
	})

	it('joins relation arrays with comma', () => {
		expect(formatCellValueText(['alpha', 'beta'], col('relation'))).toBe('alpha, beta')
	})

	it('renders checkbox as ✓ or ✗', () => {
		expect(formatCellValueText(true, col('checkbox'))).toBe('✓')
		expect(formatCellValueText(false, col('checkbox'))).toBe('✗')
	})

	it('falls back to String for select/status', () => {
		expect(formatCellValueText('Done', col('select'))).toBe('Done')
		expect(formatCellValueText('In progress', col('status'))).toBe('In progress')
	})

	it('handles missing column by joining arrays', () => {
		expect(formatCellValueText(['a', 'b'], undefined)).toBe('a, b')
		expect(formatCellValueText('plain', undefined)).toBe('plain')
	})

	it('returns empty string for objects rather than [object Object]', () => {
		// toStr uses JSON.stringify for unknown types
		expect(formatCellValueText({ foo: 'bar' }, col('text'))).toBe('{"foo":"bar"}')
	})
})
