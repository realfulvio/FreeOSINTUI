// Cloudflare port of backend/app/footprint.py. Original attribution: ../NOTICE.
import { fetchText, HttpError, requireOk } from './http';
const DOMAIN =
	/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;
export function parseCdx(body: string, complete = true) {
	const lines = body.split('\n');
	if (!complete) lines.pop();
	return lines.flatMap((line) => {
		const parts = line.trim().split(' ');
		if (parts.length < 4 || !/^\d{14}$/.test(parts[0])) return [];
		const status = parts.pop()!;
		const mime = parts.pop()!;
		const timestamp = parts.shift()!;
		const url = parts.join(' ');
		return url
			? [
					{
						timestamp,
						url,
						mime: ['-', 'unk', ''].includes(mime) ? null : mime,
						status: /^\d{3}$/.test(status) ? status : null
					}
				]
			: [];
	});
}
export async function handleFootprint(url: URL) {
	if (url.pathname !== '/api/footprint/wayback') throw new HttpError(404, 'Unknown endpoint.');
	const domain = (url.searchParams.get('domain') ?? '').trim().toLowerCase().replace(/\.$/, '');
	if (!DOMAIN.test(domain))
		throw new HttpError(422, 'Invalid domain: expected a hostname such as example.com.');
	const rawLimit = url.searchParams.get('limit') ?? '5000';
	if (!/^\d+$/.test(rawLimit) || +rawLimit < 1 || +rawLimit > 5000)
		throw new HttpError(422, 'Limit must be between 1 and 5000.');
	const sub = (url.searchParams.get('subdomains') ?? 'false').toLowerCase();
	if (!['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'].includes(sub))
		throw new HttpError(422, 'Invalid subdomains flag.');
	const subdomains = ['true', '1', 'yes', 'on'].includes(sub);
	const limit = +rawLimit;
	const query = new URLSearchParams({
		url: subdomains ? `*.${domain}` : `${domain}/*`,
		fl: 'timestamp,original,mimetype,statuscode',
		collapse: 'urlkey',
		limit: String(limit)
	});
	let homepageOnly = false;
	let fallbackError: string | undefined;
	const request = async () => {
		const response = await fetchText(
			`https://web.archive.org/cdx/search/cdx?${query}`,
			{},
			{ maxBytes: 2 * 1024 * 1024, timeoutMs: 15000 }
		);
		// Keep access/rate-limit failures out of the fallback path.
		if ([500, 502, 503, 504].includes(response.status))
			throw new HttpError(504, `web.archive.org HTTP ${response.status}`);
		requireOk(response, 'web.archive.org');
		return response;
	};
	let result;
	try {
		result = await request();
	} catch (error) {
		if (!(error instanceof HttpError) || error.status !== 504) throw error;
		fallbackError = error.message;
		homepageOnly = true;
		query.set('url', `${domain}/`);
		query.delete('collapse');
		query.set('limit', String(Math.min(limit, 5)));
		result = await request();
	}

	const records = parseCdx(result.body, result.complete).slice(0, limit);
	if (result.body.trim() && !records.length)
		throw new HttpError(502, 'Invalid Wayback CDX response.');
	return {
		domain,
		subdomains,
		limit,
		truncated: homepageOnly || !result.complete || records.length >= limit,
		...(homepageOnly ? { homepageOnly, fallbackError } : {}),
		records
	};
}
