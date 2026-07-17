import { describe, it, expect, beforeAll, afterAll } from 'vitest'
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

	it('formats numbers with NumberFormat using the display locale', () => {
		const c = col('number', { numberFormat: { decimals: 2, thousandsSeparator: true, prefix: 'R$' } })
		// Mocked getLanguage() returns 'en' → 1,234.50
		expect(formatCellValueText(1234.5, c)).toContain('R$')
		expect(formatCellValueText(1234.5, c)).toContain('1,234.50')
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

// ── Date formatting (issue #46) ──────────────────────────────────────────────

describe('date formatting', () => {
	// Stub window.moment: echoes the pattern it was asked to format with
	beforeAll(() => {
		;(globalThis as Record<string, unknown>).window = {
			moment: () => ({ format: (fmt: string) => `fmt(${fmt})` }),
		}
	})
	afterAll(() => {
		delete (globalThis as Record<string, unknown>).window
	})

	it('uses the column dateFormat when set', () => {
		expect(formatCellValueText('2026-07-15', col('date', { dateFormat: 'DD/MM/YYYY' }))).toBe('fmt(DD/MM/YYYY)')
	})

	it('explicit format hint wins over the column dateFormat', () => {
		expect(formatCellValueText('2026-07-15', col('date', { dateFormat: 'DD/MM/YYYY' }), 'YYYY')).toBe('fmt(YYYY)')
	})

	it('defaults to the localized date-only pattern', () => {
		expect(formatCellValueText('2026-07-15', col('date'))).toBe('fmt(L)')
	})

	it('defaults to the localized date+time pattern when the value has a time', () => {
		expect(formatCellValueText('2026-07-15T08:10:00', col('date'))).toBe('fmt(L LT)')
		expect(formatCellValueText('2026-07-15 08:10', col('date'))).toBe('fmt(L LT)')
	})

	it('returns the raw value when moment is unavailable', () => {
		;(globalThis as Record<string, unknown>).window = {}
		expect(formatCellValueText('2026-07-15', col('date'))).toBe('2026-07-15')
		;(globalThis as Record<string, unknown>).window = {
			moment: () => ({ format: (fmt: string) => `fmt(${fmt})` }),
		}
	})
})
