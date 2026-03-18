import tseslint from 'typescript-eslint';
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";
import sentenceCase from "@bgarciamoura/eslint-plugin-sentence-case";

export default tseslint.config(
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: [
						'eslint.config.js',
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
		},
	},
	{
		files: ["src/i18n/locales/en.ts"],
		plugins: {
			"sentence-case": sentenceCase,
		},
		rules: {
			"sentence-case/enforce": ["error", {
				titleCaseDetection: true,
				allowedWords: ["Obsidian", "Notion", "GitHub"],
			}],
		},
	},
	{
		files: ["src/i18n/locales/*.ts"],
		ignores: ["src/i18n/locales/en.ts"],
		plugins: {
			"sentence-case": sentenceCase,
		},
		rules: {
			"sentence-case/enforce": ["error", {
				titleCaseDetection: false,
			}],
		},
	},
	globalIgnores([
		"node_modules",
		"dist",
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
