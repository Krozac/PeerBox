import { describe, it, expect } from 'vitest';
import { cleanText } from '../cleanText.js';

describe('cleanText', () => {
	it('replaces default banned words with asterisks (case-insensitive)', () => {
		const input = 'This is shit and FuCk and a BITCH.';
		const out = cleanText(input);
		expect(out).toContain('****'); // for 'shit'
		expect(out.toLowerCase()).not.toContain('fuck');
		expect(out.toLowerCase()).not.toContain('shit');
		expect(out.toLowerCase()).not.toContain('bitch');
	});

		it('only replaces whole words (word boundaries)', () => {
			const input = 'classification and ass should not fully censor class or harass.';
			// Use explicit banned list to avoid relying on defaults
			const out = cleanText(input, ['ass']);
			// part of 'classification' remains unchanged
			expect(out).toContain('classification');
			expect(out).toContain('class');
			// standalone 'ass' should be censored
			expect(out).not.toMatch(/\bass\b/);
			expect(out).toContain('*'.repeat(3));
		});

	it('escapes special regex characters in banned words', () => {
		// Create a local banned list with regex-special chars
		const custom = ['f(oo)', 'b[ar]'];
		const input = 'this contains f(oo) and b[ar] literally';
		const out = cleanText(input, custom);
		expect(out).not.toContain('f(oo)');
		expect(out).not.toContain('b[ar]');
		// replaced by asterisks of same length
		expect(out).toContain('*'.repeat('f(oo)'.length));
	});

	it('returns non-string input unchanged', () => {
		const obj = { a: 1 };
		expect(cleanText(obj)).toBe(obj);
		expect(cleanText(null)).toBe(null);
	});

	it('accepts a custom banned list and respects boundaries', () => {
		const input = 'hello monkey monkeyish monkey.';
		const out = cleanText(input, ['monkey']);
		// only standalone 'monkey' occurrences replaced
		expect(out).toContain('monkeyish');
		expect(out).not.toContain('monkey ');
	});
});

