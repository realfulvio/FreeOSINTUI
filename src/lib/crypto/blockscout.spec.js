import { afterEach, expect, it, vi } from 'vitest';
import { fetchBlockscout } from './blockscout.js';
afterEach(() => vi.useRealTimers());
it('recovers once from a transient HTTP 500', async () => {
	vi.useFakeTimers();
	const mock = vi
		.fn()
		.mockResolvedValueOnce(new Response('', { status: 500 }))
		.mockResolvedValueOnce(Response.json({ ok: true }));
	const request = fetchBlockscout('https://eth.blockscout.com/api/v2/stats', { fetch: mock });
	await vi.advanceTimersByTimeAsync(1000);
	expect(await request).toEqual({ ok: true });
	expect(mock).toHaveBeenCalledTimes(2);
});
it('cancels during backoff without a second request', async () => {
	vi.useFakeTimers();
	const controller = new AbortController();
	const mock = vi.fn(async () => new Response('', { status: 503 }));
	const request = fetchBlockscout('https://eth.blockscout.com/api/v2/stats', {
		fetch: mock,
		signal: controller.signal
	});
	const assertion = expect(request).rejects.toThrow();
	await vi.advanceTimersByTimeAsync(10);
	controller.abort();
	await assertion;
	expect(mock).toHaveBeenCalledTimes(1);
});
it('never retries rate limits', async () => {
	const mock = vi.fn(async () => new Response('', { status: 429 }));
	await expect(
		fetchBlockscout('https://eth.blockscout.com/api/v2/stats', { fetch: mock })
	).rejects.toMatchObject({ status: 429 });
	expect(mock).toHaveBeenCalledTimes(1);
});
