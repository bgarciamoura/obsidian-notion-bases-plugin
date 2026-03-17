import { Platform } from 'obsidian'

const DEBUG_MOBILE = true

export function useIsMobile(): boolean {
	return DEBUG_MOBILE || Platform.isMobile
}
