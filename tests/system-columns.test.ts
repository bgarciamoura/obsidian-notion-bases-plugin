import { describe, it, expect } from 'vitest'
import { App, TFile } from 'obsidian'
import { DatabaseManager } from '../src/database-manager'
import { formatTimestampLocal } from '../src/value-utils'
import { ColumnSchema } from '../src/types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeFile(ctime: number, mtime: number): TFile {
	const f = new TFile()
	f.path = 'db/Row.md'
	f.basename = 'Row'
	f.stat = { ctime, mtime, size: 0 }
	return f
}

function makeManager(frontmatter: Record<string, unknown>): DatabaseManager {
	const app = {
		metadataCache: {
			getFileCache: () => ({ frontmatter }),
		},
	} as unknown as App
	return new DatabaseManager(app, '_database.md')
}

const col = (overrides: Partial<ColumnSchema>): ColumnSchema => ({
	id: 'x',
	name: 'X',
	type: 'text',
	visible: true,
	...overrides,
})

// ── formatTimestampLocal ─────────────────────────────────────────────────────

describe('formatTimestampLocal', () => {
	it('formats epoch millis as local YYYY-MM-DDTHH:mm', () => {
		const ts = new Date(2026, 0, 5, 9, 7).getTime()
		expect(formatTimestampLocal(ts)).toBe('2026-01-05T09:07')
	})

	it('zero-pads month, day, hour and minute', () => {
		const ts = new Date(2026, 10, 30, 23, 59).getTime()
		expect(formatTimestampLocal(ts)).toBe('2026-11-30T23:59')
	})
})

// ── getNoteDataSync with system columns ──────────────────────────────────────

describe('system columns', () => {
	const ctime = new Date(2026, 2, 10, 8, 30).getTime()
	const mtime = new Date(2026, 6, 27, 18, 45).getTime()

	it('populates ctime/mtime columns from file.stat', () => {
		const manager = makeManager({})
		const schema = [
			col({ id: 'created', type: 'date', systemField: 'ctime' }),
			col({ id: 'edited', type: 'date', systemField: 'mtime' }),
		]
		const row = manager.getNoteDataSync(makeFile(ctime, mtime), schema)
		expect(row['created']).toBe('2026-03-10T08:30')
		expect(row['edited']).toBe('2026-07-27T18:45')
	})

	it('ignores frontmatter values for system columns', () => {
		const manager = makeManager({ created: '1999-01-01', notes: 'hello' })
		const schema = [
			col({ id: 'created', type: 'date', systemField: 'ctime' }),
			col({ id: 'notes', type: 'text' }),
		]
		const row = manager.getNoteDataSync(makeFile(ctime, mtime), schema)
		expect(row['created']).toBe('2026-03-10T08:30')
		expect(row['notes']).toBe('hello')
	})

	it('regular date columns still read frontmatter', () => {
		const manager = makeManager({ due: '2026-12-01' })
		const schema = [col({ id: 'due', type: 'date' })]
		const row = manager.getNoteDataSync(makeFile(ctime, mtime), schema)
		expect(row['due']).toBe('2026-12-01')
	})
})
