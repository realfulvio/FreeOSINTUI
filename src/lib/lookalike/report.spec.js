// Modified 2026 by realfulvio; original attribution in NOTICE.
import { describe, expect, it } from 'vitest';
import { buildLookalikeReport } from './report.js';
import { toMarkdown } from '$lib/export/markdown.js';

const records = (/** @type {Partial<import('./resolve.js').DnsRecords>} */ values) => ({
	a: [],
	aaaa: [],
	mx: [],
	ns: [],
	hasDns: true,
	...values
});

describe('buildLookalikeReport', () => {
	it('lists registered names with records and only counts the rest', () => {
		const candidates = [
			{ domain: 'example.net', unicode: 'example.net', type: 'tld' },
			{ domain: 'example.org', unicode: 'example.org', type: 'tld' },
			{ domain: 'exampe.com', unicode: 'exampe.com', type: 'omission' },
			{ domain: 'xn--xample-2of.com', unicode: 'еxample.com', type: 'idn' }
		];
		const report = buildLookalikeReport({
			target: { domain: 'example.com', unicode: 'example.com' },
			candidates,
			runList: candidates,
			results: {
				'example.net': {
					status: 'done',
					records: records({ a: ['192.0.2.1'], mx: ['mx.example.net'], ns: ['ns1.example.net'] })
				},
				'example.org': { status: 'done', records: records({ hasDns: false }) },
				'exampe.com': { status: 'error', error: 'dns.google did not answer in time.' },
				'xn--xample-2of.com': { status: 'done', records: records({ ns: ['ns.host'] }) }
			},
			stopped: false
		});
		expect(report.tool).toBe('lookalike');
		const [results, byType] = report.sections;
		const registered = /** @type {any} */ (results.blocks[1]);
		expect(registered.rows).toEqual([
			['example.net', 'TLD swap', '192.0.2.1', 'mx.example.net', 'ns1.example.net'],
			['еxample.com (xn--xample-2of.com)', 'IDN homograph', '', '', 'ns.host']
		]);
		expect(/** @type {any} */ (byType.blocks[0]).rows).toContainEqual(['TLD swap', 2, 2, 1]);
		const markdown = toMarkdown(report);
		expect(markdown).toContain('4 of 4 resolved · 2 with DNS · 1 failed');
		expect(markdown).toContain('- exampe.com: lookup failed: dns.google did not answer in time.');
		expect(markdown).not.toContain('| example.org');
	});
});
