import { ItemView, TFile, WorkspaceLeaf } from 'obsidian'
import { createElement } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { AppContext } from './context'
import { DatabaseManager } from './database-manager'
import { DatabaseTable } from './components/DatabaseTable'
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
			return file?.parent?.name ?? 'Banco de Dados'
		}
		return 'Notion Bases'
	}

	getIcon(): string {
		return 'table'
	}

	// Restaura estado após reload do workspace
	async setState(state: DatabaseViewState, result: Parameters<ItemView['setState']>[1]): Promise<void> {
		if (state.dbFilePath) {
			this.dbFilePath = state.dbFilePath
			this.exposeFile(this.dbFilePath)
		}
		await super.setState(state, result)
		this.render()
	}

	getState(): DatabaseViewState {
		return { dbFilePath: this.dbFilePath }
	}

	setDatabaseFile(file: TFile): void {
		this.dbFilePath = file.path
		this.exposeFile(file.path)
		this.render()
	}

	getDatabaseFilePath(): string {
		return this.dbFilePath
	}

	/**
	 * Expõe this.file para que o Obsidian reconheça esta view como
	 * "exibindo" o arquivo de database. Sem isso, o Obsidian não sabe
	 * que o arquivo está aberto e sempre cria uma nova aba markdown ao
	 * clicar no arquivo, causando conflito de inicialização do CodeMirror.
	 */
	private exposeFile(filePath: string): void {
		const file = this.app.vault.getFileByPath(filePath)
		if (file) {
			// @ts-ignore — propriedade interna do FileView/ItemView que o
			// Obsidian usa para detectar se um arquivo já está aberto
			this.file = file
		}
	}

	async onOpen(): Promise<void> {
		// setState sempre é chamado após onOpen e faz o render correto
	}

	async onClose(): Promise<void> {
		this.root?.unmount()
		this.root = null
	}

	private render(): void {
		const container = this.containerEl.children[1] as HTMLElement | undefined
		if (!container) return

		if (this.root) {
			this.root.unmount()
			this.root = null
		}

		container.empty()
		container.addClass('notion-bases-view-container')

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
				createElement(DatabaseTable, { dbFile, manager })
			)
		)
	}
}
