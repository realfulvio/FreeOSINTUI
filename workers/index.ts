// Cloudflare Workers entrypoint, added 2026 by realfulvio. See ../NOTICE.
import { HttpError } from './http';
import { handleFootprint } from './footprint';
import { handleUsername } from './username';
import { handleTelegram } from './telegram';
import { handleUrl } from './url';
import { handleReputation } from './reputation';
export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);
		if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
		const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
		try {
			if (request.method !== 'GET')
				return Response.json(
					{ detail: 'Method not allowed.' },
					{ status: 405, headers: { ...headers, Allow: 'GET' } }
				);
			if (url.href.length > 8192) throw new HttpError(414, 'Request URL too long.');
			if (url.pathname !== '/api/health' && url.pathname !== '/api/username/sites') {
				const limiter = url.pathname.startsWith('/api/username/')
					? env.USERNAME_RATE_LIMITER
					: env.API_RATE_LIMITER;
				const group = url.pathname.split('/')[2];
				const client = request.headers.get('CF-Connecting-IP') ?? 'local';
				const { success } = await limiter.limit({ key: `freeosintui:${group}:${client}` });
				if (!success)
					return Response.json(
						{ detail: 'Too many requests. Please wait a minute.' },
						{ status: 429, headers: { ...headers, 'Retry-After': '60' } }
					);
			}
			let result: unknown;
			if (url.pathname === '/api/health') result = { status: 'ok' };
			else if (url.pathname.startsWith('/api/username/')) result = await handleUsername(url);
			else if (url.pathname.startsWith('/api/telegram/')) result = await handleTelegram(url);
			else if (url.pathname.startsWith('/api/url/'))
				result = await handleUrl(url, env.ABUSECH_AUTH_KEY);
			else if (url.pathname.startsWith('/api/reputation/'))
				result = await handleReputation(url, env.ABUSECH_AUTH_KEY);
			else if (url.pathname.startsWith('/api/footprint/')) result = await handleFootprint(url);
			else throw new HttpError(404, 'Unknown endpoint.');
			return Response.json(result, { headers });
		} catch (error) {
			return Response.json(
				{
					detail:
						error instanceof HttpError ? error.message : 'The source returned an invalid response.'
				},
				{ status: error instanceof HttpError ? error.status : 502, headers }
			);
		}
	}
} satisfies ExportedHandler<Env>;
