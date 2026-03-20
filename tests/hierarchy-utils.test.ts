import { describe, it, expect } from 'vitest'
import { findHierarchyColumn, buildHierarchyTree } from '../src/hierarchy-utils'
import { ColumnSchema, NoteRow } from '../src/types'
import { TFile } from 'obsidian'

function makeRow(title: string, parentCol?: string, parentValues?: string[]): NoteRow {
	const file = new TFile()
	file.path = `db/${title}.md`
	file.basename = title
	const row: NoteRow = { _file: file, _title: title }
	if (parentCol && parentValues) row[parentCol] = parentValues
	return row
}

const DB_PATH = 'db/_database.md'

const hierarchyCol: ColumnSchema = {
	id: 'parent',
	name: 'Parent',
	type: 'relation',
	visible: true,
	refDatabasePath: DB_PATH,
	refColumnId: '_title',
	isHierarchical: true,
}

const nonHierarchyCol: ColumnSchema = {
	id: 'rel',
	name: 'Rel',
	type: 'relation',
	visible: true,
	refDatabasePath: 'other/_database.md',
	refColumnId: '_title',
}

describe('findHierarchyColumn', () => {
	it('finds the hierarchy column', () => {
		const result = findHierarchyColumn([nonHierarchyCol, hierarchyCol], DB_PATH)
		expect(result).toBe(hierarchyCol)
	})

	it('returns null when no hierarchy column exists', () => {
		expect(findHierarchyColumn([nonHierarchyCol], DB_PATH)).toBeNull()
	})

	it('returns null when self-relation is not marked hierarchical', () => {
		const col = { ...hierarchyCol, isHierarchical: undefined }
		expect(findHierarchyColumn([col], DB_PATH)).toBeNull()
	})
})

describe('buildHierarchyTree', () => {
	it('returns flat list when no parent-child relationships', () => {
		const rows = [makeRow('A'), makeRow('B'), makeRow('C')]
		const result = buildHierarchyTree(rows, 'parent', [], new Set(), true)
		expect(result).toHaveLength(3)
		expect(result.every(r => r.depth === 0)).toBe(true)
		expect(result.every(r => !r.hasChildren)).toBe(true)
	})

	it('builds simple parent-child hierarchy', () => {
		const rows = [
			makeRow('Parent'),
			makeRow('Child1', 'parent', ['Parent']),
			makeRow('Child2', 'parent', ['Parent']),
		]
		const result = buildHierarchyTree(rows, 'parent', [], new Set(), true)
		expect(result).toHaveLength(3)
		expect(result[0].row._title).toBe('Parent')
		expect(result[0].depth).toBe(0)
		expect(result[0].hasChildren).toBe(true)
		expect(result[1].row._title).toBe('Child1')
		expect(result[1].depth).toBe(1)
		expect(result[2].row._title).toBe('Child2')
		expect(result[2].depth).toBe(1)
	})

	it('handles 3 levels deep', () => {
		const rows = [
			makeRow('Root'),
			makeRow('L1', 'parent', ['Root']),
			makeRow('L2', 'parent', ['L1']),
			makeRow('L3', 'parent', ['L2']),
		]
		const result = buildHierarchyTree(rows, 'parent', [], new Set(), true)
		expect(result).toHaveLength(4)
		expect(result[0].depth).toBe(0)
		expect(result[1].depth).toBe(1)
		expect(result[2].depth).toBe(2)
		expect(result[3].depth).toBe(3)
	})

	it('enforces max depth of 3 (4th level not expanded)', () => {
		const rows = [
			makeRow('Root'),
			makeRow('L1', 'parent', ['Root']),
			makeRow('L2', 'parent', ['L1']),
			makeRow('L3', 'parent', ['L2']),
			makeRow('L4', 'parent', ['L3']),
		]
		const result = buildHierarchyTree(rows, 'parent', [], new Set(), true)
		// L3 at depth 3 has children (L4), but they are not expanded beyond max depth
		const l3 = result.find(r => r.row._title === 'L3')
		expect(l3?.depth).toBe(3)
		expect(l3?.hasChildren).toBe(true)
		// L4 should NOT appear in the result as a nested child
		const l4 = result.find(r => r.row._title === 'L4')
		expect(l4).toBeUndefined()
	})

	it('detects and breaks circular references', () => {
		const rows = [
			makeRow('A', 'parent', ['B']),
			makeRow('B', 'parent', ['A']),
		]
		const result = buildHierarchyTree(rows, 'parent', [], new Set(), true)
		// Both reference each other — should not infinite loop
		// At least one must be a root
		expect(result.length).toBeGreaterThan(0)
		expect(result.length).toBeLessThanOrEqual(2)
	})

	it('handles self-reference gracefully', () => {
		const rows = [makeRow('Self', 'parent', ['Self'])]
		const result = buildHierarchyTree(rows, 'parent', [], new Set(), true)
		expect(result).toHaveLength(1)
		expect(result[0].depth).toBe(0)
	})

	it('treats rows with non-existent parent as roots', () => {
		const rows = [
			makeRow('Orphan', 'parent', ['NonExistent']),
			makeRow('Root'),
		]
		const result = buildHierarchyTree(rows, 'parent', [], new Set(), true)
		expect(result).toHaveLength(2)
		expect(result.every(r => r.depth === 0)).toBe(true)
	})

	it('collapses children when parent is in expandedSet (allExpanded=true mode)', () => {
		const parent = makeRow('Parent')
		const rows = [
			parent,
			makeRow('Child', 'parent', ['Parent']),
		]
		const collapsed = new Set([parent._file.path])
		const result = buildHierarchyTree(rows, 'parent', [], collapsed, true)
		expect(result).toHaveLength(1)
		expect(result[0].row._title).toBe('Parent')
		expect(result[0].hasChildren).toBe(true)
	})

	it('only shows expanded rows when allExpanded=false', () => {
		const parent = makeRow('Parent')
		const rows = [
			parent,
			makeRow('Child', 'parent', ['Parent']),
		]
		const expanded = new Set([parent._file.path])
		const result = buildHierarchyTree(rows, 'parent', [], expanded, false)
		expect(result).toHaveLength(2)
	})

	it('sorts parents and children independently (sort by group)', () => {
		const rows = [
			makeRow('Z-Parent'),
			makeRow('A-Parent'),
			makeRow('Z-Child', 'parent', ['A-Parent']),
			makeRow('A-Child', 'parent', ['A-Parent']),
		]
		const sorts = [{ columnId: '_title', direction: 'asc' as const }]
		const result = buildHierarchyTree(rows, 'parent', sorts, new Set(), true)
		expect(result[0].row._title).toBe('A-Parent')
		expect(result[1].row._title).toBe('A-Child')
		expect(result[2].row._title).toBe('Z-Child')
		expect(result[3].row._title).toBe('Z-Parent')
	})

	it('handles empty rows array', () => {
		const result = buildHierarchyTree([], 'parent', [], new Set(), true)
		expect(result).toHaveLength(0)
	})

	it('handles multiple children per parent', () => {
		const rows = [
			makeRow('Parent'),
			makeRow('C1', 'parent', ['Parent']),
			makeRow('C2', 'parent', ['Parent']),
			makeRow('C3', 'parent', ['Parent']),
		]
		const result = buildHierarchyTree(rows, 'parent', [], new Set(), true)
		expect(result).toHaveLength(4)
		expect(result[0].hasChildren).toBe(true)
		expect(result.filter(r => r.depth === 1)).toHaveLength(3)
	})
})
