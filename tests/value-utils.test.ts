import { describe, expect, it } from 'vitest'
import { isHttpUrl } from '../src/value-utils'

describe('isHttpUrl', () => {
	it('accepts absolute http and https URLs', () => {
		expect(isHttpUrl('https://example.com/img.png')).toBe(true)
		expect(isHttpUrl('http://example.com/a')).toBe(true)
		expect(isHttpUrl('HTTPS://EXAMPLE.COM/A')).toBe(true)
		expect(isHttpUrl('  https://drive.google.com/thumbnail?id=x ')).toBe(true)
	})

	it('rejects vault paths and other schemes', () => {
		expect(isHttpUrl('attachments/photo.png')).toBe(false)
		expect(isHttpUrl('photo.png')).toBe(false)
		expect(isHttpUrl('file:///c/img.png')).toBe(false)
		expect(isHttpUrl('obsidian://open?vault=x')).toBe(false)
		expect(isHttpUrl('httpsnot-a-url')).toBe(false)
		expect(isHttpUrl('')).toBe(false)
	})
})
