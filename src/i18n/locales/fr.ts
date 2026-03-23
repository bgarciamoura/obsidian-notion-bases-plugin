import en from './en'

const fr: Partial<Record<keyof typeof en, string>> = {
	// View types
	view_table: 'Tableau',
	view_list: 'Liste',
	view_board: 'Tableau Kanban',
	view_gallery: 'Galerie',
	view_calendar: 'Calendrier',
	view_timeline: 'Chronologie',
	view_chart: 'Graphique',

	// View tabs
	add_view: 'Ajouter une vue',
	remove_view: 'Supprimer la vue',
	rename_view_hint: 'Double-cliquez pour renommer',

	// Toolbar buttons
	fields: 'Champs',
	filter: 'Filtre',
	filters: 'Filtres',
	sort: 'Trier',
	actions: 'Actions',
	group_by: 'Grouper par',
	cover: 'Couverture',
	date_field: 'Date',
	start_field: 'Début',
	end_field: 'Fin',
	group_field: 'Groupe',

	// Dropdown labels
	fields_in_card: 'Champs dans la carte',
	fields_label: 'Champs',
	fields_on_bars: 'Champs sur les barres',
	filter_by: 'Filtrer par',
	sort_by: 'Trier par',
	group_by_label: 'Grouper par',
	date_field_label: 'Champ de date',
	cover_field_label: 'Champ de couverture',
	card_size_label: 'Taille de carte',
	row_height_label: 'Hauteur de ligne',

	// Common values
	none_value: 'Aucun',
	no_value: 'Sans valeur',
	no_cover: 'Aucune',

	// Card sizes
	size_small: 'Petit',
	size_medium: 'Moyen',
	size_large: 'Grand',

	// Row heights
	height_compact: 'Compact',
	height_medium: 'Moyen',
	height_tall: 'Grand',

	// Filter/Sort
	add_filter_advanced: 'Ajouter un filtre avancé',
	add_sort: 'Ajouter un tri',
	no_active_sorts: 'Aucun tri actif',
	name_column: 'Nom',

	// Conjunction pills
	conjunction_and: 'ET',
	conjunction_or: 'OU',

	// Filter value placeholders
	filter_number_placeholder: 'Nombre...',
	filter_value_placeholder: 'Valeur...',

	// Actions menu
	delete_selected: 'Supprimer tous les sélectionnés',
	move_selected: 'Déplacer tous les sélectionnés',
	duplicate_selected: 'Dupliquer tous les sélectionnés',
	export_csv: 'Exporter CSV',
	import_csv: 'Importer CSV',

	// Context menu (single note)
	open_note: 'Ouvrir la note',
	delete_note: 'Supprimer la note',
	duplicate_note: 'Dupliquer la note',

	// Sort directions
	sort_asc: 'Croissant',
	sort_desc: 'Décroissant',
	sort_asc_title: 'Trier décroissant',
	sort_desc_title: 'Supprimer le tri',
	sort_none_title: 'Trier croissant',

	// Column header menu
	rename_column: 'Renommer',
	edit_formula: 'Modifier la formule',
	configure_lookup: 'Configurer le lookup',
	configure_relation: 'Configurer la relation',
	format_number: 'Formater le nombre',
	configure_image_folder: 'Configurer le dossier d\'images',
	field_type_label: 'Type de champ',
	hide_field: 'Masquer le champ',
	delete_field: 'Supprimer le champ',

	// Column types
	type_title: 'Titre',
	type_text: 'Texte',
	type_number: 'Nombre',
	type_select: 'Sélection',
	type_multiselect: 'Multi-sélection',
	type_date: 'Date',
	type_checkbox: 'Checkbox',
	type_url: 'URL',
	type_email: 'Email',
	type_phone: 'Téléphone',
	type_status: 'Statut',
	type_formula: 'Formule',
	type_relation: 'Relation',
	type_lookup: 'Lookup',
	type_rollup: 'Rollup',
	rollup_panel_title: 'Rollup',
	configure_rollup: 'Configurer le rollup',
	rollup_select_relation: '1. Colonne de relation',
	rollup_select_relation_placeholder: 'Sélectionner une relation...',
	rollup_select_target: '2. Colonne cible',
	rollup_select_target_placeholder: 'Sélectionner une colonne...',
	rollup_select_function: '3. Agrégation',
	rollup_no_relations: 'Aucune colonne de relation trouvée. Ajoutez d\'abord une colonne de relation.',
	rollup_fn_sum: 'Somme',
	rollup_fn_count: 'Compter',
	rollup_fn_avg: 'Moyenne',
	rollup_fn_min: 'Min',
	rollup_fn_max: 'Max',
	rollup_fn_count_values: 'Compter les uniques',
	rollup_fn_list: 'Tout lister',
	type_image: 'Image',
	type_audio: 'Audio',
	audio_path_placeholder: 'Chemin vers le fichier audio...',
	audio_select_placeholder: 'Sélectionner un audio...',
	audio_picker_title: 'Sélectionner un audio',
	audio_picker_clear: 'Effacer',
	audio_picker_empty_folder: 'Aucun fichier audio dans le dossier',
	audio_picker_empty_vault: 'Aucun fichier audio dans le vault',
	audio_panel_title: 'Paramètres audio',
	audio_folder_label: 'Dossier source (laisser vide pour tout le vault)',
	audio_folder_placeholder: 'Ex : audio/musique',
	configure_audio_folder: 'Configurer le dossier audio',

	// Video column
	type_video: 'Vidéo',
	video_select_placeholder: 'Sélectionner une vidéo...',
	video_picker_clear: 'Effacer',
	video_picker_empty_folder: 'Aucun fichier vidéo dans le dossier',
	video_picker_empty_vault: 'Aucun fichier vidéo dans le vault',
	video_panel_title: 'Paramètres vidéo',
	video_folder_label: 'Dossier source (laisser vide pour tout le vault)',
	video_folder_placeholder: 'Ex : video/clips',
	configure_video_folder: 'Configurer le dossier vidéo',

	// Formula panel
	formula_panel_title: 'Formule',
	formula_placeholder: 'Exemple : if(status = "done", 1, 0)',
	formula_valid: 'Syntaxe valide',
	formula_available_cols: 'Colonnes disponibles :',
	formula_ref_toggle: 'Référence des fonctions',
	formula_save: 'Enregistrer',
	formula_cancel: 'Annuler',
	formula_save_hint: 'Enregistrer (Ctrl+Entrée)',

	// Formula reference groups
	formula_group_logic: 'Logique',
	formula_group_comparators: 'Comparateurs',
	formula_group_aggregators: 'Agrégateurs',
	formula_group_text: 'Texte',
	formula_group_math: 'Mathématiques',
	formula_group_utils: 'Utilitaires',

	// Number format panel
	number_format_title: 'Format',
	number_decimals_label: 'Décimales',
	number_thousands_label: 'Séparateur de milliers',
	number_prefix_label: 'Préfixe',
	number_suffix_label: 'Suffixe',
	number_prefix_placeholder: 'Ex : $, €',
	number_suffix_placeholder: 'Ex : %, kg, km',
	number_remove_format: 'Supprimer le format',

	// Lookup/Relation panel
	relation_panel_title: 'Relation',
	lookup_panel_title: 'Lookup',
	lookup_ref_table: '1. Table de référence',
	lookup_select_table: 'Sélectionner une table...',
	lookup_col_to_display: '2. Colonne à afficher',
	lookup_origin_col: '2. Champ source des valeurs',
	lookup_select_col: 'Sélectionner une colonne...',
	lookup_file_name: 'Nom du fichier',
	lookup_join_col: '3. Colonne de jointure (cette table)',
	lookup_join_col_title: 'Nom du fichier (jointure par titre)',
	lookup_select_join_col: 'Sélectionner une colonne...',
	lookup_hint: 'La valeur de cette colonne doit correspondre au nom du fichier dans la table référencée',

	// Image config panel
	image_panel_title: 'Image',
	image_folder_label: 'Dossier source (optionnel)',
	image_folder_placeholder: 'Ex : images/covers',

	// Image picker
	image_picker_title: 'Sélectionner une image',
	image_picker_clear: 'Effacer',
	image_picker_empty_vault: 'Aucune image trouvée dans le vault',
	image_picker_empty_folder: 'Aucune image trouvée dans',
	image_select_placeholder: 'Sélectionner une image…',

	// Aggregations
	agg_none: 'Aucun',
	agg_count: 'Compter',
	agg_count_values: 'Compter les valeurs',
	agg_sum: 'Somme',
	agg_avg: 'Moyenne',
	agg_min: 'Min',
	agg_max: 'Max',

	// Empty states / loading
	no_database_open: 'Aucune base de données ouverte.',
	no_database_hint: 'Utilisez le bouton du ruban ou la commande "créer une nouvelle base de données".',
	loading: 'Chargement...',
	no_results: 'Aucun élément trouvé',

	// Row/item counts
	item_singular: 'Élément',
	item_plural: 'Éléments',
	row_singular: 'Ligne',
	row_plural: 'Lignes',
	record_singular: 'Enregistrement',
	record_plural: 'Enregistrements',

	// Add row/entry
	add_row: 'Nouvelle ligne',
	add_entry: 'Nouvelle entrée',
	add_card: 'Nouvelle carte',
	new_field: 'Nouveau champ',
	add_field: 'Ajouter un champ',

	// Board
	board_no_select_col: 'Le tableau nécessite une colonne de sélection ou de statut pour grouper les cartes.',
	board_add_select_hint: 'Ajoutez une colonne de ce type dans la vue tableau et revenez ici.',
	board_drag_reorder: 'Glisser pour réorganiser',
	board_set_limit: 'Cliquer pour definir la limite de cartes',
	board_limit_placeholder: 'Limite (0 = aucune)',
	board_show_more: 'De plus',
	board_show_less: 'Afficher moins',
	hide_empty_cols: 'Masquer vides',
	hide_no_value_cols: 'Masquer sans valeur',

	// Calendar
	calendar_no_date_field: 'Sélectionnez un champ de date dans la barre d\'outils pour afficher le calendrier.',
	calendar_no_date_section: 'Sans date',
	calendar_click_to_create: 'Cliquez pour créer une note',
	calendar_today: 'Aujourd\'hui',
	calendar_prev_month: 'Mois précédent',
	calendar_next_month: 'Mois suivant',
	calendar_view_month: 'Mois',
	calendar_view_week: 'Semaine',
	calendar_prev_week: 'Semaine précédente',
	calendar_next_week: 'Semaine suivante',
	calendar_add_time: 'Ajouter une heure',
	calendar_remove_time: 'Supprimer l\'heure',
	calendar_all_day: 'Toute la journée',

	// Calendar days (short)
	day_sun: 'Dim',
	day_mon: 'Lun',
	day_tue: 'Mar',
	day_wed: 'Mer',
	day_thu: 'Jeu',
	day_fri: 'Ven',
	day_sat: 'Sam',

	// Calendar months (long)
	month_january: 'Janvier',
	month_february: 'Février',
	month_march: 'Mars',
	month_april: 'Avril',
	month_may: 'Mai',
	month_june: 'Juin',
	month_july: 'Juillet',
	month_august: 'Août',
	month_september: 'Septembre',
	month_october: 'Octobre',
	month_november: 'Novembre',
	month_december: 'Décembre',

	// Timeline
	timeline_no_start_field: 'Sélectionnez un champ de début dans la barre d\'outils pour afficher la chronologie.',
	timeline_no_interval: 'Sans intervalle',
	timeline_scroll_prev: 'Défiler en arrière',
	timeline_scroll_next: 'Défiler en avant',
	zoom_days: 'Jours',
	zoom_weeks: 'Semaines',
	zoom_months: 'Mois',

	// Timeline months (short)
	month_short_jan: 'Jan',
	month_short_feb: 'Fév',
	month_short_mar: 'Mar',
	month_short_apr: 'Avr',
	month_short_may: 'Mai',
	month_short_jun: 'Jun',
	month_short_jul: 'Jul',
	month_short_aug: 'Aoû',
	month_short_sep: 'Sep',
	month_short_oct: 'Oct',
	month_short_nov: 'Nov',
	month_short_dec: 'Déc',

	// Hierarchy / Sub-rows
	hierarchy_toggle: 'Utiliser comme hiérarchie',
	hierarchy_toggle_hint: 'Active les relations parent-enfant entre les lignes de cette base de données',
	add_subrow: 'Ajouter une sous-ligne',
	collapse_all: 'Tout réduire',
	expand_all: 'Tout développer',
	max_depth_reached: 'Profondeur maximale atteinte (3 niveaux)',

	// Chart view
	chart_configure: 'Configurer',
	chart_type: 'Type de graphique',
	chart_type_bar: 'Barres',
	chart_type_line: 'Courbes',
	chart_type_pie: 'Camembert',
	chart_x_axis: 'Catégories (axe X)',
	chart_y_axis: 'Valeurs (axe Y)',
	chart_aggregation: 'Agrégation',
	chart_select_column: 'Sélectionner une colonne...',
	chart_count_records: 'Compter',
	chart_no_config: 'Configurez le graphique pour commencer.',
	chart_no_config_hint: 'Sélectionnez une colonne pour les catégories dans la barre d\'outils ci-dessus.',

	// Misc tooltips
	tooltip_pin_column: 'Fixer les colonnes jusqu\'ici',
	tooltip_unpin_column: 'Détacher les colonnes',
	tooltip_resize_column: 'Glisser pour redimensionner ; double-clic pour ajuster au contenu',
	tooltip_wrap_text: 'Retour à la ligne',
	tooltip_include_subfolders: 'Inclure les sous-dossiers',
	folder_column: 'Dossier',
	tooltip_manage_fields: 'Gérer les champs',
	tooltip_batch_actions: 'Actions groupées',
	tooltip_remove_filter: 'Supprimer le filtre',
	tooltip_close: 'Fermer',
	tooltip_remove: 'Supprimer',
	tooltip_move_up: 'Monter',
	tooltip_move_down: 'Descendre',
	tooltip_change_color: 'Changer la couleur',
	tooltip_delete_status: 'Supprimer le statut',

	// Status defaults
	status_not_started: 'Non commencé',
	status_in_progress: 'En cours',
	status_done: 'Terminé',
	status_cancelled: 'Annulé',

	// Relation cell
	relation_search_placeholder: 'Rechercher...',
	relation_clear: 'Effacer',
	relation_no_results: 'Aucun résultat',
	relation_two_way: 'Relation bidirectionnelle',
	relation_two_way_hint: 'Crée automatiquement une relation inverse dans la base de données cible',

	// Select cell
	select_clear: 'Effacer',
	select_create_placeholder: 'Créer une nouvelle option...',

	// Status cell
	status_new_placeholder: 'Nouveau statut...',
	color_custom: 'Personnalisée',

	// Type change validation errors
	validate_non_numeric: 'Cellule(s) contiennent des valeurs non numériques (ex : "',
	validate_invalid_dates: 'Cellule(s) contiennent des valeurs qui ne sont pas des dates valides (ex : "',
	validate_invalid_checkbox: 'Cellule(s) contiennent des valeurs incompatibles avec checkbox (ex : "',
	validate_multiselect_to_select: 'Ligne(s) ont plusieurs valeurs sélectionnées. Supprimez les extras avant de passer en sélection unique.',
	validate_invalid_email: 'Cellule(s) contiennent des valeurs qui ne sont pas des emails valides (ex : "',
	validate_invalid_url: 'Cellule(s) contiennent des valeurs qui ne sont pas des URLs valides (ex : "',
	validate_invalid_phone: 'Cellule(s) contiennent des valeurs qui ne sont pas des numéros de téléphone valides (ex : "',
	validate_type_change_prefix: 'Impossible de changer le type : ',

	// Cell validation
	email_invalid: 'Email invalide',

	// Filter operators
	op_is: 'Est',
	op_is_not: 'N\'est pas',
	op_contains: 'Contient',
	op_not_contains: 'Ne contient pas',
	op_starts_with: 'Commence par',
	op_ends_with: 'Finit par',
	op_is_empty: 'Est vide',
	op_is_not_empty: 'N\'est pas vide',
	op_gt: '>',
	op_gte: '>=',
	op_lt: '<',
	op_lte: '<=',
	op_is_checked: 'Est coché',
	op_is_unchecked: 'N\'est pas coché',

	// Settings tab
	settings_db_filename_name: 'Nom du fichier de base de données',
	settings_db_filename_desc: 'Nom du fichier spécial qui identifie une base de données dans un dossier.',
	settings_row_height_name: 'Hauteur de ligne par défaut',
	settings_row_height_desc: 'Hauteur en pixels de chaque ligne du tableau.',

	// Inline fields
	settings_inline_fields_name: 'Lire les champs inline dataview',
	settings_inline_fields_desc: 'Analyse les champs key:: value dans le corps de la note et les affiche comme valeurs de colonne (lecture seule)',

	// Database manager
	db_untitled_note: 'Sans titre',
	db_copy_suffix: '(copie)',
	db_copy_suffix_n: '(copie $n)',
	db_already_exists: 'Une base de données existe déjà dans "$folder"',
	db_tip_body: 'Ce fichier est une base de données. Ouvrez-le pour voir la vue tableau.',

	// Formula errors
	formula_err_unclosed_string: 'Chaîne non fermée à la position $pos',
	formula_err_unclosed_bracket: 'Crochet non fermé à la position $pos',
	formula_err_unexpected_bang: "Caractère inattendu '!' à la position $pos",
	formula_err_unexpected_char: "Caractère inattendu '$char' à la position $pos",
	formula_err_expected_token: "Attendu $expected, trouvé '$found' à la position $pos",
	formula_err_unexpected_token: "Token inattendu '$token' à la position $pos",
	formula_err_circular_ref: 'Référence circulaire : "$name" est une colonne formule',
	formula_err_unknown_fn: 'Fonction inconnue : $fn()',
	formula_err_if_args: 'Attendu if(condition, si_vrai, [si_faux])',
	formula_err_avg_args: 'Attendu avg(colonne) — nécessite une référence de colonne',
	formula_err_count_args: 'Attendu count(colonne) — nécessite une référence de colonne',
	formula_err_mid_args: 'Attendu mid(texte, début, longueur)',
	formula_err_mod_args: 'Attendu mod(nombre, diviseur)',
	formula_err_sqrt_args: 'Attendu sqrt(nombre)',
	formula_err_not_implemented: 'Fonction non implémentée : $fn()',

	// Plugin
	plugin_display_name: 'Notion bases',
	no_databases_found: 'Aucune base de données trouvée. Utilisez la commande "créer une nouvelle base de données" pour en créer une.',

	// Commands
	cmd_open_database: 'Ouvrir la base de données de ce dossier',
	cmd_create_database: 'Créer une nouvelle base de données dans le dossier actuel',

	// Quick add
	cmd_quick_add: 'Ajouter rapidement une ligne à la base de données',
	quick_add_title: 'Ajout rapide',
	quick_add_note_title: 'Titre',
	quick_add_note_title_placeholder: 'Titre de la note...',
	quick_add_create: 'Créer',
	quick_add_create_and_open: 'Créer et ouvrir',
	quick_add_no_visible_fields: 'Aucun champ modifiable dans cette base de données',

	// Picker / View
	picker_placeholder: 'Sélectionner une base de données...',
	picker_root: '/ (Racine)',
	view_fallback_name: 'Base de données',
	saving: 'Enregistrement',
	saved: 'Enregistré',
	save_error: 'Erreur de sauvegarde',
	settings_page_size_name: 'Lignes par page',
	settings_page_size_desc: 'Nombre de lignes à afficher par page. Définissez "Toutes" pour le défilement continu',
	settings_page_size_all: 'Toutes (défilement continu)',
	page_of: 'Page {current} sur {total}',
	first_page: 'Première page',
	last_page: 'Dernière page',
	prev_page: 'Page précédente',
	next_page: 'Page suivante',
	conditional_formatting: 'Mise en forme conditionnelle',
	no_conditional_formats: 'Aucune règle pour l\'instant',
	add_rule: 'Ajouter une règle',
	select_value: 'Sélectionner une valeur',
	style: 'Style',
	background: 'Arrière-plan',
	text_color: 'Couleur du texte',
	save: 'Enregistrer',
	cancel: 'Annuler',
	value: 'Valeur',
}

export default fr
