import { App, Modal, Notice, Setting, TFile } from 'obsidian'
import { t } from './i18n'
import { DatabaseManager } from './database-manager'
import { ColumnSchema, ColumnType } from './types'

const SUPPORTED_TYPES: Set<ColumnType> = new Set([
	'text', 'number', 'select', 'multiselect', 'status', 'date', 'checkbox',
	'url', 'email', 'phone',
])

export class QuickAddModal extends Modal {
	private manager: DatabaseManager
	private dbFile: TFile
	private schema: ColumnSchema[]
	private values: Record<string, unknown> = {}
	private titleValue = ''

	constructor(app: App, manager: DatabaseManager, dbFile: TFile, schema: ColumnSchema[]) {
		super(app)
		this.manager = manager
		this.dbFile = dbFile
		this.schema = schema
	}

	onOpen() {
		const { contentEl } = this
		contentEl.empty()
		contentEl.addClass('nb-quick-add-modal')

		// Header
		contentEl.createEl('h3', { text: t('quick_add_title') })

		// Database name
		const dbName = this.dbFile.parent?.name ?? this.dbFile.path
		contentEl.createEl('p', { text: dbName, cls: 'nb-quick-add-db-name' })

		// Title field
		new Setting(contentEl)
			.setName(t('quick_add_note_title'))
			.addText(text => {
				text.setPlaceholder(t('quick_add_note_title_placeholder'))
				text.onChange(v => { this.titleValue = v })
				text.inputEl.addClass('nb-quick-add-title-input')
				// Auto-focus
				setTimeout(() => text.inputEl.focus(), 50)
			})

		// Editable fields from schema
		const editableFields = this.schema.filter(col =>
			col.type !== 'title' &&
			col.visible &&
			SUPPORTED_TYPES.has(col.type) &&
			!col.formula &&
			!col.isHierarchical
		)

		if (editableFields.length === 0) {
			contentEl.createEl('p', {
				text: t('quick_add_no_visible_fields'),
				cls: 'nb-quick-add-empty',
			})
		} else {
			for (const col of editableFields) {
				this.renderField(contentEl, col)
			}
		}

		// Action buttons
		const btnContainer = contentEl.createDiv({ cls: 'nb-quick-add-buttons' })

		const createBtn = btnContainer.createEl('button', {
			text: t('quick_add_create'),
			cls: 'nb-quick-add-btn',
		})
		createBtn.addEventListener('click', () => { void this.handleCreate(false) })

		const createAndOpenBtn = btnContainer.createEl('button', {
			text: t('quick_add_create_and_open'),
			cls: 'nb-quick-add-btn nb-quick-add-btn--primary',
		})
		createAndOpenBtn.addEventListener('click', () => { void this.handleCreate(true) })
	}

	onClose() {
		this.contentEl.empty()
	}

	private renderField(container: HTMLElement, col: ColumnSchema) {
		const setting = new Setting(container).setName(col.name)

		switch (col.type) {
		case 'text':
		case 'url':
		case 'email':
		case 'phone':
			setting.addText(text => {
				text.setPlaceholder(col.name)
				text.onChange(v => { this.values[col.id] = v || null })
			})
			break

		case 'number':
			setting.addText(text => {
				text.setPlaceholder('0')
				text.inputEl.type = 'number'
				text.onChange(v => {
					this.values[col.id] = v ? Number(v) : null
				})
			})
			break

		case 'date':
			setting.addText(text => {
				text.inputEl.type = 'date'
				text.onChange(v => { this.values[col.id] = v || null })
			})
			break

		case 'checkbox':
			setting.addToggle(toggle => {
				toggle.onChange(v => { this.values[col.id] = v })
			})
			break

		case 'select':
		case 'status':
			setting.addDropdown(dropdown => {
				dropdown.addOption('', '')
				for (const opt of col.options ?? []) {
					dropdown.addOption(opt.value, opt.value)
				}
				dropdown.onChange(v => { this.values[col.id] = v || null })
			})
			break

		case 'multiselect':
			setting.addText(text => {
				const optionValues = (col.options ?? []).map(o => o.value)
				text.setPlaceholder(optionValues.join(', '))
				text.onChange(v => {
					this.values[col.id] = v
						? v.split(',').map(s => s.trim()).filter(Boolean)
						: null
				})
			})
			break
		}
	}

	private async handleCreate(openAfter: boolean) {
		const frontmatter: Record<string, unknown> = {}
		for (const [key, value] of Object.entries(this.values)) {
			if (value != null && value !== '' && !(Array.isArray(value) && value.length === 0)) {
				frontmatter[key] = value
			}
		}

		try {
			const newFile = await this.manager.createNoteWithTemplate(this.dbFile, frontmatter)

			// Rename if title was provided
			if (this.titleValue.trim()) {
				const folder = newFile.parent?.path ?? ''
				const newPath = folder
					? `${folder}/${this.titleValue.trim()}.md`
					: `${this.titleValue.trim()}.md`
				await this.app.fileManager.renameFile(newFile, newPath)
			}

			this.close()

			if (openAfter) {
				const finalFile = this.titleValue.trim()
					? this.app.vault.getFileByPath(
						(newFile.parent?.path ? `${newFile.parent.path}/` : '') +
						`${this.titleValue.trim()}.md`
					) ?? newFile
					: newFile
				const leaf = this.app.workspace.getLeaf('tab')
				await leaf.openFile(finalFile)
			}
		} catch (e) {
			new Notice(String(e))
		}
	}
}
