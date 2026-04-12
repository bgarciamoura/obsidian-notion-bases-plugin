import { App, FuzzySuggestModal, TFile } from 'obsidian'
import { t } from './i18n'

type TemplateChoice = { file: TFile | null; label: string }

export class TemplatePickerModal extends FuzzySuggestModal<TemplateChoice> {
	private onChoose: (path: string | null) => void
	private preferredFolder: string | null

	constructor(app: App, onChoose: (path: string | null) => void, preferredFolder?: string | null) {
		super(app)
		this.onChoose = onChoose
		this.preferredFolder = preferredFolder ?? this.getCoreTemplatesFolder()
		this.setPlaceholder(t('template_picker_placeholder'))
	}

	private getCoreTemplatesFolder(): string | null {
		const internalPlugins = (this.app as unknown as { internalPlugins?: { plugins?: Record<string, { instance?: { options?: { folder?: string } } }> } }).internalPlugins
		const folder = internalPlugins?.plugins?.['templates']?.instance?.options?.folder
		return typeof folder === 'string' && folder ? folder : null
	}

	getItems(): TemplateChoice[] {
		const clear: TemplateChoice = { file: null, label: t('template_picker_none') }
		const files = this.app.vault.getMarkdownFiles().filter(f => {
			const cache = this.app.metadataCache.getFileCache(f)
			return cache?.frontmatter?.['notion-bases'] !== true
		})
		const preferred = this.preferredFolder
			? files.filter(f => f.path.startsWith(`${this.preferredFolder!}/`))
			: []
		const others = preferred.length > 0
			? files.filter(f => !preferred.includes(f))
			: files
		const sorted = [
			...preferred.sort((a, b) => a.path.localeCompare(b.path)),
			...others.sort((a, b) => a.path.localeCompare(b.path)),
		]
		return [clear, ...sorted.map(f => ({ file: f, label: f.path }))]
	}

	getItemText(item: TemplateChoice): string {
		return item.label
	}

	onChooseItem(item: TemplateChoice): void {
		this.onChoose(item.file?.path ?? null)
	}
}
