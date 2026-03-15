import en from './en'

const ja: Partial<Record<keyof typeof en, string>> = {
	// View types
	view_table: 'テーブル',
	view_list: 'リスト',
	view_board: 'ボード',
	view_gallery: 'ギャラリー',
	view_calendar: 'カレンダー',
	view_timeline: 'タイムライン',

	// View tabs
	add_view: 'ビューを追加',
	remove_view: 'ビューを削除',
	rename_view_hint: 'ダブルクリックで名前変更',

	// Toolbar buttons
	fields: 'フィールド',
	filter: 'フィルター',
	filters: 'フィルター',
	sort: '並べ替え',
	actions: 'アクション',
	group_by: 'グループ化',
	cover: 'カバー',
	date_field: '日付',
	start_field: '開始',
	end_field: '終了',
	group_field: 'グループ',

	// Dropdown labels
	fields_in_card: 'カードのフィールド',
	fields_label: 'フィールド',
	fields_on_bars: 'バーのフィールド',
	filter_by: 'フィルター条件',
	sort_by: '並べ替え条件',
	group_by_label: 'グループ化条件',
	date_field_label: '日付フィールド',
	cover_field_label: 'カバーフィールド',
	card_size_label: 'カードサイズ',
	row_height_label: '行の高さ',

	// Common values
	none_value: 'なし',
	no_value: '値なし',
	no_cover: 'なし',

	// Card sizes
	size_small: '小',
	size_medium: '中',
	size_large: '大',

	// Row heights
	height_compact: 'コンパクト',
	height_medium: '標準',
	height_tall: '高い',

	// Filter/Sort
	add_filter_advanced: '詳細フィルターを追加',
	add_sort: '並べ替えを追加',
	no_active_sorts: 'アクティブな並べ替えなし',
	name_column: '名前',

	// Conjunction pills
	conjunction_and: 'かつ',
	conjunction_or: 'または',

	// Filter value placeholders
	filter_number_placeholder: '数値...',
	filter_value_placeholder: '値...',

	// Actions menu
	delete_selected: '選択項目をすべて削除',
	move_selected: '選択項目をすべて移動',
	duplicate_selected: '選択項目をすべて複製',
	export_csv: 'CSV エクスポート',
	import_csv: 'CSV インポート',

	// Sort directions
	sort_asc: '昇順',
	sort_desc: '降順',
	sort_asc_title: '降順で並べ替え',
	sort_desc_title: '並べ替えを解除',
	sort_none_title: '昇順で並べ替え',

	// Column header menu
	rename_column: '名前変更',
	edit_formula: '数式を編集',
	configure_lookup: 'Lookup を設定',
	configure_relation: 'リレーションを設定',
	format_number: '数値の書式',
	configure_image_folder: '画像フォルダーを設定',
	field_type_label: 'フィールドタイプ',
	hide_field: 'フィールドを非表示',
	delete_field: 'フィールドを削除',

	// Column types
	type_title: 'タイトル',
	type_text: 'テキスト',
	type_number: '数値',
	type_select: '選択',
	type_multiselect: '複数選択',
	type_date: '日付',
	type_checkbox: 'チェックボックス',
	type_url: 'URL',
	type_email: 'メール',
	type_phone: '電話',
	type_status: 'ステータス',
	type_formula: '数式',
	type_relation: 'リレーション',
	type_lookup: 'Lookup',
	type_image: '画像',

	// Formula panel
	formula_panel_title: '数式',
	formula_placeholder: '例：if(status = "done", 1, 0)',
	formula_valid: '構文は正しいです',
	formula_available_cols: '利用可能な列：',
	formula_ref_toggle: '関数リファレンス',
	formula_save: '保存',
	formula_cancel: 'キャンセル',
	formula_save_hint: '保存 (Ctrl+Enter)',

	// Formula reference groups
	formula_group_logic: '論理',
	formula_group_comparators: '比較',
	formula_group_aggregators: '集計',
	formula_group_text: 'テキスト',
	formula_group_math: '数学',
	formula_group_utils: 'ユーティリティ',

	// Number format panel
	number_format_title: '書式',
	number_decimals_label: '小数点以下の桁数',
	number_thousands_label: '桁区切り',
	number_prefix_label: '接頭辞',
	number_suffix_label: '接尾辞',
	number_prefix_placeholder: '例：$、¥',
	number_suffix_placeholder: '例：%、kg、km',
	number_remove_format: '書式を削除',

	// Lookup/Relation panel
	relation_panel_title: 'リレーション',
	lookup_panel_title: 'Lookup',
	lookup_ref_table: '1. 参照テーブル',
	lookup_select_table: 'テーブルを選択...',
	lookup_col_to_display: '2. 表示する列',
	lookup_origin_col: '2. 値のソースフィールド',
	lookup_select_col: '列を選択...',
	lookup_file_name: 'ファイル名',
	lookup_join_col: '3. 結合列（このテーブル）',
	lookup_join_col_title: 'ファイル名（タイトルで結合）',
	lookup_select_join_col: '列を選択...',
	lookup_hint: 'この列の値は参照テーブルのファイル名と一致する必要があります',

	// Image config panel
	image_panel_title: '画像',
	image_folder_label: 'ソースフォルダー（任意）',
	image_folder_placeholder: '例：images/covers',

	// Image picker
	image_picker_title: '画像を選択',
	image_picker_clear: 'クリア',
	image_picker_empty_vault: '保管庫に画像が見つかりません',
	image_picker_empty_folder: '画像が見つかりません：',
	image_select_placeholder: '画像を選択…',

	// Aggregations
	agg_none: 'なし',
	agg_count: 'カウント',
	agg_count_values: '値をカウント',
	agg_sum: '合計',
	agg_avg: '平均',
	agg_min: '最小',
	agg_max: '最大',

	// Empty states / loading
	no_database_open: 'データベースが開かれていません。',
	no_database_hint: 'リボンボタンまたは「新しいデータベースを作成」コマンドを使用してください。',
	loading: '読み込み中...',
	no_results: '項目が見つかりません',

	// Row/item counts
	item_singular: '件',
	item_plural: '件',
	row_singular: '行',
	row_plural: '行',
	record_singular: 'レコード',
	record_plural: 'レコード',

	// Add row/entry
	add_row: '新しい行',
	add_entry: '新しいエントリー',
	add_card: '新しいカード',
	new_field: '新しいフィールド',
	add_field: 'フィールドを追加',

	// Board
	board_no_select_col: 'ボードにはカードをグループ化するための選択またはステータス列が必要です。',
	board_add_select_hint: 'テーブルビューでそのタイプの列を追加してから、ここに戻ってください。',
	board_drag_reorder: 'ドラッグして並べ替え',
	hide_empty_cols: '空を非表示',
	hide_no_value_cols: '値なしを非表示',

	// Calendar
	calendar_no_date_field: 'ツールバーで日付フィールドを選択してカレンダーを表示します。',
	calendar_no_date_section: '日付なし',
	calendar_click_to_create: 'クリックしてノートを作成',
	calendar_today: '今日',
	calendar_prev_month: '前月',
	calendar_next_month: '翌月',

	// Calendar days (short)
	day_sun: '日',
	day_mon: '月',
	day_tue: '火',
	day_wed: '水',
	day_thu: '木',
	day_fri: '金',
	day_sat: '土',

	// Calendar months (long)
	month_january: '1月',
	month_february: '2月',
	month_march: '3月',
	month_april: '4月',
	month_may: '5月',
	month_june: '6月',
	month_july: '7月',
	month_august: '8月',
	month_september: '9月',
	month_october: '10月',
	month_november: '11月',
	month_december: '12月',

	// Timeline
	timeline_no_start_field: 'ツールバーで開始フィールドを選択してタイムラインを表示します。',
	timeline_no_interval: '間隔なし',
	timeline_scroll_prev: '前にスクロール',
	timeline_scroll_next: '次にスクロール',
	zoom_days: '日',
	zoom_weeks: '週',
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

	// Misc tooltips
	tooltip_pin_column: 'ここまでの列を固定',
	tooltip_unpin_column: '列の固定を解除',
	tooltip_resize_column: 'ドラッグしてサイズ変更；ダブルクリックで内容に合わせる',
	tooltip_wrap_text: 'テキストの折り返し',
	tooltip_include_subfolders: 'サブフォルダーを含める',
	folder_column: 'フォルダー',
	tooltip_manage_fields: 'フィールドを管理',
	tooltip_batch_actions: '一括操作',
	tooltip_remove_filter: 'フィルターを削除',
	tooltip_close: '閉じる',
	tooltip_remove: '削除',
	tooltip_move_up: '上に移動',
	tooltip_move_down: '下に移動',
	tooltip_change_color: '色を変更',
	tooltip_delete_status: 'ステータスを削除',

	// Status defaults
	status_not_started: '未着手',
	status_in_progress: '進行中',
	status_done: '完了',
	status_cancelled: 'キャンセル済み',

	// Relation cell
	relation_search_placeholder: '検索...',
	relation_clear: 'クリア',
	relation_no_results: '結果なし',

	// Select cell
	select_clear: 'クリア',

	// Status cell
	status_new_placeholder: '新しいステータス...',

	// Type change validation errors
	validate_non_numeric: 'セルに数値でない値が含まれています（例："',
	validate_invalid_dates: 'セルに有効でない日付が含まれています（例："',
	validate_invalid_checkbox: 'セルにチェックボックスと互換性のない値が含まれています（例："',
	validate_multiselect_to_select: '行に複数の値が選択されています。単一選択に変更する前に余分な値を削除してください。',
	validate_invalid_email: 'セルに有効でないメールアドレスが含まれています（例："',
	validate_invalid_url: 'セルに有効でない URL が含まれています（例："',
	validate_invalid_phone: 'セルに有効でない電話番号が含まれています（例："',
	validate_type_change_prefix: 'タイプを変更できません：',

	// Cell validation
	email_invalid: '無効なメールアドレス',

	// Filter operators
	op_is: '等しい',
	op_is_not: '等しくない',
	op_contains: '含む',
	op_not_contains: '含まない',
	op_starts_with: 'で始まる',
	op_ends_with: 'で終わる',
	op_is_empty: '空である',
	op_is_not_empty: '空でない',
	op_gt: '>',
	op_gte: '>=',
	op_lt: '<',
	op_lte: '<=',
	op_is_checked: 'チェック済み',
	op_is_unchecked: '未チェック',

	// Settings tab
	settings_db_filename_name: 'データベースファイル名',
	settings_db_filename_desc: 'フォルダー内のデータベースを識別する特別なファイルの名前。',
	settings_row_height_name: 'デフォルトの行の高さ',
	settings_row_height_desc: '各テーブル行のピクセル高さ。',

	// Database manager
	db_untitled_note: '無題',
	db_copy_suffix: '(コピー)',
	db_copy_suffix_n: '(コピー $n)',
	db_already_exists: '"$folder" にはすでにデータベースが存在します',
	db_tip_body: 'このファイルはデータベースです。テーブルビューを表示するには開いてください。',

	// Formula errors
	formula_err_unclosed_string: '位置 $pos で文字列が閉じられていません',
	formula_err_unclosed_bracket: '位置 $pos で括弧が閉じられていません',
	formula_err_unexpected_bang: "位置 $pos で予期しない文字 '!'",
	formula_err_unexpected_char: "位置 $pos で予期しない文字 '$char'",
	formula_err_expected_token: "位置 $pos で $expected が期待されましたが、'$found' が見つかりました",
	formula_err_unexpected_token: "位置 $pos で予期しないトークン '$token'",
	formula_err_circular_ref: '循環参照："$name" は数式列です',
	formula_err_unknown_fn: '不明な関数：$fn()',
	formula_err_if_args: '期待される形式：if(条件, 真の値, [偽の値])',
	formula_err_avg_args: '期待される形式：avg(列) — 列参照が引数として必要',
	formula_err_count_args: '期待される形式：count(列) — 列参照が引数として必要',
	formula_err_mid_args: '期待される形式：mid(テキスト, 開始, 長さ)',
	formula_err_mod_args: '期待される形式：mod(数値, 除数)',
	formula_err_sqrt_args: '期待される形式：sqrt(数値)',
	formula_err_not_implemented: '未実装の関数：$fn()',

	// Plugin
	plugin_display_name: 'Notion bases',
	no_databases_found: 'データベースが見つかりません。「新しいデータベースを作成」コマンドを使用して作成してください。',

	// Commands
	cmd_open_database: 'このフォルダーのデータベースを開く',
	cmd_create_database: '現在のフォルダーに新しいデータベースを作成',

	// Picker / View
	picker_placeholder: 'データベースを選択...',
	picker_root: '/（ルート）',
	view_fallback_name: 'データベース',
}

export default ja
