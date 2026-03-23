import React from 'react'
import { t } from '../i18n'

interface PaginationProps {
	currentPage: number
	totalPages: number
	onPageChange: (page: number) => void
}

export const Pagination = React.memo(function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
	if (totalPages <= 1) return null

	return (
		<div className="nb-pagination">
			<button
				className="nb-pagination-btn"
				disabled={currentPage === 1}
				onClick={() => onPageChange(1)}
				title={t('first_page')}
			>
				«
			</button>
			<button
				className="nb-pagination-btn"
				disabled={currentPage === 1}
				onClick={() => onPageChange(currentPage - 1)}
				title={t('prev_page')}
			>
				‹
			</button>
			<span className="nb-pagination-info">
				{t('page_of').replace('{current}', String(currentPage)).replace('{total}', String(totalPages))}
			</span>
			<button
				className="nb-pagination-btn"
				disabled={currentPage === totalPages}
				onClick={() => onPageChange(currentPage + 1)}
				title={t('next_page')}
			>
				›
			</button>
			<button
				className="nb-pagination-btn"
				disabled={currentPage === totalPages}
				onClick={() => onPageChange(totalPages)}
				title={t('last_page')}
			>
				»
			</button>
		</div>
	)
})
