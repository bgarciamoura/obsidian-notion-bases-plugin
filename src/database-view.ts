import { ItemView, TFile, WorkspaceLeaf } from 'obsidian'
import { t } from './i18n'
import { createElement } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { AppContext } from './context'
import { DatabaseManager } from './database-manager'
import { DatabaseRoot } from './components/DatabaseRoot'
import type NotionBasesPlugin from './main'

export const DATABASE_VIEW_TYPE = 'notion-bases-view'

interface DatabaseViewState extends Record<string, unknown> {
	dbFilePath?: string
}

export class DatabaseView extends ItemView {
	private root: Root | null = null
	private dbFilePath = ''
	private plugin: NotionBasesPlugin
	constructor(leaf: WorkspaceLeaf, plugin: NotionBasesPlugin) {
		super(leaf)
		this.plugin = plugin
	}

	getViewType(): string {
		return DATABASE_VIEW_TYPE
	}

	getDisplayText(): string {
		if (this.dbFilePath) {
			const file = this.app.vault.getFileByPath(this.dbFilePath)
			return file?.parent?.name ?? t('view_fallback_name')
		}
		return t('plugin_display_name')
	}

	getIcon(): string {
		return 'table'
	}

	// Restaura estado após reload do workspace
	async setState(state: DatabaseViewState, result: Parameters<ItemView['setState']>[1]): Promise<void> {
		if (state.dbFilePath) {
			this.dbFilePath = state.dbFilePath
		}
		await super.setState(state, result)
		this.render()
	}

	getState(): DatabaseViewState {
		return { dbFilePath: this.dbFilePath }
	}

	setDatabaseFile(file: TFile): void {
		this.dbFilePath = file.path
		this.render()
	}

	getDatabaseFilePath(): string {
		return this.dbFilePath
	}

	async onOpen(): Promise<void> {
		// Não renderiza aqui — setState é sempre chamado após onOpen
		// e é quem faz o render com o estado correto.
		// Se onOpen renderizar, causa um render em branco antes do setState.
	}

	// eslint-disable-next-line @typescript-eslint/require-await -- Obsidian's ItemView interface requires onClose to return Promise<void>
	async onClose(): Promise<void> {
		this.root?.unmount()
		this.root = null
	}

	private render(): void {
		const container = this.containerEl.children[1] as HTMLElement | undefined
		if (!container) return

		// Desmontar ANTES de limpar o DOM (ordem correta para o React)
		if (this.root) {
			this.root.unmount()
			this.root = null
		}

		container.empty()
		container.addClass('notion-bases-view-container')

		// No keyboard detection needed — search input is now inside a BottomSheet
		// (rendered via portal to document.body), which avoids Obsidian's behavior
		// of hiding view content when an input inside view-content gains focus.

		const dbFile = this.dbFilePath
			? this.app.vault.getFileByPath(this.dbFilePath) ?? null
			: null

		const manager = new DatabaseManager(
			this.app,
			this.plugin.settings.databaseFileName
		)

		this.root = createRoot(container)
		this.root.render(
			createElement(
				AppContext.Provider,
				{ value: this.app },
				createElement(DatabaseRoot, { dbFile, manager })
			)
		)
	}
}
