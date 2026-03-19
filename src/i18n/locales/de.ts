import en from './en'

const de: Partial<Record<keyof typeof en, string>> = {
	// View types
	view_table: 'Tabelle',
	view_list: 'Liste',
	view_board: 'Board',
	view_gallery: 'Galerie',
	view_calendar: 'Kalender',
	view_timeline: 'Zeitleiste',

	// View tabs
	add_view: 'Ansicht hinzufügen',
	remove_view: 'Ansicht entfernen',
	rename_view_hint: 'Doppelklick zum Umbenennen',

	// Toolbar buttons
	fields: 'Felder',
	filter: 'Filter',
	filters: 'Filter',
	sort: 'Sortieren',
	actions: 'Aktionen',
	group_by: 'Gruppieren nach',
	cover: 'Titelbild',
	date_field: 'Datum',
	start_field: 'Start',
	end_field: 'Ende',
	group_field: 'Gruppe',

	// Dropdown labels
	fields_in_card: 'Felder in der Karte',
	fields_label: 'Felder',
	fields_on_bars: 'Felder auf Balken',
	filter_by: 'Filtern nach',
	sort_by: 'Sortieren nach',
	group_by_label: 'Gruppieren nach',
	date_field_label: 'Datumsfeld',
	cover_field_label: 'Titelbildfeld',
	card_size_label: 'Kartengröße',
	row_height_label: 'Zeilenhöhe',

	// Common values
	none_value: 'Keine',
	no_value: 'Kein Wert',
	no_cover: 'Keine',

	// Card sizes
	size_small: 'Klein',
	size_medium: 'Mittel',
	size_large: 'Groß',

	// Row heights
	height_compact: 'Kompakt',
	height_medium: 'Mittel',
	height_tall: 'Groß',

	// Filter/Sort
	add_filter_advanced: 'Erweiterten Filter hinzufügen',
	add_sort: 'Sortierung hinzufügen',
	no_active_sorts: 'Keine aktiven Sortierungen',
	name_column: 'Name',

	// Conjunction pills
	conjunction_and: 'UND',
	conjunction_or: 'ODER',

	// Filter value placeholders
	filter_number_placeholder: 'Zahl...',
	filter_value_placeholder: 'Wert...',

	// Actions menu
	delete_selected: 'Alle ausgewählten löschen',
	move_selected: 'Alle ausgewählten verschieben',
	duplicate_selected: 'Alle ausgewählten duplizieren',
	export_csv: 'CSV exportieren',
	import_csv: 'CSV importieren',

	// Context menu (single note)
	open_note: 'Notiz öffnen',
	delete_note: 'Notiz löschen',
	duplicate_note: 'Notiz duplizieren',

	// Sort directions
	sort_asc: 'Aufsteigend',
	sort_desc: 'Absteigend',
	sort_asc_title: 'Absteigend sortieren',
	sort_desc_title: 'Sortierung entfernen',
	sort_none_title: 'Aufsteigend sortieren',

	// Column header menu
	rename_column: 'Umbenennen',
	edit_formula: 'Formel bearbeiten',
	configure_lookup: 'Lookup konfigurieren',
	configure_relation: 'Relation konfigurieren',
	format_number: 'Zahl formatieren',
	configure_image_folder: 'Bildordner konfigurieren',
	field_type_label: 'Feldtyp',
	hide_field: 'Feld ausblenden',
	delete_field: 'Feld löschen',

	// Column types
	type_title: 'Titel',
	type_text: 'Text',
	type_number: 'Zahl',
	type_select: 'Auswahl',
	type_multiselect: 'Mehrfachauswahl',
	type_date: 'Datum',
	type_checkbox: 'Checkbox',
	type_url: 'URL',
	type_email: 'E-Mail',
	type_phone: 'Telefon',
	type_status: 'Status',
	type_formula: 'Formel',
	type_relation: 'Relation',
	type_lookup: 'Lookup',
	type_image: 'Bild',
	type_audio: 'Audio',
	audio_path_placeholder: 'Pfad zur Audiodatei...',
	audio_select_placeholder: 'Audio auswählen...',
	audio_picker_title: 'Audio auswählen',
	audio_picker_clear: 'Löschen',
	audio_picker_empty_folder: 'Keine Audiodateien im Ordner',
	audio_picker_empty_vault: 'Keine Audiodateien im Vault',
	audio_panel_title: 'Audioeinstellungen',
	audio_folder_label: 'Quellordner (leer lassen für den gesamten Vault)',
	audio_folder_placeholder: 'Z.B.: audio/musik',
	configure_audio_folder: 'Audioordner konfigurieren',

	// Video column
	type_video: 'Video',
	video_select_placeholder: 'Video auswählen...',
	video_picker_clear: 'Löschen',
	video_picker_empty_folder: 'Keine Videodateien im Ordner',
	video_picker_empty_vault: 'Keine Videodateien im Vault',
	video_panel_title: 'Videoeinstellungen',
	video_folder_label: 'Quellordner (leer lassen für den gesamten Vault)',
	video_folder_placeholder: 'Z.B.: video/clips',
	configure_video_folder: 'Videoordner konfigurieren',

	// Formula panel
	formula_panel_title: 'Formel',
	formula_placeholder: 'Beispiel: if(status = "done", 1, 0)',
	formula_valid: 'Gültige Syntax',
	formula_available_cols: 'Verfügbare Spalten:',
	formula_ref_toggle: 'Funktionsreferenz',
	formula_save: 'Speichern',
	formula_cancel: 'Abbrechen',
	formula_save_hint: 'Speichern (Strg+Eingabe)',

	// Formula reference groups
	formula_group_logic: 'Logik',
	formula_group_comparators: 'Vergleiche',
	formula_group_aggregators: 'Aggregatoren',
	formula_group_text: 'Text',
	formula_group_math: 'Mathematik',
	formula_group_utils: 'Hilfsfunktionen',

	// Number format panel
	number_format_title: 'Format',
	number_decimals_label: 'Dezimalstellen',
	number_thousands_label: 'Tausendertrennzeichen',
	number_prefix_label: 'Präfix',
	number_suffix_label: 'Suffix',
	number_prefix_placeholder: 'Z.B.: $, €',
	number_suffix_placeholder: 'Z.B.: %, kg, km',
	number_remove_format: 'Formatierung entfernen',

	// Lookup/Relation panel
	relation_panel_title: 'Relation',
	lookup_panel_title: 'Lookup',
	lookup_ref_table: '1. Referenztabelle',
	lookup_select_table: 'Tabelle auswählen...',
	lookup_col_to_display: '2. Anzuzeigende Spalte',
	lookup_origin_col: '2. Quellfeld für Werte',
	lookup_select_col: 'Spalte auswählen...',
	lookup_file_name: 'Dateiname',
	lookup_join_col: '3. Verknüpfungsspalte (diese Tabelle)',
	lookup_join_col_title: 'Dateiname (Verknüpfung nach Titel)',
	lookup_select_join_col: 'Spalte auswählen...',
	lookup_hint: 'Der Wert dieser Spalte muss mit dem Dateinamen in der referenzierten Tabelle übereinstimmen',

	// Image config panel
	image_panel_title: 'Bild',
	image_folder_label: 'Quellordner (optional)',
	image_folder_placeholder: 'Z.B.: images/covers',

	// Image picker
	image_picker_title: 'Bild auswählen',
	image_picker_clear: 'Löschen',
	image_picker_empty_vault: 'Keine Bilder im Vault gefunden',
	image_picker_empty_folder: 'Keine Bilder gefunden in',
	image_select_placeholder: 'Bild auswählen…',

	// Aggregations
	agg_none: 'Keine',
	agg_count: 'Anzahl',
	agg_count_values: 'Werte zählen',
	agg_sum: 'Summe',
	agg_avg: 'Durchschnitt',
	agg_min: 'Min',
	agg_max: 'Max',

	// Empty states / loading
	no_database_open: 'Keine Datenbank geöffnet.',
	no_database_hint: 'Verwenden Sie die Schaltfläche in der Leiste oder den Befehl "Neue Datenbank erstellen".',
	loading: 'Laden...',
	no_results: 'Keine Einträge gefunden',

	// Row/item counts
	item_singular: 'Element',
	item_plural: 'Elemente',
	row_singular: 'Zeile',
	row_plural: 'Zeilen',
	record_singular: 'Datensatz',
	record_plural: 'Datensätze',

	// Add row/entry
	add_row: 'Neue Zeile',
	add_entry: 'Neuer Eintrag',
	add_card: 'Neue Karte',
	new_field: 'Neues Feld',
	add_field: 'Feld hinzufügen',

	// Board
	board_no_select_col: 'Das Board benötigt eine Auswahl- oder Statusspalte zum Gruppieren der Karten.',
	board_add_select_hint: 'Fügen Sie eine Spalte dieses Typs in der Tabellenansicht hinzu und kehren Sie hierher zurück.',
	board_drag_reorder: 'Ziehen zum Neuordnen',
	board_set_limit: 'Klicken um Kartenlimit zu setzen',
	board_limit_placeholder: 'Limit (0 = kein)',
	board_show_more: 'Mehr',
	board_show_less: 'Weniger anzeigen',
	hide_empty_cols: 'Leere ausblenden',
	hide_no_value_cols: 'Ohne Wert ausblenden',

	// Calendar
	calendar_no_date_field: 'Wählen Sie ein Datumsfeld in der Symbolleiste aus, um den Kalender anzuzeigen.',
	calendar_no_date_section: 'Ohne Datum',
	calendar_click_to_create: 'Klicken zum Erstellen einer Notiz',
	calendar_today: 'Heute',
	calendar_prev_month: 'Vorheriger Monat',
	calendar_next_month: 'Nächster Monat',
	calendar_view_month: 'Monat',
	calendar_view_week: 'Woche',
	calendar_prev_week: 'Vorherige Woche',
	calendar_next_week: 'Nächste Woche',
	calendar_add_time: 'Uhrzeit hinzufügen',
	calendar_remove_time: 'Uhrzeit entfernen',
	calendar_all_day: 'Ganztägig',

	// Calendar days (short)
	day_sun: 'So',
	day_mon: 'Mo',
	day_tue: 'Di',
	day_wed: 'Mi',
	day_thu: 'Do',
	day_fri: 'Fr',
	day_sat: 'Sa',

	// Calendar months (long)
	month_january: 'Januar',
	month_february: 'Februar',
	month_march: 'März',
	month_april: 'April',
	month_may: 'Mai',
	month_june: 'Juni',
	month_july: 'Juli',
	month_august: 'August',
	month_september: 'September',
	month_october: 'Oktober',
	month_november: 'November',
	month_december: 'Dezember',

	// Timeline
	timeline_no_start_field: 'Wählen Sie ein Startfeld in der Symbolleiste aus, um die Zeitleiste anzuzeigen.',
	timeline_no_interval: 'Kein Intervall',
	timeline_scroll_prev: 'Zurück scrollen',
	timeline_scroll_next: 'Vorwärts scrollen',
	zoom_days: 'Tage',
	zoom_weeks: 'Wochen',
	zoom_months: 'Monate',

	// Timeline months (short)
	month_short_jan: 'Jan',
	month_short_feb: 'Feb',
	month_short_mar: 'Mär',
	month_short_apr: 'Apr',
	month_short_may: 'Mai',
	month_short_jun: 'Jun',
	month_short_jul: 'Jul',
	month_short_aug: 'Aug',
	month_short_sep: 'Sep',
	month_short_oct: 'Okt',
	month_short_nov: 'Nov',
	month_short_dec: 'Dez',

	// Misc tooltips
	tooltip_pin_column: 'Spalten bis hier fixieren',
	tooltip_unpin_column: 'Spalten lösen',
	tooltip_resize_column: 'Ziehen zum Ändern der Größe; Doppelklick zum Anpassen',
	tooltip_wrap_text: 'Textumbruch',
	tooltip_include_subfolders: 'Unterordner einbeziehen',
	folder_column: 'Ordner',
	tooltip_manage_fields: 'Felder verwalten',
	tooltip_batch_actions: 'Stapelaktionen',
	tooltip_remove_filter: 'Filter entfernen',
	tooltip_close: 'Schließen',
	tooltip_remove: 'Entfernen',
	tooltip_move_up: 'Nach oben',
	tooltip_move_down: 'Nach unten',
	tooltip_change_color: 'Farbe ändern',
	tooltip_delete_status: 'Status löschen',

	// Status defaults
	status_not_started: 'Nicht begonnen',
	status_in_progress: 'In Bearbeitung',
	status_done: 'Erledigt',
	status_cancelled: 'Abgebrochen',

	// Relation cell
	relation_search_placeholder: 'Suchen...',
	relation_clear: 'Löschen',
	relation_no_results: 'Keine Ergebnisse',
	relation_two_way: 'Bidirektionale relation',
	relation_two_way_hint: 'Erstellt automatisch eine umgekehrte Relation in der Zieldatenbank',

	// Select cell
	select_clear: 'Löschen',
	select_create_placeholder: 'Neue Option erstellen...',

	// Status cell
	status_new_placeholder: 'Neuer Status...',
	color_custom: 'Benutzerdefiniert',

	// Type change validation errors
	validate_non_numeric: 'Zelle(n) enthalten nicht-numerische Werte (z.B.: "',
	validate_invalid_dates: 'Zelle(n) enthalten Werte, die keine gültigen Daten sind (z.B.: "',
	validate_invalid_checkbox: 'Zelle(n) enthalten Werte, die mit Checkbox inkompatibel sind (z.B.: "',
	validate_multiselect_to_select: 'Zeile(n) haben mehrere Werte ausgewählt. Entfernen Sie die Extras, bevor Sie zur Einzelauswahl wechseln.',
	validate_invalid_email: 'Zelle(n) enthalten Werte, die keine gültigen E-Mails sind (z.B.: "',
	validate_invalid_url: 'Zelle(n) enthalten Werte, die keine gültigen URLs sind (z.B.: "',
	validate_invalid_phone: 'Zelle(n) enthalten Werte, die keine gültigen Telefonnummern sind (z.B.: "',
	validate_type_change_prefix: 'Typänderung nicht möglich: ',

	// Cell validation
	email_invalid: 'Ungültige E-Mail',

	// Filter operators
	op_is: 'Ist',
	op_is_not: 'Ist nicht',
	op_contains: 'Enthält',
	op_not_contains: 'Enthält nicht',
	op_starts_with: 'Beginnt mit',
	op_ends_with: 'Endet mit',
	op_is_empty: 'Ist leer',
	op_is_not_empty: 'Ist nicht leer',
	op_gt: '>',
	op_gte: '>=',
	op_lt: '<',
	op_lte: '<=',
	op_is_checked: 'Ist aktiviert',
	op_is_unchecked: 'Ist nicht aktiviert',

	// Settings tab
	settings_db_filename_name: 'Datenbankdateiname',
	settings_db_filename_desc: 'Name der speziellen Datei, die eine Datenbank in einem Ordner identifiziert.',
	settings_row_height_name: 'Standard-Zeilenhöhe',
	settings_row_height_desc: 'Höhe in Pixeln jeder Tabellenzeile.',

	// Database manager
	db_untitled_note: 'Unbenannt',
	db_copy_suffix: '(Kopie)',
	db_copy_suffix_n: '(Kopie $n)',
	db_already_exists: 'Eine Datenbank existiert bereits in "$folder"',
	db_tip_body: 'Diese Datei ist eine Datenbank. Öffnen Sie sie, um die Tabellenansicht zu sehen.',

	// Formula errors
	formula_err_unclosed_string: 'Nicht geschlossene Zeichenkette an Position $pos',
	formula_err_unclosed_bracket: 'Nicht geschlossene Klammer an Position $pos',
	formula_err_unexpected_bang: "Unerwartetes Zeichen '!' an Position $pos",
	formula_err_unexpected_char: "Unerwartetes Zeichen '$char' an Position $pos",
	formula_err_expected_token: "Erwartet $expected, gefunden '$found' an Position $pos",
	formula_err_unexpected_token: "Unerwartetes Token '$token' an Position $pos",
	formula_err_circular_ref: 'Zirkuläre Referenz: "$name" ist eine Formelspalte',
	formula_err_unknown_fn: 'Unbekannte Funktion: $fn()',
	formula_err_if_args: 'Erwartet if(Bedingung, wenn_wahr, [wenn_falsch])',
	formula_err_avg_args: 'Erwartet avg(Spalte) — benötigt eine Spaltenreferenz als Argument',
	formula_err_count_args: 'Erwartet count(Spalte) — benötigt eine Spaltenreferenz als Argument',
	formula_err_mid_args: 'Erwartet mid(Text, Start, Länge)',
	formula_err_mod_args: 'Erwartet mod(Zahl, Divisor)',
	formula_err_sqrt_args: 'Erwartet sqrt(Zahl)',
	formula_err_not_implemented: 'Funktion nicht implementiert: $fn()',

	// Plugin
	plugin_display_name: 'Notion bases',
	no_databases_found: 'Keine Datenbanken gefunden. Verwenden Sie den Befehl "Neue Datenbank erstellen", um eine zu erstellen.',

	// Commands
	cmd_open_database: 'Datenbank für diesen Ordner öffnen',
	cmd_create_database: 'Neue Datenbank im aktuellen Ordner erstellen',

	// Picker / View
	picker_placeholder: 'Datenbank auswählen...',
	picker_root: '/ (Stammverzeichnis)',
	view_fallback_name: 'Datenbank',
}

export default de
