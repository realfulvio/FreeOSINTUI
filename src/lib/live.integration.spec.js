// Opt-in, read-only live-provider smoke checks. Never part of ordinary offline CI.
// RUN_LIVE_INTEGRATIONS=1 npx vitest run src/lib/live.integration.spec.js
import { expect, it } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { resolveDns } from './dns/doh.js';
import { lookupEmailAuth } from './dns/email-auth.js';
import { lookupRdap } from './rdap.js';
import { findSubdomains } from './domain/subdomains.js';
import { lookupGeo, lookupInternetDb, lookupPtr } from './ip/lookups.js';
import { gravatarHash, lookupGravatarProfile } from './email/gravatar.js';
import { checkDisposable } from './email/disposable.js';
import { checkPwnedPassword } from './leaks/pwned-passwords.js';
import { checkEmailBreaches } from './leaks/xposedornot.js';
import { fetchProfile, fetchRepos, fetchOrgs, fetchKeys } from './github/lookup.js';
import { traceAddress } from './crypto/trace.js';
import { lookupUrlWayback } from './url/remote.js';
import { lookupCommonCrawl } from './footprint/commoncrawl.js';
import { SOURCES } from './reputation/sources.js';
import { parseIndicator } from './reputation/indicator.js';

it.skipIf(process.env.RUN_LIVE_INTEGRATIONS !== '1')(
	'records actual provider behavior without treating outages as successful data',
	async () => {
		const base = process.env.LIVE_BASE_URL || 'http://localhost:8788';
		const results = [];
		const probe = async (name, call, summarize = () => 'parsed') => {
			const start = Date.now();
			try {
				const data = await call({ signal: AbortSignal.timeout(45000) });
				const detail = summarize(data);
				const outcome =
					detail?.status === 'not_configured' || detail?.configured === false
						? 'not_configured'
						: detail?.partial ||
							  Object.values(detail?.sections ?? {}).some((status) => status !== 'done')
							? 'partial'
							: 'data';
				results.push({ name, outcome, milliseconds: Date.now() - start, detail });
			} catch (error) {
				results.push({
					name,
					outcome: 'unavailable',
					milliseconds: Date.now() - start,
					detail: error.message
				});
			}
			console.log(JSON.stringify(results.at(-1)));
		};
		const api = async (path) => {
			const response = await fetch(base + path, { signal: AbortSignal.timeout(35000) });
			const data = await response.json();
			if (!response.ok) throw new Error(`HTTP ${response.status}: ${data.detail}`);
			return data;
		};
		const jobs = [
			['DNS A', (o) => resolveDns('example.com', 'A', o), (d) => ({ answers: d.length })],
			['DNS AAAA', (o) => resolveDns('example.com', 'AAAA', o), (d) => ({ answers: d.length })],
			['DNS MX', (o) => resolveDns('example.com', 'MX', o), (d) => ({ answers: d.length })],
			[
				'SPF/DMARC',
				(o) => lookupEmailAuth('example.com', o),
				(d) => ({ spf: !!d.spf, dmarc: !!d.dmarc })
			],
			['Domain RDAP', (o) => lookupRdap('domain', 'example.com', o)],
			['IP RDAP', (o) => lookupRdap('ip', '1.1.1.1', o)],
			['IP geolocation', (o) => lookupGeo('1.1.1.1', o)],
			['IP InternetDB', (o) => lookupInternetDb('1.1.1.1', o)],
			['PTR', (o) => lookupPtr('1.1.1.1', o)],
			['Disposable list', (o) => checkDisposable('example.com', o)],
			[
				'Gravatar reserved email',
				async (o) =>
					lookupGravatarProfile(await gravatarHash('tracepunk-integration-test@example.com'), o),
				(d) => ({ profilePresent: d !== null })
			],
			[
				'HIBP password fixture',
				(o) => checkPwnedPassword('password', o),
				(d) => {
					if (!(d.count > 0)) throw new Error('Known exposed fixture not found');
					return { knownFixtureFound: true };
				}
			],
			[
				'XposedOrNot reserved email',
				(o) => checkEmailBreaches('tracepunk-integration-test@example.com', o),
				(d) => ({ breaches: d.length })
			],
			[
				'GitHub profile',
				(o) => fetchProfile('octocat', o),
				(d) => {
					if (d.login !== 'octocat') throw new Error('Missing fixture profile');
					return { login: d.login };
				}
			],
			['GitHub repos', (o) => fetchRepos('octocat', o)],
			['GitHub orgs', (o) => fetchOrgs('octocat', o)],
			['GitHub keys', (o) => fetchKeys('octocat', o)],
			...[
				['btc', '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'],
				['ltc', 'LQTpS3VaYTjCr4s9Y1t5zbeY26zevf7Fb3'],
				['eth', '0x0000000000000000000000000000000000000001']
			].map(([chain, address]) => [
				`Crypto ${chain}`,
				(o) => traceAddress({ chain, address }, o),
				(d) => ({
					sections: Object.fromEntries(Object.entries(d.sections).map(([k, v]) => [k, v.status])),
					transactions: d.txs.length,
					balanceKnown: d.balance !== null
				})
			]),
			[
				'Wayback availability',
				(o) => lookupUrlWayback('https://example.com/', o),
				(d) => ({ snapshot: !!d.snapshot })
			],
			[
				'Common Crawl',
				(o) => lookupCommonCrawl('example.com', { ...o, indexes: 1, limit: 5 }),
				(d) => ({ indexes: d.indexes.length, records: d.records.length })
			],
			[
				'Certificate transparency',
				(o) => findSubdomains('example.com', o),
				(d) => ({ source: d.source, names: d.names.length, partial: d.partial })
			],
			...SOURCES.filter((s) => !s.backend).map((s) => [
				`Reputation ${s.id}`,
				(o) => s.lookup(parseIndicator('1.1.1.1'), o),
				(d) => ({ status: d.status })
			]),
			...[
				[
					'Short URL redirect',
					'/api/url/expand?url=https%3A%2F%2Fbit.ly%2F2X7gCIT',
					(d) => ({ status: d.status, destination: d.location, method: d.method })
				],
				[
					'Telegram official channel',
					'/api/telegram/telegram',
					(d) => ({ exists: d.exists, type: d.type, keys: Object.keys(d) })
				],
				[
					'Wayback CDX',
					'/api/footprint/wayback?domain=example.com&limit=5',
					(d) => ({ records: d.records.length, truncated: d.truncated })
				],
				[
					'urlscan existing scans',
					'/api/url/urlscan?host=example.com',
					(d) => ({ total: d.total, loaded: d.results?.length })
				],
				['Tor exit list', '/api/reputation/tor?ip=1.1.1.1', (d) => ({ status: d.status })],
				['Spamhaus DROP', '/api/reputation/drop?ip=1.1.1.1', (d) => ({ status: d.status })],
				[
					'URLhaus config',
					'/api/reputation/urlhaus?host=example.com',
					(d) => ({ status: d.status })
				],
				[
					'ThreatFox config',
					'/api/reputation/threatfox?term=example.com',
					(d) => ({ status: d.status })
				],
				[
					'URLhaus URL config',
					'/api/url/urlhaus?url=https%3A%2F%2Fexample.com',
					(d) => ({ configured: d.configured })
				]
			].map(([name, path, summary]) => [name, () => api(path), summary])
		];
		// At most two providers in flight. No mass username scan or scan submission.
		let next = 0;
		await Promise.all(
			[0, 1].map(async () => {
				while (next < jobs.length) await probe(...jobs[next++]);
			})
		);
		const sites = await api('/api/username/sites');
		const github = sites.sites.find((s) => s.id === 'github-user');
		expect(github, 'GitHub fixture site must exist in the bundled catalog').toBeDefined();
		for (const username of ['octocat', 'tracepunk-nonexistent-fixture-20261101'])
			await probe(
				`Username GitHub ${username === 'octocat' ? 'known' : 'absent'}`,
				() => api(`/api/username/check?username=${username}&site=${encodeURIComponent(github.id)}`),
				(d) => ({ status: d.status, http: d.http_status, reason: d.reason })
			);
		await writeFile(
			'/tmp/tracepunk-live-integrations.json',
			JSON.stringify({ at: new Date().toISOString(), results }, null, 2)
		);
		expect(results).toHaveLength(jobs.length + 2);
		// This assertion checks probe execution, not external-service availability.
		// Inspect each outcome in the report before declaring any integration validated.
	},
	600000
);
