import { TFile } from 'obsidian'
import { RowData } from '@tanstack/react-table'

// ── Column types ────────────────────────────────────────────────────────────

export type ColumnType =
	| 'title'
	| 'text'
	| 'number'
	| 'select'
	| 'multiselect'
	| 'date'
	| 'checkbox'
	| 'formula'

export interface SelectOption {
	value: string
	color?: string
}

export interface ColumnSchema {
	id: string
	name: string
	type: ColumnType
	visible: boolean
	width?: number
	options?: SelectOption[]  // select / multiselect
	formula?: string          // formula
}

// ── View / filter / sort ────────────────────────────────────────────────────

export type FilterOperator =
	| 'contains'
	| 'not_contains'
	| 'starts_with'
	| 'ends_with'
	| 'is'
	| 'is_not'
	| 'is_empty'
	| 'is_not_empty'

export interface FilterConfig {
	id: string
	columnId: string
	operator: FilterOperator
	value: string
}

export interface SortConfig {
	columnId: string
	direction: 'asc' | 'desc'
}

export interface ViewConfig {
	id: string
	type: 'table'
	filters: FilterConfig[]
	sorts: SortConfig[]
	hiddenColumns: string[]
	columnWidths: Record<string, number>
	activePills?: { columnId: string; operator: FilterOperator; value: string }[]
}

// ── Database config (stored in _database.md frontmatter) ───────────────────

export interface DatabaseConfig {
	schema: ColumnSchema[]
	views: ViewConfig[]
}

export const DEFAULT_VIEW: ViewConfig = {
	id: 'default',
	type: 'table',
	filters: [],
	sorts: [],
	hiddenColumns: [],
	columnWidths: {},
}

export const DEFAULT_DATABASE_CONFIG: DatabaseConfig = {
	schema: [],
	views: [DEFAULT_VIEW],
}

// ── Row data ────────────────────────────────────────────────────────────────

export interface NoteRow {
	_file: TFile
	_title: string
	[key: string]: unknown
}

// ── TanStack Table meta augmentation ────────────────────────────────────────

declare module '@tanstack/react-table' {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	interface TableMeta<TData extends RowData> {
		updateCell: (rowIndex: number, columnId: string, value: unknown) => Promise<void>
		editingCell: { rowIndex: number; columnId: string } | null
		setEditingCell: (cell: { rowIndex: number; columnId: string } | null) => void
		schema: ColumnSchema[]
	}
}
