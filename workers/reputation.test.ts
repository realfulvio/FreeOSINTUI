import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchText, HttpError } from './http';
import { handleReputation } from './reputation';
vi.mock('./http', async (original) => ({
	...(await original<typeof import('./http')>()),
	fetchText: vi.fn()
}));
const fetchMock = vi.mocked(fetchText);
const response = (body: string, complete = true, status = 200) => ({
	body,
	complete,
	status,
	headers: new Headers({ 'Last-Modified': 'Wed, 30 Sep 2026 09:05:15 GMT' })
});
const query = (source: string, params: Record<string, string>, key?: string) =>
	handleReputation(
		new URL(`https://example.org/api/reputation/${source}?${new URLSearchParams(params)}`),
		key
	);
const drop = (cidr: string, records = 1) =>
	`${JSON.stringify({ cidr, sblid: 'SBL1', rir: 'test' })}\n${JSON.stringify({ type: 'metadata', timestamp: 1790680442, records })}`;
beforeEach(() => {
	vi.resetAllMocks();
	vi.stubGlobal('caches', undefined);
});
afterEach(() => vi.unstubAllGlobals());
describe('reputation validation and fixed source isolation', () => {
	it.each(['1.2.3', '0177.0.0.1', '999.1.1.1', '::1%eth0', 'example.com'])(
		'rejects invalid IP %s',
		async (ip) => {
			await expect(query('tor', { ip })).rejects.toMatchObject({ status: 422 });
			expect(fetchMock).not.toHaveBeenCalled();
		}
	);
	it('validates inputs before not_configured and normalizes hosts', async () => {
		await expect(query('urlhaus', {})).rejects.toMatchObject({ status: 422 });
		await expect(query('urlhaus', { host: 'a.com', url: 'http://a.com' })).rejects.toMatchObject({
			status: 422
		});
		await expect(query('urlhaus', { url: 'http:///nohost' })).rejects.toMatchObject({
			status: 422
		});
		await expect(query('threatfox', { term: '<script>' })).rejects.toMatchObject({ status: 422 });
		await expect(query('urlhaus', { host: 'Bad.Example.' })).resolves.toEqual({
			source: 'urlhaus',
			checked: 'bad.example',
			status: 'not_configured',
			date: null,
			details: {}
		});
		await expect(query('threatfox', { term: '::ffff:1.2.3.4' })).resolves.toMatchObject({
			checked: '1.2.3.4',
			status: 'not_configured'
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});
	it('sends target only as lookup payload to URLhaus', async () => {
		fetchMock.mockResolvedValue(response('{"query_status":"no_results"}'));
		await expect(
			query('urlhaus', { url: 'http://127.0.0.1/secret' }, 'test-key')
		).resolves.toMatchObject({ kind: 'url', status: 'not_listed' });
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0][0]).toBe('https://urlhaus-api.abuse.ch/v1/url/');
		expect(new URLSearchParams(fetchMock.mock.calls[0][1]?.body as string).get('url')).toBe(
			'http://127.0.0.1/secret'
		);
		expect(fetchMock.mock.calls[0][1]).toMatchObject({
			redirect: 'error',
			headers: { 'Auth-Key': 'test-key' }
		});
	});
});
describe('public lists', () => {
	it('enforces source line caps', async () => {
		fetchMock.mockResolvedValue(response('1.2.3.4\n'.repeat(100_001)));
		await expect(query('tor', { ip: '8.8.8.8' })).rejects.toMatchObject({ status: 502 });
	});
	it('reports timeouts and upstream HTTP failures', async () => {
		fetchMock.mockRejectedValueOnce(new HttpError(504, 'timeout'));
		await expect(query('tor', { ip: '8.8.8.8' })).rejects.toMatchObject({ status: 504 });
		fetchMock.mockResolvedValueOnce(response('', true, 500));
		await expect(query('tor', { ip: '8.8.8.8' })).rejects.toThrow('HTTP 500');
	});

	it('normalizes IPv6 and mapped IPv4 and returns source date', async () => {
		fetchMock.mockResolvedValue(response('1.2.3.4\n2001:DB8::1\n'));
		await expect(query('tor', { ip: '::ffff:1.2.3.4' })).resolves.toMatchObject({
			checked: '1.2.3.4',
			status: 'listed',
			date: '2026-09-30T09:05:15+00:00',
			details: { exit_nodes: 2 }
		});
		await expect(query('tor', { ip: '2001:db8:0::1' })).resolves.toMatchObject({
			status: 'listed'
		});
	});
	it.each(['', '# empty\n', '<html>blocked</html>', '1.2.3.4\nbad line'])(
		'rejects invalid Tor source rather than clean result',
		async (body) => {
			fetchMock.mockResolvedValue(response(body));
			await expect(query('tor', { ip: '8.8.8.8' })).rejects.toMatchObject({ status: 502 });
		}
	);
	it('rejects truncated bodies even if the included records are valid', async () => {
		fetchMock.mockResolvedValue(response('1.2.3.4\n', false));
		await expect(query('tor', { ip: '8.8.8.8' })).rejects.toMatchObject({ status: 502 });
	});
	it('matches IPv4/IPv6 CIDR bounds and normalizes noncanonical networks', async () => {
		fetchMock.mockImplementation(async (url) =>
			response(url.includes('_v4') ? drop('1.10.16.9/20') : drop('2001:678:254::/48'))
		);
		await expect(query('drop', { ip: '1.10.31.255' })).resolves.toMatchObject({
			status: 'listed',
			details: { cidr: '1.10.16.0/20', sblid: 'SBL1', rir: 'test' }
		});
		await expect(query('drop', { ip: '1.10.32.0' })).resolves.toMatchObject({
			status: 'not_listed',
			details: {}
		});
		await expect(query('drop', { ip: '2001:678:254:ffff::1' })).resolves.toMatchObject({
			status: 'listed'
		});
		await expect(query('drop', { ip: '2001:678:255::1' })).resolves.toMatchObject({
			status: 'not_listed'
		});
	});
	it.each([
		drop('1.2.3.0/24', 2),
		'{"cidr":"1.2.3.0/24"}',
		drop('1.2.3.0/24') + '\ninvalid',
		drop('999.1.2.0/24')
	])('rejects malformed or incomplete DROP sources', async (body) => {
		fetchMock.mockResolvedValue(response(body));
		await expect(query('drop', { ip: '8.8.8.8' })).rejects.toMatchObject({ status: 502 });
	});
	it('uses native cache across requests; origin failures never create cached clean results', async () => {
		let cached: Response | undefined;
		const cache = {
			match: vi.fn(async () => cached?.clone()),
			put: vi.fn(async (_key, value: Response) => {
				cached = value.clone();
			})
		};
		vi.stubGlobal('caches', { default: cache });
		fetchMock.mockResolvedValue(response('1.2.3.4\n'));
		await query('tor', { ip: '1.2.3.4' });
		await query('tor', { ip: '8.8.8.8' });
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(cached?.headers.get('cache-control')).toBe('public, max-age=3600');
		cached = undefined; // Simulate expiry/eviction in the platform cache.
		fetchMock.mockResolvedValue(response('', false));
		await expect(query('tor', { ip: '8.8.8.8' })).rejects.toMatchObject({ status: 502 });
		expect(cache.put).toHaveBeenCalledTimes(1);
	});
});
describe('abuse.ch response contracts', () => {
	it('summarizes URLhaus host records', async () => {
		fetchMock.mockResolvedValue(
			response(
				JSON.stringify({
					query_status: 'ok',
					url_count: '2',
					firstseen: '2026-01-01',
					urlhaus_reference: 'https://urlhaus.abuse.ch/host/bad.example/',
					blacklists: { dbl: 'listed', empty: '' },
					urls: [
						{
							date_added: '2026-09-01',
							url_status: 'online',
							threat: 'malware_download',
							tags: ['mirai', 'elf']
						},
						{ date_added: '2026-08-01', tags: null }
					]
				})
			)
		);
		await expect(query('urlhaus', { host: 'Bad.Example' }, 'key')).resolves.toMatchObject({
			status: 'listed',
			kind: 'host',
			date: '2026-09-01',
			details: {
				url_count: 2,
				online: 1,
				blacklists: { dbl: 'listed' },
				threats: ['malware_download'],
				tags: ['elf', 'mirai']
			}
		});
	});
	it('summarizes URLhaus URL records', async () => {
		fetchMock.mockResolvedValue(
			response(
				JSON.stringify({
					query_status: 'ok',
					last_online: '2026-09-01',
					date_added: '2026-08-01',
					url_status: 'online',
					threat: 'malware_download',
					tags: ['elf']
				})
			)
		);
		await expect(query('urlhaus', { url: 'https://evil.example/a' }, 'key')).resolves.toMatchObject(
			{ status: 'listed', date: '2026-09-01', details: { url_status: 'online', tags: ['elf'] } }
		);
	});
	it('summarizes ThreatFox and caps visible records', async () => {
		fetchMock.mockResolvedValue(
			response(
				JSON.stringify({
					query_status: 'ok',
					data: Array.from({ length: 12 }, () => ({
						ioc: '1.2.3.4:443',
						threat_type_desc: 'Botnet C&C',
						malware_printable: 'Cobalt Strike',
						confidence_level: 75,
						first_seen: '2026-09-01',
						tags: ['a', 'b', 'c', 'd', 'e', 'f']
					}))
				})
			)
		);
		const result = (await query('threatfox', { term: '1.2.3.4' }, 'key')) as {
			details: { count: number; iocs: { tags: string[] }[] };
		};
		expect(result.details.count).toBe(12);
		expect(result.details.iocs).toHaveLength(10);
		expect(result.details.iocs[0].tags).toHaveLength(5);
		expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
			query: 'search_ioc',
			search_term: '1.2.3.4'
		});
	});
	it.each(['no_result', 'no_results'])('accepts explicit ThreatFox %s', async (query_status) => {
		fetchMock.mockResolvedValue(response(JSON.stringify({ query_status })));
		await expect(query('threatfox', { term: 'example.com' }, 'key')).resolves.toMatchObject({
			status: 'not_listed'
		});
	});
	it.each([
		'[]',
		'null',
		'<html>',
		'{"query_status":"ok","data":"bad"}',
		'{"query_status":"ok"}',
		'{"query_status":"illegal_search_term"}'
	])('fails closed on malformed ThreatFox data', async (body) => {
		fetchMock.mockResolvedValue(response(body));
		await expect(query('threatfox', { term: 'example.com' }, 'key')).rejects.toMatchObject({
			status: 502
		});
	});
	it('explains rejected Auth-Key without disclosing it', async () => {
		fetchMock.mockResolvedValue(response('', true, 401));
		await expect(query('urlhaus', { host: 'example.com' }, 'secret')).rejects.toThrow(
			'rejected the Auth-Key (ABUSECH_AUTH_KEY)'
		);
	});
});
