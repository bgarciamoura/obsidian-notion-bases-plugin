import { ReactNode, useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'

interface BottomSheetProps {
	open: boolean
	onClose: () => void
	title?: string
	children: ReactNode
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
	const [visible, setVisible] = useState(false)
	const [animating, setAnimating] = useState(false)
	const sheetRef = useRef<HTMLDivElement>(null)
	const [maxHeight, setMaxHeight] = useState('70vh')

	// Mount + animate in
	useEffect(() => {
		if (open) {
			setVisible(true)
			requestAnimationFrame(() => {
				requestAnimationFrame(() => setAnimating(true))
			})
			return
		}
		setAnimating(false)
		const timer = setTimeout(() => setVisible(false), 250)
		return () => clearTimeout(timer)
	}, [open])

	// Close on Escape
	useEffect(() => {
		if (!open) return
		const handler = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose()
		}
		document.addEventListener('keydown', handler)
		return () => document.removeEventListener('keydown', handler)
	}, [open, onClose])

	// Adapt to keyboard via visualViewport
	useEffect(() => {
		if (!open || !window.visualViewport) return
		const onResize = () => {
			const vh = window.visualViewport!.height
			setMaxHeight(`${vh * 0.7}px`)
		}
		onResize()
		window.visualViewport.addEventListener('resize', onResize)
		return () => window.visualViewport!.removeEventListener('resize', onResize)
	}, [open])

	if (!visible) return null

	return createPortal(
		<div
			className={`nb-bottomsheet-backdrop${animating ? ' nb-bottomsheet-backdrop--open' : ''}`}
			onMouseDown={onClose}
		>
			<div
				ref={sheetRef}
				className={`nb-bottomsheet${animating ? ' nb-bottomsheet--open' : ''}`}
				style={{ maxHeight }}
				onMouseDown={e => e.stopPropagation()}
			>
				<div className="nb-bottomsheet-handle" />
				{title && <div className="nb-bottomsheet-title">{title}</div>}
				<div className="nb-bottomsheet-content">
					{children}
				</div>
			</div>
		</div>,
		document.body
	)
}
