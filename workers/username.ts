/** Modified 2026 by realfulvio: Workers port of FreeOSINT-UI by kerlo (Kerlooo).
 * WhatsMyName data: Micah Hoffman and contributors, CC BY-SA 4.0.
 */
import data from '../backend/data/wmn-data.json';
import { fetchText, HttpError } from './http';

export interface Site {
	id: string;
	name: string;
	category: string;
	uri_check: string;
	uri_pretty?: string;
	post_body?: string;
	headers: Record<string, string>;
	e_code: number;
	e_string: string;
	m_code: number;
	m_string: string;
	strip_bad_char: string;
	unreliable: boolean;
}
type RawSite = {
	name: string;
	uri_check: string;
	e_code: number;
	m_code: number;
	valid?: boolean;
	cat?: string;
	uri_pretty?: string;
	post_body?: string;
	headers?: Record<string, string>;
	e_string?: string;
	m_string?: string;
	strip_bad_char?: string;
	protection?: string[];
};
export function parseSites(input: { sites: RawSite[] }): Site[] {
	const seen = new Set<string>();
	return input.sites
		.filter((raw) => raw.valid !== false && /^https?:\/\//.test(raw.uri_check))
		.map((raw) => {
			const base =
				raw.name
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, '-')
					.replace(/^-|-$/g, '') || 'site';
			let id = base,
				n = 2;
			while (seen.has(id)) id = `${base}-${n++}`;
			seen.add(id);
			return {
				...raw,
				id,
				category: raw.cat ?? 'misc',
				headers: raw.headers ?? {},
				e_code: Number(raw.e_code),
				m_code: Number(raw.m_code),
				e_string: raw.e_string ?? '',
				m_string: raw.m_string ?? '',
				strip_bad_char: raw.strip_bad_char ?? '',
				unreliable: !!raw.protection?.length
			};
		});
}
export const sites = new Map(
	parseSites(data as { sites: RawSite[] }).map((site) => [site.id, site])
);
export function siteRequest(site: Site, username: string) {
	const account = [...username].filter((c) => !site.strip_bad_char.includes(c)).join('');
	const replace = (s: string) => s.replaceAll('{account}', account);
	const template = site.uri_pretty || (!site.post_body ? site.uri_check : undefined);
	return {
		account,
		check: replace(site.uri_check),
		body: site.post_body ? replace(site.post_body) : undefined,
		profile: template?.includes('{account}') ? replace(template) : null
	};
}
export function detect(site: Site, status: number, body: string): [string, string] {
	if (status === site.e_code && body.includes(site.e_string))
		return ['found', `HTTP ${status} and the profile marker is present`];
	if (status === site.m_code && (!site.m_string || body.includes(site.m_string)))
		return [
			'not_found',
			site.m_string
				? `HTTP ${status} and the 'not found' marker is present`
				: `HTTP ${status} (expected for missing accounts)`
		];
	if ([403, 429, 503].includes(status))
		return ['unknown', `HTTP ${status}: blocked or rate limited by the site`];
	return ['unknown', `HTTP ${status} did not match the expected responses`];
}
export async function handleUsername(url: URL): Promise<unknown> {
	if (url.pathname === '/api/username/sites')
		return {
			source: 'WhatsMyName',
			source_url: 'https://github.com/WebBreacher/WhatsMyName',
			license: 'CC BY-SA 4.0',
			sites: [...sites.values()].map(({ id, name, category, unreliable }) => ({
				id,
				name,
				category,
				unreliable
			}))
		};
	if (url.pathname !== '/api/username/check') throw new HttpError(404, 'Not found.');
	const username = url.searchParams.get('username') ?? '';
	if (!/^[A-Za-z0-9._-]{1,64}$/.test(username))
		throw new HttpError(422, "Invalid username: use letters, digits, '.', '_' or '-' (max 64).");
	const id = url.searchParams.get('site');
	if (id === null || id.length > 100) throw new HttpError(422, 'Invalid site.');
	const site = sites.get(id);
	if (!site) throw new HttpError(404, 'Unknown site.');
	const target = siteRequest(site, username);
	const result = {
		site: site.id,
		name: site.name,
		category: site.category,
		url: target.profile,
		http_status: null as number | null,
		status: 'error',
		reason: ''
	};
	if (!target.account)
		return {
			...result,
			reason: 'Username is empty once characters unsupported by this site are removed.'
		};
	try {
		const response = await fetchText(target.check, {
			method: target.body ? 'POST' : 'GET',
			headers: site.headers,
			body: target.body
		});
		result.http_status = response.status;
		[result.status, result.reason] = response.complete
			? detect(site, response.status, response.body)
			: ['unknown', 'The response exceeded the size limit; detection is inconclusive.'];
	} catch (error) {
		result.reason =
			error instanceof Error && /timeout|abort|in time/i.test(error.name + ' ' + error.message)
				? 'The site did not answer in time.'
				: 'Request failed (HTTPError).';
	}
	return result;
}
