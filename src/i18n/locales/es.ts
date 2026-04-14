import en from './en'

const es: Partial<Record<keyof typeof en, string>> = {
	// View types
	view_table: 'Tabla',
	view_list: 'Lista',
	view_board: 'Tablero',
	view_gallery: 'Galería',
	view_calendar: 'Calendario',
	view_timeline: 'Línea de tiempo',
	view_chart: 'Gráfico',

	// View tabs
	add_view: 'Añadir vista',
	remove_view: 'Eliminar vista',
	rename_view_hint: 'Doble clic para renombrar',

	// Toolbar buttons
	fields: 'Campos',
	filter: 'Filtro',
	filters: 'Filtros',
	sort: 'Ordenar',
	actions: 'Acciones',
	group_by: 'Agrupar por',
	cover: 'Portada',
	date_field: 'Fecha',
	start_field: 'Inicio',
	end_field: 'Fin',
	group_field: 'Grupo',

	// Dropdown labels
	fields_in_card: 'Campos en tarjeta',
	fields_label: 'Campos',
	fields_on_bars: 'Campos en barras',
	filter_by: 'Filtrar por',
	sort_by: 'Ordenar por',
	group_by_label: 'Agrupar por',
	date_field_label: 'Campo de fecha',
	cover_field_label: 'Campo de portada',
	card_size_label: 'Tamaño de tarjeta',
	row_height_label: 'Altura de fila',

	// Common values
	none_value: 'Ninguno',
	no_value: 'Sin valor',
	no_cover: 'Ninguna',

	// Card sizes
	size_small: 'Pequeño',
	size_medium: 'Mediano',
	size_large: 'Grande',

	// Row heights
	height_compact: 'Compacto',
	height_medium: 'Mediano',
	height_tall: 'Alto',

	// Filter/Sort
	add_filter_advanced: 'Añadir filtro avanzado',
	add_sort: 'Añadir ordenación',
	no_active_sorts: 'Sin ordenaciones activas',
	name_column: 'Nombre',

	// Conjunction pills
	conjunction_and: 'Y',
	conjunction_or: 'O',

	// Filter value placeholders
	filter_number_placeholder: 'Número...',
	filter_value_placeholder: 'Valor...',

	// Actions menu
	delete_selected: 'Eliminar todos los seleccionados',
	move_selected: 'Mover todos los seleccionados',
	duplicate_selected: 'Duplicar todos los seleccionados',
	export_csv: 'Exportar CSV',
	import_csv: 'Importar CSV',

	// Context menu (single note)
	open_note: 'Abrir nota',
	delete_note: 'Eliminar nota',
	duplicate_note: 'Duplicar nota',

	// Sort directions
	sort_asc: 'Ascendente',
	sort_desc: 'Descendente',
	sort_asc_title: 'Ordenar descendente',
	sort_desc_title: 'Eliminar ordenación',
	sort_none_title: 'Ordenar ascendente',

	// Column header menu
	rename_column: 'Renombrar',
	edit_formula: 'Editar fórmula',
	configure_lookup: 'Configurar lookup',
	configure_relation: 'Configurar relación',
	format_number: 'Formatear número',
	configure_image_folder: 'Configurar carpeta de imágenes',
	field_type_label: 'Tipo de campo',
	hide_field: 'Ocultar campo',
	delete_field: 'Eliminar campo',

	// Column types
	type_title: 'Título',
	type_text: 'Texto',
	type_number: 'Número',
	type_select: 'Selección',
	type_multiselect: 'Multi-selección',
	type_date: 'Fecha',
	type_checkbox: 'Checkbox',
	type_url: 'URL',
	type_email: 'Email',
	type_phone: 'Teléfono',
	type_status: 'Estado',
	type_formula: 'Fórmula',
	type_relation: 'Relación',
	type_lookup: 'Lookup',
	type_rollup: 'Rollup',
	rollup_panel_title: 'Rollup',
	configure_rollup: 'Configurar rollup',
	rollup_select_relation: '1. Columna de relación',
	rollup_select_relation_placeholder: 'Seleccionar relación...',
	rollup_select_target: '2. Columna de destino',
	rollup_select_target_placeholder: 'Seleccionar columna...',
	rollup_select_function: '3. Agregación',
	rollup_no_relations: 'No se encontraron columnas de relación. Añade una columna de relación primero.',
	rollup_fn_sum: 'Suma',
	rollup_fn_count: 'Contar',
	rollup_fn_avg: 'Promedio',
	rollup_fn_min: 'Mín',
	rollup_fn_max: 'Máx',
	rollup_fn_count_values: 'Contar únicos',
	rollup_fn_list: 'Listar todo',
	type_image: 'Imagen',
	type_audio: 'Audio',
	audio_path_placeholder: 'Ruta al archivo de audio...',
	audio_select_placeholder: 'Seleccionar audio...',
	audio_picker_title: 'Seleccionar audio',
	audio_picker_clear: 'Limpiar',
	audio_picker_empty_folder: 'No hay archivos de audio en la carpeta',
	audio_picker_empty_vault: 'No hay archivos de audio en el vault',
	audio_panel_title: 'Configuración de audio',
	audio_folder_label: 'Carpeta de origen (dejar vacío para todo el vault)',
	audio_folder_placeholder: 'Ej: audio/musica',
	configure_audio_folder: 'Configurar carpeta de audio',

	// Video column
	type_video: 'Vídeo',
	video_select_placeholder: 'Seleccionar vídeo...',
	video_picker_clear: 'Limpiar',
	video_picker_empty_folder: 'No hay archivos de vídeo en la carpeta',
	video_picker_empty_vault: 'No hay archivos de vídeo en el vault',
	video_panel_title: 'Configuración de vídeo',
	video_folder_label: 'Carpeta de origen (dejar vacío para todo el vault)',
	video_folder_placeholder: 'Ej: video/clips',
	configure_video_folder: 'Configurar carpeta de vídeo',

	// Formula panel
	formula_panel_title: 'Fórmula',
	formula_placeholder: 'Ejemplo: if(status = "done", 1, 0)',
	formula_valid: 'Sintaxis válida',
	formula_available_cols: 'Columnas disponibles:',
	formula_ref_toggle: 'Referencia de funciones',
	formula_save: 'Guardar',
	formula_cancel: 'Cancelar',
	formula_save_hint: 'Guardar (Ctrl+Enter)',

	// Formula reference groups
	formula_group_logic: 'Lógica',
	formula_group_comparators: 'Comparadores',
	formula_group_aggregators: 'Agregadores',
	formula_group_text: 'Texto',
	formula_group_math: 'Matemáticas',
	formula_group_utils: 'Utilidades',

	// Number format panel
	number_format_title: 'Formato',
	number_decimals_label: 'Decimales',
	number_thousands_label: 'Separador de miles',
	number_prefix_label: 'Prefijo',
	number_suffix_label: 'Sufijo',
	number_prefix_placeholder: 'Ej: $, €',
	number_suffix_placeholder: 'Ej: %, kg, km',
	number_remove_format: 'Eliminar formato',

	// Lookup/Relation panel
	relation_panel_title: 'Relación',
	lookup_panel_title: 'Lookup',
	lookup_ref_table: '1. Tabla de referencia',
	lookup_select_table: 'Seleccionar tabla...',
	lookup_col_to_display: '2. Columna a mostrar',
	lookup_origin_col: '2. Campo de origen de valores',
	lookup_select_col: 'Seleccionar columna...',
	lookup_file_name: 'Nombre de archivo',
	lookup_join_col: '3. Columna de unión (esta tabla)',
	lookup_join_col_title: 'Nombre de archivo (unir por título)',
	lookup_select_join_col: 'Seleccionar columna...',
	lookup_hint: 'El valor de esta columna debe coincidir con el nombre de archivo en la tabla referenciada',

	// Image config panel
	image_panel_title: 'Imagen',
	image_folder_label: 'Carpeta de origen (opcional)',
	image_folder_placeholder: 'Ej: images/covers',

	// Image picker
	image_picker_title: 'Seleccionar imagen',
	image_picker_clear: 'Limpiar',
	image_picker_empty_vault: 'No se encontraron imágenes en el vault',
	image_picker_empty_folder: 'No se encontraron imágenes en',
	image_select_placeholder: 'Seleccionar imagen…',

	// Aggregations
	agg_none: 'Ninguno',
	agg_count: 'Contar',
	agg_count_values: 'Contar valores',
	agg_sum: 'Suma',
	agg_avg: 'Promedio',
	agg_min: 'Mín',
	agg_max: 'Máx',

	// Empty states / loading
	no_database_open: 'No hay base de datos abierta.',
	no_database_hint: 'Usa el botón de la barra lateral o el comando "crear nueva base de datos".',
	loading: 'Cargando...',
	no_results: 'No se encontraron elementos',

	// Row/item counts
	item_singular: 'Elemento',
	item_plural: 'Elementos',
	row_singular: 'Fila',
	row_plural: 'Filas',
	record_singular: 'Registro',
	record_plural: 'Registros',

	// Add row/entry
	add_row: 'Nueva fila',
	add_entry: 'Nueva entrada',
	add_card: 'Nueva tarjeta',
	new_field: 'Nuevo campo',
	add_field: 'Añadir campo',

	// Board
	board_no_select_col: 'El tablero requiere una columna de selección o estado para agrupar tarjetas.',
	board_add_select_hint: 'Añade una columna de ese tipo en la vista de tabla y vuelve aquí.',
	board_drag_reorder: 'Arrastra para reordenar',
	board_set_limit: 'Clic para definir limite de tarjetas',
	board_limit_placeholder: 'Limite (0 = ninguno)',
	board_show_more: 'Mas',
	board_show_less: 'Mostrar menos',
	hide_empty_cols: 'Ocultar vacías',
	hide_no_value_cols: 'Ocultar sin valor',

	// Calendar
	calendar_no_date_field: 'Selecciona un campo de fecha en la barra de herramientas para mostrar el calendario.',
	calendar_no_date_section: 'Sin fecha',
	calendar_click_to_create: 'Clic para crear nota',
	calendar_today: 'Hoy',
	calendar_prev_month: 'Mes anterior',
	calendar_next_month: 'Mes siguiente',
	calendar_view_month: 'Mes',
	calendar_view_week: 'Semana',
	calendar_prev_week: 'Semana anterior',
	calendar_next_week: 'Semana siguiente',
	calendar_add_time: 'Añadir hora',
	calendar_remove_time: 'Quitar hora',
	calendar_all_day: 'Todo el día',

	// Calendar days (short)
	day_sun: 'Dom',
	day_mon: 'Lun',
	day_tue: 'Mar',
	day_wed: 'Mié',
	day_thu: 'Jue',
	day_fri: 'Vie',
	day_sat: 'Sáb',

	// Calendar months (long)
	month_january: 'Enero',
	month_february: 'Febrero',
	month_march: 'Marzo',
	month_april: 'Abril',
	month_may: 'Mayo',
	month_june: 'Junio',
	month_july: 'Julio',
	month_august: 'Agosto',
	month_september: 'Septiembre',
	month_october: 'Octubre',
	month_november: 'Noviembre',
	month_december: 'Diciembre',

	// Timeline
	timeline_no_start_field: 'Selecciona un campo de inicio en la barra de herramientas para mostrar la línea de tiempo.',
	timeline_no_interval: 'Sin intervalo',
	timeline_scroll_prev: 'Desplazar atrás',
	timeline_scroll_next: 'Desplazar adelante',
	zoom_days: 'Días',
	zoom_weeks: 'Semanas',
	zoom_months: 'Meses',

	// Timeline months (short)
	month_short_jan: 'Ene',
	month_short_feb: 'Feb',
	month_short_mar: 'Mar',
	month_short_apr: 'Abr',
	month_short_may: 'May',
	month_short_jun: 'Jun',
	month_short_jul: 'Jul',
	month_short_aug: 'Ago',
	month_short_sep: 'Sep',
	month_short_oct: 'Oct',
	month_short_nov: 'Nov',
	month_short_dec: 'Dic',

	// Hierarchy / Sub-rows
	hierarchy_toggle: 'Usar como jerarquía',
	hierarchy_toggle_hint: 'Habilita relaciones padre-hijo entre filas de esta base de datos',
	add_subrow: 'Añadir subfila',
	collapse_all: 'Contraer todo',
	expand_all: 'Expandir todo',
	max_depth_reached: 'Profundidad máxima alcanzada (3 niveles)',

	// Chart view
	chart_configure: 'Configurar',
	chart_type: 'Tipo de gráfico',
	chart_type_bar: 'Barras',
	chart_type_line: 'Líneas',
	chart_type_pie: 'Circular',
	chart_x_axis: 'Categorías (eje X)',
	chart_y_axis: 'Valores (eje Y)',
	chart_aggregation: 'Agregación',
	chart_select_column: 'Seleccionar columna...',
	chart_count_records: 'Contar',
	chart_no_config: 'Configura el gráfico para empezar.',
	chart_no_config_hint: 'Selecciona una columna para categorías en la barra de herramientas de arriba.',

	// Misc tooltips
	tooltip_pin_column: 'Fijar columnas hasta aquí',
	tooltip_unpin_column: 'Desfijar columnas',
	tooltip_resize_column: 'Arrastra para redimensionar; doble clic para ajustar al contenido',
	tooltip_wrap_text: 'Ajuste de texto',
	tooltip_include_subfolders: 'Incluir subcarpetas',
	folder_column: 'Carpeta',
	tooltip_manage_fields: 'Gestionar campos',
	tooltip_batch_actions: 'Acciones en lote',
	tooltip_remove_filter: 'Eliminar filtro',
	hide_filters: 'Ocultar filtros',
	show_filters: 'Mostrar filtros',
	filters_count_one: '1 filtro',
	filters_count_other: '{n} filtros',
	tooltip_close: 'Cerrar',
	tooltip_remove: 'Eliminar',
	tooltip_move_up: 'Mover arriba',
	tooltip_move_down: 'Mover abajo',
	tooltip_change_color: 'Cambiar color',
	tooltip_delete_status: 'Eliminar estado',

	// Status defaults
	status_not_started: 'No iniciado',
	status_in_progress: 'En progreso',
	status_done: 'Hecho',
	status_cancelled: 'Cancelado',

	// Relation cell
	relation_search_placeholder: 'Buscar...',
	relation_clear: 'Limpiar',
	relation_no_results: 'Sin resultados',
	relation_two_way: 'Relación bidireccional',
	relation_two_way_hint: 'Crea automáticamente una relación inversa en la base de datos de destino',

	// Select cell
	select_clear: 'Limpiar',
	select_create_placeholder: 'Crear nueva opción...',

	// Status cell
	status_new_placeholder: 'Nuevo estado...',
	color_custom: 'Personalizado',

	// Type change validation errors
	validate_non_numeric: 'Celda(s) contienen valores no numéricos (ej: "',
	validate_invalid_dates: 'Celda(s) contienen valores que no son fechas válidas (ej: "',
	validate_invalid_checkbox: 'Celda(s) contienen valores incompatibles con checkbox (ej: "',
	validate_multiselect_to_select: 'Fila(s) tienen múltiples valores seleccionados. Elimina los extras antes de cambiar a selección única.',
	validate_invalid_email: 'Celda(s) contienen valores que no son emails válidos (ej: "',
	validate_invalid_url: 'Celda(s) contienen valores que no son URLs válidas (ej: "',
	validate_invalid_phone: 'Celda(s) contienen valores que no son teléfonos válidos (ej: "',
	validate_type_change_prefix: 'No se puede cambiar el tipo: ',

	// Cell validation
	email_invalid: 'Email inválido',

	// Filter operators
	op_is: 'Es',
	op_is_not: 'No es',
	op_contains: 'Contiene',
	op_not_contains: 'No contiene',
	op_starts_with: 'Empieza con',
	op_ends_with: 'Termina con',
	op_is_empty: 'Está vacío',
	op_is_not_empty: 'No está vacío',
	op_gt: '>',
	op_gte: '>=',
	op_lt: '<',
	op_lte: '<=',
	op_is_checked: 'Está marcado',
	op_is_unchecked: 'No está marcado',

	// Settings tab
	settings_db_filename_name: 'Nombre del archivo de base de datos',
	settings_db_filename_desc: 'Nombre del archivo especial que identifica una base de datos en una carpeta.',
	settings_row_height_name: 'Altura de fila predeterminada',
	settings_row_height_desc: 'Altura en píxeles de cada fila de la tabla.',

	// Inline fields
	settings_inline_fields_name: 'Leer campos inline de dataview',
	settings_inline_fields_desc: 'Interpreta campos key:: value del cuerpo de la nota y los muestra como valores de columna (solo lectura)',

	// Database manager
	db_untitled_note: 'Sin título',
	db_copy_suffix: '(copia)',
	db_copy_suffix_n: '(copia $n)',
	db_already_exists: 'Ya existe una base de datos en "$folder"',
	db_tip_body: 'Este archivo es una base de datos. Ábrelo para ver la vista de tabla.',

	// Formula errors
	formula_err_unclosed_string: 'Cadena sin cerrar en posición $pos',
	formula_err_unclosed_bracket: 'Corchete sin cerrar en posición $pos',
	formula_err_unexpected_bang: "Carácter inesperado '!' en posición $pos",
	formula_err_unexpected_char: "Carácter inesperado '$char' en posición $pos",
	formula_err_expected_token: "Se esperaba $expected, se encontró '$found' en posición $pos",
	formula_err_unexpected_token: "Token inesperado '$token' en posición $pos",
	formula_err_circular_ref: 'Referencia circular: "$name" es una columna fórmula',
	formula_err_unknown_fn: 'Función desconocida: $fn()',
	formula_err_if_args: 'Expected if(condition, if_true, [if_false])',
	formula_err_avg_args: 'Se espera avg(columna) — requiere referencia de columna como argumento',
	formula_err_count_args: 'Se espera count(columna) — requiere referencia de columna como argumento',
	formula_err_mid_args: 'Se espera mid(texto, inicio, longitud)',
	formula_err_mod_args: 'Se espera mod(número, divisor)',
	formula_err_sqrt_args: 'Se espera sqrt(número)',
	formula_err_not_implemented: 'Función no implementada: $fn()',

	// Plugin
	plugin_display_name: 'Notion bases',
	no_databases_found: 'No se encontraron bases de datos. Usa el comando "crear nueva base de datos" para crear una.',

	// Commands
	cmd_open_database: 'Abrir base de datos de esta carpeta',
	cmd_create_database: 'Crear nueva base de datos en la carpeta actual',

	// Quick add
	cmd_quick_add: 'Añadir fila rápidamente a la base de datos',
	quick_add_title: 'Añadir rápido',
	quick_add_note_title: 'Título',
	quick_add_note_title_placeholder: 'Título de la nota...',
	quick_add_create: 'Crear',
	quick_add_create_and_open: 'Crear y abrir',
	quick_add_no_visible_fields: 'No hay campos editables en esta base de datos',

	// Picker / View
	picker_placeholder: 'Seleccionar base de datos...',
	picker_root: '/ (Raíz)',
	view_fallback_name: 'Base de datos',
	saving: 'Guardando',
	saved: 'Guardado',
	save_error: 'Error al guardar',
	settings_page_size_name: 'Filas por página',
	settings_page_size_desc: 'Número de filas a mostrar por página. Establece "Todas" para desplazamiento continuo',
	settings_page_size_all: 'Todas (desplazamiento continuo)',
	page_of: 'Página {current} de {total}',
	first_page: 'Primera página',
	last_page: 'Última página',
	prev_page: 'Página anterior',
	next_page: 'Página siguiente',
	conditional_formatting: 'Formato condicional',
	no_conditional_formats: 'Sin reglas todavía',
	add_rule: 'Añadir regla',
	select_value: 'Selecciona un valor',
	style: 'Estilo',
	background: 'Fondo',
	text_color: 'Color de texto',
	save: 'Guardar',
	cancel: 'Cancelar',
	value: 'Valor',

	// Database settings modal (row templates)
	db_settings_open: 'Configuración de la base de datos',
	db_settings_title: 'Configuración de la base de datos',
	db_settings_template_name: 'Plantilla de fila',
	db_settings_template_desc: 'Aplica esta plantilla al cuerpo de cada nueva fila creada en esta base de datos.',
	db_settings_template_choose: 'Elegir plantilla',
	db_settings_template_clear: 'Quitar plantilla',
	db_settings_template_none: 'Sin plantilla seleccionada',
	db_settings_ask_name: 'Pedir plantilla al crear',
	db_settings_ask_desc: 'Solicitar una plantilla cada vez que se añada una nueva fila en lugar de aplicar la predeterminada.',
	template_picker_placeholder: 'Elige una plantilla...',
	template_picker_none: 'Sin plantilla (cuerpo vacío)',
}

export default es
