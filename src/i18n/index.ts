import { getLanguage } from 'obsidian'
import en from './locales/en'
import ptBR from './locales/pt-BR'
import es from './locales/es'
import fr from './locales/fr'
import de from './locales/de'
import zh from './locales/zh'
import ja from './locales/ja'

type Keys = keyof typeof en
type LocaleDict = Partial<Record<Keys, string>>

const locales: Record<string, LocaleDict> = {
	en: en as LocaleDict,
	'pt-BR': ptBR,
	'pt': ptBR,
	es,
	fr,
	de,
	zh,
	'zh-TW': zh,
	ja,
}

export function t(key: Keys): string {
	const locale = getLanguage() ?? 'en'
	const strings = locales[locale] ?? {}
	return strings[key] ?? (en as LocaleDict)[key] ?? key
}
