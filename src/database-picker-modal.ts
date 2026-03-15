import { App, FuzzySuggestModal, TFile } from 'obsidian'
import { t } from './i18n'

interface DatabaseEntry {
	file: TFile
	label: string
	sublabel: string
}

export class DatabasePickerModal extends FuzzySuggestModal<DatabaseEntry> {
	private entries: DatabaseEntry[]
	private onChoose: (file: TFile) => void

	constructor(app: App, databases: TFile[], onChoose: (file: TFile) => void) {
		super(app)
		this.onChoose = onChoose
		this.setPlaceholder(t('picker_placeholder'))

		this.entries = databases.map(f => {
			const isRoot = !f.parent?.path || f.parent.path === '/'
			return {
				file: f,
				label: isRoot ? t('picker_root') : (f.parent?.name ?? '/'),
				sublabel: isRoot ? '' : (f.parent?.path ?? '/'),
			}
		})
	}

	getItems(): DatabaseEntry[] {
		return this.entries
	}

	getItemText(entry: DatabaseEntry): string {
		return `${entry.label} ${entry.sublabel}`
	}

	renderSuggestion(entry: { item: DatabaseEntry }, el: HTMLElement): void {
		el.createEl('div', { text: entry.item.label, cls: 'nb-picker-title' })
		el.createEl('small', { text: entry.item.sublabel, cls: 'nb-picker-path' })
	}

	onChooseItem(entry: DatabaseEntry): void {
		this.onChoose(entry.file)
	}
}
