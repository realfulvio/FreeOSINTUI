// Modified 2026 by realfulvio for Cloudflare Workers; original attribution in ../NOTICE.
/** Reputation sources ported from backend/app/reputation.py (upstream project attribution
 * and license remain in .github/LICENSE). Only fixed source URLs are ever fetched.
 * DNSBLs are deliberately excluded: public resolvers can turn refusal into false positives.
 */
import ipaddr from 'ipaddr.js';
import { fetchText, HttpError } from './http';

const TOR = 'https://check.torproject.org/torbulkexitlist';
const DROP = [
	'https://www.spamhaus.org/drop/drop_v4.json',
	'https://www.spamhaus.org/drop/drop_v6.json'
];
const HOST = 'https://urlhaus-api.abuse.ch/v1/host/';
const URL_LOOKUP = 'https://urlhaus-api.abuse.ch/v1/url/';
const FOX = 'https://threatfox-api.abuse.ch/api/v1/';
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_LINES = 100_000;
type IP = ipaddr.IPv4 | ipaddr.IPv6;
type Obj = Record<string, unknown>;
type List = { data: string[] | DropEntry[]; date: string | null };
type DropEntry = { cidr: string; sblid: string | null; rir: string | null };
const invalid = (name: string): never => {
	throw new HttpError(502, `${name} returned an invalid or incomplete response.`);
};
function object(value: unknown, name: string): Obj {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid(name);
	return value as Obj;
}
function json(body: string, name: string): Obj {
	try {
		return object(JSON.parse(body), name);
	} catch {
		return invalid(name);
	}
}
function ip(value: string): IP | null {
	value = value.trim();
	if (!value || value.length > 64 || value.includes('%')) return null;
	// ipaddr accepts historical shorthand/octal IPv4; the Python API does not.
	if (!value.includes(':') && !/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(value))
		return null;
	const tail =
		value.includes(':') && value.includes('.') ? value.slice(value.lastIndexOf(':') + 1) : null;
	if (tail && !/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(tail)) return null;
	try {
		return ipaddr.process(value);
	} catch {
		return null;
	}
}
function domain(value: string): string | null {
	value = value.trim().toLowerCase().replace(/\.+$/, '');
	return value.length <= 253 &&
		/^(?:[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/.test(value)
		? value
		: null;
}
function lookupUrl(value: string): string | null {
	value = value.trim();
	// eslint-disable-next-line no-control-regex -- Reject control characters before URL parsing.
	if (!value || value.length > 2048 || /[\s\x00-\x1f\x7f\\]/u.test(value)) return null;
	// Validate the original authority, before WHATWG can normalize shorthand IPs or missing slashes.
	const authority = /^https?:\/\/([^/?#]+)/i.exec(value)?.[1];
	if (!authority) return null;
	const hostPort = authority.slice(authority.lastIndexOf('@') + 1);
	const rawHost = hostPort.startsWith('[')
		? /^\[([^\]]+)\](?::\d*)?$/.exec(hostPort)?.[1]
		: /^([^:]+)(?::\d*)?$/.exec(hostPort)?.[1];
	if (!rawHost || (!ip(rawHost) && !domain(rawHost))) return null;
	try {
		new URL(value);
		return value;
	} catch {
		return null;
	}
}
function iso(value: string | number | null): string | null {
	if (value === null) return null;
	const d = new Date(value);
	return Number.isFinite(d.getTime()) ? d.toISOString().replace('.000Z', '+00:00') : null;
}
async function upstream(url: string, name: string, init?: RequestInit) {
	let result: Awaited<ReturnType<typeof fetchText>>;
	try {
		result = await fetchText(
			url,
			{ ...init, redirect: 'error' },
			{ maxBytes: MAX_BYTES, timeoutMs: 12_000 }
		);
	} catch (error) {
		if (
			(error instanceof HttpError && error.status === 504) ||
			(error instanceof Error && /timeout|abort/i.test(error.name))
		)
			throw new HttpError(504, `${name} did not answer in time.`);
		throw new HttpError(502, `Could not reach ${name}.`);
	}
	if ([401, 403].includes(result.status) && name.includes('abuse.ch'))
		throw new HttpError(502, `${name} rejected the Auth-Key (ABUSECH_AUTH_KEY).`);
	if (result.status !== 200)
		throw new HttpError(502, `${name} answered with HTTP ${result.status}.`);
	if (!result.complete || new TextEncoder().encode(result.body).length > MAX_BYTES) invalid(name);
	return result;
}
function lines(body: string, name: string): string[] {
	const result = body.split(/\r?\n/);
	if (result.length > MAX_LINES || result.some((line) => line.length > 8192)) invalid(name);
	return result.map((line) => line.trim()).filter(Boolean);
}
function parseTor(body: string): string[] {
	const addresses = new Set<string>();
	for (const line of lines(body, 'Tor')) {
		const text = line.split('#', 1)[0].trim();
		if (!text) continue;
		const address = ip(text);
		if (!address) return invalid('Tor');
		addresses.add(address.toString());
	}
	if (!addresses.size) invalid('Tor');
	return [...addresses];
}
function parseDrop(body: string, version: number): List {
	const entries: DropEntry[] = [];
	let date: string | null = null;
	let metadata = false;
	for (const line of lines(body, 'Spamhaus DROP')) {
		if (metadata) invalid('Spamhaus DROP');
		const entry = json(line, 'Spamhaus DROP');
		if (entry.type === 'metadata') {
			metadata = true;
			if (
				(typeof entry.timestamp !== 'number' && typeof entry.timestamp !== 'string') ||
				!Number.isFinite(Number(entry.timestamp))
			)
				invalid('Spamhaus DROP');
			date = iso(Number(entry.timestamp) * 1000);
			if (!date || (entry.records !== undefined && entry.records !== entries.length))
				invalid('Spamhaus DROP');
			continue;
		}
		if (typeof entry.cidr !== 'string') return invalid('Spamhaus DROP');
		const [address, prefix, ...rest] = entry.cidr.split('/');
		// Do not collapse IPv4-mapped IPv6 networks into IPv4.
		let parsed: IP;
		try {
			parsed = ipaddr.parse(address);
		} catch {
			return invalid('Spamhaus DROP');
		}
		if (
			rest.length ||
			!/^\d+$/.test(prefix || '') ||
			!ip(address) ||
			(parsed.kind() === 'ipv4' ? 4 : 6) !== version
		)
			invalid('Spamhaus DROP');
		const bits = Number(prefix);
		if (bits > (version === 4 ? 32 : 128)) invalid('Spamhaus DROP');
		const bytes = parsed
			.toByteArray()
			.map((byte, i) => byte & (i * 8 >= bits ? 0 : 255 << Math.max(0, 8 - (bits - i * 8))));
		if (
			(entry.sblid != null && typeof entry.sblid !== 'string') ||
			(entry.rir != null && typeof entry.rir !== 'string')
		)
			invalid('Spamhaus DROP');
		entries.push({
			cidr: `${ipaddr.fromByteArray(bytes).toString()}/${bits}`,
			sblid: (entry.sblid as string) ?? null,
			rir: (entry.rir as string) ?? null
		});
	}
	if (!metadata || !entries.length) invalid('Spamhaus DROP');
	return { data: entries, date };
}
async function list(source: 'tor' | 'drop'): Promise<List> {
	const cache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
	const key = new Request(`https://freeosint-cache.invalid/reputation/v1/${source}`);
	if (cache) {
		try {
			const hit = await cache.match(key);
			if (hit) return (await hit.json()) as List;
		} catch {
			/* Cache availability must not prevent an origin lookup. */
		}
	}
	let value: List;
	if (source === 'tor') {
		const result = await upstream(TOR, 'check.torproject.org');
		value = { data: parseTor(result.body), date: iso(result.headers.get('last-modified')) };
	} else {
		const results = await Promise.all(
			DROP.map(async (url, i) =>
				parseDrop((await upstream(url, 'spamhaus.org')).body, i === 0 ? 4 : 6)
			)
		);
		value = {
			data: results.flatMap((result) => result.data as DropEntry[]),
			date:
				results
					.map((result) => result.date)
					.filter((date): date is string => !!date)
					.sort()
					.at(-1) ?? null
		};
	}
	if (cache) {
		try {
			await cache.put(
				key,
				new Response(JSON.stringify(value), {
					headers: {
						'Content-Type': 'application/json',
						'Cache-Control': `public, max-age=${source === 'tor' ? 3600 : 43200}`
					}
				})
			);
		} catch {
			/* Return the validated response even if the cache write fails. */
		}
	}
	// Expired lists are never served as a current clean result when refresh fails.
	return value;
}
const empty = () => ({ status: 'not_listed', date: null, details: {} });
function strings(value: unknown, name: string): string[] {
	if (value == null) return [];
	if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) return invalid(name);
	return value.filter(Boolean);
}
function records(value: unknown, name: string): Obj[] {
	if (value == null) return [];
	if (!Array.isArray(value) || value.length > MAX_LINES) return invalid(name);
	return value.map((item) => object(item, name));
}
function text(value: unknown, name: string): string | null {
	if (value == null) return null;
	if (typeof value !== 'string') return invalid(name);
	return value;
}
function summarize(data: Obj, source: 'urlhaus' | 'threatfox', kind?: 'host' | 'url'): Obj {
	const name = source === 'urlhaus' ? 'URLhaus' : 'ThreatFox';
	if (
		data.query_status === 'no_results' ||
		(source === 'threatfox' && data.query_status === 'no_result')
	)
		return empty();
	if (data.query_status !== 'ok')
		throw new HttpError(
			502,
			`${name}: ${typeof data.query_status === 'string' ? data.query_status : 'invalid response'}`
		);
	if (source === 'threatfox') {
		const iocs = records(data.data, name);
		if (!iocs.length) return invalid(name);
		return {
			status: 'listed',
			date:
				iocs
					.map((i) => text(i.last_seen || i.first_seen, name) || '')
					.sort()
					.at(-1) || null,
			details: {
				count: iocs.length,
				iocs: iocs.slice(0, 10).map((i) => ({
					ioc: text(i.ioc, name),
					threat_type: text(i.threat_type_desc || i.threat_type, name),
					malware: text(i.malware_printable, name),
					confidence: i.confidence_level ?? null,
					first_seen: text(i.first_seen, name),
					last_seen: text(i.last_seen, name),
					tags: strings(i.tags, name).slice(0, 5)
				}))
			}
		};
	}
	if (kind === 'url')
		return {
			status: 'listed',
			date: text(data.last_online || data.date_added, name),
			reference: text(data.urlhaus_reference, name),
			details: {
				url_status: text(data.url_status, name),
				threat: text(data.threat, name),
				date_added: text(data.date_added, name),
				tags: strings(data.tags, name).slice(0, 10)
			}
		};
	const urls = records(data.urls, name);
	const count =
		typeof data.url_count === 'number' || typeof data.url_count === 'string'
			? Number(data.url_count)
			: NaN;
	return {
		status: 'listed',
		date:
			urls
				.map((u) => text(u.date_added, name) || '')
				.sort()
				.at(-1) || text(data.firstseen, name),
		reference: text(data.urlhaus_reference, name),
		details: {
			url_count: Number.isInteger(count) ? count : urls.length,
			online: urls.filter((u) => u.url_status === 'online').length,
			firstseen: text(data.firstseen, name),
			blacklists: Object.fromEntries(
				Object.entries(data.blacklists == null ? {} : object(data.blacklists, name)).filter(
					([, v]) => v
				)
			),
			threats: [...new Set(urls.map((u) => text(u.threat, name)).filter(Boolean))].sort(),
			tags: [...new Set(urls.flatMap((u) => strings(u.tags, name)))].sort().slice(0, 10)
		}
	};
}
export async function handleReputation(url: URL, authKey?: string): Promise<unknown> {
	const source = url.pathname.split('/').at(-1);
	if (source === 'tor' || source === 'drop') {
		const address = ip(url.searchParams.get('ip') || '');
		if (!address) throw new HttpError(422, 'Invalid IP address.');
		const cached = await list(source);
		if (source === 'tor')
			return {
				source,
				checked: address.toString(),
				status: (cached.data as string[]).includes(address.toString()) ? 'listed' : 'not_listed',
				date: cached.date,
				details: { exit_nodes: cached.data.length }
			};
		const match = (cached.data as DropEntry[]).find((entry) => {
			const [network, bits] = ipaddr.parseCIDR(entry.cidr);
			return address.kind() === network.kind() && address.match(network, bits);
		});
		return {
			source,
			checked: address.toString(),
			status: match ? 'listed' : 'not_listed',
			date: cached.date,
			details: match || {}
		};
	}
	if (source !== 'urlhaus' && source !== 'threatfox') throw new HttpError(404, 'Not Found');
	let checked: string | null, kind: 'host' | 'url' | undefined;
	if (source === 'urlhaus') {
		const host = url.searchParams.get('host'),
			value = url.searchParams.get('url');
		if ((host === null) === (value === null))
			throw new HttpError(422, "Pass exactly one of 'host' or 'url'.");
		kind = host === null ? 'url' : 'host';
		checked = host !== null ? ip(host)?.toString() || domain(host) : lookupUrl(value || '');
		if (!checked)
			throw new HttpError(
				422,
				kind === 'host'
					? 'Invalid host: expected an IP address or a domain name.'
					: 'Invalid URL: expected an http(s) URL of at most 2048 characters.'
			);
	} else {
		const term = url.searchParams.get('term') || '';
		checked = ip(term)?.toString() || domain(term) || lookupUrl(term);
		if (!checked)
			throw new HttpError(
				422,
				'Invalid search term: expected an IP address, a domain or an http(s) URL.'
			);
	}
	if (!authKey) return { source, checked, status: 'not_configured', date: null, details: {} };
	const endpoint = source === 'threatfox' ? FOX : kind === 'host' ? HOST : URL_LOOKUP;
	const result = await upstream(endpoint, new URL(endpoint).hostname, {
		method: 'POST',
		headers: {
			'Auth-Key': authKey,
			'Content-Type':
				source === 'threatfox' ? 'application/json' : 'application/x-www-form-urlencoded',
			Accept: 'application/json'
		},
		body:
			source === 'threatfox'
				? JSON.stringify({ query: 'search_ioc', search_term: checked })
				: new URLSearchParams({ [kind!]: checked }).toString()
	});
	return {
		source,
		checked,
		...(kind ? { kind } : {}),
		...summarize(json(result.body, source === 'urlhaus' ? 'URLhaus' : 'ThreatFox'), source, kind)
	};
}
