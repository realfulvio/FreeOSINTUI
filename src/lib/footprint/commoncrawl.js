import { fetchJson, fetchText } from '$lib/net.js';
import { t } from '$lib/i18n/i18n.svelte.js';
import { cdxPattern } from './normalize.js';

const BASE = 'https://index.commoncrawl.org';

/** How many of the latest crawls are queried, and how many captures each may return. */
export const CC_INDEXES = 3;
export const CC_LIMIT_PER_INDEX = 1500;

/** @typedef {{ timestamp: string, url: string, mime: string | null, status: string | null }} CaptureRecord */

/**
 * Reads the list of crawls from collinfo.json (newest first), keeping only well-formed ids.
 * @param {any} json
 * @returns {{ id: string, name: string }[]}
 */
export function parseCollections(json) {
	if (!Array.isArray(json)) return [];
	return json
		.filter((c) => typeof c?.id === 'string' && /^CC-MAIN-\d{4}-\d{2}$/.test(c.id))
		.map((c) => ({ id: c.id, name: typeof c.name === 'string' ? c.name : c.id }));
}

/**
 * Parses a Common Crawl index answer (NDJSON, one capture per line). Bad lines are skipped.
 * @param {string} text
 * @returns {CaptureRecord[]}
 */
export function parseCcNdjson(text) {
	/** @type {CaptureRecord[]} */
	const records = [];
	for (const line of (text ?? '').split('\n')) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		let row;
		try {
			row = JSON.parse(trimmed);
		} catch {
			continue;
		}
		if (typeof row?.url !== 'string' || !/^\d{14}$/.test(row.timestamp ?? '')) continue;
		records.push({
			timestamp: row.timestamp,
			url: row.url,
			mime: typeof row.mime === 'string' ? row.mime : null,
			status: typeof row.status === 'string' ? row.status : null
		});
	}
	return records;
}

/**
 * Index query URL for one crawl.
 * @param {string} id e.g. CC-MAIN-2026-39
 * @param {string} domain
 * @param {boolean} subdomains
 * @param {number} limit
 */
export function ccIndexUrl(id, domain, subdomains, limit) {
	const params = new URLSearchParams({
		url: cdxPattern(domain, subdomains),
		output: 'json',
		fl: 'timestamp,url,mime,status',
		limit: String(limit)
	});
	return `${BASE}/${id}-index?${params}`;
}

/**
 * Queries the latest crawls one after the other (the index server is shared and slow).
 * A failing crawl does not fail the others; if all fail, the first error is thrown.
 * `onProgress` receives the partial result after each crawl.
 * @param {string} domain
 * @param {{ subdomains?: boolean, indexes?: number, limit?: number, signal?: AbortSignal, fetch?: typeof fetch, onProgress?: (partial: CcResult) => void }} [options]
 * @returns {Promise<CcResult>}
 * @typedef {{ indexes: { id: string, name: string, count: number, truncated: boolean, error: string | null, warning?: string }[], records: CaptureRecord[], done: boolean }} CcResult
 */
export async function lookupCommonCrawl(domain, options = {}) {
	const {
		subdomains = false,
		indexes = CC_INDEXES,
		limit = CC_LIMIT_PER_INDEX,
		signal,
		fetch: fetchFn,
		onProgress
	} = options;
	const net = { signal, fetch: fetchFn };
	const collections = parseCollections(await fetchJson(`${BASE}/collinfo.json`, net)).slice(
		0,
		indexes
	);

	if (!collections.length) throw new Error('Invalid or empty Common Crawl collection list');
	/** @type {CcResult} */
	const result = { indexes: [], records: [], done: false };
	/** @type {unknown} */
	let firstError = null;
	for (const { id, name } of collections) {
		try {
			let text;
			let warning;
			const request = (max) =>
				fetchText(ccIndexUrl(id, domain, subdomains, max), {
					...net,
					timeoutMs: 15000,
					allowNotFound: true
				});
			try {
				text = await request(limit);
			} catch (error) {
				signal?.throwIfAborted();
				if (limit <= 5 || (error.status !== null && ![500, 502, 503, 504].includes(error.status)))
					throw error;
				text = await request(5);
				warning = t('footprint.reducedFallback', { error: error.message });
			}

			const records = parseCcNdjson(text ?? '');
			if (text?.trim() && !records.length) throw new Error('Invalid Common Crawl response');
			result.records.push(...records);
			result.indexes.push({
				id,
				name,
				count: records.length,
				truncated: Boolean(warning) || records.length >= limit,
				...(warning ? { warning } : {}),
				error: null
			});
		} catch (error) {
			if (signal?.aborted) throw error;
			firstError ??= error;
			const message = error instanceof Error ? error.message : String(error);
			result.indexes.push({ id, name, count: 0, truncated: false, error: message });
		}
		onProgress?.({ ...result, indexes: [...result.indexes], records: [...result.records] });
	}
	if (firstError && result.indexes.every((index) => index.error)) throw firstError;
	return { ...result, done: true };
}
