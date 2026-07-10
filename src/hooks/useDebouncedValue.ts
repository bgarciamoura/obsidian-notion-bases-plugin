import { useState, useEffect } from 'react'

export function useDebouncedValue<T>(value: T, delay: number): T {
	const [debounced, setDebounced] = useState(value)

	useEffect(() => {
		const timer = activeWindow.setTimeout(() => setDebounced(value), delay)
		return () => activeWindow.clearTimeout(timer)
	}, [value, delay])

	return debounced
}
