# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 1.1.x   | Yes       |
| < 1.1   | No        |

## Reporting a vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not open a public issue.**
2. Use GitHub's **private vulnerability reporting**: go to the [Security tab](https://github.com/bgarciamoura/obsidian-notion-bases-plugin/security/advisories/new) and click **Report a vulnerability**.
3. Include as much detail as possible: steps to reproduce, affected versions, and potential impact.

You should receive an initial response within **7 days**. Once confirmed, a fix will be prioritized and released as a patch version.

## Scope

This plugin runs entirely within Obsidian and operates on local files. The main areas of concern are:

- **Data integrity** — unintended modification or deletion of vault files
- **Code injection** — formula evaluation, markdown rendering, or frontmatter parsing that could execute arbitrary code
- **Information disclosure** — leaking vault content outside the local environment

## Security design principles

- All data stays local — no network requests, no telemetry, no external services
- Formulas are evaluated in a sandboxed context with no access to the Obsidian API or Node.js modules
- User input in frontmatter is sanitized before rendering
