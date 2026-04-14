export class TFile {
	path = ''
	name = ''
	basename = ''
	extension = 'md'
}

export class TFolder {
	path = ''
	children: unknown[] = []
}

export class Modal {}
export class FuzzySuggestModal<T> {
	app: unknown
	constructor(app: unknown) { this.app = app }
	getItems(): T[] { return [] }
	getItemText(_: T): string { return '' }
	onChooseItem(_item: T): void {}
	open(): void {}
}
export class Setting {
	constructor(_el: unknown) {}
	setName(): this { return this }
	setDesc(): this { return this }
	addText(): this { return this }
	addToggle(): this { return this }
	addButton(): this { return this }
	addExtraButton(): this { return this }
	addDropdown(): this { return this }
}
export class Notice { constructor(_msg: string) {} }
export class MarkdownRenderChild {
	containerEl: HTMLElement
	constructor(el: HTMLElement) { this.containerEl = el }
	onload(): void {}
	onunload(): void {}
}

export function normalizePath(p: string): string {
	return p.replace(/\\/g, '/').replace(/\/+/g, '/')
}

export function parseYaml(s: string): unknown {
	// minimal stub — tests don't rely on actual yaml parsing
	return s
}

export interface RowData {
	[key: string]: unknown
}
