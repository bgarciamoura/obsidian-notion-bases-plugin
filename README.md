# Notion Bases

**Turn any folder in your vault into a powerful database — right inside Obsidian.**

Notion Bases brings the database experience you love from Notion directly into your vault. Every note in a folder becomes a row. Every frontmatter field becomes a column. No external tools, no syncing, no lock-in — your data stays in plain Markdown files, forever yours.

---

## Features

### Multiple views per database
Every database supports multiple views — each with its own filters, sorts, visible columns and layout. Switch between views using the tabs at the top. Click **+** to add a new view; click **×** on a tab to remove it. Views are saved independently and never affect each other.

### Table view
- **Rich column types** — Title, Text, Number, Select, Multi-select, Checkbox, Date, URL, Email, Phone, Status, Formula, Relation, Lookup
- **Inline editing** — click any cell to edit; changes are saved directly to the note's frontmatter
- **Filters with AND/OR logic** — add filter pills per column with type-aware operators (`contains`, `is`, `>`, `<`, `is checked`, and more); toggle between AND and OR between any two filters
- **Multi-column sorting** — sort by multiple columns with priority ordering via a draggable sort panel
- **Aggregation row** — footer row per column showing Sum, Average, Min, Max, Count or Count Filled; updates live as you filter
- **Row height** — switch between Compact, Medium and Tall row sizes
- **Text wrap** — toggle cell text wrapping so long values expand vertically instead of being clipped
- **Column reordering** — drag columns to reorder them
- **Column resizing** — drag column edges to resize; double-click to auto-fit
- **Column pinning** — pin a column to the left so it stays visible when scrolling horizontally
- **Hide/show fields** — choose which columns are visible without deleting them
- **Number formatting** — format number columns with prefixes, suffixes, decimals and thousand separators (Excel-style)
- **Row selection** — select multiple rows to delete, duplicate or move them in bulk
- **Row count bar** — see total rows and how many match the current filters
- **CSV export** — download the current view (with active filters applied) as a `.csv` file
- **CSV import** — upload a `.csv` file to create new rows; existing rows with matching titles are skipped
- **Formula columns** — compute values from other columns using a built-in formula engine
- **Relation columns** — link rows to notes in another database folder
- **Lookup columns** — pull a field value from a related database

### List view
A minimal, scrollable list showing each row as a single line: the note title followed by property chips for visible columns. Click any row to open the underlying note. Supports the same filters, sorts and field visibility as the table view.

### Column types

| Type | Description |
|------|-------------|
| `title` | The note's filename — always the first column |
| `text` | Plain text |
| `number` | Numeric value with optional formatting |
| `select` | Single option from a defined list |
| `multiselect` | Multiple options from a defined list |
| `checkbox` | Boolean true/false |
| `date` | Date value |
| `url` | Clickable link |
| `email` | Email address with inline validation |
| `phone` | Phone number with Brazilian mask |
| `status` | Colored status badge; create, rename, recolor and delete options inline |
| `formula` | Computed value using other column values |
| `relation` | Link to a note in another database |
| `lookup` | Pull a field from a related database |

### Database embed
Embed any database inside a regular note using a simple code block:

````markdown
```nb-database
path: Projects
```
````

Embeds are fully independent from the original database. There are two embed modes:

**Free mode** (no `type:` declared) — the embed gets its own set of views, each with independent filters, sorts and field visibility. You can add and remove views in the embed without touching the database. On first render the embed is initialized with a copy of the database's views; after that it is completely self-contained.

````markdown
```nb-database
path: Projects
```
````

**Fixed-type mode** (`type:` declared) — the embed always shows a single view of the specified type, with no tabs and no option to switch. Useful when you want to pin a specific perspective in a note.

````markdown
```nb-database
path: Projects
type: list
```
````

Supported types: `table`, `list` (more coming soon).

All embed configs are stored in the frontmatter of the note that contains the embed, not in the database itself. Each embed block gets a unique `id` that is automatically generated and written back into the code block on first render.

### Smart schema inference
Open a folder that already has notes with frontmatter — Notion Bases will automatically infer the schema and column types from the existing data.

### Open rows as notes
Click the title of any row to open the underlying note. The full Obsidian experience remains intact.

---

## How data is stored

Every piece of data lives in your vault as plain Markdown:

- **Rows** are `.md` files in the database folder
- **Column values** are frontmatter fields in each note
- **Database schema and view config** are stored in the `_database.md` frontmatter
- **Embed view configs** are stored in the frontmatter of the note that contains the embed, under the `notion-bases-embeds` key

No proprietary format. No external database. Open any file in any text editor and your data is right there.

---

## Getting started

### 1. Install
> Community plugin listing coming soon. In the meantime, install manually (see below).

### 2. Create a database
Use the command palette (`Ctrl/Cmd + P`) and run **"Create new database in current folder"**. This creates a `_database.md` file in the active folder, which marks it as a database.

### 3. Open a database
Click the table icon in the ribbon, or run **"Open database for this folder"** from the command palette. A database tab will open showing all notes in that folder as rows.

### 4. Add columns
Click **+** at the right end of the header row to add a new column. Choose the column type and start editing.

### 5. Filter and sort
Click the **filter icon** in the toolbar to add filter pills. Click the **Sort** button to open the sort panel. Click the **E** / **OU** badges between pills to toggle AND/OR logic between filters.

### 6. Aggregations
Click any cell in the footer row at the bottom of the table to choose an aggregation. The result updates automatically as you filter rows.

### 7. Add more views
Click **+** in the view tab bar at the top to add a new view (Table or List). Each view has its own filters, sorts and field visibility. Switch between views by clicking their tabs. Remove a view with the **×** on its tab.

### 8. Export and import CSV
Open the **Ações** menu in the toolbar. Use **Exportar CSV** to download the current filtered view as a `.csv` file (named after the database folder). Use **Importar CSV** to create new rows from a file — rows whose title already exists in the table are skipped automatically.

### 9. Embed in a note
In any note, add a code block with the database path:

````markdown
```nb-database
path: Projects
```
````

The embed starts with a copy of the database views and is fully independent — add, remove and configure views without affecting the original database.

To pin a specific view type (no tabs, no switching):

````markdown
```nb-database
path: Projects
type: list
```
````

---

## Manual installation

1. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](../../releases/latest)
2. Copy the three files to `<your-vault>/.obsidian/plugins/notion-bases/`
3. Reload Obsidian and enable the plugin in **Settings → Community plugins**

---

## Requirements

- Obsidian `1.4.0` or later
- Desktop and mobile supported
