import en from './en'

const ptBR: Partial<Record<keyof typeof en, string>> = {
	// View types
	view_table: 'Tabela',
	view_list: 'Lista',
	view_board: 'Board',
	view_gallery: 'Galeria',
	view_calendar: 'Calendário',
	view_timeline: 'Timeline',

	// View tabs
	add_view: 'Adicionar view',
	remove_view: 'Remover view',
	rename_view_hint: 'Duplo clique para renomear',

	// Toolbar buttons
	fields: 'Campos',
	filter: 'Filtro',
	filters: 'Filtros',
	sort: 'Ordenar',
	actions: 'Ações',
	group_by: 'Agrupar por',
	cover: 'Capa',
	date_field: 'Data',
	start_field: 'Início',
	end_field: 'Fim',
	group_field: 'Agrupar',

	// Dropdown labels
	fields_in_card: 'Campos no card',
	fields_label: 'Campos',
	fields_on_bars: 'Campos nas barras',
	filter_by: 'Filtrar por',
	sort_by: 'Ordenar por',
	group_by_label: 'Agrupar por',
	date_field_label: 'Campo de data',
	cover_field_label: 'Campo de capa',
	card_size_label: 'Tamanho dos cards',
	row_height_label: 'Altura das linhas',

	// Common values
	none_value: 'Nenhum',
	no_value: 'Sem valor',
	no_cover: 'Nenhuma',

	// Card sizes
	size_small: 'Pequeno',
	size_medium: 'Médio',
	size_large: 'Grande',

	// Row heights
	height_compact: 'Compacto',
	height_medium: 'Médio',
	height_tall: 'Alto',

	// Filter/Sort
	add_filter_advanced: 'Adicionar filtro avançado',
	add_sort: 'Adicionar ordenação',
	no_active_sorts: 'Nenhuma ordenação ativa',
	name_column: 'Nome',

	// Conjunction pills
	conjunction_and: 'E',
	conjunction_or: 'OU',

	// Filter value placeholders
	filter_number_placeholder: 'Número...',
	filter_value_placeholder: 'Valor...',

	// Actions menu
	delete_selected: 'Apagar todos selecionados',
	move_selected: 'Mover todos selecionados',
	duplicate_selected: 'Duplicar todos selecionados',
	export_csv: 'Exportar CSV',
	import_csv: 'Importar CSV',

	// Context menu (single note)
	open_note: 'Abrir nota',
	delete_note: 'Excluir nota',
	duplicate_note: 'Duplicar nota',

	// Sort directions
	sort_asc: 'Ascendente',
	sort_desc: 'Descendente',
	sort_asc_title: 'Ordenar descendente',
	sort_desc_title: 'Remover ordenação',
	sort_none_title: 'Ordenar ascendente',

	// Column header menu
	rename_column: 'Renomear',
	edit_formula: 'Editar fórmula',
	configure_lookup: 'Configurar lookup',
	configure_relation: 'Configurar relação',
	format_number: 'Formatar número',
	configure_image_folder: 'Configurar pasta de imagens',
	field_type_label: 'Tipo de campo',
	hide_field: 'Ocultar campo',
	delete_field: 'Excluir campo',

	// Column types
	type_title: 'Título',
	type_text: 'Texto',
	type_number: 'Número',
	type_select: 'Seleção',
	type_multiselect: 'Multi-seleção',
	type_date: 'Data',
	type_checkbox: 'Checkbox',
	type_url: 'URL',
	type_email: 'Email',
	type_phone: 'Telefone',
	type_status: 'Status',
	type_formula: 'Fórmula',
	type_relation: 'Relação',
	type_lookup: 'Lookup',
	type_image: 'Imagem',

	// Formula panel
	formula_panel_title: 'Fórmula',
	formula_placeholder: 'Ex: if(status = "feito", 1, 0)',
	formula_valid: 'Sintaxe válida',
	formula_available_cols: 'Colunas disponíveis:',
	formula_ref_toggle: 'Referência de funções',
	formula_save: 'Salvar',
	formula_cancel: 'Cancelar',
	formula_save_hint: 'Salvar (Ctrl+Enter)',

	// Formula reference groups
	formula_group_logic: 'Lógica',
	formula_group_comparators: 'Comparadores',
	formula_group_aggregators: 'Agregadores',
	formula_group_text: 'Texto',
	formula_group_math: 'Matemática',
	formula_group_utils: 'Utilitários',

	// Number format panel
	number_format_title: 'Formatar',
	number_decimals_label: 'Casas decimais',
	number_thousands_label: 'Separador de milhar',
	number_prefix_label: 'Prefixo',
	number_suffix_label: 'Sufixo',
	number_prefix_placeholder: 'Ex: R$, $, €',
	number_suffix_placeholder: 'Ex: %, kg, km',
	number_remove_format: 'Remover formatação',

	// Lookup/Relation panel
	relation_panel_title: 'Relação',
	lookup_panel_title: 'Lookup',
	lookup_ref_table: '1. Tabela de referência',
	lookup_select_table: 'Selecionar tabela...',
	lookup_col_to_display: '2. Coluna a exibir',
	lookup_origin_col: '2. Campo de origem dos valores',
	lookup_select_col: 'Selecionar coluna...',
	lookup_file_name: 'Nome do arquivo',
	lookup_join_col: '3. Coluna de junção (nesta tabela)',
	lookup_join_col_title: 'Nome do arquivo (junção por título)',
	lookup_select_join_col: 'Selecionar coluna...',
	lookup_hint: 'O valor desta coluna deve ser igual ao nome do arquivo da nota na tabela referenciada',

	// Image config panel
	image_panel_title: 'Imagem',
	image_folder_label: 'Pasta de origem (opcional)',
	image_folder_placeholder: 'Ex: imagens/capas',

	// Image picker
	image_picker_title: 'Selecionar imagem',
	image_picker_clear: 'Limpar',
	image_picker_empty_vault: 'Nenhuma imagem encontrada no vault',
	image_picker_empty_folder: 'Nenhuma imagem encontrada em',
	image_select_placeholder: 'Selecionar imagem…',

	// Aggregations
	agg_none: 'Nenhum',
	agg_count: 'Contar',
	agg_count_values: 'Contar valores',
	agg_sum: 'Soma',
	agg_avg: 'Média',
	agg_min: 'Mín',
	agg_max: 'Máx',

	// Empty states / loading
	no_database_open: 'Nenhum banco de dados aberto.',
	no_database_hint: 'Use o botão na ribbon ou o comando "criar novo banco de dados".',
	loading: 'Carregando...',
	no_results: 'Nenhum item encontrado',

	// Row/item counts
	item_singular: 'Item',
	item_plural: 'Itens',
	row_singular: 'Linha',
	row_plural: 'Linhas',
	record_singular: 'Registro',
	record_plural: 'Registros',

	// Add row/entry
	add_row: 'Nova linha',
	add_entry: 'Nova entrada',
	add_card: 'Novo card',
	new_field: 'Novo campo',
	add_field: 'Adicionar campo',

	// Board
	board_no_select_col: 'O board precisa de uma coluna do tipo select ou status para agrupar os cards.',
	board_add_select_hint: 'Adicione uma coluna desse tipo na view de tabela e volte aqui.',
	board_drag_reorder: 'Arraste para reordenar',
	board_set_limit: 'Clique para definir limite de cards',
	board_limit_placeholder: 'Limite (0 = nenhum)',
	board_show_more: 'Mais',
	board_show_less: 'Mostrar menos',
	hide_empty_cols: 'Ocultar vazias',
	hide_no_value_cols: 'Ocultar sem valor',

	// Calendar
	calendar_no_date_field: 'Selecione um campo de data no toolbar para exibir o calendário.',
	calendar_no_date_section: 'Sem data',
	calendar_click_to_create: 'Clique para criar nota',
	calendar_today: 'Hoje',
	calendar_prev_month: 'Mês anterior',
	calendar_next_month: 'Próximo mês',
	calendar_view_month: 'Mês',
	calendar_view_week: 'Semana',
	calendar_prev_week: 'Semana anterior',
	calendar_next_week: 'Próxima semana',

	// Calendar days (short)
	day_sun: 'Dom',
	day_mon: 'Seg',
	day_tue: 'Ter',
	day_wed: 'Qua',
	day_thu: 'Qui',
	day_fri: 'Sex',
	day_sat: 'Sáb',

	// Calendar months (long)
	month_january: 'Janeiro',
	month_february: 'Fevereiro',
	month_march: 'Março',
	month_april: 'Abril',
	month_may: 'Maio',
	month_june: 'Junho',
	month_july: 'Julho',
	month_august: 'Agosto',
	month_september: 'Setembro',
	month_october: 'Outubro',
	month_november: 'Novembro',
	month_december: 'Dezembro',

	// Timeline
	timeline_no_start_field: 'Selecione um campo de início no toolbar para exibir a timeline.',
	timeline_no_interval: 'Sem intervalo',
	timeline_scroll_prev: 'Scroll anterior',
	timeline_scroll_next: 'Scroll próximo',
	zoom_days: 'Dias',
	zoom_weeks: 'Semanas',
	zoom_months: 'Meses',

	// Timeline months (short)
	month_short_jan: 'Jan',
	month_short_feb: 'Fev',
	month_short_mar: 'Mar',
	month_short_apr: 'Abr',
	month_short_may: 'Mai',
	month_short_jun: 'Jun',
	month_short_jul: 'Jul',
	month_short_aug: 'Ago',
	month_short_sep: 'Set',
	month_short_oct: 'Out',
	month_short_nov: 'Nov',
	month_short_dec: 'Dez',

	// Misc tooltips
	tooltip_pin_column: 'Fixar colunas até aqui',
	tooltip_unpin_column: 'Desafixar colunas',
	tooltip_resize_column: 'Arrastar para redimensionar; clique duplo para ajustar ao conteúdo',
	tooltip_wrap_text: 'Wrap de texto',
	tooltip_include_subfolders: 'Incluir subpastas',
	folder_column: 'Pasta',
	tooltip_manage_fields: 'Gerenciar campos',
	tooltip_batch_actions: 'Ações em lote',
	tooltip_remove_filter: 'Remover filtro',
	tooltip_close: 'Fechar',
	tooltip_remove: 'Remover',
	tooltip_move_up: 'Mover para cima',
	tooltip_move_down: 'Mover para baixo',
	tooltip_change_color: 'Trocar cor',
	tooltip_delete_status: 'Excluir status',

	// Status defaults
	status_not_started: 'Não iniciado',
	status_in_progress: 'Em andamento',
	status_done: 'Concluído',
	status_cancelled: 'Cancelado',

	// Relation cell
	relation_search_placeholder: 'Buscar...',
	relation_clear: 'Limpar',
	relation_no_results: 'Nenhum resultado',
	relation_two_way: 'Relação bidirecional',
	relation_two_way_hint: 'Cria automaticamente uma relação inversa no banco de dados de destino',

	// Select cell
	select_clear: 'Limpar',
	select_create_placeholder: 'Criar nova opção...',

	// Status cell
	status_new_placeholder: 'Novo status...',
	color_custom: 'Personalizada',

	// Type change validation errors
	validate_non_numeric: 'Célula(s) contêm valores não numéricos (ex: "',
	validate_invalid_dates: 'Célula(s) contêm valores que não são datas válidas (ex: "',
	validate_invalid_checkbox: 'Célula(s) contêm valores incompatíveis com checkbox (ex: "',
	validate_multiselect_to_select: 'Linha(s) têm múltiplos valores selecionados. Remova os extras antes de mudar para seleção única.',
	validate_invalid_email: 'Célula(s) contêm valores que não são e-mails válidos (ex: "',
	validate_invalid_url: 'Célula(s) contêm valores que não são URLs válidas (ex: "',
	validate_invalid_phone: 'Célula(s) contêm valores que não são telefones válidos (ex: "',
	validate_type_change_prefix: 'Não é possível mudar o tipo: ',

	// Cell validation
	email_invalid: 'E-mail inválido',

	// Filter operators
	op_is: 'É',
	op_is_not: 'Não é',
	op_contains: 'Contém',
	op_not_contains: 'Não contém',
	op_starts_with: 'Começa com',
	op_ends_with: 'Termina com',
	op_is_empty: 'Está vazio',
	op_is_not_empty: 'Não está vazio',
	op_gt: '>',
	op_gte: '>=',
	op_lt: '<',
	op_lte: '<=',
	op_is_checked: 'Está marcado',
	op_is_unchecked: 'Não está marcado',

	// Settings tab
	settings_db_filename_name: 'Nome do arquivo de banco de dados',
	settings_db_filename_desc: 'Nome do arquivo especial que identifica um banco de dados na pasta.',
	settings_row_height_name: 'Altura padrão das linhas',
	settings_row_height_desc: 'Altura em pixels de cada linha da tabela.',

	// Database manager
	db_untitled_note: 'Sem título',
	db_copy_suffix: '(cópia)',
	db_copy_suffix_n: '(cópia $n)',
	db_already_exists: 'Já existe um banco de dados em "$folder"',
	db_tip_body: 'Este arquivo é um banco de dados. Abra-o para ver a visualização de tabela.',

	// Formula errors
	formula_err_unclosed_string: 'String não fechada na posição $pos',
	formula_err_unclosed_bracket: 'Colchete não fechado na posição $pos',
	formula_err_unexpected_bang: "Caractere inesperado '!' na posição $pos",
	formula_err_unexpected_char: "Caractere inesperado '$char' na posição $pos",
	formula_err_expected_token: "Esperado $expected, encontrado '$found' na posição $pos",
	formula_err_unexpected_token: "Token inesperado '$token' na posição $pos",
	formula_err_circular_ref: 'Referência circular: "$name" é uma coluna fórmula',
	formula_err_unknown_fn: 'Função desconhecida: $fn()',
	formula_err_if_args: 'Esperado if(condição, se_verdadeiro, [se_falso])',
	formula_err_avg_args: 'Esperado avg(coluna) — requer referência de coluna como argumento',
	formula_err_count_args: 'Esperado count(coluna) — requer referência de coluna como argumento',
	formula_err_mid_args: 'Esperado mid(texto, início, comprimento)',
	formula_err_mod_args: 'Esperado mod(número, divisor)',
	formula_err_sqrt_args: 'Esperado sqrt(número)',
	formula_err_not_implemented: 'Função não implementada: $fn()',

	// Plugin
	plugin_display_name: 'Notion bases',
	no_databases_found: 'Nenhum banco de dados encontrado. Use o comando "Criar novo banco de dados" para criar um.',

	// Commands
	cmd_open_database: 'Abrir banco de dados desta pasta',
	cmd_create_database: 'Criar novo banco de dados na pasta atual',

	// Picker / View
	picker_placeholder: 'Selecionar banco de dados...',
	picker_root: '/ (Raiz)',
	view_fallback_name: 'Banco de dados',
}

export default ptBR
