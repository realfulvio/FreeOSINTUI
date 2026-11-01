import { describe, expect, it } from 'vitest';
import { buildFootprintReport } from './report.js';
import { mergeRecords } from './merge.js';
import { groupEntries } from './classify.js';
import { computeStats, extractParams, findSubdomains } from './stats.js';
import { toMarkdown } from '$lib/export/markdown.js';

/** Page state derived from the source answers, as on the page. */
function pageState(/** @type {any} */ cc, /** @type {any} */ wayback) {
	const entries = mergeRecords([
		{ source: 'commoncrawl', records: cc.data?.records ?? [] },
		{ source: 'wayback', records: wayback.status === 'done' ? wayback.data.records : [] }
	]);
	const groups = groupEntries(entries);
	return {
		target: { domain: 'example.com', subdomains: true },
		cc,
		wayback,
		entries,
		stats: computeStats(entries),
		groups,
		subdomains: findSubdomains(entries, 'example.com'),
		params: extractParams(groups.params)
	};
}

describe('buildFootprintReport', () => {
	it('exports every URL grouped by type with archive links', () => {
		const record = (/** @type {string} */ url, timestamp = '20200101000000') => ({
			url,
			timestamp,
			mime: 'text/html',
			status: '200'
		});
		const report = buildFootprintReport(
			pageState(
				{
					status: 'done',
					data: {
						indexes: [
							{ id: 'CC-1', name: 'CC-1', count: 2, truncated: false, error: null },
							{ id: 'CC-2', name: 'CC-2', count: 0, truncated: false, error: 'HTTP 504' }
						],
						records: [record('https://example.com/report.pdf'), record('https://example.com/a')],
						done: true
					}
				},
				{
					status: 'done',
					data: {
						records: [record('http://shop.example.com/search?q=1', '20210505000000')],
						truncated: true
					}
				}
			)
		);
		expect(report.input).toBe('*.example.com');
		const markdown = toMarkdown(report);
		expect(markdown).toContain('- CC-2: HTTP 504');
		expect(markdown).toContain('1 capture (limit reached');
		expect(markdown).toContain('### Documents (1)');
		expect(markdown).toContain(
			'| [https://example.com/report.pdf](https://web.archive.org/web/20200101000000/https://example.com/report.pdf) | 2020-01-01 | 200 | text/html | CC |'
		);
		expect(markdown).toContain('### All URLs (3)');
		expect(markdown).toContain('- shop.example.com (1 URL)');
		expect(markdown).toContain('- q (1 URL)');
	});

	it('explains a missing backend and an empty result', () => {
		const report = buildFootprintReport(
			pageState(
				{ status: 'done', data: { indexes: [], records: [], done: true } },
				{ status: 'error', error: 'down', backendDown: true }
			)
		);
		expect(report.sections[1].error).toContain('Backend not running');
		expect(toMarkdown(report)).toContain('the archive checks are incomplete');
		expect(toMarkdown(report)).not.toContain('No archived URLs found for this domain.');
	});
});
