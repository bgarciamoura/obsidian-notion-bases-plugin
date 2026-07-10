import { describe, it, expect } from 'vitest'
import { parseEmbedBlock } from '../src/database-embed'

describe('parseEmbedBlock', () => {
	it('parses path and id', () => {
		const result = parseEmbedBlock('id: nb12345678\npath: Projects/Tasks\n')
		expect(result.folderPath).toBe('Projects/Tasks')
		expect(result.embedId).toBe('nb12345678')
		expect(result.forcedType).toBeUndefined()
	})

	it.each(['table', 'list', 'board', 'gallery', 'calendar', 'timeline', 'chart'] as const)(
		'accepts view type %s',
		(type) => {
			const result = parseEmbedBlock(`path: Foo\ntype: ${type}`)
			expect(result.forcedType).toBe(type)
		},
	)

	it('ignores unknown view types', () => {
		expect(parseEmbedBlock('path: Foo\ntype: kanban').forcedType).toBeUndefined()
		expect(parseEmbedBlock('path: Foo\ntype: ').forcedType).toBeUndefined()
	})

	it('trims whitespace around values', () => {
		const result = parseEmbedBlock('path:   My/Folder  \ntype:  board ')
		expect(result.folderPath).toBe('My/Folder')
		expect(result.forcedType).toBe('board')
	})

	it('returns empty strings when path and id are missing', () => {
		const result = parseEmbedBlock('type: board')
		expect(result.folderPath).toBe('')
		expect(result.embedId).toBe('')
	})

	it('last occurrence wins when a key is repeated', () => {
		const result = parseEmbedBlock('type: board\ntype: calendar')
		expect(result.forcedType).toBe('calendar')
	})
})
