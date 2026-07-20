/**
 * Preferências de plugin lidas pelos componentes React em tempo de render.
 * O plugin (main.ts) mantém este objeto sincronizado com NotionBasesSettings —
 * evita atravessar props/contexto para configurações globais de exibição.
 */
export const runtimePrefs = {
	clipEllipsis: true,
}
