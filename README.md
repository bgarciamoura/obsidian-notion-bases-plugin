
# Notion Bases — The database plugin Obsidian is missing

![GitHub release (latest by date)](https://img.shields.io/github/v/release/bgarciamoura/obsidian-notion-bases-plugin)
![Obsidian Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=7c3aed&label=downloads&query=%24%5B%22obsidian-notion-bases%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json)
![Minimum Obsidian version](https://img.shields.io/badge/obsidian-%3E%3D1.4.0-7c3aed)
![License](https://img.shields.io/github/license/bgarciamoura/obsidian-notion-bases-plugin)

**6 views. 15 column types. Formulas, relations and lookups. Zero code required.**

Turn any folder into a full-featured database with Table, Board, Gallery, List, Calendar, and Timeline views — all powered by plain Markdown and frontmatter. Your data stays yours.

![Hero — Table view overview](docs/images/hero.png)

---

## Why Notion Bases instead of the core Bases plugin?

Obsidian's built-in Bases plugin is great for tables and has its own powerful expression-based formula system. Notion Bases focuses on a different set of trade-offs — more views, more column types, and a spreadsheet-style formula syntax. Here's how they compare:

| Feature | Notion Bases | Core Bases |
|---------|:---:|:---:|
| Table view | Yes | Yes |
| Board / Kanban view | Yes | No |
| Gallery view | Yes | No |
| List view | Yes | Yes |
| Calendar view | Yes | No |
| Timeline / Gantt view | Yes | No |
| Column types | **15** | 7 |
| Formulas | Spreadsheet-style (IF, SUM, AVG, CONCAT) | Expression-based (JS-like dot notation) |
| Relation columns | Yes | No |
| Lookup columns | Yes | No |
| Image columns (rendered) | Yes | Text only |
| Aggregation row (sum, avg, min, max) | Yes | No |
| Number formatting (prefix, suffix, decimals, thousands) | Yes | No |
| Column pinning | Yes | No |
| Column reordering (drag) | Yes | No |
| Column resizing (drag) | Yes | No |
| Row height options | Yes | No |
| Text wrap toggle | Yes | No |
| CSV import / export | Yes | No |
| Bulk actions (delete, duplicate, move) | Yes | No |
| Embed database in any note | Yes | Yes |
| Multiple views per database | Yes | Yes |
| AND/OR filter logic | Yes | Yes |

**In short:** if you ever wished Obsidian had Notion-level databases without leaving your vault, this is it.

---

## Views

### Table
A fully interactive spreadsheet: inline editing, resizable/reorderable/pinnable columns, aggregation footer, row height options, text wrap, multi-column sort, and bulk row actions.

![Table view](docs/images/view-table.png)

### Board (Kanban)
Drag cards between columns grouped by any `select` or `status` field. Add cards directly to a column. Hide empty or no-value columns. Configure which properties appear on each card.

![Board view](docs/images/view-board.png)

![Board drag](docs/images/feature-board-drag.gif)

### Gallery
A responsive card grid. Pick a cover field (text or image), choose card size (small / medium / large), and display any properties below the title.

![Gallery view](docs/images/view-gallery.png)

### List
A minimal, single-line view — title plus property chips. Great for quick overviews and task-oriented databases.

![List view](docs/images/view-list.png)

### Calendar
Monthly calendar. Position notes by any `date` field. Click a day to create a note with the date pre-filled. Notes without a date appear in a collapsible section.

![Calendar view](docs/images/view-calendar.png)

### Timeline (Gantt)
Horizontal bar chart with three zoom levels (days / weeks / months). Drag bar edges to resize start or end dates. Group rows by any field.

![Timeline view](docs/images/view-timeline.png)

![Timeline resize](docs/images/feature-timeline-resize.gif)

---

## Powerful features, zero learning curve

- **15 column types** — Title, Text, Number, Select, Multi-select, Checkbox, Date, URL, Email, Phone, Status, Formula, Relation, Lookup, Image
- **Formula engine** — Compute values with built-in functions: `IF`, `SUM`, `AVG`, `CONCAT`, `LEFT`, `ROUND`, and [many more](docs/formulas.md)
- **Relations & Lookups** — Link rows across databases and pull values from related notes, just like Notion
- **Filters with AND/OR** — Type-aware operators with toggleable conjunction between filter pills
- **Multi-column sort** — Draggable sort panel with priority ordering
- **Aggregation row** — Sum, Average, Min, Max, Count — updates live as you filter
- **Number formatting** — Excel-style: prefix (`$`, `R$`), suffix (`%`, `kg`), decimal places, thousands separator
- **Column pinning, resizing & reordering** — Drag to resize, drag to reorder, pin columns to the left
- **CSV import / export** — Bring data in or take it out
- **Bulk actions** — Select multiple rows to delete, duplicate or move
- **Smart schema inference** — Infers column types from existing frontmatter automatically
- **Database embed** — Embed any database inside a regular note with a simple code block
- **Multiple views per database** — Each view has its own filters, sorts, and field visibility
- **100% Markdown** — Every row is a `.md` file, every column is a frontmatter field. No lock-in, ever.

![Inline editing](docs/images/feature-inline-edit.gif)

![Filters](docs/images/feature-filter.gif)

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

1. Open **Settings > Community plugins** and disable Safe mode if prompted
2. Click **Browse**, search for **Notion Bases** and install
3. Enable the plugin

**Manual installation**

1. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/bgarciamoura/obsidian-notion-bases-plugin/releases/latest)
2. Copy the three files to `<your-vault>/.obsidian/plugins/notion-bases/`
3. Reload Obsidian and enable the plugin in **Settings > Community plugins**

### Create your first database

1. Open the command palette (`Ctrl/Cmd + P`) and run **"Create new database"**
2. Pick a folder — a `_database.md` file is created to mark it as a database
3. Click the table icon in the ribbon (or run **"Open database"**) to open it

### Add views

Click **+** in the view tab bar to add a new view. Each view has its own filters, sorts and field visibility. Drag tabs to reorder. Click **x** on a tab to remove.

### Embed in a note

````markdown
```nb-database
path: Projects
```
````

Pin a fixed view type (no tabs):

````markdown
```nb-database
path: Projects
type: table
```
````

![Embed in note](docs/images/feature-embed.png)

---

## How data is stored

Everything lives in your vault as plain Markdown — nothing proprietary, nothing locked in:

| What | Where |
|------|-------|
| Rows | `.md` files in the database folder |
| Column values | Frontmatter fields in each note |
| Schema & view config | Frontmatter of `_database.md` |
| Embed view configs | Frontmatter of the hosting note |

Open any file in any text editor and your data is right there.

---

## Requirements

- Obsidian `1.4.0` or later
- Desktop and mobile supported

---

## Support the project

If Notion Bases makes your vault more powerful, consider supporting the project!

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Support-FFDD00?logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/bgarciamoura)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/bgarciamoura)

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

[GPL v3](LICENSE) — free to use and modify, but any distribution must remain open source under the same license.
