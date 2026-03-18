import { describe, it, expect } from 'vitest'
import { evaluateFormula, validateFormulaSyntax, FormulaError } from '../src/formula-engine'
import { ColumnSchema, NoteRow } from '../src/types'
import { TFile } from 'obsidian'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRow(data: Record<string, unknown>): NoteRow {
	return { _file: new TFile(), _title: 'Test', ...data }
}

const baseSchema: ColumnSchema[] = [
	{ id: 'price', name: 'Price', type: 'number', visible: true },
	{ id: 'qty', name: 'Quantity', type: 'number', visible: true },
	{ id: 'name', name: 'Name', type: 'text', visible: true },
	{ id: 'active', name: 'Active', type: 'checkbox', visible: true },
	{ id: 'status', name: 'Status', type: 'select', visible: true },
]

function evalF(formula: string, rowData: Record<string, unknown> = {}, allRows?: NoteRow[]) {
	const row = makeRow(rowData)
	return evaluateFormula(formula, row, allRows ?? [row], baseSchema)
}

// ── Syntax validation ────────────────────────────────────────────────────────

describe('validateFormulaSyntax', () => {
	it('returns null for valid formulas', () => {
		expect(validateFormulaSyntax('1 + 2')).toBeNull()
		expect(validateFormulaSyntax('IF(TRUE, 1, 0)')).toBeNull()
		expect(validateFormulaSyntax('CONCAT("a", "b")')).toBeNull()
	})

	it('returns error for invalid syntax', () => {
		expect(validateFormulaSyntax('1 +')).not.toBeNull()
		expect(validateFormulaSyntax('IF(1,')).not.toBeNull()
		expect(validateFormulaSyntax('"unclosed')).not.toBeNull()
	})

	it('returns null for empty formula', () => {
		expect(validateFormulaSyntax('')).toBeNull()
		expect(validateFormulaSyntax('  ')).toBeNull()
	})
})

// ── Arithmetic ───────────────────────────────────────────────────────────────

describe('arithmetic', () => {
	it('adds numbers', () => {
		expect(evalF('1 + 2')).toBe(3)
	})

	it('subtracts numbers', () => {
		expect(evalF('10 - 3')).toBe(7)
	})

	it('multiplies numbers', () => {
		expect(evalF('4 * 5')).toBe(20)
	})

	it('divides numbers', () => {
		expect(evalF('10 / 4')).toBe(2.5)
	})

	it('returns null for division by zero', () => {
		expect(evalF('10 / 0')).toBeNull()
	})

	it('negates values', () => {
		expect(evalF('-5')).toBe(-5)
		expect(evalF('-(-3)')).toBe(3)
	})

	it('respects operator precedence', () => {
		expect(evalF('2 + 3 * 4')).toBe(14)
		expect(evalF('(2 + 3) * 4')).toBe(20)
	})

	it('uses column values', () => {
		expect(evalF('price * qty', { price: 10, qty: 3 })).toBe(30)
	})

	it('references columns with brackets', () => {
		expect(evalF('[price] + [qty]', { price: 5, qty: 2 })).toBe(7)
	})
})

// ── Comparison ───────────────────────────────────────────────────────────────

describe('comparison', () => {
	it('equals', () => {
		expect(evalF('1 = 1')).toBe(true)
		expect(evalF('1 == 2')).toBe(false)
	})

	it('not equals', () => {
		expect(evalF('1 != 2')).toBe(true)
		expect(evalF('1 <> 1')).toBe(false)
	})

	it('greater / less than', () => {
		expect(evalF('5 > 3')).toBe(true)
		expect(evalF('3 < 5')).toBe(true)
		expect(evalF('5 >= 5')).toBe(true)
		expect(evalF('4 <= 3')).toBe(false)
	})

	it('compares strings case-insensitively', () => {
		expect(evalF('"Hello" = "hello"')).toBe(true)
	})
})

// ── String operations ────────────────────────────────────────────────────────

describe('string functions', () => {
	it('CONCAT joins strings', () => {
		expect(evalF('CONCAT("Hello", " ", "World")')).toBe('Hello World')
	})

	it('& operator concatenates', () => {
		expect(evalF('"a" & "b"')).toBe('ab')
	})

	it('LEN returns length', () => {
		expect(evalF('LEN("test")')).toBe(4)
	})

	it('UPPER / LOWER', () => {
		expect(evalF('UPPER("hello")')).toBe('HELLO')
		expect(evalF('LOWER("HELLO")')).toBe('hello')
	})

	it('TRIM removes whitespace', () => {
		expect(evalF('TRIM("  hello  ")')).toBe('hello')
	})

	it('LEFT / RIGHT', () => {
		expect(evalF('LEFT("abcdef", 3)')).toBe('abc')
		expect(evalF('RIGHT("abcdef", 2)')).toBe('ef')
	})

	it('MID extracts substring (1-based)', () => {
		expect(evalF('MID("abcdef", 2, 3)')).toBe('bcd')
	})

	it('SUBSTITUTE replaces text', () => {
		expect(evalF('SUBSTITUTE("hello world", "world", "there")')).toBe('hello there')
	})
})

// ── Logic functions ──────────────────────────────────────────────────────────

describe('logic functions', () => {
	it('IF returns based on condition', () => {
		expect(evalF('IF(TRUE, "yes", "no")')).toBe('yes')
		expect(evalF('IF(FALSE, "yes", "no")')).toBe('no')
	})

	it('IF with two args returns null on false', () => {
		expect(evalF('IF(FALSE, "yes")')).toBeNull()
	})

	it('IF with column condition', () => {
		expect(evalF('IF(active, "on", "off")', { active: true })).toBe('on')
		expect(evalF('IF(active, "on", "off")', { active: false })).toBe('off')
	})

	it('IFS evaluates multiple conditions', () => {
		expect(evalF('IFS(FALSE, "a", TRUE, "b")')).toBe('b')
		expect(evalF('IFS(FALSE, "a", FALSE, "b")')).toBeNull()
	})

	it('AND / OR / NOT', () => {
		expect(evalF('AND(TRUE, TRUE)')).toBe(true)
		expect(evalF('AND(TRUE, FALSE)')).toBe(false)
		expect(evalF('OR(FALSE, TRUE)')).toBe(true)
		expect(evalF('OR(FALSE, FALSE)')).toBe(false)
		expect(evalF('NOT(TRUE)')).toBe(false)
		expect(evalF('NOT(FALSE)')).toBe(true)
	})
})

// ── Math functions ───────────────────────────────────────────────────────────

describe('math functions', () => {
	it('ROUND', () => {
		expect(evalF('ROUND(3.456, 2)')).toBe(3.46)
		expect(evalF('ROUND(3.5)')).toBe(4)
	})

	it('FLOOR / CEIL', () => {
		expect(evalF('FLOOR(3.7)')).toBe(3)
		expect(evalF('CEIL(3.2)')).toBe(4)
	})

	it('ABS', () => {
		expect(evalF('ABS(-5)')).toBe(5)
		expect(evalF('ABS(5)')).toBe(5)
	})

	it('MOD', () => {
		expect(evalF('MOD(10, 3)')).toBe(1)
	})

	it('POWER', () => {
		expect(evalF('POWER(2, 10)')).toBe(1024)
	})

	it('SQRT', () => {
		expect(evalF('SQRT(9)')).toBe(3)
	})
})

// ── Aggregate functions ──────────────────────────────────────────────────────

describe('aggregate functions', () => {
	const rows = [
		makeRow({ price: 10, qty: 1 }),
		makeRow({ price: 20, qty: 2 }),
		makeRow({ price: 30, qty: 3 }),
	]

	it('SUM across all rows', () => {
		expect(evaluateFormula('SUM(price)', rows[0], rows, baseSchema)).toBe(60)
	})

	it('SUM with multiple args uses current row values', () => {
		expect(evaluateFormula('SUM(price, qty)', rows[1], rows, baseSchema)).toBe(22)
	})

	it('AVG across all rows', () => {
		expect(evaluateFormula('AVG(price)', rows[0], rows, baseSchema)).toBe(20)
	})

	it('COUNT across all rows', () => {
		expect(evaluateFormula('COUNT(price)', rows[0], rows, baseSchema)).toBe(3)
	})

	it('MIN / MAX across all rows', () => {
		expect(evaluateFormula('MIN(price)', rows[0], rows, baseSchema)).toBe(10)
		expect(evaluateFormula('MAX(price)', rows[0], rows, baseSchema)).toBe(30)
	})
})

// ── Null / empty functions ───────────────────────────────────────────────────

describe('null functions', () => {
	it('ISNULL / ISEMPTY', () => {
		expect(evalF('ISNULL(name)', { name: null })).toBe(true)
		expect(evalF('ISNULL(name)', { name: 'test' })).toBe(false)
		expect(evalF('ISEMPTY(name)', { name: '' })).toBe(true)
	})

	it('COALESCE returns first non-empty', () => {
		expect(evalF('COALESCE(name, "default")', { name: null })).toBe('default')
		expect(evalF('COALESCE(name, "default")', { name: 'hello' })).toBe('hello')
	})
})

// ── Conversion functions ─────────────────────────────────────────────────────

describe('conversion functions', () => {
	it('TEXT converts to string', () => {
		expect(evalF('TEXT(123)')).toBe('123')
	})

	it('VALUE converts to number', () => {
		expect(evalF('VALUE("42")')).toBe(42)
		expect(evalF('VALUE("abc")')).toBe(0)
	})
})

// ── Error handling ───────────────────────────────────────────────────────────

describe('error handling', () => {
	it('returns #ERRO for unknown column', () => {
		expect(evalF('unknown_col + 1')).toBe('#ERRO')
	})

	it('returns #ERRO for unknown function', () => {
		expect(evalF('INVALID(1)')).toBe('#ERRO')
	})

	it('returns null for empty formula', () => {
		expect(evalF('')).toBeNull()
		expect(evalF('  ')).toBeNull()
	})
})
