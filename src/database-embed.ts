import { MarkdownRenderChild } from 'obsidian'
import { createElement } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { AppContext } from './context'
import { DatabaseRoot } from './components/DatabaseRoot'
import { DEFAULT_VIEW, EmbedState, ViewConfig } from './types'
import type NotionBasesPlugin from './main'

const EMBED_FM_KEY = 'notion-bases-embeds'

class DatabaseEmbedChild extends MarkdownRenderChild {
	private root: Root | null = null

	constructor(
		containerEl: HTMLElement,
		private plugin: NotionBasesPlugin,
		private folderPath: string,
		private embedId: string,
		private sourcePath: string,
		private forcedType?: ViewConfig['type'],
	) {
		super(containerEl)
	}

	onload() {
		const manager = this.plugin.manager
		const dbFile = manager.getDatabaseFileInFolder(this.folderPath)

		if (!dbFile) {
			this.containerEl.createEl('div', {
				text: `Database not found: "${this.folderPath || '/'}"`,
				cls: 'nb-embed-error',
			})
			return
		}

		const hostFile = this.plugin.app.vault.getFileByPath(this.sourcePath)
		const hostFm = hostFile
			? this.plugin.app.metadataCache.getFileCache(hostFile)?.frontmatter
			: undefined
		const savedData = (hostFm as Record<string, Record<string, unknown>> | undefined)?.[EMBED_FM_KEY]?.[this.embedId]

		let props: object

		if (this.forcedType) {
			// Mode A — type declared in code block: single forced view, no tabs
			const savedView = (savedData && typeof savedData === 'object' && !('activeViewId' in savedData)) ? savedData as ViewConfig : undefined
			const dbFm = this.plugin.app.metadataCache.getFileCache(dbFile)?.frontmatter
			const dbFirstView = (dbFm as Record<string, unknown[]> | undefined)?.views?.[0] as ViewConfig | undefined

			let externalView: ViewConfig
			if (savedView) {
				externalView = { ...savedView, id: this.embedId, type: this.forcedType }
			} else {
				externalView = dbFirstView
					? { ...dbFirstView, id: this.embedId, type: this.forcedType }
					: { ...DEFAULT_VIEW, id: this.embedId, type: this.forcedType }
			}

			const onViewChange = async (view: ViewConfig) => {
				const hFile = this.plugin.app.vault.getFileByPath(this.sourcePath)
				if (!hFile) return
				await this.plugin.app.fileManager.processFrontMatter(hFile, (fm: Record<string, Record<string, unknown>>) => {
					if (!fm[EMBED_FM_KEY]) fm[EMBED_FM_KEY] = {}
					fm[EMBED_FM_KEY][this.embedId] = view
				})
			}

			props = { dbFile, manager, externalView, onViewChange }
		} else {
			// Mode B — no type declared: free multi-view embed with independent views
			// EmbedState has { activeViewId, views[] }; old ViewConfig format is ignored
			const embedState = (savedData && typeof savedData === 'object' && 'activeViewId' in savedData && Array.isArray((savedData as Record<string, unknown>)['views']))
				? savedData as EmbedState
				: undefined

			const onEmbedStateChange = async (state: EmbedState) => {
				const hFile = this.plugin.app.vault.getFileByPath(this.sourcePath)
				if (!hFile) return
				await this.plugin.app.fileManager.processFrontMatter(hFile, (fm: Record<string, Record<string, unknown>>) => {
					if (!fm[EMBED_FM_KEY]) fm[EMBED_FM_KEY] = {}
					fm[EMBED_FM_KEY][this.embedId] = state
				})
			}

			props = { dbFile, manager, embedState, onEmbedStateChange }
		}

		this.root = createRoot(this.containerEl)
		this.root.render(
			createElement(
				AppContext.Provider,
				{ value: this.plugin.app },
				createElement(DatabaseRoot, props as Parameters<typeof DatabaseRoot>[0])
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
		const lines = source.trim().split('\n')
		let folderPath = ''
		let embedId = ''
		let forcedType: ViewConfig['type'] | undefined

		for (const line of lines) {
			const pathMatch = line.match(/^path:\s*(.+)$/)
			if (pathMatch) folderPath = pathMatch[1].trim()
			const idMatch = line.match(/^id:\s*(.+)$/)
			if (idMatch) embedId = idMatch[1].trim()
			const typeMatch = line.match(/^type:\s*(.+)$/)
			if (typeMatch) {
				const t = typeMatch[1].trim()
				if (t === 'table' || t === 'list') forcedType = t
			}
		}

		// Generate and persist ID if missing
		if (!embedId) {
			embedId = 'nb' + Math.random().toString(36).slice(2, 10)
			const hostFile = plugin.app.vault.getFileByPath(ctx.sourcePath)
			if (hostFile) {
				plugin.app.vault.process(hostFile, (content) => {
					const needle = '```nb-database\n' + source.trimEnd()
					const idx = content.indexOf(needle)
					if (idx === -1) return content
					const insertAt = idx + '```nb-database\n'.length
					return content.slice(0, insertAt) + `id: ${embedId}\n` + content.slice(insertAt)
				}).catch(console.error)
			}
		}

		el.addClass('nb-embed-container')
		ctx.addChild(new DatabaseEmbedChild(el, plugin, folderPath, embedId, ctx.sourcePath, forcedType))
	})
}
