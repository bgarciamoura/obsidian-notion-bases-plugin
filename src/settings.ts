import { App, PluginSettingTab, Setting } from 'obsidian'
import NotionBasesPlugin from './main'
import { ViewConfig } from './types'
import { runtimePrefs } from './runtime-prefs'
import { t } from './i18n'

export interface NotionBasesSettings {
	databaseFileName: string
	defaultRowHeight: number
	embedViews: Record<string, ViewConfig>
	readInlineFields: boolean
	pageSize: number
	clipEllipsis: boolean
}

export const DEFAULT_SETTINGS: NotionBasesSettings = {
	databaseFileName: '_database.md',
	defaultRowHeight: 36,
	embedViews: {},
	readInlineFields: false,
	pageSize: 0,
	clipEllipsis: true,
}

export class NotionBasesSettingTab extends PluginSettingTab {
	plugin: NotionBasesPlugin

	constructor(app: App, plugin: NotionBasesPlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		const { containerEl } = this
		containerEl.empty()

		new Setting(containerEl)
			.setName(t('settings_db_filename_name'))
			.setDesc(t('settings_db_filename_desc'))
			.addText(text =>
				text
					.setPlaceholder('_database.md')
					.setValue(this.plugin.settings.databaseFileName)
					.onChange(async value => {
						this.plugin.settings.databaseFileName = value || '_database.md'
						await this.plugin.saveSettings()
					})
			)

		new Setting(containerEl)
			.setName(t('settings_inline_fields_name'))
			.setDesc(t('settings_inline_fields_desc'))
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.readInlineFields)
					.onChange(async value => {
						this.plugin.settings.readInlineFields = value
						this.plugin.manager.readInlineFields = value
						await this.plugin.saveSettings()
					})
			)

		new Setting(containerEl)
			.setName(t('settings_clip_ellipsis_name'))
			.setDesc(t('settings_clip_ellipsis_desc'))
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.clipEllipsis)
					.onChange(async value => {
						this.plugin.settings.clipEllipsis = value
						runtimePrefs.clipEllipsis = value
						await this.plugin.saveSettings()
					})
			)

		new Setting(containerEl)
			.setName(t('settings_row_height_name'))
			.setDesc(t('settings_row_height_desc'))
			.addSlider(slider =>
				slider
					.setLimits(28, 80, 4)
					.setValue(this.plugin.settings.defaultRowHeight)
					.onChange(async value => {
						this.plugin.settings.defaultRowHeight = value
						await this.plugin.saveSettings()
					})
			)

		new Setting(containerEl)
			.setName(t('settings_page_size_name'))
			.setDesc(t('settings_page_size_desc'))
			.addDropdown(dropdown =>
				dropdown
					.addOptions({
						'0': t('settings_page_size_all'),
						'50': '50',
						'100': '100',
						'200': '200',
					})
					.setValue(String(this.plugin.settings.pageSize))
					.onChange(async value => {
						this.plugin.settings.pageSize = Number(value)
						this.plugin.manager.pageSize = Number(value)
						await this.plugin.saveSettings()
					})
			)
	}
}
