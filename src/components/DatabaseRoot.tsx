import { TFile } from 'obsidian'
import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../context'
import { DatabaseManager } from '../database-manager'
import { DatabaseConfig, DEFAULT_DATABASE_CONFIG, DEFAULT_VIEW, EmbedState, ViewConfig } from '../types'
import { DatabaseTable } from './DatabaseTable'
import { DatabaseList } from './DatabaseList'
import { DatabaseBoard } from './DatabaseBoard'
import { DatabaseGallery } from './DatabaseGallery'
import { DatabaseCalendar } from './DatabaseCalendar'
import { DatabaseTimeline } from './DatabaseTimeline'
import { t } from '../i18n'

interface DatabaseRootProps {
	dbFile: TFile | null
	manager: DatabaseManager
	// Mode A — forced single view (type: declared in embed block)
	externalView?: ViewConfig
	onViewChange?: (view: ViewConfig) => Promise<void>
	// Mode B — free multi-view embed (no type: in block; fully independent views)
	embedState?: EmbedState
	onEmbedStateChange?: (state: EmbedState) => Promise<void>
}

const VIEW_ICONS: Record<string, string> = { table: '⊞', list: '≡', board: '▦', gallery: '⊟', calendar: '📅', timeline: '▬' }
const VIEW_LABELS = () => ({ table: t('view_table'), list: t('view_list'), board: t('view_board'), gallery: t('view_gallery'), calendar: t('view_calendar'), timeline: t('view_timeline') })

export function DatabaseRoot({
	dbFile, manager,
	externalView, onViewChange,
	embedState, onEmbedStateChange,
}: DatabaseRootProps) {
	const app = useApp()

	// ── Shared config (used for direct mode tabs + free embed initialization) ─
	const [config, setConfig] = useState<DatabaseConfig>(DEFAULT_DATABASE_CONFIG)

	// ── Direct mode state ─────────────────────────────────────────────────────
	const [activeViewId, setActiveViewId] = useState('')
	const [addMenuOpen, setAddMenuOpen] = useState(false)
	const addMenuRef = useRef<HTMLDivElement>(null)

	// ── Free embed state (managed internally, persisted via callback) ─────────
	const [embedViews, setEmbedViews] = useState<ViewConfig[]>(embedState?.views ?? [])
	const [embedActiveId, setEmbedActiveId] = useState(embedState?.activeViewId ?? '')
	const [embedInitialized, setEmbedInitialized] = useState(!!embedState)
	const [embedAddMenuOpen, setEmbedAddMenuOpen] = useState(false)
	const embedAddMenuRef = useRef<HTMLDivElement>(null)

	const isForcedEmbed = !!externalView
	const isFreeEmbed = !!onEmbedStateChange && !isForcedEmbed
	const isDirectMode = !isForcedEmbed && !isFreeEmbed

	// ── Inline rename state ───────────────────────────────────────────────────
	const [renamingViewId, setRenamingViewId] = useState<string | null>(null)
	const [renameValue, setRenameValue] = useState('')
	const renameInputRef = useRef<HTMLInputElement>(null)

	// ── Tab drag-to-reorder state ────────────────────────────────────────────
	const [dragViewId, setDragViewId] = useState<string | null>(null)
	const [dragOverId, setDragOverId] = useState<string | null>(null)

	// ── Load database config ──────────────────────────────────────────────────

	useEffect(() => {
		if (!dbFile || isForcedEmbed) return
		const cfg = manager.readConfig(dbFile)
		setConfig(cfg)
		if (isDirectMode) {
			setActiveViewId(prev => (prev && cfg.views.some((v: ViewConfig) => v.id === prev)) ? prev : (cfg.views[0]?.id ?? ''))
		} else if (isFreeEmbed && !embedInitialized) {
			// First render: copy database views into embed with new IDs
			const initialViews: ViewConfig[] = cfg.views.map((v: ViewConfig) => ({
				...v,
				id: crypto.randomUUID(),
			}))
			const initialState: EmbedState = {
				activeViewId: initialViews[0]?.id ?? '',
				views: initialViews,
			}
			setEmbedViews(initialViews)
			setEmbedActiveId(initialViews[0]?.id ?? '')
			setEmbedInitialized(true)
			void onEmbedStateChange(initialState)
		}
	}, [dbFile, manager, isForcedEmbed])

	// Sync direct mode tabs when database file changes
	useEffect(() => {
		if (!dbFile || !isDirectMode) return
		const onChange = (file: TFile) => {
			if (file === dbFile) setConfig(manager.readConfig(dbFile))
		}
		app.metadataCache.on('changed', onChange)
		return () => app.metadataCache.off('changed', onChange)
	}, [dbFile, manager, app, isDirectMode])

	// Close menus on outside click
	useEffect(() => {
		if (!addMenuOpen) return
		const h = (e: MouseEvent) => { if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) setAddMenuOpen(false) }
		document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
	}, [addMenuOpen])

	useEffect(() => {
		if (!embedAddMenuOpen) return
		const h = (e: MouseEvent) => { if (embedAddMenuRef.current && !embedAddMenuRef.current.contains(e.target as Node)) setEmbedAddMenuOpen(false) }
		document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
	}, [embedAddMenuOpen])

	// ── Inline rename helpers ─────────────────────────────────────────────────

	const startRename = (viewId: string, currentName: string) => {
		setRenamingViewId(viewId)
		setRenameValue(currentName)
		// Focus the input on next paint
		requestAnimationFrame(() => {
			renameInputRef.current?.select()
		})
	}

	const commitRename = useCallback(async (views: ViewConfig[], newName: string, saveViews: (v: ViewConfig[]) => Promise<void>) => {
		if (!renamingViewId) return
		const trimmed = newName.trim()
		if (trimmed) {
			const updated = views.map(v => v.id === renamingViewId ? { ...v, name: trimmed } : v)
			await saveViews(updated)
		}
		setRenamingViewId(null)
	}, [renamingViewId])

	const reorderViews = (views: ViewConfig[], fromId: string, toId: string): ViewConfig[] => {
		const from = views.findIndex(v => v.id === fromId)
		const to   = views.findIndex(v => v.id === toId)
		if (from < 0 || to < 0) return views
		const result = [...views]
		const [moved] = result.splice(from, 1)
		result.splice(to, 0, moved)
		return result
	}

	const handleDirectTabDrop = async (toId: string) => {
		setDragOverId(null)
		if (!dragViewId || dragViewId === toId || !dbFile) { setDragViewId(null); return }
		const newViews = reorderViews(config.views, dragViewId, toId)
		const newConfig = { ...config, views: newViews }
		setConfig(newConfig); setDragViewId(null)
		await manager.writeConfig(dbFile, newConfig)
	}

	const handleEmbedTabDrop = async (toId: string) => {
		setDragOverId(null)
		if (!dragViewId || dragViewId === toId) { setDragViewId(null); return }
		const newViews = reorderViews(embedViews, dragViewId, toId)
		setEmbedViews(newViews); setDragViewId(null)
		await onEmbedStateChange!({ activeViewId: embedActiveId, views: newViews })
	}

	// ── View renderer helper ──────────────────────────────────────────────────

	function renderView(view: ViewConfig, onChange: (v: ViewConfig) => Promise<void>, key?: string) {
		const props = { key, dbFile, manager, externalView: view, onViewChange: onChange }
		if (view.type === 'list') return <DatabaseList {...props} />
		if (view.type === 'board') return <DatabaseBoard {...props} />
		if (view.type === 'gallery') return <DatabaseGallery {...props} />
		if (view.type === 'calendar') return <DatabaseCalendar {...props} />
		if (view.type === 'timeline') return <DatabaseTimeline {...props} />
		return <DatabaseTable key={key} dbFile={dbFile} manager={manager} externalView={view} onViewChange={onChange} />
	}

	// ── Mode A: forced single view ────────────────────────────────────────────

	if (isForcedEmbed) {
		return renderView(externalView, onViewChange!)
	}

	// ── Mode B: free multi-view embed ─────────────────────────────────────────

	if (isFreeEmbed) {
		const embedActiveView = embedViews.find(v => v.id === embedActiveId) ?? embedViews[0] ?? DEFAULT_VIEW

		const handleEmbedViewChange = async (updated: ViewConfig) => {
			const newViews = embedViews.map(v => v.id === updated.id ? updated : v)
			setEmbedViews(newViews)
			await onEmbedStateChange({ activeViewId: embedActiveId, views: newViews })
		}

		const addEmbedView = async (type: ViewConfig['type']) => {
			const newView: ViewConfig = {
				...DEFAULT_VIEW,
				id: crypto.randomUUID(),
				type,
				name: VIEW_LABELS()[type] ?? type,
				filters: [], sorts: [], hiddenColumns: [], columnWidths: {},
			}
			const newViews = [...embedViews, newView]
			setEmbedViews(newViews)
			setEmbedActiveId(newView.id)
			setEmbedAddMenuOpen(false)
			await onEmbedStateChange({ activeViewId: newView.id, views: newViews })
		}

		const removeEmbedView = async (viewId: string) => {
			if (embedViews.length <= 1) return
			const newViews = embedViews.filter(v => v.id !== viewId)
			const newActiveId = embedActiveId === viewId ? newViews[0].id : embedActiveId
			setEmbedViews(newViews)
			setEmbedActiveId(newActiveId)
			await onEmbedStateChange({ activeViewId: newActiveId, views: newViews })
		}

		const switchEmbedTab = (viewId: string) => {
			setEmbedActiveId(viewId)
			void onEmbedStateChange({ activeViewId: viewId, views: embedViews })
		}

		const saveEmbedViewNames = async (updatedViews: ViewConfig[]) => {
			setEmbedViews(updatedViews)
			await onEmbedStateChange({ activeViewId: embedActiveId, views: updatedViews })
		}

		return (
			<Fragment>
				<div className="nb-view-tabs nb-view-tabs--embed">
					{embedViews.map(view => (
						<button
							key={view.id}
							className={`nb-view-tab${view.id === embedActiveId ? ' nb-view-tab--active' : ''}${dragOverId === view.id && dragViewId !== view.id ? ' nb-view-tab--drag-over' : ''}`}
						draggable
						onDragStart={() => setDragViewId(view.id)}
						onDragOver={e => { e.preventDefault(); setDragOverId(view.id) }}
						onDragLeave={() => setDragOverId(null)}
						onDrop={() => { void handleEmbedTabDrop(view.id) }}
						onDragEnd={() => { setDragViewId(null); setDragOverId(null) }}
						onClick={() => renamingViewId !== view.id && switchEmbedTab(view.id)}
						>
							<span className="nb-view-tab-icon">{VIEW_ICONS[view.type] ?? '□'}</span>
							{renamingViewId === view.id ? (
								<input
									ref={renameInputRef}
									className="nb-view-tab-rename-input"
									value={renameValue}
									onChange={e => setRenameValue(e.target.value)}
									onBlur={() => { void commitRename(embedViews, renameValue, saveEmbedViewNames) }}
									onKeyDown={e => {
										if (e.key === 'Enter') { e.preventDefault(); void commitRename(embedViews, renameValue, saveEmbedViewNames) }
										if (e.key === 'Escape') { e.preventDefault(); setRenamingViewId(null) }
									}}
									onClick={e => e.stopPropagation()}
								/>
							) : (
								<span
									onDoubleClick={e => { e.stopPropagation(); startRename(view.id, view.name ?? VIEW_LABELS()[view.type] ?? view.type) }}
									title={t('rename_view_hint')}
								>
									{view.name ?? VIEW_LABELS()[view.type] ?? view.type}
								</span>
							)}
							{embedViews.length > 1 && renamingViewId !== view.id && (
								<span
									className="nb-view-tab-remove"
									onClick={(e) => { e.stopPropagation(); void removeEmbedView(view.id) }}
									title={t('remove_view')}
								>
									×
								</span>
							)}
						</button>
					))}
					<div className="nb-view-tab-add" ref={embedAddMenuRef}>
						<button className="nb-view-tab-add-btn" onClick={() => setEmbedAddMenuOpen(v => !v)} title={t('add_view')}>
							+
						</button>
						{embedAddMenuOpen && (
							<div className="nb-view-add-menu nb-fields-dropdown">
								<div className="nb-fields-dropdown-label">{t('add_view')}</div>
								{(['table', 'list', 'board', 'gallery', 'calendar', 'timeline'] as ViewConfig['type'][]).map(type => (
									<button key={type} className="nb-menu-item" onClick={() => { void addEmbedView(type) }}>
										<span className="nb-menu-item-icon">{VIEW_ICONS[type]}</span>
										<span>{VIEW_LABELS()[type]}</span>
									</button>
								))}
							</div>
						)}
					</div>
				</div>
				{renderView(embedActiveView, handleEmbedViewChange, embedActiveId)}
			</Fragment>
		)
	}

	// ── Mode C: direct mode ───────────────────────────────────────────────────

	const handleViewChange = useCallback(async (updatedView: ViewConfig) => {
		if (!dbFile) return
		const newViews = config.views.map(v => v.id === updatedView.id ? updatedView : v)
		const newConfig = { ...config, views: newViews }
		setConfig(newConfig)
		await manager.writeConfig(dbFile, newConfig)
	}, [config, dbFile, manager])

	const addView = useCallback(async (type: ViewConfig['type']) => {
		if (!dbFile) return
		const needsMigration = config.views.length === 1
		const newSchema = needsMigration
			? config.schema.map(c => ({ ...c, visible: true }))
			: config.schema
		const migratedFirstView = needsMigration
			? { ...config.views[0], hiddenColumns: [...(config.views[0].hiddenColumns ?? []), ...config.schema.filter(c => !c.visible).map(c => c.id)] }
			: config.views[0]
		const newView: ViewConfig = {
			...DEFAULT_VIEW,
			id: crypto.randomUUID(),
			type,
			name: VIEW_LABELS()[type] ?? type,
			filters: [], sorts: [], hiddenColumns: [], columnWidths: {},
		}
		const newViews = needsMigration ? [migratedFirstView, newView] : [...config.views, newView]
		const newConfig = { schema: newSchema, views: newViews }
		setConfig(newConfig)
		setActiveViewId(newView.id)
		setAddMenuOpen(false)
		await manager.writeConfig(dbFile, newConfig)
	}, [config, dbFile, manager])

	const removeView = useCallback(async (viewId: string) => {
		if (!dbFile || config.views.length <= 1) return
		const newViews = config.views.filter(v => v.id !== viewId)
		const newConfig = { ...config, views: newViews }
		setConfig(newConfig)
		if (activeViewId === viewId) setActiveViewId(newViews[0].id)
		await manager.writeConfig(dbFile, newConfig)
	}, [config, dbFile, manager, activeViewId])

	const activeView = config.views.find(v => v.id === activeViewId) ?? config.views[0] ?? DEFAULT_VIEW
	const isSingleTableView = config.views.length === 1 && activeView.type === 'table'

	const saveDirectViewNames = async (updatedViews: ViewConfig[]) => {
		if (!dbFile) return
		const newConfig = { ...config, views: updatedViews }
		setConfig(newConfig)
		await manager.writeConfig(dbFile, newConfig)
	}

	return (
		<Fragment>
			<div className="nb-view-tabs">
				{config.views.map(view => (
					<button
						key={view.id}
						className={`nb-view-tab${view.id === activeViewId ? ' nb-view-tab--active' : ''}${dragOverId === view.id && dragViewId !== view.id ? ' nb-view-tab--drag-over' : ''}`}
						draggable
						onDragStart={() => setDragViewId(view.id)}
						onDragOver={e => { e.preventDefault(); setDragOverId(view.id) }}
						onDragLeave={() => setDragOverId(null)}
						onDrop={() => { void handleDirectTabDrop(view.id) }}
						onDragEnd={() => { setDragViewId(null); setDragOverId(null) }}
						onClick={() => renamingViewId !== view.id && setActiveViewId(view.id)}
					>
						<span className="nb-view-tab-icon">{VIEW_ICONS[view.type] ?? '□'}</span>
						{renamingViewId === view.id ? (
							<input
								ref={renameInputRef}
								className="nb-view-tab-rename-input"
								value={renameValue}
								onChange={e => setRenameValue(e.target.value)}
								onBlur={() => { void commitRename(config.views, renameValue, saveDirectViewNames) }}
								onKeyDown={e => {
									if (e.key === 'Enter') { e.preventDefault(); void commitRename(config.views, renameValue, saveDirectViewNames) }
									if (e.key === 'Escape') { e.preventDefault(); setRenamingViewId(null) }
								}}
								onClick={e => e.stopPropagation()}
							/>
						) : (
							<span
								onDoubleClick={e => { e.stopPropagation(); startRename(view.id, view.name ?? VIEW_LABELS()[view.type] ?? view.type) }}
								title={t('rename_view_hint')}
							>
								{view.name ?? VIEW_LABELS()[view.type] ?? view.type}
							</span>
						)}
						{config.views.length > 1 && renamingViewId !== view.id && (
							<span
								className="nb-view-tab-remove"
								onClick={(e) => { e.stopPropagation(); void removeView(view.id) }}
								title={t('remove_view')}
							>
								×
							</span>
						)}
					</button>
				))}
				<div className="nb-view-tab-add" ref={addMenuRef}>
					<button className="nb-view-tab-add-btn" onClick={() => setAddMenuOpen(v => !v)} title={t('add_view')}>
						+
					</button>
					{addMenuOpen && (
						<div className="nb-view-add-menu nb-fields-dropdown">
							<div className="nb-fields-dropdown-label">{t('add_view')}</div>
							{(['table', 'list', 'board', 'gallery', 'calendar', 'timeline'] as ViewConfig['type'][]).map(type => (
								<button key={type} className="nb-menu-item" onClick={() => { void addView(type) }}>
									<span className="nb-menu-item-icon">{VIEW_ICONS[type]}</span>
									<span>{VIEW_LABELS()[type]}</span>
								</button>
							))}
						</div>
					)}
				</div>
			</div>
			{activeView.type === 'table'
				? <DatabaseTable
					key={activeViewId}
					dbFile={dbFile}
					manager={manager}
					externalView={isSingleTableView ? undefined : activeView}
					onViewChange={isSingleTableView ? undefined : handleViewChange}
				/>
				: renderView(activeView, handleViewChange, activeViewId)
			}
		</Fragment>
	)
}
