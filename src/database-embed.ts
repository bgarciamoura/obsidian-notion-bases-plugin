import { MarkdownRenderChild } from 'obsidian'
import { createElement } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { AppContext } from './context'
import { DatabaseManager } from './database-manager'
import { DatabaseTable } from './components/DatabaseTable'
import { DEFAULT_VIEW, ViewConfig } from './types'
import type NotionBasesPlugin from './main'

class DatabaseEmbedChild extends MarkdownRenderChild {
	private root: Root | null = null

	constructor(
		containerEl: HTMLElement,
		private plugin: NotionBasesPlugin,
		private folderPath: string,
		private embedId: string,
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

		const externalView: ViewConfig = this.plugin.settings.embedViews[this.embedId]
			?? { ...DEFAULT_VIEW, id: this.embedId }

		const onViewChange = async (view: ViewConfig) => {
			this.plugin.settings.embedViews[this.embedId] = view
			await this.plugin.saveSettings()
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
	plugin.registerMarkdownCodeBlockProcessor('nb-database', (source, el, ctx) => {
		let folderPath = ''

		for (const line of source.trim().split('\n')) {
			const match = line.match(/^path:\s*(.+)$/)
			if (match) {
				folderPath = match[1].trim()
				break
			}
		}

		const embedId = `${ctx.sourcePath}::${folderPath}`
		el.addClass('nb-embed-container')
		ctx.addChild(new DatabaseEmbedChild(el, plugin, folderPath, embedId))
	})
}
