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
	| 'url'
	| 'email'
	| 'phone'
	| 'status'
	| 'formula'
	| 'relation'
	| 'lookup'
	| 'rollup'
	| 'image'
	| 'audio'
	| 'video'

export interface SelectOption {
	value: string
	color?: string
}

export interface NumberFormat {
	decimals: number
	thousandsSeparator: boolean
	prefix?: string
	suffix?: string
}

export interface ColumnSchema {
	id: string
	name: string
	type: ColumnType
	visible: boolean
	width?: number
	options?: SelectOption[]  // select / multiselect
	formula?: string          // formula
	refDatabasePath?: string  // lookup
	refColumnId?: string      // lookup
	refMatchColumnId?: string // lookup
	pairedColumnId?: string   // two-way relation: column id in the target database
	numberFormat?: NumberFormat
	imageSourceFolder?: string
	audioSourceFolder?: string
	videoSourceFolder?: string
	rollupRelationColumnId?: string   // rollup: which relation column to aggregate from
	rollupTargetColumnId?: string     // rollup: which column in the target database
	rollupFunction?: RollupFunction   // rollup: aggregation function
	isHierarchical?: boolean          // self-relation used as hierarchy parent column
}

// ── View / filter / sort ────────────────────────────────────────────────────

export type FilterOperator =
	| 'contains'
	| 'not_contains'
	| 'starts_with'
	| 'ends_with'
	| 'is'
	| 'is_not'
	| 'gt'
	| 'lt'
	| 'gte'
	| 'lte'
	| 'is_checked'
	| 'is_unchecked'
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

export type RollupFunction = 'sum' | 'count' | 'avg' | 'min' | 'max' | 'count_values' | 'list'

export type AggregationType = 'none' | 'count' | 'count_values' | 'sum' | 'avg' | 'min' | 'max'

export interface ViewConfig {
	id: string
	name?: string
	type: 'table' | 'list' | 'board' | 'gallery' | 'calendar' | 'timeline' | 'chart'
	filters: FilterConfig[]
	sorts: SortConfig[]
	hiddenColumns: string[]
	columnWidths: Record<string, number>
	activePills?: { id: string; columnId: string; operator: FilterOperator; value: string; conjunction?: 'and' | 'or' }[]
	pinnedColumnId?: string | null
	columnOrder?: string[]
	rowHeight?: 'compact' | 'medium' | 'tall'
	aggregations?: Record<string, AggregationType>
	wrapText?: boolean
	groupByColumnId?: string
	boardColumnOrder?: string[]
	boardColumnLimits?: Record<string, number>
	galleryCoverField?: string
	galleryCardSize?: 'small' | 'medium' | 'large'
	calendarDateField?: string
	calendarViewMode?: 'month' | 'week'
	timelineStartField?: string
	timelineEndField?: string
	timelineZoom?: 'days' | 'weeks' | 'months'
	timelineGroupByField?: string
	includeSubfolders?: boolean
	chartType?: 'bar' | 'pie' | 'line'
	chartXAxis?: string
	chartYAxis?: string
	chartAggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max'
	rowOrder?: string[]
	conditionalFormats?: ConditionalFormatRule[]
}

export interface ConditionalFormatRule {
	id: string
	columnId: string
	operator: FilterOperator
	value: string
	bgColor: string
	textColor: string
}

// ── Embed multi-view state (stored in hosting note frontmatter) ─────────────

export interface EmbedState {
	activeViewId: string
	views: ViewConfig[]  // embed's own view list, fully independent from the database
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
	pinnedColumnId: null,
}

export const DEFAULT_DATABASE_CONFIG: DatabaseConfig = {
	schema: [],
	views: [DEFAULT_VIEW],
}

// ── Inline field metadata ───────────────────────────────────────────────────

export interface InlineFieldMeta {
	format: 'standalone' | 'bracketed' | 'parenthesized'
	rawKey: string
	rawValue: string
	lineNumber: number
	fullMatch: string
}

// ── Row data ────────────────────────────────────────────────────────────────

export interface NoteRow {
	_file: TFile
	_title: string
	_inlineFields?: Record<string, InlineFieldMeta>
	[key: string]: unknown
}

// ── TanStack Table meta augmentation ────────────────────────────────────────

declare module '@tanstack/react-table' {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars -- TData generic is required by TanStack Table module augmentation signature
	interface TableMeta<TData extends RowData> {
		updateCell: (rowIndex: number, columnId: string, value: unknown) => Promise<void>
		editingCell: { rowIndex: number; columnId: string } | null
		setEditingCell: (cell: { rowIndex: number; columnId: string } | null) => void
		schema: ColumnSchema[]
	}
}
