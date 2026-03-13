import { App, PluginSettingTab, Setting } from 'obsidian'
import NotionBasesPlugin from './main'
import { ViewConfig } from './types'

export interface NotionBasesSettings {
	databaseFileName: string
	defaultRowHeight: number
	embedViews: Record<string, ViewConfig>
}

export const DEFAULT_SETTINGS: NotionBasesSettings = {
	databaseFileName: '_database.md',
	defaultRowHeight: 36,
	embedViews: {},
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
			.setName('Nome do arquivo de banco de dados')
			.setDesc('Nome do arquivo especial que identifica um banco de dados na pasta.')
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
			.setName('Altura padrão das linhas')
			.setDesc('Altura em pixels de cada linha da tabela.')
			.addSlider(slider =>
				slider
					.setLimits(28, 80, 4)
					.setValue(this.plugin.settings.defaultRowHeight)
					.setDynamicTooltip()
					.onChange(async value => {
						this.plugin.settings.defaultRowHeight = value
						await this.plugin.saveSettings()
					})
			)
	}
}
