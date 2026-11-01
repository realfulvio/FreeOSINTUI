import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchText } from './http';
import { handleFootprint, parseCdx } from './footprint';
afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});
describe('bounded transport', () => {
	it('caps a single oversized chunk and cancels the stream', async () => {
		const cancel = vi.fn();
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						new ReadableStream({
							start(c) {
								c.enqueue(new TextEncoder().encode('abcdef'));
							},
							cancel
						})
					)
			)
		);
		const r = await fetchText('https://example.com', {}, { maxBytes: 3 });
		expect(r.body).toBe('abc');
		expect(r.complete).toBe(false);
		expect(cancel).toHaveBeenCalled();
		expect(fetch).toHaveBeenCalledWith(
			'https://example.com',
			expect.objectContaining({ redirect: 'manual' })
		);
	});
	it('keeps a timeout active while reading the body', async () => {
		vi.useFakeTimers();
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async (_url, init) =>
					new Response(
						new ReadableStream({
							start(c) {
								init.signal.addEventListener('abort', () => c.error(new Error('abort')));
							}
						})
					)
			)
		);
		const request = fetchText('https://example.com', {}, { timeoutMs: 20 });
		const assertion = expect(request).rejects.toMatchObject({ status: 504 });
		await vi.advanceTimersByTimeAsync(21);
		await assertion;
	});
});
describe('Wayback', () => {
	it('drops partial last record', () => {
		expect(
			parseCdx(
				'20240101000000 https://example.com/ text/html 200\n20240101000000 https://partial text/html 200',
				false
			)
		).toHaveLength(1);
	});
	it('rejects arbitrary URLs and invalid flags before fetching', async () => {
		const mock = vi.fn();
		vi.stubGlobal('fetch', mock);
		await expect(
			handleFootprint(new URL('https://local/api/footprint/wayback?domain=http://127.0.0.1'))
		).rejects.toMatchObject({ status: 422 });
		await expect(
			handleFootprint(
				new URL('https://local/api/footprint/wayback?domain=example.com&subdomains=oops')
			)
		).rejects.toMatchObject({ status: 422 });
		expect(mock).not.toHaveBeenCalled();
	});
	it('queries only CDX and preserves response shape', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('20240101000000 https://example.com/a text/html 200\n'))
		);
		const result = await handleFootprint(
			new URL('https://local/api/footprint/wayback?domain=example.com&limit=1')
		);
		expect(result).toMatchObject({
			domain: 'example.com',
			limit: 1,
			truncated: true,
			records: [{ status: '200' }]
		});
		expect(new URL(vi.mocked(fetch).mock.calls[0][0] as string).hostname).toBe('web.archive.org');
	});
});
it('decodes declared legacy charset and retains language negotiation', async () => {
	vi.stubGlobal(
		'fetch',
		vi.fn(
			async () =>
				new Response(new Uint8Array([0xe9]), {
					headers: { 'Content-Type': 'text/html; charset=windows-1252' }
				})
		)
	);
	const r = await fetchText('https://example.com');
	expect(r.body).toBe('é');
	const init = vi.mocked(fetch).mock.calls[0][1];
	expect(new Headers(init?.headers).get('Accept-Language')).toBe('en-US,en;q=0.9');
});

describe('Wayback degraded coverage', () => {
	it('recovers only homepage captures after a temporary source error', async () => {
		const mock = vi
			.fn()
			.mockResolvedValueOnce(new Response('', { status: 503 }))
			.mockResolvedValueOnce(new Response('20240101000000 https://example.com/ text/html 200\n'));
		vi.stubGlobal('fetch', mock);
		const result = await handleFootprint(
			new URL('https://local/api/footprint/wayback?domain=example.com&subdomains=true')
		);
		expect(result).toMatchObject({
			homepageOnly: true,
			truncated: true,
			records: [{ url: 'https://example.com/' }]
		});
		const fallback = new URL(mock.mock.calls[1][0]);
		expect(fallback.searchParams.get('url')).toBe('example.com/');
		expect(fallback.searchParams.get('limit')).toBe('5');
		expect(fallback.searchParams.has('collapse')).toBe(false);
	});
	it.each([403, 429])('does not retry an access or rate limit failure %s', async (status) => {
		const mock = vi.fn(async () => new Response('', { status }));
		vi.stubGlobal('fetch', mock);
		await expect(
			handleFootprint(new URL('https://local/api/footprint/wayback?domain=example.com'))
		).rejects.toThrow();
		expect(mock).toHaveBeenCalledTimes(1);
	});
	it('rejects an HTML error page returned with HTTP 200', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('<html>error</html>'))
		);
		await expect(
			handleFootprint(new URL('https://local/api/footprint/wayback?domain=example.com'))
		).rejects.toMatchObject({ status: 502 });
	});
});
