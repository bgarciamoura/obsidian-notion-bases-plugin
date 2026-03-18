/** @type {import('eslint').Rule.RuleModule} */
const rule = {
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Enforce sentence case for UI text in i18n locale files',
		},
		fixable: 'code',
		messages: {
			lowercase:
				'UI text should use sentence case (start with an uppercase letter): "{{value}}"',
			titleCase:
				'UI text should use sentence case — "{{word}}" should be lowercase: "{{value}}"',
		},
		schema: [],
	},

	create(context) {
		const filename = context.filename ?? context.getFilename();
		if (!/i18n[\\/]locales[\\/]/.test(filename)) return {};

		const isEnglish = /[\\/]en\.ts$/.test(filename);

		return {
			Property(node) {
				if (
					node.value.type !== 'Literal' ||
					typeof node.value.value !== 'string'
				) {
					return;
				}

				const value = node.value.value;
				if (!value) return;

				const violations = [];
				const wordRe = /[a-zA-Z]+/g;
				let m;
				let first = true;

				while ((m = wordRe.exec(value)) !== null) {
					const word = m[0];
					const idx = m.index;

					if (first) {
						first = false;
						// Only enforce uppercase if string starts with a letter
						if (idx === 0 && word[0] >= 'a' && word[0] <= 'z') {
							violations.push({ idx, type: 'lowercase', word });
						}
						continue;
					}

					// Title Case check only for English locale
					if (!isEnglish) continue;

					// Skip single characters
					if (word.length <= 1) continue;

					// Skip all-caps acronyms (CSV, URL, AND, OR)
					if (word === word.toUpperCase()) continue;

					// Skip acronyms with lowercase suffix (URLs, IDs, APIs)
					const upperPrefix = word.replace(/[a-z]+$/, '');
					if (
						upperPrefix.length >= 2 &&
						upperPrefix === upperPrefix.toUpperCase()
					) {
						continue;
					}

					// Allow capitalization after clause-ending punctuation
					const before = value.substring(0, idx).trimEnd();
					if (/[.!?:]$/.test(before)) continue;

					// Skip words inside parentheses
					if (isInsideParens(value, idx)) continue;

					if (word[0] >= 'A' && word[0] <= 'Z') {
						violations.push({ idx, type: 'titleCase', word });
					}
				}

				if (!violations.length) return;

				const v = violations[0];
				const display =
					value.length > 50
						? value.substring(0, 50) + '…'
						: value;

				context.report({
					node: node.value,
					messageId: v.type,
					data: { value: display, word: v.word },
					fix(fixer) {
						const raw = node.value.raw;
						const chars = raw.split('');
						for (const vi of violations) {
							const ri = vi.idx + 1; // +1 for opening quote
							chars[ri] =
								vi.type === 'lowercase'
									? chars[ri].toUpperCase()
									: chars[ri].toLowerCase();
						}
						return fixer.replaceText(node.value, chars.join(''));
					},
				});
			},
		};
	},
};

function isInsideParens(str, idx) {
	let depth = 0;
	for (let i = 0; i < idx; i++) {
		if (str[i] === '(') depth++;
		if (str[i] === ')') depth--;
	}
	return depth > 0;
}

export default rule;
