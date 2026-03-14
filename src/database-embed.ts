import { MarkdownRenderChild } from 'obsidian'
import { createElement } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { AppContext } from './context'
import { DatabaseManager } from './database-manager'
import { DatabaseTable } from './components/DatabaseTable'
import { DEFAULT_VIEW, ViewConfig } from './types'
import type NotionBasesPlugin from './main'

// Frontmatter key used to store per-embed view configs in the hosting note
const EMBED_FM_KEY = 'notion-bases-embeds'

class DatabaseEmbedChild extends MarkdownRenderChild {
	private root: Root | null = null

	constructor(
		containerEl: HTMLElement,
		private plugin: NotionBasesPlugin,
		private folderPath: string,
		private embedId: string,
		private sourcePath: string,
	) {
		super(containerEl)
	}

	onload() {
		const manager = new DatabaseManager(this.plugin.app, this.plugin.settings.databaseFileName)
		const dbFile = manager.getDatabaseFileInFolder(this.folderPath)

		if (!dbFile) {
			this.containerEl.createEl('div', {
				text: `Database not found: "${this.folderPath || '/'}"`,
				cls: 'nb-embed-error',
			})
			return
		}

		// Read saved view config from hosting note frontmatter (TODO 49)
		const hostFile = this.plugin.app.vault.getFileByPath(this.sourcePath)
		const hostFm = hostFile
			? this.plugin.app.metadataCache.getFileCache(hostFile)?.frontmatter
			: undefined
		const savedView = hostFm?.[EMBED_FM_KEY]?.[this.embedId] as ViewConfig | undefined

		// Fallback: use database's first canonical view, then DEFAULT_VIEW (TODO 53)
		let externalView: ViewConfig
		if (savedView) {
			externalView = { ...savedView, id: this.embedId }
		} else {
			const dbFm = this.plugin.app.metadataCache.getFileCache(dbFile)?.frontmatter
			const dbFirstView = dbFm?.views?.[0] as ViewConfig | undefined
			externalView = dbFirstView
				? { ...dbFirstView, id: this.embedId }
				: { ...DEFAULT_VIEW, id: this.embedId }
		}

		// Save view changes to hosting note frontmatter, not plugin settings (TODO 51)
		const onViewChange = async (view: ViewConfig) => {
			const hFile = this.plugin.app.vault.getFileByPath(this.sourcePath)
			if (!hFile) return
			await this.plugin.app.fileManager.processFrontMatter(hFile, fm => {
				if (!fm[EMBED_FM_KEY]) fm[EMBED_FM_KEY] = {}
				fm[EMBED_FM_KEY][this.embedId] = view
			})
		}

		this.root = createRoot(this.containerEl)
		this.root.render(
			createElement(
				AppContext.Provider,
				{ value: this.plugin.app },
				createElement(DatabaseTable, { dbFile, manager, externalView, onViewChange })
			)
		)
	}

	onunload() {
		this.root?.unmount()
		this.root = null
	}
}

export function registerDatabaseEmbed(plugin: NotionBasesPlugin): void {
	plugin.registerMarkdownCodeBlockProcessor('nb-database', async (source, el, ctx) => {
		const lines = source.trim().split('\n')
		let folderPath = ''
		let embedId = ''

		for (const line of lines) {
			const pathMatch = line.match(/^path:\s*(.+)$/)
			if (pathMatch) folderPath = pathMatch[1].trim()
			const idMatch = line.match(/^id:\s*(.+)$/)
			if (idMatch) embedId = idMatch[1].trim()
		}

		// Generate a unique ID and persist it in the code block if missing (TODO 50)
		// This ensures two embeds pointing to the same database are independent (TODO 52)
		if (!embedId) {
			embedId = 'nb' + Math.random().toString(36).slice(2, 10)
			const hostFile = plugin.app.vault.getFileByPath(ctx.sourcePath)
			if (hostFile) {
				plugin.app.vault.process(hostFile, (content) => {
					// Locate the exact code block by matching its opening fence + content,
					// then insert the id: line as the first property
					const needle = '```nb-database\n' + source.trimEnd()
					const idx = content.indexOf(needle)
					if (idx === -1) return content
					const insertAt = idx + '```nb-database\n'.length
					return content.slice(0, insertAt) + `id: ${embedId}\n` + content.slice(insertAt)
				}).catch(console.error)
			}
		}

		el.addClass('nb-embed-container')
		ctx.addChild(new DatabaseEmbedChild(el, plugin, folderPath, embedId, ctx.sourcePath))
	})
}
