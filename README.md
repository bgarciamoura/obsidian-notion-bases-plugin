# Notion Bases

**Turn any folder in your vault into a powerful database — right inside Obsidian.**

Notion Bases brings the database experience you love from Notion directly into your vault. Every note in a folder becomes a row. Every frontmatter field becomes a column. No external tools, no syncing, no lock-in — your data stays in plain Markdown files, forever yours.

---

## What it does

Notion Bases reads your notes' frontmatter and presents them as a fully interactive database table. You can filter, sort, group, and edit your data without ever leaving Obsidian. When you edit a cell, it writes directly to the note's frontmatter. When you add a row, it creates a new `.md` file in the folder.

---

## Features

### Table view
- **Rich column types** — Title, Text, Number, Select, Multi-select, Checkbox, Date, URL, Formula, Relation, Lookup
- **Inline editing** — click any cell to edit; changes are saved directly to the note's frontmatter
- **Filters** — add filter pills per column with type-aware operators (`contains`, `is`, `>`, `<`, `is checked`, and more)
- **Sorting** — click the sort button on any column header to sort ascending or descending
- **Column reordering** — drag columns to reorder them
- **Column pinning** — pin columns to the left so they stay visible when scrolling horizontally
- **Hide/show fields** — choose which columns are visible without deleting them
- **Number formatting** — format number columns with prefixes, suffixes, decimals and thousand separators (Excel-style)
- **Row selection** — select multiple rows to delete, duplicate or move them in bulk
- **Formula columns** — compute values from other columns using a built-in formula engine
- **Relation columns** — link rows to notes in another database folder
- **Lookup columns** — pull a field value from a related database

### Database embed
Embed any database inside a regular note using a simple code block:

````markdown
```nb-database
path: Projects
```
````

The embed has its own independent view — filters, column order and visibility are saved separately from the main database, so you can create custom perspectives for different contexts.

### Smart schema inference
Open a folder that already has notes with frontmatter — Notion Bases will automatically infer the schema and column types from the existing data.

### Open rows as notes
Click the title of any row to open the underlying note. The full Obsidian experience remains intact.

---

## Getting started

### 1. Install
Search for **Notion Bases** in **Settings → Community plugins → Browse** and click Install.

### 2. Create a database
Use the command palette (`Ctrl/Cmd + P`) and run **"Create new database in current folder"**. This creates a `_database.md` file in the active folder, which marks it as a database.

### 3. Open a database
Click the table icon in the ribbon, or run **"Open database for this folder"** from the command palette. A database tab will open showing all notes in that folder as rows.

### 4. Add columns
Click **+** at the right end of the header row to add a new column. Choose the column type and start editing.

### 5. Embed in a note
In any note, add a code block with the database path:

````markdown
```nb-database
path: Projects
```
````

---

## Column types

| Type | Description |
|------|-------------|
| `title` | The note's filename — always the first column |
| `text` | Plain text |
| `number` | Numeric value with optional formatting |
| `select` | Single option from a defined list |
| `multiselect` | Multiple options from a defined list |
| `checkbox` | Boolean true/false |
| `date` | Date value |
| `formula` | Computed value using other column values |
| `relation` | Link to a note in another database |
| `lookup` | Pull a field from a related database |

---

## How data is stored

Every piece of data lives in your vault as plain Markdown:

- **Rows** are `.md` files in the database folder
- **Column values** are frontmatter fields in each note
- **Database schema and view config** are stored in the `_database.md` frontmatter
- **Embed view configs** are stored locally in the plugin's `data.json`

No proprietary format. No external database. Open any file in any text editor and your data is right there.

---

## Installation (manual)

1. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](../../releases/latest)
2. Copy the three files to `<your-vault>/.obsidian/plugins/notion-bases/`
3. Reload Obsidian and enable the plugin in **Settings → Community plugins**

---

## Requirements

- Obsidian `1.4.0` or later
- Works on desktop and mobile
