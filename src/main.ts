import { Notice, Plugin, TFile, WorkspaceLeaf } from 'obsidian'
import { DATABASE_VIEW_TYPE, DatabaseView } from './database-view'
import { DatabaseManager } from './database-manager'
import { DEFAULT_SETTINGS, NotionBasesSettings, NotionBasesSettingTab } from './settings'

export default class NotionBasesPlugin extends Plugin {
	settings: NotionBasesSettings
	manager: DatabaseManager

	// Evita loop: quando nós mesmos abrimos a view, file-open é disparado novamente
	private _redirecting = false

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

		// Interceptar abertura de _database.md no explorador de arquivos
		this.registerEvent(
			this.app.workspace.on('file-open', async file => {
				if (!file || this._redirecting) return
				if (!this.manager.isDatabaseFile(file)) return

				// Verificar o leaf ATIVO agora (o que acabou de abrir o arquivo),
				// não o "mais recente" — getMostRecentLeaf pode retornar uma
				// database view já aberta em outra aba e causar falso positivo no guard.
				const activeLeaf = this.app.workspace.activeLeaf
				if (activeLeaf?.view.getViewType() === DATABASE_VIEW_TYPE) return

				this._redirecting = true
				try {
					// Reutilizar o leaf ativo (que está mostrando o .md como texto)
					const leaf = activeLeaf ?? this.app.workspace.getLeaf(false)
					await this.openDatabaseInLeaf(leaf, file)
				} finally {
					this._redirecting = false
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
			// Se já existe uma aba com esse database, apenas revelá-la
			const existingLeaf = this.findDatabaseLeaf(existing.path)
			if (existingLeaf) {
				this.app.workspace.revealLeaf(existingLeaf)
				return
			}
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
		// setViewState cria a DatabaseView e chama setState com o state fornecido
		await leaf.setViewState({
			type: DATABASE_VIEW_TYPE,
			state: { dbFilePath: file.path },
			active: true,
		})
		this.app.workspace.revealLeaf(leaf)

		// Garantia extra: chamar setDatabaseFile diretamente caso setState
		// não tenha renderizado (ex: leaf recém-criado sem container pronto)
		const view = leaf.view
		if (view instanceof DatabaseView && view.getDatabaseFilePath() !== file.path) {
			view.setDatabaseFile(file)
		}
	}

	/** Procura uma aba já aberta mostrando o database do caminho indicado */
	private findDatabaseLeaf(filePath: string): WorkspaceLeaf | null {
		let found: WorkspaceLeaf | null = null
		this.app.workspace.iterateAllLeaves(leaf => {
			if (found) return
			if (leaf.view.getViewType() !== DATABASE_VIEW_TYPE) return
			const state = leaf.view.getState() as { dbFilePath?: string }
			if (state.dbFilePath === filePath) found = leaf
		})
		return found
	}
}
