import { describe, it, expect } from 'vitest'
import { parseInlineFields, inferInlineFieldValue, sanitizeKey, frontmatterLineCount } from '../src/inline-fields'

// ── sanitizeKey ─────────────────────────────────────────────────────────────

describe('sanitizeKey', () => {
	it('lowercases and trims', () => {
		expect(sanitizeKey('  Rating  ')).toBe('rating')
	})

	it('replaces spaces with dashes', () => {
		expect(sanitizeKey('My Rating')).toBe('my-rating')
	})

	it('removes markdown formatting', () => {
		expect(sanitizeKey('**Bold Key**')).toBe('bold-key')
		expect(sanitizeKey('__underline__')).toBe('underline')
		expect(sanitizeKey('~~strike~~')).toBe('strike')
	})

	it('handles accented characters', () => {
		expect(sanitizeKey('Prioridade')).toBe('prioridade')
		expect(sanitizeKey('Título')).toBe('título')
	})
})

// ── inferInlineFieldValue ───────────────────────────────────────────────────

describe('inferInlineFieldValue', () => {
	it('returns null for empty string', () => {
		expect(inferInlineFieldValue('')).toBe(null)
		expect(inferInlineFieldValue('  ')).toBe(null)
	})

	it('parses booleans', () => {
		expect(inferInlineFieldValue('true')).toBe(true)
		expect(inferInlineFieldValue('false')).toBe(false)
	})

	it('does not parse partial booleans', () => {
		expect(inferInlineFieldValue('trueish')).toBe('trueish')
		expect(inferInlineFieldValue('falsehood')).toBe('falsehood')
	})

	it('parses integers', () => {
		expect(inferInlineFieldValue('42')).toBe(42)
		expect(inferInlineFieldValue('-7')).toBe(-7)
	})

	it('parses decimals', () => {
		expect(inferInlineFieldValue('3.14')).toBe(3.14)
		expect(inferInlineFieldValue('-0.5')).toBe(-0.5)
	})

	it('keeps ISO dates as strings', () => {
		expect(inferInlineFieldValue('2024-01-15')).toBe('2024-01-15')
		expect(inferInlineFieldValue('2024-01-15T14:30')).toBe('2024-01-15T14:30')
		expect(inferInlineFieldValue('2024-01-15T14:30:00')).toBe('2024-01-15T14:30:00')
	})

	it('keeps wiki-links as strings', () => {
		expect(inferInlineFieldValue('[[Page]]')).toBe('[[Page]]')
		expect(inferInlineFieldValue('[[Folder/Page|Alias]]')).toBe('[[Folder/Page|Alias]]')
	})

	it('returns plain text as-is', () => {
		expect(inferInlineFieldValue('hello world')).toBe('hello world')
	})
})

// ── frontmatterLineCount ────────────────────────────────────────────────────

describe('frontmatterLineCount', () => {
	it('returns 0 for no frontmatter', () => {
		expect(frontmatterLineCount('Just text')).toBe(0)
	})

	it('counts frontmatter lines', () => {
		expect(frontmatterLineCount('---\ntitle: Test\n---\nBody')).toBe(3)
	})

	it('counts minimal frontmatter', () => {
		expect(frontmatterLineCount('---\n\n---\nBody')).toBe(3)
	})
})

// ── parseInlineFields ───────────────────────────────────────────────────────

describe('parseInlineFields', () => {
	it('parses standalone field with metadata', () => {
		const result = parseInlineFields('Rating:: 9')
		expect(result).toHaveLength(1)
		expect(result[0]).toMatchObject({
			key: 'rating', rawKey: 'Rating', value: 9,
			format: 'standalone', rawValue: '9', lineNumber: 0,
			fullMatch: 'Rating:: 9',
		})
	})

	it('parses standalone field with no value', () => {
		const result = parseInlineFields('Status::')
		expect(result).toHaveLength(1)
		expect(result[0]).toMatchObject({
			key: 'status', rawKey: 'Status', value: null,
			format: 'standalone', rawValue: '',
			fullMatch: 'Status:: ',
		})
	})

	it('parses bracketed field with metadata', () => {
		const result = parseInlineFields('I rate this [mood:: happy] today')
		expect(result).toHaveLength(1)
		expect(result[0]).toMatchObject({
			key: 'mood', rawKey: 'mood', value: 'happy',
			format: 'bracketed', rawValue: 'happy', lineNumber: 0,
			fullMatch: '[mood:: happy]',
		})
	})

	it('parses parenthesized field with metadata', () => {
		const result = parseInlineFields('Some text (secret:: hidden) here')
		expect(result).toHaveLength(1)
		expect(result[0]).toMatchObject({
			key: 'secret', rawKey: 'secret', value: 'hidden',
			format: 'parenthesized', rawValue: 'hidden', lineNumber: 0,
			fullMatch: '(secret:: hidden)',
		})
	})

	it('parses multiple bracketed fields on one line', () => {
		const result = parseInlineFields('I give [rating:: 9] and [mood:: great]')
		expect(result).toHaveLength(2)
		expect(result[0]).toMatchObject({ key: 'rating', format: 'bracketed', fullMatch: '[rating:: 9]' })
		expect(result[1]).toMatchObject({ key: 'mood', format: 'bracketed', fullMatch: '[mood:: great]' })
	})

	it('strips frontmatter before parsing', () => {
		const content = `---
title: My Note
rating: 5
---
Inline Rating:: 8`
		const result = parseInlineFields(content)
		expect(result).toHaveLength(1)
		expect(result[0]).toMatchObject({
			key: 'inline-rating', rawKey: 'Inline Rating', value: 8,
			format: 'standalone', lineNumber: 0,
		})
	})

	it('tracks correct line numbers', () => {
		const content = `First line
Rating:: 9
Some text
[mood:: happy]`
		const result = parseInlineFields(content)
		expect(result).toHaveLength(2)
		expect(result[0]).toMatchObject({ key: 'rating', lineNumber: 1 })
		expect(result[1]).toMatchObject({ key: 'mood', lineNumber: 3 })
	})

	it('tracks line numbers after frontmatter', () => {
		const content = `---
title: Test
---
Rating:: 9
Text
Status:: done`
		const result = parseInlineFields(content)
		expect(result).toHaveLength(2)
		expect(result[0]).toMatchObject({ key: 'rating', lineNumber: 0 })
		expect(result[1]).toMatchObject({ key: 'status', lineNumber: 2 })
	})

	it('ignores fields inside fenced code blocks', () => {
		const content = `Before:: yes
\`\`\`
Inside:: no
\`\`\`
After:: yes`
		const result = parseInlineFields(content)
		expect(result).toHaveLength(2)
		expect(result[0].key).toBe('before')
		expect(result[1].key).toBe('after')
	})

	it('ignores fields inside tilde code blocks', () => {
		const content = `Before:: yes
~~~
Inside:: no
~~~
After:: yes`
		const result = parseInlineFields(content)
		expect(result).toHaveLength(2)
		expect(result[0].key).toBe('before')
		expect(result[1].key).toBe('after')
	})

	it('ignores fields inside inline code', () => {
		const content = 'This `Rating:: 5` is code, not [real:: field]'
		const result = parseInlineFields(content)
		expect(result).toHaveLength(1)
		expect(result[0]).toMatchObject({ key: 'real', format: 'bracketed' })
	})

	it('handles wiki-link values', () => {
		const result = parseInlineFields('Author:: [[John Doe]]')
		expect(result[0]).toMatchObject({
			key: 'author', value: '[[John Doe]]', format: 'standalone',
			fullMatch: 'Author:: [[John Doe]]',
		})
	})

	it('handles date values', () => {
		const result = parseInlineFields('Due:: 2024-03-15')
		expect(result[0]).toMatchObject({
			key: 'due', value: '2024-03-15', rawValue: '2024-03-15',
		})
	})

	it('handles boolean values', () => {
		const result = parseInlineFields('Completed:: true')
		expect(result[0]).toMatchObject({ key: 'completed', value: true, rawValue: 'true' })
	})

	it('sanitizes keys with spaces', () => {
		const result = parseInlineFields('My Custom Field:: value')
		expect(result[0]).toMatchObject({
			key: 'my-custom-field', rawKey: 'My Custom Field',
			fullMatch: 'My Custom Field:: value',
		})
	})

	it('handles multiple fields across lines', () => {
		const content = `Rating:: 9
Status:: done
[priority:: high]`
		const result = parseInlineFields(content)
		expect(result).toHaveLength(3)
		expect(result[0]).toMatchObject({ key: 'rating', lineNumber: 0, format: 'standalone' })
		expect(result[1]).toMatchObject({ key: 'status', lineNumber: 1, format: 'standalone' })
		expect(result[2]).toMatchObject({ key: 'priority', lineNumber: 2, format: 'bracketed' })
	})

	it('returns empty array for content with no fields', () => {
		expect(parseInlineFields('Just a normal note\nwith no fields')).toEqual([])
	})

	it('returns empty array for empty string', () => {
		expect(parseInlineFields('')).toEqual([])
	})

	it('handles accented keys', () => {
		const result = parseInlineFields('Prioridade:: alta')
		expect(result[0]).toMatchObject({ key: 'prioridade', rawKey: 'Prioridade' })
	})
})
