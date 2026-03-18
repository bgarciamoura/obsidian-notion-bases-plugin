# Contributing to Notion Bases

Thank you for your interest in contributing! This guide will help you get started.

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- A local [Obsidian](https://obsidian.md/) vault for testing
- Git

### Setup

1. Fork and clone the repository:

   ```bash
   git clone https://github.com/<your-username>/obsidian-notion-bases-plugin.git
   cd obsidian-notion-bases-plugin
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the plugin:

   ```bash
   npm run build
   ```

4. For development with hot-reload:

   ```bash
   npm run dev
   ```

5. Symlink or copy the built files (`main.js`, `styles.css`, `manifest.json`) into your vault's `.obsidian/plugins/notion-bases/` folder, then enable the plugin in Obsidian settings.

## How to contribute

### Reporting bugs

Use the [Bug report](https://github.com/bgarciamoura/obsidian-notion-bases-plugin/issues/new?template=bug_report.yml) issue template. Include your Obsidian version, plugin version, platform, and steps to reproduce.

### Suggesting features

Use the [Feature request](https://github.com/bgarciamoura/obsidian-notion-bases-plugin/issues/new?template=feature_request.yml) issue template. Describe the use case and any alternatives you've considered.

### Submitting code

1. **Open an issue first** — discuss the change before investing time on implementation, unless it's a small bug fix.
2. **Create a branch** from `main`:

   ```bash
   git checkout -b feat/your-feature
   # or
   git checkout -b fix/your-bugfix
   ```

3. **Follow existing code style** — the project uses TypeScript and ESLint. Run `npm run lint` before committing.
4. **Write semantic commits** in English:

   ```
   feat: add weekly calendar view
   fix: prevent blank page on root database
   chore: bump dependencies
   ```

5. **Open a Pull Request** against `main`. Reference the related issue with `Closes #N`.

### Code guidelines

- **TypeScript** — all source code is in `src/`. Avoid `any` when possible.
- **ESLint** — run `npm run lint` and fix all errors before submitting.
- **No breaking changes** to `_database.md` schema without discussion.
- **Localization** — if you add or change user-facing strings, update all locale files in `src/i18n/locales/`. Strings must use sentence case (enforced by ESLint).
- **Test manually** — verify your changes in Obsidian on at least one platform (desktop or mobile).

## Pull request checklist

- [ ] Branch is up to date with `main`
- [ ] `npm run lint` passes with no errors
- [ ] `npm run build` succeeds
- [ ] Changes tested manually in Obsidian
- [ ] Locale files updated (if UI strings changed)
- [ ] PR description references the related issue

## License

By contributing, you agree that your contributions will be licensed under the [GPLv3 License](LICENSE).
