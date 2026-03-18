import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
	resolve: {
		alias: {
			obsidian: path.resolve(__dirname, 'tests/__mocks__/obsidian.ts'),
			'@tanstack/react-table': path.resolve(__dirname, 'tests/__mocks__/@tanstack/react-table.ts'),
		},
	},
	test: {
		include: ['tests/**/*.test.ts'],
		globals: true,
	},
})
