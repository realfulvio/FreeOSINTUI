import { describe, expect, it } from 'vitest';
import { buildHeadersReport } from './report.js';
import { analyzeHeaders } from './analyze.js';
import { SAMPLE_HEADERS } from './sample.js';
import { toMarkdown } from '$lib/export/markdown.js';

describe('buildHeadersReport', () => {
	it('exports the analysis without the raw header block', () => {
		const result = /** @type {NonNullable<ReturnType<typeof analyzeHeaders>>} */ (
			analyzeHeaders(SAMPLE_HEADERS)
		);
		const report = buildHeadersReport({ result });
		expect(report.tool).toBe('headers');
		expect(report.input).toMatch(/^Action required: verify your account/);
		expect(report.sections.every((section) => section.status === 'done')).toBe(true);
		const markdown = toMarkdown(report);
		expect(markdown).toContain('## Findings');
		expect(markdown).toContain(
			'| Likely originating IP | [192.0.2.45](http://localhost:8787/ip?q=192.0.2.45) |'
		);
		expect(markdown).toContain('### Hop 1 ·');
		expect(markdown).toContain('| DMARC | fail · example.net |');
		expect(markdown).not.toContain('ZmFrZXNpZ25hdHVyZWZvcnRoZWV4YW1wbGVvbmx5');
	});

	it('falls back to a truncated first line as input', () => {
		const result = /** @type {NonNullable<ReturnType<typeof analyzeHeaders>>} */ (
			analyzeHeaders(`X-Long: ${'a'.repeat(200)}\n`)
		);
		const report = buildHeadersReport({ result });
		expect(report.input).toHaveLength(80);
		expect(report.input.endsWith('…')).toBe(true);
		expect(toMarkdown(report)).toContain('No Received headers.');
	});
});
