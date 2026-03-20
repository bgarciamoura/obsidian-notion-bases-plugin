import { ColumnSchema, NoteRow, SortConfig } from './types'
import { applySorts } from './components/filter-utils'

const MAX_DEPTH = 3

export interface HierarchyRow {
	row: NoteRow
	depth: number
	hasChildren: boolean
	parentTitle: string | null
}

export function findHierarchyColumn(
	schema: ColumnSchema[],
	dbFilePath: string,
): ColumnSchema | null {
	return schema.find(c =>
		c.type === 'relation' &&
		c.isHierarchical &&
		c.refDatabasePath === dbFilePath,
	) ?? null
}

function getParentTitles(row: NoteRow, colId: string): string[] {
	const val = row[colId]
	if (!val) return []
	if (Array.isArray(val)) return val as string[]
	return [String(val as string | number | boolean)]
}

export function buildHierarchyTree(
	rows: NoteRow[],
	hierarchyColId: string,
	sorts: SortConfig[],
	expandedSet: Set<string>,
	allExpanded: boolean,
): HierarchyRow[] {
	const titleToRow = new Map<string, NoteRow>()
	const childrenMap = new Map<string, NoteRow[]>()
	const childSet = new Set<string>()

	for (const row of rows) {
		titleToRow.set(row._title, row)
	}

	for (const row of rows) {
		const parents = getParentTitles(row, hierarchyColId)
		for (const parentTitle of parents) {
			if (titleToRow.has(parentTitle) && parentTitle !== row._title) {
				const list = childrenMap.get(parentTitle) ?? []
				list.push(row)
				childrenMap.set(parentTitle, list)
				childSet.add(row._file.path)
				break
			}
		}
	}

	// Detect cycles: walk up from each child; if we revisit a node, break the cycle
	for (const row of rows) {
		if (!childSet.has(row._file.path)) continue
		const visited = new Set<string>()
		let current = row._title
		while (current) {
			if (visited.has(current)) {
				// Cycle detected — remove this row from childSet to make it a root
				childSet.delete(row._file.path)
				const parentTitle = getParentTitles(row, hierarchyColId)[0]
				if (parentTitle) {
					const siblings = childrenMap.get(parentTitle)
					if (siblings) {
						const idx = siblings.indexOf(row)
						if (idx >= 0) siblings.splice(idx, 1)
						if (siblings.length === 0) childrenMap.delete(parentTitle)
					}
				}
				break
			}
			visited.add(current)
			const parentRow = titleToRow.get(current)
			if (!parentRow || !childSet.has(parentRow._file.path)) break
			const parentParents = getParentTitles(parentRow, hierarchyColId)
			current = parentParents.find(p => titleToRow.has(p) && p !== parentRow._title) ?? ''
		}
	}

	const roots = rows.filter(r => !childSet.has(r._file.path))
	const sortedRoots = applySorts(roots, sorts)

	const result: HierarchyRow[] = []
	const visited = new Set<string>()

	function flatten(row: NoteRow, depth: number, parentTitle: string | null) {
		if (visited.has(row._title)) return
		visited.add(row._title)

		const children = childrenMap.get(row._title) ?? []
		const hasChildren = children.length > 0

		result.push({ row, depth, hasChildren, parentTitle })

		if (!hasChildren || depth >= MAX_DEPTH) return

		const isExpanded = allExpanded
			? !expandedSet.has(row._file.path)
			: expandedSet.has(row._file.path)

		if (!isExpanded) return

		const sortedChildren = applySorts(children, sorts)
		for (const child of sortedChildren) {
			flatten(child, depth + 1, row._title)
		}
	}

	for (const root of sortedRoots) {
		flatten(root, 0, null)
	}

	return result
}
