import { describe, it, expect } from 'vitest'
import { sanitizeSegment } from '../src/database-manager'

describe('sanitizeSegment', () => {
	it('strips invalid filename characters', () => {
		expect(sanitizeSegment('a/b\\c:d*e?f"g<h>i|j')).toBe('abcdefghij')
	})

	it('collapses whitespace', () => {
		expect(sanitizeSegment('  hello   world  ')).toBe('hello world')
	})

	it('returns empty string for whitespace-only or empty', () => {
		expect(sanitizeSegment('   ')).toBe('')
		expect(sanitizeSegment('')).toBe('')
	})

	it('preserves accented characters and emoji', () => {
		expect(sanitizeSegment('Olá Mundo 🌍')).toBe('Olá Mundo 🌍')
	})

	it('strips only invalid characters, keeps everything else', () => {
		expect(sanitizeSegment('Done — high priority')).toBe('Done — high priority')
	})
})
