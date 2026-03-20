import en from './en'

const zh: Partial<Record<keyof typeof en, string>> = {
	// View types
	view_table: '表格',
	view_list: '列表',
	view_board: '看板',
	view_gallery: '画廊',
	view_calendar: '日历',
	view_timeline: '时间线',
	view_chart: '图表',

	// View tabs
	add_view: '添加视图',
	remove_view: '删除视图',
	rename_view_hint: '双击重命名',

	// Toolbar buttons
	fields: '字段',
	filter: '筛选',
	filters: '筛选',
	sort: '排序',
	actions: '操作',
	group_by: '分组',
	cover: '封面',
	date_field: '日期',
	start_field: '开始',
	end_field: '结束',
	group_field: '分组',

	// Dropdown labels
	fields_in_card: '卡片中的字段',
	fields_label: '字段',
	fields_on_bars: '条形上的字段',
	filter_by: '筛选条件',
	sort_by: '排序条件',
	group_by_label: '分组条件',
	date_field_label: '日期字段',
	cover_field_label: '封面字段',
	card_size_label: '卡片大小',
	row_height_label: '行高',

	// Common values
	none_value: '无',
	no_value: '无值',
	no_cover: '无',

	// Card sizes
	size_small: '小',
	size_medium: '中',
	size_large: '大',

	// Row heights
	height_compact: '紧凑',
	height_medium: '中等',
	height_tall: '高',

	// Filter/Sort
	add_filter_advanced: '添加高级筛选',
	add_sort: '添加排序',
	no_active_sorts: '无活跃排序',
	name_column: '名称',

	// Conjunction pills
	conjunction_and: '且',
	conjunction_or: '或',

	// Filter value placeholders
	filter_number_placeholder: '数字...',
	filter_value_placeholder: '值...',

	// Actions menu
	delete_selected: '删除所有选中项',
	move_selected: '移动所有选中项',
	duplicate_selected: '复制所有选中项',
	export_csv: '导出 CSV',
	import_csv: '导入 CSV',

	// Context menu (single note)
	open_note: '打开笔记',
	delete_note: '删除笔记',
	duplicate_note: '复制笔记',

	// Sort directions
	sort_asc: '升序',
	sort_desc: '降序',
	sort_asc_title: '降序排列',
	sort_desc_title: '移除排序',
	sort_none_title: '升序排列',

	// Column header menu
	rename_column: '重命名',
	edit_formula: '编辑公式',
	configure_lookup: '配置 lookup',
	configure_relation: '配置关联',
	format_number: '数字格式',
	configure_image_folder: '配置图片文件夹',
	field_type_label: '字段类型',
	hide_field: '隐藏字段',
	delete_field: '删除字段',

	// Column types
	type_title: '标题',
	type_text: '文本',
	type_number: '数字',
	type_select: '单选',
	type_multiselect: '多选',
	type_date: '日期',
	type_checkbox: '复选框',
	type_url: 'URL',
	type_email: '邮箱',
	type_phone: '电话',
	type_status: '状态',
	type_formula: '公式',
	type_relation: '关联',
	type_lookup: 'Lookup',
	type_rollup: 'Rollup',
	rollup_panel_title: 'Rollup',
	configure_rollup: '配置 rollup',
	rollup_select_relation: '1. 关联列',
	rollup_select_relation_placeholder: '选择关联...',
	rollup_select_target: '2. 目标列',
	rollup_select_target_placeholder: '选择列...',
	rollup_select_function: '3. 聚合函数',
	rollup_no_relations: '未找到关联列。请先添加一个关联列。',
	rollup_fn_sum: '求和',
	rollup_fn_count: '计数',
	rollup_fn_avg: '平均值',
	rollup_fn_min: '最小值',
	rollup_fn_max: '最大值',
	rollup_fn_count_values: '计唯一值',
	rollup_fn_list: '列出全部',
	type_image: '图片',
	type_audio: '音频',
	audio_path_placeholder: '音频文件路径...',
	audio_select_placeholder: '选择音频...',
	audio_picker_title: '选择音频',
	audio_picker_clear: '清除',
	audio_picker_empty_folder: '文件夹中没有音频文件',
	audio_picker_empty_vault: '仓库中没有音频文件',
	audio_panel_title: '音频设置',
	audio_folder_label: '来源文件夹（留空则使用整个仓库）',
	audio_folder_placeholder: '例：audio/music',
	configure_audio_folder: '配置音频文件夹',

	// Video column
	type_video: '视频',
	video_select_placeholder: '选择视频...',
	video_picker_clear: '清除',
	video_picker_empty_folder: '文件夹中没有视频文件',
	video_picker_empty_vault: '仓库中没有视频文件',
	video_panel_title: '视频设置',
	video_folder_label: '来源文件夹（留空则使用整个仓库）',
	video_folder_placeholder: '例：video/clips',
	configure_video_folder: '配置视频文件夹',

	// Formula panel
	formula_panel_title: '公式',
	formula_placeholder: '示例：if(status = "done", 1, 0)',
	formula_valid: '语法正确',
	formula_available_cols: '可用列：',
	formula_ref_toggle: '函数参考',
	formula_save: '保存',
	formula_cancel: '取消',
	formula_save_hint: '保存 (Ctrl+Enter)',

	// Formula reference groups
	formula_group_logic: '逻辑',
	formula_group_comparators: '比较',
	formula_group_aggregators: '聚合',
	formula_group_text: '文本',
	formula_group_math: '数学',
	formula_group_utils: '工具',

	// Number format panel
	number_format_title: '格式',
	number_decimals_label: '小数位数',
	number_thousands_label: '千位分隔符',
	number_prefix_label: '前缀',
	number_suffix_label: '后缀',
	number_prefix_placeholder: '例：$、¥',
	number_suffix_placeholder: '例：%、kg、km',
	number_remove_format: '移除格式',

	// Lookup/Relation panel
	relation_panel_title: '关联',
	lookup_panel_title: 'Lookup',
	lookup_ref_table: '1. 引用表',
	lookup_select_table: '选择表...',
	lookup_col_to_display: '2. 显示列',
	lookup_origin_col: '2. 值的来源字段',
	lookup_select_col: '选择列...',
	lookup_file_name: '文件名',
	lookup_join_col: '3. 连接列（本表）',
	lookup_join_col_title: '文件名（按标题连接）',
	lookup_select_join_col: '选择列...',
	lookup_hint: '此列的值必须与引用表中的文件名匹配',

	// Image config panel
	image_panel_title: '图片',
	image_folder_label: '来源文件夹（可选）',
	image_folder_placeholder: '例：images/covers',

	// Image picker
	image_picker_title: '选择图片',
	image_picker_clear: '清除',
	image_picker_empty_vault: '仓库中未找到图片',
	image_picker_empty_folder: '未找到图片于',
	image_select_placeholder: '选择图片…',

	// Aggregations
	agg_none: '无',
	agg_count: '计数',
	agg_count_values: '计数值',
	agg_sum: '求和',
	agg_avg: '平均值',
	agg_min: '最小值',
	agg_max: '最大值',

	// Empty states / loading
	no_database_open: '未打开数据库。',
	no_database_hint: '使用工具栏按钮或"创建新数据库"命令。',
	loading: '加载中...',
	no_results: '未找到项目',

	// Row/item counts
	item_singular: '项',
	item_plural: '项',
	row_singular: '行',
	row_plural: '行',
	record_singular: '记录',
	record_plural: '记录',

	// Add row/entry
	add_row: '新建行',
	add_entry: '新建条目',
	add_card: '新建卡片',
	new_field: '新字段',
	add_field: '添加字段',

	// Board
	board_no_select_col: '看板需要一个单选或状态列来分组卡片。',
	board_add_select_hint: '在表格视图中添加该类型的列，然后回到这里。',
	board_drag_reorder: '拖动以重新排序',
	board_set_limit: '点击设置卡片限制',
	board_limit_placeholder: '限制 (0 = 无)',
	board_show_more: '更多',
	board_show_less: '收起',
	hide_empty_cols: '隐藏空列',
	hide_no_value_cols: '隐藏无值列',

	// Calendar
	calendar_no_date_field: '在工具栏中选择一个日期字段以显示日历。',
	calendar_no_date_section: '无日期',
	calendar_click_to_create: '点击创建笔记',
	calendar_today: '今天',
	calendar_prev_month: '上个月',
	calendar_next_month: '下个月',
	calendar_view_month: '月',
	calendar_view_week: '周',
	calendar_prev_week: '上一周',
	calendar_next_week: '下一周',
	calendar_add_time: '添加时间',
	calendar_remove_time: '移除时间',
	calendar_all_day: '全天',

	// Calendar days (short)
	day_sun: '日',
	day_mon: '一',
	day_tue: '二',
	day_wed: '三',
	day_thu: '四',
	day_fri: '五',
	day_sat: '六',

	// Calendar months (long)
	month_january: '一月',
	month_february: '二月',
	month_march: '三月',
	month_april: '四月',
	month_may: '五月',
	month_june: '六月',
	month_july: '七月',
	month_august: '八月',
	month_september: '九月',
	month_october: '十月',
	month_november: '十一月',
	month_december: '十二月',

	// Timeline
	timeline_no_start_field: '在工具栏中选择一个开始字段以显示时间线。',
	timeline_no_interval: '无间隔',
	timeline_scroll_prev: '向前滚动',
	timeline_scroll_next: '向后滚动',
	zoom_days: '天',
	zoom_weeks: '周',
	zoom_months: '月',

	// Timeline months (short)
	month_short_jan: '1月',
	month_short_feb: '2月',
	month_short_mar: '3月',
	month_short_apr: '4月',
	month_short_may: '5月',
	month_short_jun: '6月',
	month_short_jul: '7月',
	month_short_aug: '8月',
	month_short_sep: '9月',
	month_short_oct: '10月',
	month_short_nov: '11月',
	month_short_dec: '12月',

	// Chart view
	chart_configure: '配置',
	chart_type: '图表类型',
	chart_type_bar: '柱状图',
	chart_type_line: '折线图',
	chart_type_pie: '饼图',
	chart_x_axis: '分类 (X 轴)',
	chart_y_axis: '数值 (Y 轴)',
	chart_aggregation: '聚合',
	chart_select_column: '选择列...',
	chart_count_records: '计数',
	chart_no_config: '请配置图表以开始使用。',
	chart_no_config_hint: '在上方工具栏中选择一个分类列。',

	// Misc tooltips
	tooltip_pin_column: '固定到此列',
	tooltip_unpin_column: '取消固定列',
	tooltip_resize_column: '拖动调整大小；双击适应内容',
	tooltip_wrap_text: '文字换行',
	tooltip_include_subfolders: '包含子文件夹',
	folder_column: '文件夹',
	tooltip_manage_fields: '管理字段',
	tooltip_batch_actions: '批量操作',
	tooltip_remove_filter: '移除筛选',
	tooltip_close: '关闭',
	tooltip_remove: '移除',
	tooltip_move_up: '上移',
	tooltip_move_down: '下移',
	tooltip_change_color: '更改颜色',
	tooltip_delete_status: '删除状态',

	// Status defaults
	status_not_started: '未开始',
	status_in_progress: '进行中',
	status_done: '已完成',
	status_cancelled: '已取消',

	// Relation cell
	relation_search_placeholder: '搜索...',
	relation_clear: '清除',
	relation_no_results: '无结果',
	relation_two_way: '双向关联',
	relation_two_way_hint: '自动在目标数据库中创建反向关联',

	// Select cell
	select_clear: '清除',
	select_create_placeholder: '创建新选项...',

	// Status cell
	status_new_placeholder: '新状态...',
	color_custom: '自定义',

	// Type change validation errors
	validate_non_numeric: '单元格包含非数字值（例："',
	validate_invalid_dates: '单元格包含无效日期值（例："',
	validate_invalid_checkbox: '单元格包含与复选框不兼容的值（例："',
	validate_multiselect_to_select: '行有多个选中值。请在切换到单选前移除多余的值。',
	validate_invalid_email: '单元格包含无效邮箱值（例："',
	validate_invalid_url: '单元格包含无效 URL 值（例："',
	validate_invalid_phone: '单元格包含无效电话号码（例："',
	validate_type_change_prefix: '无法更改类型：',

	// Cell validation
	email_invalid: '无效邮箱',

	// Filter operators
	op_is: '等于',
	op_is_not: '不等于',
	op_contains: '包含',
	op_not_contains: '不包含',
	op_starts_with: '开头是',
	op_ends_with: '结尾是',
	op_is_empty: '为空',
	op_is_not_empty: '不为空',
	op_gt: '>',
	op_gte: '>=',
	op_lt: '<',
	op_lte: '<=',
	op_is_checked: '已勾选',
	op_is_unchecked: '未勾选',

	// Settings tab
	settings_db_filename_name: '数据库文件名',
	settings_db_filename_desc: '用于标识文件夹中数据库的特殊文件名。',
	settings_row_height_name: '默认行高',
	settings_row_height_desc: '每个表格行的像素高度。',

	// Database manager
	db_untitled_note: '未命名',
	db_copy_suffix: '(副本)',
	db_copy_suffix_n: '(副本 $n)',
	db_already_exists: '"$folder" 中已存在数据库',
	db_tip_body: '此文件是一个数据库。打开它以查看表格视图。',

	// Formula errors
	formula_err_unclosed_string: '位置 $pos 处字符串未关闭',
	formula_err_unclosed_bracket: '位置 $pos 处括号未关闭',
	formula_err_unexpected_bang: "位置 $pos 处出现意外字符 '!'",
	formula_err_unexpected_char: "位置 $pos 处出现意外字符 '$char'",
	formula_err_expected_token: "位置 $pos 处期望 $expected，找到 '$found'",
	formula_err_unexpected_token: "位置 $pos 处出现意外标记 '$token'",
	formula_err_circular_ref: '循环引用："$name" 是一个公式列',
	formula_err_unknown_fn: '未知函数：$fn()',
	formula_err_if_args: '期望 if(条件, 真值, [假值])',
	formula_err_avg_args: '期望 avg(列) — 需要列引用作为参数',
	formula_err_count_args: '期望 count(列) — 需要列引用作为参数',
	formula_err_mid_args: '期望 mid(文本, 起始, 长度)',
	formula_err_mod_args: '期望 mod(数字, 除数)',
	formula_err_sqrt_args: '期望 sqrt(数字)',
	formula_err_not_implemented: '函数未实现：$fn()',

	// Plugin
	plugin_display_name: 'Notion bases',
	no_databases_found: '未找到数据库。使用"创建新数据库"命令来创建一个。',

	// Commands
	cmd_open_database: '打开此文件夹的数据库',
	cmd_create_database: '在当前文件夹创建新数据库',

	// Picker / View
	picker_placeholder: '选择数据库...',
	picker_root: '/（根目录）',
	view_fallback_name: '数据库',
}

export default zh
