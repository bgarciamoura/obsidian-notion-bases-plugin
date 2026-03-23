import React from 'react'
import { t } from '../i18n'
import { type SaveStatus } from '../hooks/useSaveTracker'

export const SaveIndicator = React.memo(function SaveIndicator({ status }: { status: SaveStatus }) {
	if (status === 'idle') return null

	return (
		<span className={`nb-save-indicator nb-save-indicator--${status}`} aria-live="polite">
			{status === 'saving' && (
				<>
					<span className="nb-save-spinner" />
					<span className="nb-save-label">{t('saving')}</span>
				</>
			)}
			{status === 'saved' && (
				<>
					<svg className="nb-save-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
						<polyline points="20 6 9 17 4 12" />
					</svg>
					<span className="nb-save-label">{t('saved')}</span>
				</>
			)}
			{status === 'error' && (
				<>
					<svg className="nb-save-error-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
						<circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
					</svg>
					<span className="nb-save-label">{t('save_error')}</span>
				</>
			)}
		</span>
	)
})
