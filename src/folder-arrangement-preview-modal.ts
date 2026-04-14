import { App, Modal, Notice, TFile } from 'obsidian'
import { DatabaseConfig } from './types'
import { DatabaseManager } from './database-manager'
import { t } from './i18n'

export class FolderArrangementPreviewModal extends Modal {
	constructor(
		app: App,
		private manager: DatabaseManager,
		private dbFile: TFile,
		private config: DatabaseConfig,
	) {
		super(app)
	}

	onOpen(): void {
		const { contentEl } = this
		contentEl.empty()
		contentEl.createEl('h2', { text: t('arr_preview_title') })

		const moves = this.manager.previewArrangement(this.dbFile, this.config)
			.filter(m => m.to !== null)

		if (moves.length === 0) {
			contentEl.createEl('p', { text: t('arr_preview_empty') })
		} else {
			contentEl.createEl('p', { text: t('arr_preview_desc').replace('$count', String(moves.length)) })
			const list = contentEl.createEl('div', { cls: 'nb-arr-preview-list' })
			for (const m of moves) {
				const row = list.createEl('div', { cls: 'nb-arr-preview-row' })
				row.createSpan({ cls: 'nb-arr-preview-from', text: m.from })
				row.createSpan({ cls: 'nb-arr-preview-arrow', text: '→' })
				row.createSpan({ cls: 'nb-arr-preview-to', text: m.to ?? '' })
			}
		}

		const buttons = contentEl.createEl('div', { cls: 'nb-arr-preview-actions' })
		const cancelBtn = buttons.createEl('button', { text: t('arr_preview_cancel') })
		cancelBtn.onclick = () => this.close()

		const applyBtn = buttons.createEl('button', { text: t('arr_preview_apply'), cls: 'mod-cta' })
		applyBtn.disabled = moves.length === 0
		applyBtn.onclick = async () => {
			applyBtn.disabled = true
			cancelBtn.disabled = true
			const applied = await this.manager.applyArrangementToAll(this.dbFile, this.config)
			new Notice(t('arr_preview_applied').replace('$count', String(applied.length)))
			this.close()
		}
	}

	onClose(): void {
		this.contentEl.empty()
	}
}
