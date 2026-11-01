import { describe, expect, it } from 'vitest';
import { remainingSites, replaceResult } from './session.js';
import { runPool } from './pool.js';
describe('resuming username scans', () => {
	const sites = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
	it('resumes only missing sites and retries only errors or unknown results', () => {
		const results = [
			{ site: 'a', status: 'found' },
			{ site: 'b', status: 'error' },
			{ site: 'c', status: 'unknown' }
		];
		expect(remainingSites(sites, results)).toEqual([{ id: 'd' }]);
		expect(remainingSites(sites, results, true)).toEqual([{ id: 'b' }, { id: 'c' }]);
		const updated = replaceResult(results, { site: 'b', status: 'not_found' });
		expect(updated).toHaveLength(3);
		expect(updated.find((r) => r.site === 'a').status).toBe('found');
		expect(remainingSites(sites, updated, true)).toEqual([{ id: 'c' }]);
	});
	it('ignores in-flight responses after stop and resumes without repeating completed work', async () => {
		const controller = new AbortController();
		let results = [];
		await runPool(
			sites,
			async (site) => {
				if (site.id === 'b') controller.abort();
				return { site: site.id, status: 'found' };
			},
			{
				concurrency: 1,
				signal: controller.signal,
				onResult: (r) => (results = replaceResult(results, r))
			}
		);
		expect(results.map((r) => r.site)).toEqual(['a']);
		const resumed = remainingSites(sites, results);
		await runPool(resumed, async (site) => ({ site: site.id, status: 'found' }), {
			onResult: (r) => (results = replaceResult(results, r))
		});
		expect(results.map((r) => r.site).sort()).toEqual(['a', 'b', 'c', 'd']);
	});
});
