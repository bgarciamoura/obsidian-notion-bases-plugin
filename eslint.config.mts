import tseslint from 'typescript-eslint';
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";

export default tseslint.config(
	{
		languageOptions: {
			globals: {
				...globals.browser,
				// Obsidian runtime globals (popout-window-safe helpers)
				activeWindow: 'readonly',
				activeDocument: 'readonly',
				createEl: 'readonly',
				createDiv: 'readonly',
				createSpan: 'readonly',
				createFragment: 'readonly',
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: [
						'eslint.config.js',
						'eslint.config.mts',
						'manifest.json'
					]
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json']
			},
		},
	},
	...obsidianmd.configs.recommendedWithLocalesEn,
	{
		files: ["**/*.ts", "**/*.tsx"],
		extends: [tseslint.configs.recommendedTypeChecked[0]],
		rules: {
			"@typescript-eslint/require-await": "error",
			"@typescript-eslint/no-unnecessary-type-assertion": "error",
		},
	},
	{
		files: ["src/i18n/locales/en.ts"],
		rules: {
			"obsidianmd/ui/sentence-case-locale-module": ["error", {
				ignoreWords: ["AND", "OR", "IF"],
				// Counts, filename suffixes and dataview syntax literals are not prose
				ignoreRegex: ["^\\d", "^\\(copy", "key:: value"],
			}],
		},
	},
	globalIgnores([
		"node_modules",
		"dist",
		".wolf",
		"esbuild.config.mjs",
		"eslint.config.js",
		"release.mjs",
		"versions.json",
		"main.js",
		"*.cjs",
		"tests",
		"vitest.config.ts",
	]),
);
