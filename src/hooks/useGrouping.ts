import { useCallback, useEffect, useMemo, useState } from 'react'
import { ColumnSchema, ViewConfig } from '../types'
import { buildGroups, getGroupableColumns, GroupDef } from '../components/group-utils'

interface GroupingResult<T> {
	groupableColumns: ColumnSchema[]
	groupByCol: ColumnSchema | null
	/** null when the view is not grouped, so callers can keep their flat render path. */
	groups: GroupDef<T>[] | null
	collapsedGroups: Set<string>
	toggleGroup: (value: string) => void
	collapseAll: () => void
	expandAll: () => void
}

/**
 * Grouping state shared by the table, list and gallery views.
 *
 * Collapsed state lives here and is deliberately not persisted: writing it to
 * the view config would rewrite _database.md on every toggle.
 */
export function useGrouping<T>(
	schema: ColumnSchema[],
	view: ViewConfig,
	items: T[],
	getValue: (item: T, columnId: string) => unknown,
): GroupingResult<T> {
	const groupableColumns = useMemo(() => getGroupableColumns(schema), [schema])
	const groupByCol = useMemo(
		() => schema.find(c => c.id === view.groupByColumnId) ?? null,
		[schema, view.groupByColumnId],
	)
	const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

	// Two columns can share an option value ("High"), so a stale collapse would
	// carry over to the new axis. Start every axis fully expanded.
	useEffect(() => { setCollapsedGroups(new Set()) }, [groupByCol?.id])

	const groups = useMemo(() => {
		if (!groupByCol) return null
		return buildGroups(items, item => getValue(item, groupByCol.id), groupByCol, {
			order: view.boardColumnOrder,
			hideEmpty: view.boardHideEmpty,
			hideNoValue: view.boardHideNoValue,
		})
	}, [groupByCol, items, getValue, view.boardColumnOrder, view.boardHideEmpty, view.boardHideNoValue])

	const toggleGroup = useCallback((value: string) => {
		setCollapsedGroups(prev => {
			const next = new Set(prev)
			if (next.has(value)) next.delete(value)
			else next.add(value)
			return next
		})
	}, [])

	const collapseAll = useCallback(() => {
		setCollapsedGroups(new Set((groups ?? []).map(g => g.value)))
	}, [groups])

	const expandAll = useCallback(() => setCollapsedGroups(new Set()), [])

	return { groupableColumns, groupByCol, groups, collapsedGroups, toggleGroup, collapseAll, expandAll }
}
