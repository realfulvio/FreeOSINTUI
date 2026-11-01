// Regression cases reproduced during the pre-publication review.
import { it, expect } from 'vitest';
import { buildGithubReport } from './github/report.js';
import { toMarkdown } from './export/markdown.js';
import { checkEmailBreaches } from './leaks/xposedornot.js';
import { SOURCES, fromBackend } from './reputation/sources.js';
import { lookupEmailAuth } from './dns/email-auth.js';
import { sameOrganization } from './headers/address.js';
import { parseDomain } from './lookalike/domain.js';
import { resolveLookalike } from './lookalike/resolve.js';
import { fetchCommitEmails } from './github/lookup.js';
const json = (data) =>
	new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
it('rejects malformed breach responses', async () => {
	await expect(
		checkEmailBreaches('synthetic@example.test', { fetch: async () => json({ maintenance: true }) })
	).rejects.toThrow();
});
it('rejects malformed reputation responses', async () => {
	const otx = SOURCES.find((s) => s.id === 'otx');
	await expect(
		otx.lookup(
			{ kind: 'domain', value: 'example.test' },
			{ fetch: async () => json({ maintenance: true }) }
		)
	).rejects.toThrow();
	expect(() => fromBackend({ status: 'unexpected' }, null)).toThrow();
});
it('rejects duplicate SPF records', async () => {
	await expect(
		lookupEmailAuth('example.test', {
			fetch: async (url) =>
				json({
					Status: 0,
					Answer: String(url).includes('_dmarc')
						? []
						: [
								{ name: 'example.test.', type: 16, TTL: 60, data: '"v=spf1 -all"' },
								{ name: 'example.test.', type: 16, TTL: 60, data: '"v=spf1 +all"' }
							]
				})
		})
	).rejects.toThrow();
});
it('keeps independent hosted domains separate', () => {
	expect(sameOrganization('alice.github.io', 'bob.github.io')).toBe(false);
	expect(parseDomain('alice.github.io').domain).toBe('alice.github.io');
});
it('detects AAAA-only hosts', async () => {
	const queries = [];
	const result = await resolveLookalike('ipv6.example.test', {
		fetch: async (url) => {
			const type = new URL(url).searchParams.get('type');
			queries.push(type);
			return json({
				Status: 0,
				Answer:
					type === 'AAAA'
						? [{ name: 'ipv6.example.test.', type: 28, TTL: 60, data: '2001:db8::1' }]
						: []
			});
		}
	});
	expect(result.hasDns).toBe(true);
	expect(queries).toContain('AAAA');
});
it('preserves successful commit sources', async () => {
	const repos = ['one', 'two'].map((name) => ({
		name,
		full_name: `synthetic/${name}`,
		fork: false,
		size: 1
	}));
	const result = await fetchCommitEmails('synthetic', repos, {
		fetch: async (url) =>
			String(url).includes('/two/')
				? new Response('', { status: 503 })
				: json([
						{
							html_url: 'https://github.com/synthetic/one/commit/test',
							author: { login: 'synthetic' },
							commit: {
								author: { name: 'Synthetic', email: 'test@example.test', date: '2026-01-01' },
								committer: {}
							}
						}
					])
	});
	expect(result.emails[0].email).toBe('test@example.test');
	expect(result.scanned).toEqual(['synthetic/one']);
	const report = buildGithubReport({
		username: 'synthetic',
		commitsPerRepo: 30,
		sections: {
			profile: { status: 'done', data: { login: 'synthetic' } },
			repos: { status: 'idle' },
			orgs: { status: 'idle' },
			keys: { status: 'idle' },
			emails: { status: 'done', data: result }
		}
	});
	expect(toMarkdown(report)).toContain('Partial results');
	expect(toMarkdown(report)).toContain('synthetic/two');
	expect(toMarkdown(report)).toContain('test@example.test');
	expect(result.failed.map((x) => x.repo)).toEqual(['synthetic/two']);
});
import { parseArchivedUrl } from './footprint/merge.js';
import { countInRange } from './leaks/pwned-passwords.js';
it('keeps distinct archive ports', () => {
	expect(parseArchivedUrl('https://example.test:8443/admin').key).not.toBe(
		parseArchivedUrl('https://example.test:9443/admin').key
	);
});
it('rejects malformed password ranges', () => {
	expect(() => countInRange('<html>Temporarily unavailable</html>', 'A'.repeat(35))).toThrow();
});

it('distinguishes JSON null from a documented missing breach response', async () => {
	await expect(
		checkEmailBreaches('synthetic@example.test', { fetch: async () => json(null) })
	).rejects.toThrow();
	expect(
		await checkEmailBreaches('synthetic@example.test', {
			fetch: async () => new Response('', { status: 404 })
		})
	).toEqual([]);
});
it('validates the whole password range even after finding a match', () => {
	expect(() => countInRange('A'.repeat(35) + ':4\ncorrupt', 'A'.repeat(35))).toThrow();
	expect(countInRange('A'.repeat(35) + ':0\r\n', 'B'.repeat(35))).toBe(0);
});
it('rejects duplicate DMARC records as well as SPF', async () => {
	await expect(
		lookupEmailAuth('example.test', {
			fetch: async (url) =>
				json({
					Status: 0,
					Answer: String(url).includes('_dmarc')
						? ['v=DMARC1; p=reject', 'v=DMARC1; p=none'].map((data) => ({
								name: '_dmarc.example.test.',
								type: 16,
								TTL: 60,
								data
							}))
						: []
				})
		})
	).rejects.toThrow(/DMARC/);
});
it('distinguishes missing DNS evidence from lookup errors and detects null MX', async () => {
	await expect(
		resolveLookalike('example.test', { fetch: async () => json({ Status: 2 }) })
	).rejects.toThrow();
	const result = await resolveLookalike('example.test', {
		fetch: async (url) =>
			json({
				Status: 0,
				Answer:
					new URL(url).searchParams.get('type') === 'MX'
						? [{ name: 'example.test.', type: 15, TTL: 60, data: '0 .' }]
						: []
			})
	});
	expect(result.hasDns).toBe(true);
	expect(result.mx).toEqual([]);
});
it('does not return an empty successful GitHub result when every source fails', async () => {
	await expect(
		fetchCommitEmails('synthetic', [{ full_name: 'synthetic/one', fork: false, size: 1 }], {
			fetch: async () => new Response('', { status: 503 })
		})
	).rejects.toThrow();
});
it('uses suffix wildcard exceptions and rejects a bare private suffix', () => {
	expect(parseDomain('www.city.kawasaki.jp').domain).toBe('city.kawasaki.jp');
	expect(parseDomain('github.io')).toHaveProperty('error');
	expect(sameOrganization('news.alice.github.io', 'alice.github.io')).toBe(true);
});
