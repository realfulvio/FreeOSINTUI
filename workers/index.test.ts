import { describe, it, expect, vi } from 'vitest';
import worker from './index';
function env(success = true) {
	return {
		ASSETS: { fetch: vi.fn(async () => new Response('static')) },
		USERNAME_RATE_LIMITER: { limit: vi.fn(async () => ({ success })) },
		API_RATE_LIMITER: { limit: vi.fn(async () => ({ success })) }
	};
}
describe('routing', () => {
	it('serves static assets without API limiting', async () => {
		const bindings = env();
		const r = await worker.fetch(new Request('https://local/username'), bindings);
		expect(await r.text()).toBe('static');
		expect(bindings.API_RATE_LIMITER.limit).not.toHaveBeenCalled();
	});
	it('returns JSON 404 and never serves HTML for missing API', async () => {
		const bindings = env();
		const r = await worker.fetch(new Request('https://local/api/missing'), bindings);
		expect(r.status).toBe(404);
		expect(await r.json()).toEqual({ detail: 'Unknown endpoint.' });
		expect(bindings.ASSETS.fetch).not.toHaveBeenCalled();
	});
	it('limits API requests before external requests', async () => {
		const r = await worker.fetch(
			new Request('https://local/api/username/check?username=test&site=github'),
			env(false)
		);
		expect(r.status).toBe(429);
		expect(r.headers.get('Retry-After')).toBe('60');
	});
	it('keeps API methods and health explicit', async () => {
		expect(
			(await worker.fetch(new Request('https://local/api/health', { method: 'POST' }), env()))
				.status
		).toBe(405);
		const r = await worker.fetch(new Request('https://local/api/health'), env(false));
		expect(await r.json()).toEqual({ status: 'ok' });
	});
});
