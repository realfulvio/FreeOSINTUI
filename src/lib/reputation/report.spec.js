import { describe, expect, it } from 'vitest';
import { buildReputationReport } from './report.js';
import { parseIndicator } from './indicator.js';
import { countResults } from './sources.js';
import { toMarkdown } from '$lib/export/markdown.js';

describe('buildReputationReport', () => {
	it('exports the summary and every source with its state', () => {
		const indicator = /** @type {any} */ (parseIndicator('45.9.20.10'));
		const sources = [
			{ id: 'otx', name: 'AlienVault OTX' },
			{ id: 'tor', name: 'Tor Project' },
			{ id: 'threatfox', name: 'abuse.ch ThreatFox' }
		];
		/** @type {Record<string, any>} */
		const sections = {
			otx: {
				status: 'done',
				data: {
					status: 'listed',
					checked: '45.9.20.10',
					date: null,
					link: 'https://otx.alienvault.com/indicator/ip/45.9.20.10',
					details: {
						count: 1,
						whitelisted: [],
						pulses: [{ id: 'p1', name: 'Botnet C2', date: null, malware: ['Mirai'], tags: [] }]
					}
				}
			},
			tor: { status: 'error', error: 'down', unreachable: true },
			threatfox: {
				status: 'done',
				data: {
					status: 'unavailable',
					checked: '45.9.20.10',
					date: null,
					link: null,
					details: null,
					reason: 'notConfigured'
				}
			}
		};
		const report = buildReputationReport({
			indicator,
			sources,
			sections,
			counts: countResults(sources.map((source) => sections[source.id]))
		});
		expect(report.input).toBe('45.9.20.10 (IP address)');
		expect(report.sections.map((section) => section.status)).toEqual([
			'done',
			'done',
			'error',
			'done'
		]);
		const markdown = toMarkdown(report);
		expect(markdown).toContain('- Listed by 1 of 1 sources checked.');
		expect(markdown).toContain('- 2 sources unavailable.');
		expect(markdown).toContain('| Result | listed |');
		expect(markdown).toContain('- Botnet C2 · Mirai');
		expect(markdown).toContain('**Error:** Needs the API service, which is not running.');
		expect(markdown).toContain('Not configured');
	});

	it('explains why special addresses were not checked', () => {
		const indicator = /** @type {any} */ (parseIndicator('10.0.0.1'));
		const report = buildReputationReport({
			indicator,
			sources: [],
			sections: {},
			counts: { listed: 0, notListed: 0, unavailable: 0, pending: 0 }
		});
		expect(report.sections).toHaveLength(1);
		expect(toMarkdown(report)).toContain('not a public internet address');
	});
});
