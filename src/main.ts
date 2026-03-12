import { Notice, Plugin, TFile, WorkspaceLeaf } from 'obsidian'
import { DATABASE_VIEW_TYPE, DatabaseView } from './database-view'
import { DatabaseManager } from './database-manager'
import { DEFAULT_SETTINGS, NotionBasesSettings, NotionBasesSettingTab } from './settings'

export default class NotionBasesPlugin extends Plugin {
	settings: NotionBasesSettings
	manager: DatabaseManager

	async onload() {
		await this.loadSettings()
		this.manager = new DatabaseManager(this.app, this.settings.databaseFileName)

		// Registrar o tipo de view customizado
		this.registerView(
			DATABASE_VIEW_TYPE,
			leaf => new DatabaseView(leaf, this)
		)

		// Ribbon — abrir/criar banco na pasta atual
		this.addRibbonIcon('table', 'Notion Bases', async () => {
			await this.openOrCreateDatabase()
		})

		// Comandos
		this.addCommand({
			id: 'open-database',
			name: 'Abrir banco de dados desta pasta',
			callback: async () => {
				await this.openOrCreateDatabase()
			},
		})

		this.addCommand({
			id: 'create-database',
			name: 'Criar novo banco de dados na pasta atual',
			callback: async () => {
				const activeFile = this.app.workspace.getActiveFile()
				const folderPath = activeFile?.parent?.path ?? ''
				await this.createAndOpenDatabase(folderPath)
			},
		})

		// Interceptar abertura de arquivos _database.md
		this.registerEvent(
			this.app.workspace.on('file-open', async file => {
				if (!file) return
				// Evitar loop: só redirecionar se a view atual NÃO for já nossa view
				const activeLeaf = this.app.workspace.getMostRecentLeaf()
				if (activeLeaf?.view.getViewType() === DATABASE_VIEW_TYPE) return

				if (this.manager.isDatabaseFile(file)) {
					const leaf = this.app.workspace.getLeaf(false)
					await this.openDatabaseInLeaf(leaf, file)
				}
			})
		)

		// Settings tab
		this.addSettingTab(new NotionBasesSettingTab(this.app, this))
	}

	onunload() {
		// O Obsidian desmonta as views automaticamente
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<NotionBasesSettings>
		)
	}

	async saveSettings() {
		await this.saveData(this.settings)
	}

	// ── Helpers ──────────────────────────────────────────────────────────────

	async openOrCreateDatabase() {
		const activeFile = this.app.workspace.getActiveFile()
		const folderPath = activeFile?.parent?.path ?? ''
		const existing = this.manager.getDatabaseFileInFolder(folderPath)

		if (existing) {
			const leaf = this.app.workspace.getLeaf('tab')
			await this.openDatabaseInLeaf(leaf, existing)
		} else {
			await this.createAndOpenDatabase(folderPath)
		}
	}

	async createAndOpenDatabase(folderPath: string) {
		try {
			const dbFile = await this.manager.createDatabase(folderPath)
			const leaf = this.app.workspace.getLeaf('tab')
			await this.openDatabaseInLeaf(leaf, dbFile)
		} catch (e) {
			new Notice(String(e))
		}
	}

	async openDatabaseInLeaf(leaf: WorkspaceLeaf, file: TFile) {
		await leaf.setViewState({
			type: DATABASE_VIEW_TYPE,
			state: { dbFilePath: file.path },
			active: true,
		})
		this.app.workspace.revealLeaf(leaf)
	}
}
