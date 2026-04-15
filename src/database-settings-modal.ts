import { App, Modal, Setting, TFile } from 'obsidian'
import { ColumnType, DatabaseConfig, FolderArrangementConfig } from './types'
import { TemplatePickerModal } from './template-picker-modal'
import { DatabaseManager } from './database-manager'
import { FolderArrangementPreviewModal } from './folder-arrangement-preview-modal'
import { t } from './i18n'

const ARRANGEMENT_SUPPORTED_TYPES: ColumnType[] = ['text', 'select', 'status', 'date']

type SettingsUpdate = {
	templatePath?: string
	askTemplateOnCreate?: boolean
	folderArrangement?: FolderArrangementConfig
}

export class DatabaseSettingsModal extends Modal {
	private config: DatabaseConfig
	private onSave: (updated: SettingsUpdate) => Promise<void> | void
	private manager: DatabaseManager | null
	private dbFile: TFile | null
	private restrictToPaths: Set<string> | undefined

	constructor(
		app: App,
		config: DatabaseConfig,
		onSave: (updated: SettingsUpdate) => Promise<void> | void,
		manager?: DatabaseManager,
		dbFile?: TFile | null,
		restrictToPaths?: Set<string>,
	) {
		super(app)
		this.config = config
		this.onSave = onSave
		this.manager = manager ?? null
		this.dbFile = dbFile ?? null
		this.restrictToPaths = restrictToPaths
	}

	onOpen(): void {
		const { contentEl } = this
		contentEl.empty()
		contentEl.createEl('h2', { text: t('db_settings_title') })

		// ── Template path ─────────────────────────────────────────────────
		const tplSetting = new Setting(contentEl)
			.setName(t('db_settings_template_name'))
			.setDesc(t('db_settings_template_desc'))

		const pathEl = contentEl.createDiv({ cls: 'nb-db-settings-template-path' })
		const renderPath = () => {
			pathEl.empty()
			pathEl.setText(this.config.templatePath ?? t('db_settings_template_none'))
		}
		renderPath()

		tplSetting.addButton(btn => btn
			.setButtonText(t('db_settings_template_choose'))
			.onClick(() => {
				new TemplatePickerModal(this.app, (path) => {
					this.config = { ...this.config, templatePath: path ?? undefined }
					renderPath()
					void this.onSave({ templatePath: this.config.templatePath })
				}).open()
			}))

		if (this.config.templatePath) {
			tplSetting.addExtraButton(btn => btn
				.setIcon('x')
				.setTooltip(t('db_settings_template_clear'))
				.onClick(async () => {
					this.config = { ...this.config, templatePath: undefined }
					renderPath()
					await this.onSave({ templatePath: undefined })
					this.onOpen()
				}))
		}

		// ── Ask on create toggle ──────────────────────────────────────────
		new Setting(contentEl)
			.setName(t('db_settings_ask_name'))
			.setDesc(t('db_settings_ask_desc'))
			.addToggle(tg => tg
				.setValue(!!this.config.askTemplateOnCreate)
				.onChange(async (v) => {
					this.config = { ...this.config, askTemplateOnCreate: v }
					await this.onSave({ askTemplateOnCreate: v })
				}))

		// ── Folder arrangement ────────────────────────────────────────────
		this.renderArrangementSection(contentEl)
	}

	private renderArrangementSection(contentEl: HTMLElement): void {
		const section = contentEl.createDiv({ cls: 'nb-db-settings-arrangement' })
		section.createEl('h3', { text: t('arr_settings_title') })
		section.createEl('p', { text: t('arr_settings_desc'), cls: 'nb-db-settings-arrangement-desc' })

		const current: FolderArrangementConfig = this.config.folderArrangement
			? { enabled: !!this.config.folderArrangement.enabled, propertyIds: [...this.config.folderArrangement.propertyIds] }
			: { enabled: false, propertyIds: [] }

		const persist = async () => {
			this.config = { ...this.config, folderArrangement: current }
			await this.onSave({ folderArrangement: current })
		}

		new Setting(section)
			.setName(t('arr_settings_enabled_name'))
			.setDesc(t('arr_settings_enabled_desc'))
			.addToggle(tg => tg
				.setValue(current.enabled)
				.onChange(async (v) => {
					current.enabled = v
					await persist()
				}))

		const candidates = this.config.schema.filter(c =>
			ARRANGEMENT_SUPPORTED_TYPES.includes(c.type) && !current.propertyIds.includes(c.id)
		)

		const listEl = section.createDiv({ cls: 'nb-arr-property-list' })
		const renderList = () => {
			listEl.empty()
			if (current.propertyIds.length === 0) {
				listEl.createEl('p', { text: t('arr_settings_no_props'), cls: 'nb-arr-empty' })
				return
			}
			current.propertyIds.forEach((id, idx) => {
				const col = this.config.schema.find(c => c.id === id)
				const row = listEl.createDiv({ cls: 'nb-arr-property-row' })
				row.createSpan({ cls: 'nb-arr-property-index', text: String(idx + 1) })
				row.createSpan({ cls: 'nb-arr-property-name', text: col?.name ?? id })

				const upBtn = row.createEl('button', { text: '↑', cls: 'nb-arr-btn' })
				upBtn.disabled = idx === 0
				upBtn.onclick = async () => {
					[current.propertyIds[idx - 1], current.propertyIds[idx]] = [current.propertyIds[idx], current.propertyIds[idx - 1]]
					await persist()
					renderList()
				}

				const downBtn = row.createEl('button', { text: '↓', cls: 'nb-arr-btn' })
				downBtn.disabled = idx === current.propertyIds.length - 1
				downBtn.onclick = async () => {
					[current.propertyIds[idx + 1], current.propertyIds[idx]] = [current.propertyIds[idx], current.propertyIds[idx + 1]]
					await persist()
					renderList()
				}

				const rmBtn = row.createEl('button', { text: '×', cls: 'nb-arr-btn nb-arr-btn-remove' })
				rmBtn.onclick = async () => {
					current.propertyIds.splice(idx, 1)
					await persist()
					renderList()
					renderAddRow()
				}
			})
		}

		const addRow = section.createDiv({ cls: 'nb-arr-add-row' })
		const renderAddRow = () => {
			addRow.empty()
			const remaining = this.config.schema.filter(c =>
				ARRANGEMENT_SUPPORTED_TYPES.includes(c.type) && !current.propertyIds.includes(c.id)
			)
			if (remaining.length === 0 && candidates.length === 0) {
				addRow.createEl('p', { text: t('arr_settings_no_candidates'), cls: 'nb-arr-empty' })
				return
			}
			if (remaining.length === 0) return

			const select = addRow.createEl('select', { cls: 'nb-arr-select' })
			select.createEl('option', { text: t('arr_settings_add_placeholder'), value: '' })
			for (const c of remaining) {
				select.createEl('option', { text: c.name, value: c.id })
			}
			const addBtn = addRow.createEl('button', { text: t('arr_settings_add_btn'), cls: 'mod-cta nb-arr-add-btn' })
			addBtn.onclick = async () => {
				const v = select.value
				if (!v) return
				current.propertyIds.push(v)
				await persist()
				renderList()
				renderAddRow()
			}
		}

		renderList()
		renderAddRow()

		// Preview & apply button
		if (this.manager && this.dbFile) {
			const previewBtn = section.createEl('button', {
				text: t('arr_settings_preview_btn'),
				cls: 'nb-arr-preview-btn',
			})
			previewBtn.onclick = () => {
				if (!this.manager || !this.dbFile) return
				new FolderArrangementPreviewModal(this.app, this.manager, this.dbFile, { ...this.config, folderArrangement: current }, this.restrictToPaths).open()
			}
		}
	}

	onClose(): void {
		this.contentEl.empty()
	}
}
