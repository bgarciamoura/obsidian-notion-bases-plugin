import { App, Modal, Setting } from 'obsidian'
import { DatabaseConfig } from './types'
import { TemplatePickerModal } from './template-picker-modal'
import { t } from './i18n'

export class DatabaseSettingsModal extends Modal {
	private config: DatabaseConfig
	private onSave: (updated: { templatePath?: string; askTemplateOnCreate?: boolean }) => Promise<void> | void

	constructor(
		app: App,
		config: DatabaseConfig,
		onSave: (updated: { templatePath?: string; askTemplateOnCreate?: boolean }) => Promise<void> | void,
	) {
		super(app)
		this.config = config
		this.onSave = onSave
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
					// Re-render modal so the clear button disappears
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
	}

	onClose(): void {
		this.contentEl.empty()
	}
}
