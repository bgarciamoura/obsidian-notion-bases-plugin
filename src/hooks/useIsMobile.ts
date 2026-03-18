import { Platform } from 'obsidian'

export function useIsMobile(): boolean {
	return Platform.isMobile
}
