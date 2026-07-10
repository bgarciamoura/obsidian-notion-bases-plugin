/** Type guard: value is a plain object indexable by string keys. */
export function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Stringify a frontmatter scalar without falling back to Object#toString
 * ("[object Object]"). Objects and arrays are JSON-encoded.
 */
export function stringifyScalar(v: unknown): string {
	if (v === null || v === undefined) return ''
	if (typeof v === 'string') return v
	if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return v.toString()
	if (v instanceof Date) return v.toISOString()
	return JSON.stringify(v) ?? ''
}
