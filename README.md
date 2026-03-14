
# Notion Bases — Database views for Obsidian

![GitHub release (latest by date)](https://img.shields.io/github/v/release/bgarciamoura/obsidian-notion-bases-plugin)
![Obsidian Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=7c3aed&label=downloads&query=%24%5B%22obsidian-notion-bases%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json)
![Minimum Obsidian version](https://img.shields.io/badge/obsidian-%3E%3D1.4.0-7c3aed)
![License](https://img.shields.io/github/license/bgarciamoura/obsidian-notion-bases-plugin)

**Turn any folder in your vault into a powerful database — right inside Obsidian.**

Notion Bases brings the database experience from Notion directly into your vault. Every note in a folder becomes a row. Every frontmatter field becomes a column. Six different views. No external tools, no syncing, no lock-in — your data lives in plain Markdown files, forever yours.

---

## Views

### 📊 Table
The core view. A fully interactive spreadsheet with inline editing, resizable/reorderable/pinnable columns, aggregation footer, row height options, text wrap, and bulk row actions.

### 📋 List
A minimal, single-line list of rows — title plus property chips. Great for quick overviews and task-like databases.

### 🗂 Board (Kanban)
Drag cards between columns grouped by any `select` or `status` field. Configurable card properties, hide empty columns, add cards directly to a specific column.

### 🖼 Gallery
A responsive image/card grid. Choose a cover field (text or image), configure card size (small / medium / large), and display any properties below the title.

### 📅 Calendar
Monthly calendar. Position notes by any `date` field. Click a day to create a note with the date pre-filled. Drag cards to reschedule them. Notes without a date appear in a collapsible "No date" section.

### ⏱ Timeline (Gantt)
Horizontal bar chart with three zoom levels (days / weeks / months). Drag the left or right edge of a bar to resize the start or end date. Group rows by any `select` / `status` field. Scroll-to-today on load.

---

## Features at a glance

- **Multiple views per database** — each with independent filters, sorts and field visibility, saved to the database config
- **15 column types** — Title, Text, Number, Select, Multi-select, Checkbox, Date, URL, Email, Phone, Status, Formula, Relation, Lookup, Image
- **Filters with AND/OR logic** — type-aware operators; toggle AND/OR between any two filter pills
- **Multi-column sorting** — draggable sort panel with priority ordering
- **Aggregation row** — Sum, Average, Min, Max, Count, Count Filled; updates live as you filter
- **Number formatting** — Excel-style: prefix, suffix, decimal places, thousands separator
- **Column resizing, reordering and pinning**
- **Row height** — Compact / Medium / Tall
- **Text wrap** — toggle per view
- **Bulk row actions** — select multiple rows to delete or duplicate
- **CSV export / import**
- **Formula columns** — compute values with a built-in expression engine
- **Relation & Lookup columns** — link rows across databases and pull values from related notes
- **Tab drag-to-reorder** — drag view tabs to change their order
- **Smart schema inference** — infers column types from existing frontmatter automatically
- **Database embed** — embed any database inside a regular note with a simple code block

---

## Column types

| Type | Description |
|------|-------------|
| `title` | The note's filename — always the first column |
| `text` | Plain text |
| `number` | Numeric value with optional formatting |
| `select` | Single option from a defined list |
| `multiselect` | Multiple options from a defined list |
| `checkbox` | Boolean true / false |
| `date` | Date value |
| `url` | Clickable link |
| `email` | Email address |
| `phone` | Phone number |
| `status` | Colored badge; create, rename, recolor and delete options inline |
| `formula` | Computed value using other column values |
| `relation` | Link to a note in another database |
| `lookup` | Pull a field value from a related database |
| `image` | Display an image from the vault |

---

## Getting started

### Installation

**Community plugins (recommended)**

1. Open **Settings → Community plugins** and disable Safe mode if prompted
2. Click **Browse**, search for **Notion Bases** and install
3. Enable the plugin

**Manual installation**

1. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/bgarciamoura/obsidian-notion-bases-plugin/releases/latest)
2. Copy the three files to `<your-vault>/.obsidian/plugins/obsidian-notion-bases/`
3. Reload Obsidian and enable the plugin in **Settings → Community plugins**

### Create your first database

1. Open a folder in your vault
2. Open the command palette (`Ctrl/Cmd + P`) and run **"Create new database in current folder"**
3. A `_database.md` file is created — this marks the folder as a database
4. Click the table icon in the ribbon (or run **"Open database for this folder"**) to open it

### Add views

Click **+** in the view tab bar to add a new view. Each view has its own filters, sorts and field visibility. Drag tabs to reorder them. Click **×** on a tab to remove it.

### Embed in a note

Embed any database inside a regular note using a code block:

````markdown
```nb-database
path: Projects
```
````

To pin a fixed view type with no tabs:

````markdown
```nb-database
path: Projects
type: table
```
````

---

## How data is stored

Everything lives in your vault as plain Markdown — nothing proprietary, nothing locked in:

| What | Where |
|------|-------|
| Rows | `.md` files in the database folder |
| Column values | Frontmatter fields in each note |
| Schema & view config | Frontmatter of `_database.md` |
| Embed view configs | Frontmatter of the hosting note, under `notion-bases-embeds` |

Open any file in any text editor and your data is right there.

---

## Requirements

- Obsidian `1.4.0` or later
- Desktop and mobile supported

---

## Support the project

If Notion Bases saves you time or makes your vault more powerful, consider supporting its development!

[![Ko-fi](https://img.shields.io/badge/Ko--fi-Donate-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/bgarciamoura)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Donate-FFDD00?logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/bgarciamoura)
[![GitHub Sponsors](https://img.shields.io/badge/GitHub%20Sponsors-Sponsor-EA4AAA?logo=github-sponsors&logoColor=white)](https://github.com/sponsors/bgarciamoura)

---

## Contributing

Bug reports and feature requests are welcome on the [issue tracker](https://github.com/bgarciamoura/obsidian-notion-bases-plugin/issues).

To build locally:

```bash
git clone https://github.com/bgarciamoura/obsidian-notion-bases-plugin.git
cd obsidian-notion-bases-plugin
npm install
npm run dev
```

---

## License

[0BSD](LICENSE) — do whatever you want with it.
