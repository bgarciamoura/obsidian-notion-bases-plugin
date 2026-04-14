import { MarkdownView, Notice, Plugin, TFile, TFolder, WorkspaceLeaf } from 'obsidian'
import { t } from './i18n'
import { DATABASE_VIEW_TYPE, DatabaseView } from './database-view'
import { DatabaseManager } from './database-manager'
import { DEFAULT_SETTINGS, NotionBasesSettings, NotionBasesSettingTab } from './settings'
import { DatabasePickerModal } from './database-picker-modal'
import { QuickAddModal } from './quick-add-modal'
import { registerDatabaseEmbed } from './database-embed'
import { createLivePlaceholderProcessor } from './live-placeholders'

export default class NotionBasesPlugin extends Plugin {
	settings: NotionBasesSettings
	manager: DatabaseManager

	// Evita loop: quando nós mesmos abrimos a view, file-open é disparado novamente
	private _redirecting = false

	async onload() {
		await this.loadSettings()
		this.manager = new DatabaseManager(this.app, this.settings.databaseFileName)
		this.manager.readInlineFields = this.settings.readInlineFields
		this.manager.pageSize = this.settings.pageSize

		// Registrar o tipo de view customizado
		this.registerView(
			DATABASE_VIEW_TYPE,
			leaf => new DatabaseView(leaf, this)
		)

		// Ribbon — selecionar banco de dados
		this.addRibbonIcon('table', 'Notion bases', () => {
			this.openDatabasePicker()
		})

		// Comandos
		this.addCommand({
			id: 'open-database',
			name: t('cmd_open_database'),
			callback: async () => {
				await this.openOrCreateDatabase()
			},
		})

		this.addCommand({
			id: 'create-database',
			name: t('cmd_create_database'),
			callback: async () => {
				const activeFile = this.app.workspace.getActiveFile()
				const folderPath = activeFile?.parent?.path ?? ''
				await this.createAndOpenDatabase(folderPath)
			},
		})

		this.addCommand({
			id: 'quick-add',
			name: t('cmd_quick_add'),
			callback: () => {
				this.openQuickAdd()
			},
		})

		// Interceptar abertura de _database.md no explorador de arquivos.
		//
		// Usamos active-leaf-change em vez de file-open porque file-open
		// dispara antes do CodeMirror terminar de inicializar. Quando
		// tentávamos fechar ou converter o leaf naquele momento, saveHistory()
		// falhava com "Field is not present in this state" porque o StateField
		// history ainda não havia sido registrado no EditorState.
		//
		// active-leaf-change dispara depois que o leaf está completamente
		// ativo e o editor markdown está pronto, tornando seguro chamar
		// detach() ou setViewState() sem disparar o erro do CodeMirror.
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', async leaf => {
				if (!leaf || this._redirecting) return
				if (leaf.view.getViewType() !== 'markdown') return

				const file = (leaf.view as MarkdownView).file ?? undefined
				if (!file || !this.manager.isDatabaseFile(file)) return

				const existingLeaf = this.findDatabaseLeaf(file.path)
				if (existingLeaf && existingLeaf !== leaf) {
					// Database já aberto: revelar a aba existente e fechar esta
					void this.app.workspace.revealLeaf(existingLeaf)
					leaf.detach()
					return
				}

				if (!existingLeaf) {
					// Primeira abertura: converter este leaf markdown em database view
					this._redirecting = true
					try {
						await this.openDatabaseInLeaf(leaf, file)
					} finally {
						this._redirecting = false
					}
				}
			})
		)

		// Menu de contexto do explorador de arquivos — "Create database here" em pastas
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, abstractFile) => {
				if (!(abstractFile instanceof TFolder)) return
				if (this.manager.getDatabaseFileInFolder(abstractFile.path)) return
				menu.addItem(item => {
					item
						.setTitle(t('ctx_create_database'))
						.setIcon('database')
						.onClick(async () => {
							await this.createAndOpenDatabase(abstractFile.path)
						})
				})
			})
		)

		// Embed de database em notas via ```nb-database
		registerDatabaseEmbed(this)

		// Live placeholders — substitui {{columnId}} no corpo das notas em tempo de renderização
		this.registerMarkdownPostProcessor(createLivePlaceholderProcessor(this.app, this.manager))

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

	openQuickAdd() {
		const databases = this.manager.getAllDatabases()
			.sort((a, b) => (a.parent?.path ?? '').localeCompare(b.parent?.path ?? ''))

		if (databases.length === 0) {
			new Notice(t('no_databases_found'))
			return
		}

		new DatabasePickerModal(this.app, databases, file => {
			const config = this.manager.readConfig(file)
			new QuickAddModal(this.app, this.manager, file, config.schema).open()
		}).open()
	}

	openDatabasePicker() {
		const databases = this.manager.getAllDatabases()
			.sort((a, b) => (a.parent?.path ?? '').localeCompare(b.parent?.path ?? ''))

		if (databases.length === 0) {
			new Notice(t('no_databases_found'))
			return
		}

		new DatabasePickerModal(this.app, databases, file => {
			const existingLeaf = this.findDatabaseLeaf(file.path)
			if (existingLeaf) {
				void this.app.workspace.revealLeaf(existingLeaf)
				return
			}
			const leaf = this.app.workspace.getLeaf('tab')
			void this.openDatabaseInLeaf(leaf, file)
		}).open()
	}

	async openOrCreateDatabase() {
		// getActiveFile() retorna null quando a leaf ativa é uma database view
		// (ItemView não expõe .file). Nesses casos, usar a pasta do próprio database.
		const activeFile = this.app.workspace.getActiveFile()
		let folderPath = activeFile?.parent?.path ?? ''

		if (!activeFile) {
			const activeLeaf = this.app.workspace.getActiveViewOfType(DatabaseView)?.leaf ?? null
			if (activeLeaf?.view instanceof DatabaseView) {
				const dbPath = activeLeaf.view.getDatabaseFilePath()
				const dbFile = this.app.vault.getFileByPath(dbPath)
				folderPath = dbFile?.parent?.path ?? ''
			}
		}

		const existing = this.manager.getDatabaseFileInFolder(folderPath)

		if (existing) {
			// Se já existe uma aba com esse database, apenas revelá-la
			const existingLeaf = this.findDatabaseLeaf(existing.path)
			if (existingLeaf) {
				void this.app.workspace.revealLeaf(existingLeaf)
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
		void this.app.workspace.revealLeaf(leaf)

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
