import { useCallback, useEffect, useRef } from 'react'

/**
 * Debounced wrapper around a callback: the trailing call wins, and a pending
 * call is flushed on unmount so the last invocation is never lost. The wrapped
 * function is read through a ref, so the returned function is stable while the
 * flushed call always sees the latest closure.
 */
export function useDebouncedCallback<A extends unknown[]>(
	fn: (...args: A) => void | Promise<void>,
	delayMs: number,
): (...args: A) => void {
	const fnRef = useRef(fn)
	fnRef.current = fn
	const timer = useRef<number | null>(null)
	const pendingArgs = useRef<A | null>(null)

	const flush = useCallback(() => {
		if (timer.current !== null) {
			window.clearTimeout(timer.current)
			timer.current = null
		}
		if (pendingArgs.current) {
			const args = pendingArgs.current
			pendingArgs.current = null
			void fnRef.current(...args)
		}
	}, [])

	useEffect(() => flush, [flush])

	return useCallback((...args: A) => {
		pendingArgs.current = args
		if (timer.current !== null) window.clearTimeout(timer.current)
		timer.current = window.setTimeout(flush, delayMs)
	}, [flush, delayMs])
}
