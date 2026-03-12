import { App, FuzzySuggestModal, TFolder } from 'obsidian'

export class FolderPickerModal extends FuzzySuggestModal<TFolder> {
	private onChoose: (folder: TFolder) => void

	constructor(app: App, onChoose: (folder: TFolder) => void) {
		super(app)
		this.onChoose = onChoose
		this.setPlaceholder('Escolha uma pasta de destino...')
	}

	getItems(): TFolder[] {
		return this.app.vault.getAllLoadedFiles()
			.filter((f): f is TFolder => f instanceof TFolder)
			.sort((a, b) => a.path.localeCompare(b.path))
	}

	getItemText(folder: TFolder): string {
		return folder.path || '/'
	}

	onChooseItem(folder: TFolder): void {
		this.onChoose(folder)
	}
}
