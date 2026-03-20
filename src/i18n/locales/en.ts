const en = {
	// View types
	view_table: 'Table',
	view_list: 'List',
	view_board: 'Board',
	view_gallery: 'Gallery',
	view_calendar: 'Calendar',
	view_timeline: 'Timeline',
	view_chart: 'Chart',

	// View tabs
	add_view: 'Add view',
	remove_view: 'Remove view',
	rename_view_hint: 'Double-click to rename',

	// Toolbar buttons
	fields: 'Fields',
	filter: 'Filter',
	filters: 'Filters',
	sort: 'Sort',
	actions: 'Actions',
	group_by: 'Group by',
	cover: 'Cover',
	date_field: 'Date',
	start_field: 'Start',
	end_field: 'End',
	group_field: 'Group',

	// Dropdown labels
	fields_in_card: 'Fields in card',
	fields_label: 'Fields',
	fields_on_bars: 'Fields on bars',
	filter_by: 'Filter by',
	sort_by: 'Sort by',
	group_by_label: 'Group by',
	date_field_label: 'Date field',
	cover_field_label: 'Cover field',
	card_size_label: 'Card size',
	row_height_label: 'Row height',

	// Common values
	none_value: 'None',
	no_value: 'No value',
	no_cover: 'None',

	// Card sizes
	size_small: 'Small',
	size_medium: 'Medium',
	size_large: 'Large',

	// Row heights
	height_compact: 'Compact',
	height_medium: 'Medium',
	height_tall: 'Tall',

	// Filter/Sort
	add_filter_advanced: 'Add advanced filter',
	add_sort: 'Add sort',
	no_active_sorts: 'No active sorts',
	name_column: 'Name',

	// Conjunction pills
	conjunction_and: 'AND',
	conjunction_or: 'OR',

	// Filter value placeholders
	filter_number_placeholder: 'Number...',
	filter_value_placeholder: 'Value...',

	// Actions menu
	delete_selected: 'Delete all selected',
	move_selected: 'Move all selected',
	duplicate_selected: 'Duplicate all selected',
	export_csv: 'Export CSV',
	import_csv: 'Import CSV',

	// Context menu (single note)
	open_note: 'Open note',
	delete_note: 'Delete note',
	duplicate_note: 'Duplicate note',

	// Sort directions
	sort_asc: 'Ascending',
	sort_desc: 'Descending',
	sort_asc_title: 'Sort descending',
	sort_desc_title: 'Remove sort',
	sort_none_title: 'Sort ascending',

	// Column header menu
	rename_column: 'Rename',
	edit_formula: 'Edit formula',
	configure_lookup: 'Configure lookup',
	configure_relation: 'Configure relation',
	format_number: 'Format number',
	configure_image_folder: 'Configure image folder',
	field_type_label: 'Field type',
	hide_field: 'Hide field',
	delete_field: 'Delete field',

	// Column types
	type_title: 'Title',
	type_text: 'Text',
	type_number: 'Number',
	type_select: 'Select',
	type_multiselect: 'Multi-select',
	type_date: 'Date',
	type_checkbox: 'Checkbox',
	type_url: 'URL',
	type_email: 'Email',
	type_phone: 'Phone',
	type_status: 'Status',
	type_formula: 'Formula',
	type_relation: 'Relation',
	type_lookup: 'Lookup',
	type_rollup: 'Rollup',
	rollup_panel_title: 'Rollup',
	configure_rollup: 'Configure rollup',
	rollup_select_relation: '1. Relation column',
	rollup_select_relation_placeholder: 'Select relation...',
	rollup_select_target: '2. Target column',
	rollup_select_target_placeholder: 'Select column...',
	rollup_select_function: '3. Aggregation',
	rollup_no_relations: 'No relation columns found. Add a relation column first.',
	rollup_fn_sum: 'Sum',
	rollup_fn_count: 'Count',
	rollup_fn_avg: 'Average',
	rollup_fn_min: 'Min',
	rollup_fn_max: 'Max',
	rollup_fn_count_values: 'Count unique',
	rollup_fn_list: 'List all',
	type_image: 'Image',
	type_audio: 'Audio',
	audio_path_placeholder: 'Path to audio file...',
	audio_select_placeholder: 'Select audio...',
	audio_picker_title: 'Select audio',
	audio_picker_clear: 'Clear',
	audio_picker_empty_folder: 'No audio files in folder',
	audio_picker_empty_vault: 'No audio files in vault',
	audio_panel_title: 'Audio settings',
	audio_folder_label: 'Source folder (leave empty for entire vault)',
	audio_folder_placeholder: 'Ex: audio/music',
	configure_audio_folder: 'Configure audio folder',

	// Video column
	type_video: 'Video',
	video_select_placeholder: 'Select video...',
	video_picker_clear: 'Clear',
	video_picker_empty_folder: 'No video files in folder',
	video_picker_empty_vault: 'No video files in vault',
	video_panel_title: 'Video settings',
	video_folder_label: 'Source folder (leave empty for entire vault)',
	video_folder_placeholder: 'Ex: video/clips',
	configure_video_folder: 'Configure video folder',

	// Formula panel
	formula_panel_title: 'Formula',
	formula_placeholder: 'Example: if(status = "done", 1, 0)',
	formula_valid: 'Valid syntax',
	formula_available_cols: 'Available columns:',
	formula_ref_toggle: 'Function reference',
	formula_save: 'Save',
	formula_cancel: 'Cancel',
	formula_save_hint: 'Save (Ctrl+Enter)',

	// Formula reference groups
	formula_group_logic: 'Logic',
	formula_group_comparators: 'Comparators',
	formula_group_aggregators: 'Aggregators',
	formula_group_text: 'Text',
	formula_group_math: 'Math',
	formula_group_utils: 'Utilities',

	// Number format panel
	number_format_title: 'Format',
	number_decimals_label: 'Decimal places',
	number_thousands_label: 'Thousands separator',
	number_prefix_label: 'Prefix',
	number_suffix_label: 'Suffix',
	number_prefix_placeholder: 'Ex: $, €',
	number_suffix_placeholder: 'Ex: %, kg, km',
	number_remove_format: 'Remove formatting',

	// Lookup/Relation panel
	relation_panel_title: 'Relation',
	lookup_panel_title: 'Lookup',
	lookup_ref_table: '1. Reference table',
	lookup_select_table: 'Select table...',
	lookup_col_to_display: '2. Column to display',
	lookup_origin_col: '2. Source field for values',
	lookup_select_col: 'Select column...',
	lookup_file_name: 'File name',
	lookup_join_col: '3. Join column (this table)',
	lookup_join_col_title: 'File name (join by title)',
	lookup_select_join_col: 'Select column...',
	lookup_hint: 'The value of this column must match the file name in the referenced table',

	// Image config panel
	image_panel_title: 'Image',
	image_folder_label: 'Source folder (optional)',
	image_folder_placeholder: 'Ex: images/covers',

	// Image picker
	image_picker_title: 'Select image',
	image_picker_clear: 'Clear',
	image_picker_empty_vault: 'No images found in vault',
	image_picker_empty_folder: 'No images found in',
	image_select_placeholder: 'Select image…',

	// Aggregations
	agg_none: 'None',
	agg_count: 'Count',
	agg_count_values: 'Count values',
	agg_sum: 'Sum',
	agg_avg: 'Average',
	agg_min: 'Min',
	agg_max: 'Max',

	// Empty states / loading
	no_database_open: 'No database open.',
	no_database_hint: 'Use the ribbon button or the "create new database" command.',
	loading: 'Loading...',
	no_results: 'No items found',

	// Row/item counts
	item_singular: 'Item',
	item_plural: 'Items',
	row_singular: 'Row',
	row_plural: 'Rows',
	record_singular: 'Record',
	record_plural: 'Records',

	// Add row/entry
	add_row: 'New row',
	add_entry: 'New entry',
	add_card: 'New card',
	new_field: 'New field',
	add_field: 'Add field',

	// Board
	board_no_select_col: 'The board requires a select or status column to group cards.',
	board_add_select_hint: 'Add a column of that type in the table view and come back here.',
	board_drag_reorder: 'Drag to reorder',
	board_set_limit: 'Click to set card limit',
	board_limit_placeholder: 'Limit (0 = none)',
	board_show_more: 'More',
	board_show_less: 'Show less',
	hide_empty_cols: 'Hide empty',
	hide_no_value_cols: 'Hide no-value',

	// Calendar
	calendar_no_date_field: 'Select a date field in the toolbar to show the calendar.',
	calendar_no_date_section: 'No date',
	calendar_click_to_create: 'Click to create note',
	calendar_today: 'Today',
	calendar_prev_month: 'Previous month',
	calendar_next_month: 'Next month',
	calendar_view_month: 'Month',
	calendar_view_week: 'Week',
	calendar_prev_week: 'Previous week',
	calendar_next_week: 'Next week',
	calendar_add_time: 'Add time',
	calendar_remove_time: 'Remove time',
	calendar_all_day: 'All day',

	// Calendar days (short)
	day_sun: 'Sun',
	day_mon: 'Mon',
	day_tue: 'Tue',
	day_wed: 'Wed',
	day_thu: 'Thu',
	day_fri: 'Fri',
	day_sat: 'Sat',

	// Calendar months (long)
	month_january: 'January',
	month_february: 'February',
	month_march: 'March',
	month_april: 'April',
	month_may: 'May',
	month_june: 'June',
	month_july: 'July',
	month_august: 'August',
	month_september: 'September',
	month_october: 'October',
	month_november: 'November',
	month_december: 'December',

	// Timeline
	timeline_no_start_field: 'Select a start field in the toolbar to show the timeline.',
	timeline_no_interval: 'No interval',
	timeline_scroll_prev: 'Scroll back',
	timeline_scroll_next: 'Scroll forward',
	zoom_days: 'Days',
	zoom_weeks: 'Weeks',
	zoom_months: 'Months',

	// Timeline months (short)
	month_short_jan: 'Jan',
	month_short_feb: 'Feb',
	month_short_mar: 'Mar',
	month_short_apr: 'Apr',
	month_short_may: 'May',
	month_short_jun: 'Jun',
	month_short_jul: 'Jul',
	month_short_aug: 'Aug',
	month_short_sep: 'Sep',
	month_short_oct: 'Oct',
	month_short_nov: 'Nov',
	month_short_dec: 'Dec',

	// Chart view
	chart_configure: 'Configure',
	chart_type: 'Chart type',
	chart_type_bar: 'Bar',
	chart_type_line: 'Line',
	chart_type_pie: 'Pie',
	chart_x_axis: 'Categories (X axis)',
	chart_y_axis: 'Values (Y Axis)',
	chart_aggregation: 'Aggregation',
	chart_select_column: 'Select column...',
	chart_count_records: 'Count',
	chart_no_config: 'Configure the chart to get started.',
	chart_no_config_hint: 'Select a column for categories in the toolbar above.',

	// Misc tooltips
	tooltip_pin_column: 'Pin columns up to here',
	tooltip_unpin_column: 'Unpin columns',
	tooltip_resize_column: 'Drag to resize; double-click to fit content',
	tooltip_wrap_text: 'Wrap text',
	tooltip_include_subfolders: 'Include subfolders',
	folder_column: 'Folder',
	tooltip_manage_fields: 'Manage fields',
	tooltip_batch_actions: 'Batch actions',
	tooltip_remove_filter: 'Remove filter',
	tooltip_close: 'Close',
	tooltip_remove: 'Remove',
	tooltip_move_up: 'Move up',
	tooltip_move_down: 'Move down',
	tooltip_change_color: 'Change color',
	tooltip_delete_status: 'Delete status',

	// Status defaults
	status_not_started: 'Not started',
	status_in_progress: 'In progress',
	status_done: 'Done',
	status_cancelled: 'Cancelled',

	// Relation cell
	relation_search_placeholder: 'Search...',
	relation_clear: 'Clear',
	relation_no_results: 'No results',
	relation_two_way: 'Two-way relation',
	relation_two_way_hint: 'Automatically creates a reverse relation in the target database',

	// Select cell
	select_clear: 'Clear',
	select_create_placeholder: 'Create new option...',

	// Status cell
	status_new_placeholder: 'New status...',
	color_custom: 'Custom',

	// Type change validation errors
	validate_non_numeric: 'Cell(s) contain non-numeric values (e.g.: "',
	validate_invalid_dates: 'Cell(s) contain values that are not valid dates (e.g.: "',
	validate_invalid_checkbox: 'Cell(s) contain values incompatible with checkbox (e.g.: "',
	validate_multiselect_to_select: 'Row(s) have multiple values selected. Remove extras before changing to single select.',
	validate_invalid_email: 'Cell(s) contain values that are not valid emails (e.g.: "',
	validate_invalid_url: 'Cell(s) contain values that are not valid URLs (e.g.: "',
	validate_invalid_phone: 'Cell(s) contain values that are not valid phone numbers (e.g.: "',
	validate_type_change_prefix: 'Cannot change type: ',

	// Cell validation
	email_invalid: 'Invalid email',

	// Filter operators
	op_is: 'Is',
	op_is_not: 'Is not',
	op_contains: 'Contains',
	op_not_contains: 'Does not contain',
	op_starts_with: 'Starts with',
	op_ends_with: 'Ends with',
	op_is_empty: 'Is empty',
	op_is_not_empty: 'Is not empty',
	op_gt: '>',
	op_gte: '>=',
	op_lt: '<',
	op_lte: '<=',
	op_is_checked: 'Is checked',
	op_is_unchecked: 'Is unchecked',

	// Settings tab
	settings_db_filename_name: 'Database file name',
	settings_db_filename_desc: 'Name of the special file that identifies a database in a folder.',
	settings_row_height_name: 'Default row height',
	settings_row_height_desc: 'Height in pixels of each table row.',

	// Database manager
	db_untitled_note: 'Untitled',
	db_copy_suffix: '(copy)',
	db_copy_suffix_n: '(copy $n)',
	db_already_exists: 'A database already exists in "$folder"',
	db_tip_body: 'This file is a database. Open it to see the table view.',

	// Formula errors
	formula_err_unclosed_string: 'Unclosed string at position $pos',
	formula_err_unclosed_bracket: 'Unclosed bracket at position $pos',
	formula_err_unexpected_bang: "Unexpected character '!' at position $pos",
	formula_err_unexpected_char: "Unexpected character '$char' at position $pos",
	formula_err_expected_token: "Expected $expected, found '$found' at position $pos",
	formula_err_unexpected_token: "Unexpected token '$token' at position $pos",
	formula_err_circular_ref: 'Circular reference: "$name" is a formula column',
	formula_err_unknown_fn: 'Unknown function: $fn()',
	formula_err_if_args: 'Expected if(condition, if_true, [if_false])',
	formula_err_avg_args: 'Expected avg(column) — requires a column reference as argument',
	formula_err_count_args: 'Expected count(column) — requires a column reference as argument',
	formula_err_mid_args: 'Expected mid(text, start, length)',
	formula_err_mod_args: 'Expected mod(number, divisor)',
	formula_err_sqrt_args: 'Expected sqrt(number)',
	formula_err_not_implemented: 'Function not implemented: $fn()',

	// Plugin
	plugin_display_name: 'Notion bases',
	no_databases_found: 'No databases found. Use the "create new database" command to create one.',

	// Commands
	cmd_open_database: 'Open database for this folder',
	cmd_create_database: 'Create new database in current folder',

	// Picker / View
	picker_placeholder: 'Select database...',
	picker_root: '/ (root)',
	view_fallback_name: 'Database',
} as const

export default en
