import { ColumnSchema, NoteRow } from './types'
import { t as i18n } from './i18n'
import { stringifyScalar } from './value-utils'

// ── Erros ─────────────────────────────────────────────────────────────────────

export class FormulaError extends Error {
	constructor(msg: string) { super(msg); this.name = 'FormulaError' }
}

// ── Tokenizer ─────────────────────────────────────────────────────────────────

type TT =
	| 'NUM' | 'STR' | 'BOOL' | 'IDENT' | 'BRACKET_IDENT'
	| 'LPAREN' | 'RPAREN' | 'COMMA'
	| 'PLUS' | 'MINUS' | 'STAR' | 'SLASH' | 'AMP'
	| 'EQ' | 'NEQ' | 'GT' | 'LT' | 'GTE' | 'LTE'
	| 'EOF'

interface Tok { type: TT; val: string; pos: number }

function tokenize(src: string): Tok[] {
	const out: Tok[] = []
	let i = 0
	while (i < src.length) {
		if (/\s/.test(src[i])) { i++; continue }
		const p = i

		// Number
		if (/[0-9]/.test(src[i]) || (src[i] === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
			while (i < src.length && /[0-9.]/.test(src[i])) i++
			out.push({ type: 'NUM', val: src.slice(p, i), pos: p }); continue
		}

		// String literal: "..." or '...'
		if (src[i] === '"' || src[i] === "'") {
			const q = src[i++]
			while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++ }
			if (i >= src.length) throw new FormulaError(i18n('formula_err_unclosed_string').replace('$pos', String(p)))
			i++ // closing quote
			out.push({ type: 'STR', val: src.slice(p + 1, i - 1), pos: p }); continue
		}

		// Bracket identifier: [col name with spaces]
		if (src[i] === '[') {
			i++
			const start = i
			while (i < src.length && src[i] !== ']') i++
			if (i >= src.length) throw new FormulaError(i18n('formula_err_unclosed_bracket').replace('$pos', String(p)))
			const name = src.slice(start, i++)
			out.push({ type: 'BRACKET_IDENT', val: name, pos: p }); continue
		}

		// Identifier / keyword
		if (/[a-zA-Z_]/.test(src[i])) {
			while (i < src.length && /[a-zA-Z0-9_]/.test(src[i])) i++
			const val = src.slice(p, i)
			const up = val.toUpperCase()
			if (up === 'TRUE' || up === 'FALSE') out.push({ type: 'BOOL', val: up, pos: p })
			else out.push({ type: 'IDENT', val, pos: p })
			continue
		}

		// Operators
		switch (src[i]) {
			case '(': out.push({ type: 'LPAREN', val: '(', pos: i++ }); break
			case ')': out.push({ type: 'RPAREN', val: ')', pos: i++ }); break
			case ',': out.push({ type: 'COMMA', val: ',', pos: i++ }); break
			case '+': out.push({ type: 'PLUS', val: '+', pos: i++ }); break
			case '-': out.push({ type: 'MINUS', val: '-', pos: i++ }); break
			case '*': out.push({ type: 'STAR', val: '*', pos: i++ }); break
			case '/': out.push({ type: 'SLASH', val: '/', pos: i++ }); break
			case '&': out.push({ type: 'AMP', val: '&', pos: i++ }); break
			case '=':
				if (src[i + 1] === '=') { out.push({ type: 'EQ', val: '==', pos: i }); i += 2 }
				else { out.push({ type: 'EQ', val: '=', pos: i++ }) }
				break
			case '!':
				if (src[i + 1] === '=') { out.push({ type: 'NEQ', val: '!=', pos: i }); i += 2 }
				else throw new FormulaError(i18n('formula_err_unexpected_bang').replace('$pos', String(i)))
				break
			case '<':
				if (src[i + 1] === '>') { out.push({ type: 'NEQ', val: '<>', pos: i }); i += 2 }
				else if (src[i + 1] === '=') { out.push({ type: 'LTE', val: '<=', pos: i }); i += 2 }
				else { out.push({ type: 'LT', val: '<', pos: i++ }) }
				break
			case '>':
				if (src[i + 1] === '=') { out.push({ type: 'GTE', val: '>=', pos: i }); i += 2 }
				else { out.push({ type: 'GT', val: '>', pos: i++ }) }
				break
			default: throw new FormulaError(i18n('formula_err_unexpected_char').replace('$char', src[i]).replace('$pos', String(i)))
		}
	}
	out.push({ type: 'EOF', val: '', pos: i })
	return out
}

// ── AST ───────────────────────────────────────────────────────────────────────

type Node =
	| { k: 'num'; v: number }
	| { k: 'str'; v: string }
	| { k: 'bool'; v: boolean }
	| { k: 'col'; name: string }
	| { k: 'call'; fn: string; args: Node[] }
	| { k: 'bin'; op: string; l: Node; r: Node }
	| { k: 'neg'; x: Node }

// ── Parser ────────────────────────────────────────────────────────────────────

class Parser {
	private p = 0
	constructor(private toks: Tok[]) {}

	private cur() { return this.toks[this.p] }
	private eat() { return this.toks[this.p++] }
	private expect(t: TT) {
		const tok = this.eat()
		if (tok.type !== t) throw new FormulaError(i18n('formula_err_expected_token').replace('$expected', String(t)).replace('$found', tok.val).replace('$pos', String(tok.pos)))
		return tok
	}
	private is(t: TT) { return this.cur().type === t }

	parse(): Node {
		const n = this.expr()
		if (!this.is('EOF')) throw new FormulaError(i18n('formula_err_unexpected_token').replace('$token', this.cur().val).replace('$pos', String(this.cur().pos)))
		return n
	}

	private expr(): Node { return this.cmp() }

	private cmp(): Node {
		let l = this.add()
		while (['EQ','NEQ','GT','LT','GTE','LTE'].includes(this.cur().type)) {
			const op = this.eat().val
			l = { k: 'bin', op, l, r: this.add() }
		}
		return l
	}

	private add(): Node {
		let l = this.mul()
		while (this.is('PLUS') || this.is('MINUS') || this.is('AMP')) {
			const op = this.eat().val
			l = { k: 'bin', op, l, r: this.mul() }
		}
		return l
	}

	private mul(): Node {
		let l = this.unary()
		while (this.is('STAR') || this.is('SLASH')) {
			const op = this.eat().val
			l = { k: 'bin', op, l, r: this.unary() }
		}
		return l
	}

	private unary(): Node {
		if (this.is('MINUS')) { this.eat(); return { k: 'neg', x: this.unary() } }
		return this.primary()
	}

	private primary(): Node {
		const t = this.cur()
		if (t.type === 'NUM') { this.eat(); return { k: 'num', v: parseFloat(t.val) } }
		if (t.type === 'STR') { this.eat(); return { k: 'str', v: t.val } }
		if (t.type === 'BOOL') { this.eat(); return { k: 'bool', v: t.val === 'TRUE' } }
		if (t.type === 'BRACKET_IDENT') { this.eat(); return { k: 'col', name: t.val } }
		if (t.type === 'IDENT') {
			this.eat()
			if (this.is('LPAREN')) {
				this.eat()
				const args: Node[] = []
				if (!this.is('RPAREN')) {
					args.push(this.expr())
					while (this.is('COMMA')) { this.eat(); args.push(this.expr()) }
				}
				this.expect('RPAREN')
				return { k: 'call', fn: t.val.toUpperCase(), args }
			}
			return { k: 'col', name: t.val }
		}
		if (t.type === 'LPAREN') {
			this.eat()
			const n = this.expr()
			this.expect('RPAREN')
			return n
		}
		throw new FormulaError(i18n('formula_err_unexpected_token').replace('$token', t.val).replace('$pos', String(t.pos)))
	}
}

// ── Helpers de avaliação ──────────────────────────────────────────────────────

function toNum(v: unknown): number {
	if (typeof v === 'number') return isNaN(v) ? 0 : v
	if (typeof v === 'string') { const n = parseFloat(v); return isNaN(n) ? 0 : n }
	if (typeof v === 'boolean') return v ? 1 : 0
	if (v instanceof Date) return v.getTime()
	return 0
}

function toStr(v: unknown): string {
	if (v === null || v === undefined) return ''
	if (Array.isArray(v)) return (v as unknown[]).map(toStr).join(', ')
	if (v instanceof Date) return formatDateValue(v)
	return stringifyScalar(v)
}

// ── Datas ─────────────────────────────────────────────────────────────────────

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Converte um valor em Date. Strings "YYYY-MM-DD" são interpretadas como data
 * LOCAL (new Date("YYYY-MM-DD") usaria UTC e erraria o dia em fusos negativos).
 */
function toDate(v: unknown): Date | null {
	if (v instanceof Date) return isNaN(v.getTime()) ? null : v
	if (typeof v === 'number') { const d = new Date(v); return isNaN(d.getTime()) ? null : d }
	if (typeof v === 'string') {
		const s = v.trim()
		if (!s) return null
		if (DATE_ONLY_RE.test(s)) {
			const [y, m, d] = s.split('-').map(Number)
			return new Date(y, m - 1, d)
		}
		const t = Date.parse(s.includes(' ') ? s.replace(' ', 'T') : s)
		return isNaN(t) ? null : new Date(t)
	}
	return null
}

function pad2(n: number): string { return String(n).padStart(2, '0') }

/** "YYYY-MM-DD" para datas à meia-noite, "YYYY-MM-DD HH:mm" quando há horário. */
function formatDateValue(d: Date): string {
	const datePart = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
	if (d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0) return datePart
	return `${datePart} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function formatDatePattern(d: Date, fmt: string): string {
	return fmt.replace(/YYYY|YY|MM|DD|HH|mm|ss/g, tok => {
		switch (tok) {
			case 'YYYY': return String(d.getFullYear())
			case 'YY': return String(d.getFullYear() % 100).padStart(2, '0')
			case 'MM': return pad2(d.getMonth() + 1)
			case 'DD': return pad2(d.getDate())
			case 'HH': return pad2(d.getHours())
			case 'mm': return pad2(d.getMinutes())
			case 'ss': return pad2(d.getSeconds())
			default: return tok
		}
	})
}

type DateUnit = 'years' | 'months' | 'weeks' | 'days' | 'hours' | 'minutes'

function toDateUnit(v: unknown): DateUnit | null {
	const s = toStr(v).trim().toLowerCase()
	switch (s) {
		case 'y': case 'year': case 'years': return 'years'
		case 'm': case 'month': case 'months': return 'months'
		case 'w': case 'week': case 'weeks': return 'weeks'
		case '': case 'd': case 'day': case 'days': return 'days'
		case 'h': case 'hour': case 'hours': return 'hours'
		case 'min': case 'minute': case 'minutes': return 'minutes'
		default: return null
	}
}

function truthy(v: unknown): boolean {
	return v !== null && v !== undefined && v !== false && v !== '' && v !== 0
}

function eqVal(a: unknown, b: unknown): boolean {
	if (a instanceof Date || b instanceof Date) {
		const da = toDate(a), db = toDate(b)
		if (da && db) return da.getTime() === db.getTime()
	}
	const as = typeof a === 'string' ? a.toLowerCase() : a
	const bs = typeof b === 'string' ? b.toLowerCase() : b
	return as == bs
}

/**
 * Valor numérico para comparações ordenadas. Quando um dos lados é Date,
 * ambos são coeridos via toDate para que `[due] < TODAY()` funcione com a
 * coluna vinda do frontmatter como string ISO.
 */
function cmpPair(a: unknown, b: unknown): [number, number] {
	if (a instanceof Date || b instanceof Date) {
		const da = toDate(a), db = toDate(b)
		if (da && db) return [da.getTime(), db.getTime()]
	}
	return [toNum(a), toNum(b)]
}

// ── Resolução de colunas ──────────────────────────────────────────────────────

interface Ctx {
	row: NoteRow
	allRows: NoteRow[]
	schema: ColumnSchema[]
	formulaColIds: Set<string>
}

function resolveColId(name: string, ctx: Ctx): string | null {
	if (name === '_title') return '_title'
	const byId = ctx.schema.find(c => c.id === name && c.type !== 'formula')
	if (byId) return byId.id
	const byName = ctx.schema.find(c => c.name.toLowerCase() === name.toLowerCase() && c.type !== 'formula')
	if (byName) return byName.id
	return null
}

function getColVal(colId: string, row: NoteRow): unknown {
	return colId === '_title' ? row._title : row[colId]
}

function resolveCol(name: string, ctx: Ctx): unknown {
	const id = resolveColId(name, ctx)
	if (id === null) {
		// Check if it's a formula col (circular)
		const isFormula = ctx.schema.some(c =>
			(c.id === name || c.name.toLowerCase() === name.toLowerCase()) && c.type === 'formula'
		)
		if (isFormula) throw new FormulaError(i18n('formula_err_circular_ref').replace('$name', name))
		throw new FormulaError(`Coluna desconhecida: "${name}"`)
	}
	return getColVal(id, ctx.row)
}

// ── Funções conhecidas ────────────────────────────────────────────────────────

const KNOWN_FNS = new Set([
	'IF', 'IFS', 'AND', 'OR', 'NOT',
	'SUM', 'AVG', 'AVERAGE', 'COUNT', 'COUNTA', 'MIN', 'MAX',
	'CONCAT', 'LEN', 'UPPER', 'LOWER', 'TRIM', 'LEFT', 'RIGHT', 'MID', 'SUBSTITUTE',
	'ROUND', 'FLOOR', 'CEIL', 'ABS', 'MOD', 'POWER', 'SQRT',
	'ISNULL', 'ISEMPTY', 'COALESCE',
	'TEXT', 'VALUE',
	'NOW', 'TODAY', 'DATE', 'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE',
	'WEEKDAY', 'DATEDIF', 'DATEDIFF', 'DATEADD', 'FORMATDATE',
])

// ── Avaliador ─────────────────────────────────────────────────────────────────

function evalNode(n: Node, ctx: Ctx): unknown {
	switch (n.k) {
		case 'num': return n.v
		case 'str': return n.v
		case 'bool': return n.v
		case 'col': return resolveCol(n.name, ctx)
		case 'neg': return -toNum(evalNode(n.x, ctx))

		case 'bin': {
			const { op, l, r } = n
			const lv = evalNode(l, ctx)
			const rv = evalNode(r, ctx)
			switch (op) {
				case '+': return toNum(lv) + toNum(rv)
				case '-': return toNum(lv) - toNum(rv)
				case '*': return toNum(lv) * toNum(rv)
				case '/': { const d = toNum(rv); return d === 0 ? null : toNum(lv) / d }
				case '&': return toStr(lv) + toStr(rv)
				case '=': case '==': return eqVal(lv, rv)
				case '<>': case '!=': return !eqVal(lv, rv)
				case '>':  { const [a, b] = cmpPair(lv, rv); return a > b }
				case '<':  { const [a, b] = cmpPair(lv, rv); return a < b }
				case '>=': { const [a, b] = cmpPair(lv, rv); return a >= b }
				case '<=': { const [a, b] = cmpPair(lv, rv); return a <= b }
				default: throw new FormulaError(`Operador desconhecido: ${op}`)
			}
		}

		case 'call': {
			const { fn, args } = n
			if (!KNOWN_FNS.has(fn)) throw new FormulaError(i18n('formula_err_unknown_fn').replace('$fn', fn))

			// ── Lógicas ──
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_IF: if (fn === 'IF') {
				if (args.length < 2 || args.length > 3) throw new FormulaError(i18n('formula_err_if_args'))
				return truthy(evalNode(args[0], ctx)) ? evalNode(args[1], ctx) : (args[2] ? evalNode(args[2], ctx) : null)
			}
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_IFS: if (fn === 'IFS') {
				if (args.length < 2 || args.length % 2 !== 0) throw new FormulaError('IFS(cond1, val1, cond2, val2, ...)')
				for (let i = 0; i < args.length; i += 2) {
					if (truthy(evalNode(args[i], ctx))) return evalNode(args[i + 1], ctx)
				}
				return null
			}
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_AND: if (fn === 'AND') {
				if (args.length === 0) throw new FormulaError('AND requer ao menos 1 argumento')
				return args.every(a => truthy(evalNode(a, ctx)))
			}
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_OR: if (fn === 'OR') {
				if (args.length === 0) throw new FormulaError('OR requer ao menos 1 argumento')
				return args.some(a => truthy(evalNode(a, ctx)))
			}
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_NOT: if (fn === 'NOT') {
				if (args.length !== 1) throw new FormulaError('NOT(valor)')
				return !truthy(evalNode(args[0], ctx))
			}

			// ── Agregadores ──
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_SUM: if (fn === 'SUM') {
				if (args.length === 0) throw new FormulaError('SUM requer ao menos 1 argumento')
				if (args.length === 1 && args[0].k === 'col') {
					const id = resolveColId(args[0].name, ctx)
					if (id) return ctx.allRows.reduce((s, row) => s + toNum(getColVal(id, row)), 0)
				}
				return args.reduce((s, a) => s + toNum(evalNode(a, ctx)), 0)
			}
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_AVG: if (fn === 'AVG' || fn === 'AVERAGE') {
				if (args.length !== 1 || args[0].k !== 'col') throw new FormulaError(i18n('formula_err_avg_args'))
				const id = resolveColId(args[0].name, ctx)
				if (!id) throw new FormulaError(`Coluna desconhecida em AVG`)
				const vals = ctx.allRows.map(r => toNum(getColVal(id, r)))
				return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
			}
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_COUNT: if (fn === 'COUNT' || fn === 'COUNTA') {
				if (args.length !== 1 || args[0].k !== 'col') throw new FormulaError(i18n('formula_err_count_args'))
				const id = resolveColId(args[0].name, ctx)
				if (!id) throw new FormulaError(`Coluna desconhecida em COUNT`)
				return ctx.allRows.filter(r => { const v = getColVal(id, r); return v !== null && v !== undefined && v !== '' }).length
			}
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_MIN: if (fn === 'MIN') {
				if (args.length === 1 && args[0].k === 'col') {
					const id = resolveColId(args[0].name, ctx)
					if (id) return Math.min(...ctx.allRows.map(r => toNum(getColVal(id, r))))
				}
				return Math.min(...args.map(a => toNum(evalNode(a, ctx))))
			}
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_MAX: if (fn === 'MAX') {
				if (args.length === 1 && args[0].k === 'col') {
					const id = resolveColId(args[0].name, ctx)
					if (id) return Math.max(...ctx.allRows.map(r => toNum(getColVal(id, r))))
				}
				return Math.max(...args.map(a => toNum(evalNode(a, ctx))))
			}

			// ── Texto ──
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_CONCAT: if (fn === 'CONCAT') return args.map(a => toStr(evalNode(a, ctx))).join('')
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_LEN: if (fn === 'LEN') {
				if (args.length !== 1) throw new FormulaError('LEN(texto)')
				return toStr(evalNode(args[0], ctx)).length
			}
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_UPPER: if (fn === 'UPPER') {
				if (args.length !== 1) throw new FormulaError('UPPER(texto)')
				return toStr(evalNode(args[0], ctx)).toUpperCase()
			}
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_LOWER: if (fn === 'LOWER') {
				if (args.length !== 1) throw new FormulaError('LOWER(texto)')
				return toStr(evalNode(args[0], ctx)).toLowerCase()
			}
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_TRIM: if (fn === 'TRIM') {
				if (args.length !== 1) throw new FormulaError('TRIM(texto)')
				return toStr(evalNode(args[0], ctx)).trim()
			}
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_LEFT: if (fn === 'LEFT') {
				if (args.length !== 2) throw new FormulaError('LEFT(texto, n)')
				return toStr(evalNode(args[0], ctx)).slice(0, toNum(evalNode(args[1], ctx)))
			}
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_RIGHT: if (fn === 'RIGHT') {
				if (args.length !== 2) throw new FormulaError('RIGHT(texto, n)')
				const s = toStr(evalNode(args[0], ctx)), n = toNum(evalNode(args[1], ctx))
				return s.slice(Math.max(0, s.length - n))
			}
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_MID: if (fn === 'MID') {
				if (args.length !== 3) throw new FormulaError(i18n('formula_err_mid_args'))
				const s = toStr(evalNode(args[0], ctx))
				const start = toNum(evalNode(args[1], ctx)) - 1
				return s.slice(start, start + toNum(evalNode(args[2], ctx)))
			}
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_SUBSTITUTE: if (fn === 'SUBSTITUTE') {
				if (args.length < 3) throw new FormulaError('SUBSTITUTE(texto, de, para)')
				return toStr(evalNode(args[0], ctx)).split(toStr(evalNode(args[1], ctx))).join(toStr(evalNode(args[2], ctx)))
			}

			// ── Matemática ──
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_ROUND: if (fn === 'ROUND') {
				const n = toNum(evalNode(args[0], ctx)), d = args[1] ? toNum(evalNode(args[1], ctx)) : 0
				return Math.round(n * 10 ** d) / 10 ** d
			}
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_FLOOR: if (fn === 'FLOOR') { return Math.floor(toNum(evalNode(args[0], ctx))) }
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_CEIL: if (fn === 'CEIL') { return Math.ceil(toNum(evalNode(args[0], ctx))) }
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_ABS: if (fn === 'ABS') { return Math.abs(toNum(evalNode(args[0], ctx))) }
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_MOD: if (fn === 'MOD') {
				if (args.length !== 2) throw new FormulaError(i18n('formula_err_mod_args'))
				return toNum(evalNode(args[0], ctx)) % toNum(evalNode(args[1], ctx))
			}
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_POWER: if (fn === 'POWER') {
				if (args.length !== 2) throw new FormulaError('POWER(base, expoente)')
				return Math.pow(toNum(evalNode(args[0], ctx)), toNum(evalNode(args[1], ctx)))
			}
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_SQRT: if (fn === 'SQRT') {
				if (args.length !== 1) throw new FormulaError(i18n('formula_err_sqrt_args'))
				return Math.sqrt(toNum(evalNode(args[0], ctx)))
			}

			// ── Nulos ──
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_ISNULL: if (fn === 'ISNULL' || fn === 'ISEMPTY') {
				if (args.length !== 1) throw new FormulaError(`${fn}(valor)`)
				const v = evalNode(args[0], ctx)
				return v === null || v === undefined || v === ''
			}
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_COALESCE: if (fn === 'COALESCE') {
				for (const a of args) { const v = evalNode(a, ctx); if (v !== null && v !== undefined && v !== '') return v }
				return null
			}

			// ── Conversão ──
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_TEXT: if (fn === 'TEXT') { return args.length === 1 ? toStr(evalNode(args[0], ctx)) : null }
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_VALUE: if (fn === 'VALUE') { return args.length === 1 ? toNum(evalNode(args[0], ctx)) : null }

			// ── Datas ──
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_NOW: if (fn === 'NOW') {
				if (args.length !== 0) throw new FormulaError('NOW()')
				return new Date()
			}
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_TODAY: if (fn === 'TODAY') {
				if (args.length !== 0) throw new FormulaError('TODAY()')
				const d = new Date()
				return new Date(d.getFullYear(), d.getMonth(), d.getDate())
			}
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_DATE: if (fn === 'DATE') {
				if (args.length !== 3) throw new FormulaError('DATE(ano, mes, dia)')
				return new Date(toNum(evalNode(args[0], ctx)), toNum(evalNode(args[1], ctx)) - 1, toNum(evalNode(args[2], ctx)))
			}
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_DATEPART: if (fn === 'YEAR' || fn === 'MONTH' || fn === 'DAY' || fn === 'HOUR' || fn === 'MINUTE' || fn === 'WEEKDAY') {
				if (args.length !== 1) throw new FormulaError(`${fn}(data)`)
				const d = toDate(evalNode(args[0], ctx))
				if (!d) return null
				switch (fn) {
					case 'YEAR': return d.getFullYear()
					case 'MONTH': return d.getMonth() + 1
					case 'DAY': return d.getDate()
					case 'HOUR': return d.getHours()
					case 'MINUTE': return d.getMinutes()
					default: return d.getDay() + 1 // WEEKDAY: 1 = domingo … 7 = sábado
				}
			}
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_DATEDIF: if (fn === 'DATEDIF' || fn === 'DATEDIFF') {
				if (args.length < 2 || args.length > 3) throw new FormulaError('DATEDIF(inicio, fim, unidade?)')
				const a = toDate(evalNode(args[0], ctx))
				const b = toDate(evalNode(args[1], ctx))
				if (!a || !b) return null
				const unit = toDateUnit(args[2] ? evalNode(args[2], ctx) : '')
				if (!unit) throw new FormulaError('DATEDIF: unidade deve ser years, months, weeks, days, hours ou minutes')
				// Dias por componentes de calendário (imune a DST), tempo por diferença bruta
				const calDays = Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000)
				switch (unit) {
					case 'days': return calDays
					case 'weeks': return Math.trunc(calDays / 7)
					case 'hours': return Math.trunc((b.getTime() - a.getTime()) / 3600000)
					case 'minutes': return Math.trunc((b.getTime() - a.getTime()) / 60000)
					case 'months': case 'years': {
						let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
						if (months > 0 && b.getDate() < a.getDate()) months--
						else if (months < 0 && b.getDate() > a.getDate()) months++
						return unit === 'months' ? months : Math.trunc(months / 12)
					}
				}
			}
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_DATEADD: if (fn === 'DATEADD') {
				if (args.length < 2 || args.length > 3) throw new FormulaError('DATEADD(data, n, unidade?)')
				const d = toDate(evalNode(args[0], ctx))
				if (!d) return null
				const n = Math.trunc(toNum(evalNode(args[1], ctx)))
				const unit = toDateUnit(args[2] ? evalNode(args[2], ctx) : '')
				if (!unit) throw new FormulaError('DATEADD: unidade deve ser years, months, weeks, days, hours ou minutes')
				const r = new Date(d.getTime())
				switch (unit) {
					case 'years': r.setFullYear(r.getFullYear() + n); break
					case 'months': r.setMonth(r.getMonth() + n); break
					case 'weeks': r.setDate(r.getDate() + n * 7); break
					case 'days': r.setDate(r.getDate() + n); break
					case 'hours': r.setHours(r.getHours() + n); break
					case 'minutes': r.setMinutes(r.getMinutes() + n); break
				}
				return r
			}
			// eslint-disable-next-line no-unused-labels -- labels used as named case markers for function dispatch readability
			case_FORMATDATE: if (fn === 'FORMATDATE') {
				if (args.length !== 2) throw new FormulaError('FORMATDATE(data, formato)')
				const d = toDate(evalNode(args[0], ctx))
				if (!d) return null
				return formatDatePattern(d, toStr(evalNode(args[1], ctx)))
			}

			throw new FormulaError(i18n('formula_err_not_implemented').replace('$fn', fn))
		}
	}
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Valida a sintaxe de uma fórmula. Retorna null se válida, ou mensagem de erro.
 */
export function validateFormula(formula: string, schema: ColumnSchema[]): string | null {
	if (!formula.trim()) return null
	try {
		const toks = tokenize(formula)
		const ast = new Parser(toks).parse()
		// Dry-run com valores dummy para pegar referências inválidas
		const dummyRow: NoteRow = { _file: null as never, _title: '' }
		for (const col of schema) { if (col.type !== 'formula') dummyRow[col.id] = null }
		const ctx: Ctx = { row: dummyRow, allRows: [dummyRow], schema, formulaColIds: new Set(schema.filter(c => c.type === 'formula').map(c => c.id)) }
		evalNode(ast, ctx) // pode falhar em runtime com valores null — tudo bem
		return null
	} catch (e) {
		if (e instanceof FormulaError) return e.message
		// Erros runtime com valores dummy são esperados, ignoramos
		return null
	}
}

/**
 * Valida apenas a sintaxe (sem tentar resolver colunas).
 */
export function validateFormulaSyntax(formula: string): string | null {
	if (!formula.trim()) return null
	try {
		tokenize(formula)
		const toks = tokenize(formula)
		new Parser(toks).parse()
		return null
	} catch (e) {
		if (e instanceof FormulaError) return e.message
		return String(e)
	}
}

/**
 * Avalia uma fórmula para uma linha específica.
 */
export function evaluateFormula(
	formula: string,
	row: NoteRow,
	allRows: NoteRow[],
	schema: ColumnSchema[],
): unknown {
	if (!formula.trim()) return null
	try {
		const ast = new Parser(tokenize(formula)).parse()
		const formulaColIds = new Set(schema.filter(c => c.type === 'formula').map(c => c.id))
		const result = evalNode(ast, { row, allRows, schema, formulaColIds })
		// Date só existe como valor intermediário — a célula recebe string formatada
		return result instanceof Date ? formatDateValue(result) : result
	} catch {
		return '#ERRO'
	}
}

/**
 * Avalia todas as colunas fórmula para todas as linhas.
 */
export function evaluateFormulas(rows: NoteRow[], schema: ColumnSchema[]): NoteRow[] {
	const formulaCols = schema.filter(c => c.type === 'formula' && c.formula)
	if (formulaCols.length === 0) return rows
	return rows.map(row => {
		const newRow = { ...row }
		for (const col of formulaCols) {
			newRow[col.id] = evaluateFormula(col.formula!, row, rows, schema)
		}
		return newRow
	})
}
