import { useState, useCallback, useRef } from 'react'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface SaveTracker {
	status: SaveStatus
	trackSave: <T>(promise: Promise<T>) => Promise<T>
}

export function useSaveTracker(fadeDelay = 2000): SaveTracker {
	const [status, setStatus] = useState<SaveStatus>('idle')
	const pendingRef = useRef(0)
	const timerRef = useRef<ReturnType<typeof setTimeout>>()

	const trackSave = useCallback(<T,>(promise: Promise<T>): Promise<T> => {
		pendingRef.current++
		if (timerRef.current) clearTimeout(timerRef.current)
		setStatus('saving')

		return promise.then(
			(result) => {
				pendingRef.current--
				if (pendingRef.current === 0) {
					setStatus('saved')
					timerRef.current = setTimeout(() => setStatus('idle'), fadeDelay)
				}
				return result
			},
			(err) => {
				pendingRef.current--
				if (pendingRef.current === 0) {
					setStatus('error')
					timerRef.current = setTimeout(() => setStatus('idle'), fadeDelay)
				}
				throw err
			},
		)
	}, [fadeDelay])

	return { status, trackSave }
}
