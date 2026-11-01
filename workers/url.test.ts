/** Modified 2026-11-01: Workers URL regression tests. Original project: kerlo; see NOTICE. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchText, HttpError } from './http';
import { handleUrl, parseUrlhaus, parseUrlscan, validateScanHost, validateShortUrl } from './url';
vi.mock('./http', async (original) => ({
	...(await original<typeof import('./http')>()),
	fetchText: vi.fn()
}));
const fetchMock = vi.mocked(fetchText);
const page = (status = 200, body = '', location?: string) => ({
	status,
	body,
	headers: new Headers(location ? { location } : {}),
	complete: true
});
const api = (route: string, params: Record<string, string>) =>
	new URL(`https://app.test/api/url/${route}?${new URLSearchParams(params)}`);
beforeEach(() => vi.resetAllMocks());

describe('URL validation', () => {
	it.each([
		'https://evil.com/a',
		'https://bit.ly.evil.com/a',
		'https://evil.com#bit.ly',
		'https://bit.ly@evil.com/a',
		'https://user@bit.ly/a',
		'https://bit.ly:443/a',
		'https://bit.ly:8080/a',
		'http://127.0.0.1/a',
		'http://[::1]/a',
		'http://2130706433/a',
		'ftp://bit.ly/a',
		'javascript:alert(1)',
		'bit.ly/a',
		'https://bit.ly./a',
		'https://bit.ly\\@evil.com/a',
		'https://bit.ly/a b',
		'https://sub.bit.ly/a',
		'https://%62it.ly/a',
		'https://bit.ly/é',
		''
	])('rejects unsupported or ambiguous short URL %s', async (raw) => {
		await expect(handleUrl(api('expand', { url: raw }))).rejects.toMatchObject({ status: 422 });
		expect(fetchMock).not.toHaveBeenCalled();
	});
	it('normalizes case and strips fragments', () => {
		expect(validateShortUrl('https://BIT.LY/a?x=1#frag')).toBe('https://bit.ly/a?x=1');
		expect(validateShortUrl('https://tinyurl.com')).toBe('https://tinyurl.com/');
	});
	it.each([
		'',
		'a b.com',
		'evil.com/x',
		'example',
		'xn--.com',
		'exa_mple.com',
		'1.2.3.999',
		'-a.com'
	])('rejects host %s', (host) => expect(() => validateScanHost(host)).toThrow());
	it('accepts normalized host and IPv4', () => {
		expect(validateScanHost('Example.COM.')).toBe('example.com');
		expect(validateScanHost('8.8.8.8')).toBe('8.8.8.8');
	});
});

describe('shortener expansion', () => {
	it('does not follow a redirect to an arbitrary destination', async () => {
		fetchMock.mockResolvedValueOnce(page(301, '', 'http://169.254.169.254/latest/meta-data/'));
		expect(await handleUrl(api('expand', { url: 'https://bit.ly/a' }))).toEqual({
			url: 'https://bit.ly/a',
			method: 'HEAD',
			status: 301,
			location: 'http://169.254.169.254/latest/meta-data/',
			location_is_shortener: false
		});
		expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
			'https://bit.ly/a',
			{ method: 'HEAD', redirect: 'manual' },
			{ maxBytes: 65536 }
		);
	});
	it('flags another shortener without fetching it', async () => {
		fetchMock.mockResolvedValueOnce(page(302, '', '/b'));
		expect(await handleUrl(api('expand', { url: 'https://bit.ly/a' }))).toMatchObject({
			location: 'https://bit.ly/b',
			location_is_shortener: true
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
	it.each([405, 501, 200])('falls back to GET after HEAD %s', async (status) => {
		fetchMock
			.mockResolvedValueOnce(page(status))
			.mockResolvedValueOnce(
				page(200, '<meta http-equiv="refresh" content="0;URL=https://example.net/?a=1&amp;b=2">')
			);
		expect(await handleUrl(api('expand', { url: 'https://t.co/a' }))).toMatchObject({
			method: 'GET',
			location: 'https://example.net/?a=1&b=2'
		});
		expect(fetchMock).toHaveBeenLastCalledWith(
			'https://t.co/a',
			{ method: 'GET', redirect: 'manual' },
			{ maxBytes: 65536 }
		);
	});
	it('accepts a GET redirect', async () => {
		fetchMock
			.mockResolvedValueOnce(page(405))
			.mockResolvedValueOnce(page(307, '', 'https://example.net/a'));
		expect(await handleUrl(api('expand', { url: 'https://t.co/a' }))).toMatchObject({
			method: 'GET',
			status: 307,
			location: 'https://example.net/a'
		});
	});
	it.each([
		[404, null],
		[302, 'javascript:alert(1)'],
		[200, 'https://example.net/']
	])('does not expose invalid redirect for %s', async (status, location) => {
		fetchMock.mockResolvedValueOnce(page(status as number, '', location as string | undefined));
		expect(await handleUrl(api('expand', { url: 'https://t.co/a' }))).toMatchObject({
			location: null
		});
	});
	it('maps timeout and network errors', async () => {
		fetchMock
			.mockRejectedValueOnce(new HttpError(504, 'timeout'))
			.mockRejectedValueOnce(new TypeError('network'));
		await expect(handleUrl(api('expand', { url: 'https://t.co/a' }))).rejects.toMatchObject({
			status: 504
		});
		await expect(handleUrl(api('expand', { url: 'https://t.co/a' }))).rejects.toMatchObject({
			status: 502
		});
	});
});

describe('urlscan', () => {
	it.each(['example.com', '8.8.8.8'])('queries only existing scans for %s', async (host) => {
		fetchMock.mockResolvedValueOnce(page(200, '{"total":0,"results":[]}'));
		expect(await handleUrl(api('urlscan', { host }))).toEqual({
			host,
			search_url: `https://urlscan.io/search/#${host}`,
			total: 0,
			results: []
		});
		const target = new URL(fetchMock.mock.calls[0][0]);
		expect(target.origin).toBe('https://urlscan.io');
		expect(target.searchParams.get('q')).toBe(
			host === '8.8.8.8'
				? 'page.ip:"8.8.8.8"'
				: 'page.domain:example.com OR task.domain:example.com'
		);
	});
	it('keeps fields and rejects forged scan IDs', () => {
		const uuid = '01a0f1b6-d05c-718c-80b8-8fa47236c3c0';
		const parsed = parseUrlscan({
			total: 1,
			results: [
				{
					_id: uuid,
					task: { tags: ['phishing', 2] },
					verdicts: { overall: { malicious: true, score: 100 } }
				},
				{ _id: '../../evil' }
			]
		});
		expect(parsed.results).toHaveLength(1);
		expect(parsed.results[0]).toMatchObject({
			malicious: true,
			score: 100,
			title: null,
			tags: ['phishing'],
			result_url: `https://urlscan.io/result/${uuid}/`
		});
	});
	it.each([
		[429, '{}', 429],
		[503, '{}', 502],
		[200, 'bad json', 502],
		[200, 'null', 502],
		[200, '{"results":{}}', 502]
	])('maps upstream %s', async (status, body, expected) => {
		fetchMock.mockResolvedValueOnce(page(status as number, body as string));
		await expect(handleUrl(api('urlscan', { host: 'example.com' }))).rejects.toMatchObject({
			status: expected
		});
	});
});

describe('URLhaus', () => {
	it('validates even when unconfigured', async () => {
		expect(await handleUrl(api('urlhaus', { url: 'https://example.com/' }))).toEqual({
			configured: false
		});
		await expect(handleUrl(api('urlhaus', { url: 'javascript:alert(1)' }))).rejects.toMatchObject({
			status: 422
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});
	it('sends analyzed URL as form data only to URLhaus', async () => {
		fetchMock.mockResolvedValueOnce(page(200, '{"query_status":"no_results"}'));
		expect(await handleUrl(api('urlhaus', { url: 'https://example.com/' }), 'test-key')).toEqual({
			configured: true,
			listed: false
		});
		expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
			'https://urlhaus-api.abuse.ch/v1/url/',
			{
				method: 'POST',
				redirect: 'manual',
				headers: {
					'Auth-Key': 'test-key',
					'Content-Type': 'application/x-www-form-urlencoded',
					Accept: 'application/json'
				},
				body: 'url=https%3A%2F%2Fexample.com%2F'
			},
			{ maxBytes: undefined }
		);
	});
	it('parses listed URLs and filters tags/blacklists', () => {
		expect(
			parseUrlhaus({
				query_status: 'ok',
				tags: ['elf', 3],
				blacklists: { surbl: 'not listed', bad: {} },
				payloads: [{}, {}]
			})
		).toMatchObject({
			listed: true,
			payload_count: 2,
			tags: ['elf'],
			blacklists: { surbl: 'not listed' }
		});
	});
	it.each([
		[401, '{}'],
		[403, '{}'],
		[503, '{}'],
		[200, 'bad'],
		[200, '{"query_status":"invalid_url"}']
	])('maps failure %s', async (status, body) => {
		fetchMock.mockResolvedValueOnce(page(status as number, body as string));
		await expect(
			handleUrl(api('urlhaus', { url: 'https://example.com/' }), 'test-key')
		).rejects.toMatchObject({ status: 502 });
	});
	it('rejects a truncated provider response', async () => {
		fetchMock.mockResolvedValueOnce({
			...page(200, '{"query_status":"no_results"}'),
			complete: false
		});
		await expect(
			handleUrl(api('urlhaus', { url: 'https://example.com/' }), 'test-key')
		).rejects.toMatchObject({ status: 502 });
	});
});
