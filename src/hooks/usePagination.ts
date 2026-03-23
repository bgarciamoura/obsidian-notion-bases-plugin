import { useState, useMemo, useEffect } from 'react'

interface PaginationResult<T> {
	pageItems: T[]
	currentPage: number
	totalPages: number
	setPage: (page: number) => void
}

export function usePagination<T>(items: T[], pageSize: number): PaginationResult<T> {
	const [currentPage, setCurrentPage] = useState(1)

	const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(items.length / pageSize)) : 1

	// Reset to page 1 when items change (filter/sort/search) or pageSize changes
	useEffect(() => {
		setCurrentPage(1)
	}, [items.length, pageSize])

	// Clamp page if it exceeds total (e.g. after deleting rows)
	useEffect(() => {
		if (currentPage > totalPages) setCurrentPage(totalPages)
	}, [currentPage, totalPages])

	const pageItems = useMemo(() => {
		if (pageSize <= 0) return items
		const start = (currentPage - 1) * pageSize
		return items.slice(start, start + pageSize)
	}, [items, currentPage, pageSize])

	return { pageItems, currentPage, totalPages, setPage: setCurrentPage }
}
