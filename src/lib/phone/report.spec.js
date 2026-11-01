import { describe, expect, it } from 'vitest';
import { analyzePhone } from './analyze.js';
import { buildPhoneReport } from './report.js';
import { toMarkdown } from '$lib/export/markdown.js';

describe('buildPhoneReport', () => {
	it('exports the analysis, the formats and the pivot links', () => {
		const input = '+39 06 6982';
		const { result } = analyzePhone(input, 'IT');
		const report = buildPhoneReport({ input, result: /** @type {any} */ (result) });
		expect(report.tool).toBe('phone');
		expect(report.sections.map((section) => section.title)).toEqual([
			'Results',
			'Formats',
			'Pivot'
		]);
		const markdown = toMarkdown(report);
		expect(markdown).toContain('| Calling code | +39 |');
		expect(markdown).toContain('| E.164 | +39066982 |');
		expect(markdown).toContain('- [WhatsApp](https://wa.me/39066982)');
		expect(markdown).toContain('](http://localhost:8787/dorks?type=phone&q=%2B39');
	});
});
