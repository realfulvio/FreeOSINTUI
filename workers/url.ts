/** Modified 2026-11-01: Workers port of backend/app/url.py and routers/url.py.
 * Original FreeOSINT-UI Copyright 2026 kerlo; see NOTICE and .github/LICENSE.
 * Only allow-listed shorteners and fixed provider APIs are ever contacted.
 */
import { fetchText, HttpError } from './http';

const SHORTENERS = new Set([
	'bit.ly',
	'bitly.com',
	't.co',
	'tinyurl.com',
	'goo.gl',
	'ow.ly',
	'is.gd',
	'buff.ly',
	'rebrand.ly',
	'cutt.ly',
	'shorturl.at',
	'www.shorturl.at',
	'rb.gy',
	't.ly',
	'tiny.cc',
	'lnkd.in',
	's.id'
]);
const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
const HOSTNAME =
	/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?=[a-z0-9-]*[a-z])[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])$/;
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const bad = (message: string): never => {
	throw new HttpError(422, message);
};
// eslint-disable-next-line no-control-regex -- Reject ASCII controls in untrusted URLs.
const badChars = (value: string) => /[\x00-\x20\x7f\\]/.test(value);
function checkLength(raw: string) {
	if (!raw || raw.length > 2048) bad('URL missing or too long.');
	if (badChars(raw)) bad('URL contains characters that are not allowed.');
}
export function validateShortUrl(raw: string): string {
	checkLength(raw);
	// eslint-disable-next-line no-control-regex -- Restrict shortener input to ASCII.
	if (/[^\x00-\x7f]/.test(raw)) bad('URL contains characters that are not allowed.');
	const parts = /^(https?):\/\/([^/?#]*)([^?#]*)(\?[^#]*)?(?:#.*)?$/i.exec(raw);
	if (!parts) return bad('Only http and https URLs can be expanded.');
	const authority = parts[2].toLowerCase();
	// Inspect the raw authority before WHATWG URL normalization (which erases default ports).
	if (authority.includes('@')) bad('URLs with user information cannot be expanded.');
	if (authority.includes(':')) bad('URLs with an explicit port cannot be expanded.');
	if (!SHORTENERS.has(authority)) bad('This host is not a supported URL shortener.');
	return `${parts[1].toLowerCase()}://${authority}${parts[3] || '/'}${parts[4] === '?' ? '' : parts[4] || ''}`;
}
export function validateScanHost(raw: string): string {
	const host = raw.trim().toLowerCase().replace(/\.+$/, '');
	if (raw.length <= 253 && (IPV4.test(host) || HOSTNAME.test(host))) return host;
	return bad('Invalid host: use an ASCII (punycode) hostname or an IPv4 address.');
}
export function validateLookupUrl(raw: string): string {
	checkLength(raw);
	if (!/^https?:\/\/[^/?#]+/i.test(raw)) bad('Only http and https URLs can be looked up.');
	// This value is submitted as form data, never fetched or normalized.
	return raw;
}
export function resolveLocation(base: string, location: string | null): string | null {
	if (!location) return null;
	try {
		const target = new URL(location.trim(), base);
		return ['http:', 'https:'].includes(target.protocol) ? target.href : null;
	} catch {
		return null;
	}
}
export function metaRefreshTarget(body: string): string | null {
	return (
		/<meta[^>]+http-equiv=["']?refresh["']?[^>]*content=["']?\s*\d+\s*;\s*url=([^"'>\s]+)/i
			.exec(body)?.[1]
			.replaceAll('&amp;', '&') ?? null
	);
}
function isShortener(raw: string | null): boolean {
	try {
		return raw !== null && Boolean(validateShortUrl(raw));
	} catch {
		return false;
	}
}
type ObjectData = Record<string, unknown>;
function object(value: unknown): ObjectData {
	return value && typeof value === 'object' && !Array.isArray(value) ? (value as ObjectData) : {};
}
const strings = (value: unknown): string[] =>
	Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
export function parseUrlscan(input: unknown) {
	const data = object(input);
	if (
		!input ||
		typeof input !== 'object' ||
		Array.isArray(input) ||
		(data.results != null && !Array.isArray(data.results))
	)
		throw new Error('Invalid response');
	const results = (Array.isArray(data.results) ? data.results : []).flatMap((entry) => {
		const item = object(entry),
			task = object(item.task),
			page = object(item.page),
			verdict = object(object(item.verdicts).overall);
		const uuid = item._id || task.uuid;
		if (typeof uuid !== 'string' || !/^[0-9a-f-]{36}$/.test(uuid)) return [];
		return [
			{
				uuid,
				time: task.time ?? null,
				task_url: task.url ?? null,
				page_url: page.url ?? null,
				page_domain: page.domain ?? null,
				ip: page.ip ?? null,
				country: page.country ?? null,
				status: page.status ?? null,
				title: page.title ?? null,
				malicious: verdict.malicious ?? null,
				score: verdict.score ?? null,
				tags: strings(task.tags).slice(0, 10),
				result_url: `https://urlscan.io/result/${uuid}/`,
				screenshot_url: `https://urlscan.io/screenshots/${uuid}.png`
			}
		];
	});
	return { total: data.total ?? results.length, results };
}
export function parseUrlhaus(input: unknown) {
	const data = object(input);
	if (data.query_status === 'no_results') return { configured: true, listed: false };
	if (data.query_status !== 'ok') throw new Error('Invalid URLhaus query status');
	return {
		configured: true,
		listed: true,
		url_status: data.url_status ?? null,
		threat: data.threat ?? null,
		tags: strings(data.tags),
		date_added: data.date_added ?? null,
		last_online: data.last_online ?? null,
		reference: data.urlhaus_reference ?? null,
		blacklists: Object.fromEntries(
			Object.entries(object(data.blacklists)).filter(([, value]) => typeof value === 'string')
		),
		payload_count: Array.isArray(data.payloads) ? data.payloads.length : 0
	};
}
async function send(name: string, url: string, init: RequestInit = {}, maxBytes?: number) {
	try {
		return await fetchText(url, { ...init, redirect: 'manual' }, { maxBytes });
	} catch (error) {
		const timeout =
			(error instanceof HttpError && error.status === 504) ||
			(error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name));
		throw new HttpError(
			timeout ? 504 : 502,
			timeout ? `${name} did not answer in time.` : `Could not reach ${name}.`
		);
	}
}
export async function handleUrl(url: URL, authKey?: string): Promise<unknown> {
	if (url.pathname === '/api/url/expand') {
		const short = validateShortUrl(url.searchParams.get('url') || '');
		let method = 'HEAD';
		let page = await send('The shortener', short, { method }, 64 * 1024);
		let location = page.headers.get('location');
		if ([405, 501].includes(page.status) || (page.status === 200 && !location)) {
			method = 'GET';
			page = await send('The shortener', short, { method }, 64 * 1024);
			location =
				REDIRECTS.has(page.status) && page.headers.get('location')
					? page.headers.get('location')
					: page.status === 200
						? metaRefreshTarget(page.body)
						: null;
		} else if (!REDIRECTS.has(page.status)) location = null;
		const target = resolveLocation(short, location);
		return {
			url: short,
			method,
			status: page.status,
			location: target,
			location_is_shortener: isShortener(target)
		};
	}
	if (url.pathname === '/api/url/urlscan') {
		const host = validateScanHost(url.searchParams.get('host') || '');
		const query = IPV4.test(host)
			? `page.ip:"${host}"`
			: `page.domain:${host} OR task.domain:${host}`;
		const page = await send(
			'urlscan.io',
			`https://urlscan.io/api/v1/search/?q=${encodeURIComponent(query)}&size=10`,
			{ headers: { Accept: 'application/json' } }
		);
		if (page.status === 429)
			throw new HttpError(429, 'urlscan.io is rate limiting requests. Try again in a minute.');
		if (page.status !== 200)
			throw new HttpError(502, `urlscan.io answered with HTTP ${page.status}.`);
		try {
			if (!page.complete) throw new Error('Truncated response');
			return {
				host,
				search_url: `https://urlscan.io/search/#${host}`,
				...parseUrlscan(JSON.parse(page.body))
			};
		} catch {
			throw new HttpError(502, 'urlscan.io returned an invalid response.');
		}
	}
	if (url.pathname === '/api/url/urlhaus') {
		const valid = validateLookupUrl(url.searchParams.get('url') || '');
		if (!authKey) return { configured: false };
		const page = await send('URLhaus', 'https://urlhaus-api.abuse.ch/v1/url/', {
			method: 'POST',
			headers: {
				'Auth-Key': authKey,
				'Content-Type': 'application/x-www-form-urlencoded',
				Accept: 'application/json'
			},
			body: new URLSearchParams({ url: valid }).toString()
		});
		if ([401, 403].includes(page.status))
			throw new HttpError(502, 'URLhaus rejected the configured Auth-Key.');
		if (page.status !== 200) throw new HttpError(502, `URLhaus answered with HTTP ${page.status}.`);
		try {
			if (!page.complete) throw new Error('Truncated response');
			return parseUrlhaus(JSON.parse(page.body));
		} catch {
			throw new HttpError(502, 'URLhaus returned an invalid response.');
		}
	}
	throw new HttpError(404, 'Not Found');
}
