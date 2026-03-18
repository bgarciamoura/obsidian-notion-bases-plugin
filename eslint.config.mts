import tseslint from 'typescript-eslint';
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";
import sentenceCaseLocale from "./eslint-rules/sentence-case-locale.mjs";

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
		files: ["src/i18n/locales/*.ts"],
		plugins: {
			"local": { rules: { "sentence-case-locale": sentenceCaseLocale } },
		},
		rules: {
			"local/sentence-case-locale": "error",
		},
	},
	globalIgnores([
		"node_modules",
		"dist",
		"esbuild.config.mjs",
		"eslint.config.js",
		"version-bump.mjs",
		"release.mjs",
		"versions.json",
		"main.js",
		"*.cjs",
		"obsidian-notion-bases-plugin",
		"tests",
		"vitest.config.ts",
	]),
);
