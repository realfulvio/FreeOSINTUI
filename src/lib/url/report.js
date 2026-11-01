// Modified 2026 by realfulvio for Cloudflare Workers; original attribution in NOTICE.
import { t } from '$lib/i18n/i18n.svelte.js';
import {
	createReport,
	fields,
	list,
	section,
	stateSection,
	table,
	text
} from '$lib/export/report.js';
import { defang } from './refang.js';
import { overviewRows, urlhausRows } from './rows.js';
import { MAX_EXPAND_HOPS } from './shorteners.js';

/** @typedef {{ status: 'loading' | 'done' | 'error' | 'backend', data?: any, error?: string }} SectionState */

/**
 * Builds the exported report of the URL Analyzer page. URLs are written defanged, as the
 * page shows them, so the report can be shared without live links to the analyzed site.
 * @param {{
 *   result: any,
 *   showUrlscan: boolean,
 *   sections: Record<'expand' | 'urlscan' | 'urlhaus' | 'wayback', SectionState>
 * }} state `result` is a successful analyzeUrl() answer
 */
export function buildUrlReport({ result, showUrlscan, sections }) {
	return createReport({
		tool: 'url',
		input: result.defanged,
		sections: /** @type {import('$lib/export/report.js').ReportSection[]} */ (
			[
				section(
					t('url.findings.title'),
					[
						result.findings.length
							? list(
									result.findings.map(
										(/** @type {{ severity: string, message: string }} */ finding) =>
											`${t(`url.severity.${finding.severity}`)}: ${finding.message}`
									)
								)
							: text(t('url.findings.none'))
					],
					{ note: t('url.findings.note') }
				),
				section(t('url.overview.title'), [
					fields([
						...overviewRows(result),
						{ label: t('url.row.defanged'), value: result.defanged },
						{
							label: t('url.row.cleaned'),
							value: result.cleaned.removed.length ? defang(result.cleaned.url) : null
						}
					])
				]),
				result.embedded.length &&
					section(t('url.embedded.title'), embeddedBlocks(result), {
						note: t('url.embedded.note')
					}),
				section(t('url.params.title'), [
					result.params.length
						? table(
								[t('url.params.name'), t('url.params.value')],
								result.params.map(
									(
										/** @type {{ name: string, value: string, tracking: boolean, embedded: string | null }} */ param
									) => {
										const tags = [
											param.tracking && t('url.params.tracking'),
											param.embedded && t('url.params.embedded')
										].filter(Boolean);
										return [
											tags.length ? `${param.name} (${tags.join(', ')})` : param.name,
											param.value
										];
									}
								)
							)
						: text(t('url.params.empty'))
				]),
				result.shortener &&
					stateSection(t('url.expand.title'), withBackend(sections.expand), expandBlocks, {
						source: t('url.expand.source'),
						note: t('url.expand.note')
					}),
				showUrlscan &&
					stateSection(t('url.urlscan.title'), withBackend(sections.urlscan), urlscanBlocks, {
						source: 'urlscan.io',
						note: t('url.urlscan.note'),
						isEmpty: (data) => !data?.results?.length,
						emptyText: t('url.urlscan.empty')
					}),
				stateSection(t('url.urlhaus.title'), withBackend(sections.urlhaus), urlhausBlocks, {
					source: 'abuse.ch',
					note: t('url.urlhaus.note')
				}),
				stateSection(t('url.wayback.title'), withBackend(sections.wayback), waybackBlocks, {
					source: 'archive.org',
					note: t('url.wayback.note')
				})
			].filter(Boolean)
		)
	});
}

/**
 * The page's extra "backend" state becomes an error with the page's notice text.
 * @param {SectionState} state
 * @returns {{ status: 'loading' | 'done' | 'error', data?: any, error?: string }}
 */
function withBackend(state) {
	return state.status === 'backend'
		? {
				status: 'error',
				error: `${t('backend.down')} ${t('backend.needed')}`
			}
		: /** @type {any} */ (state);
}

/** Link texts end with an arrow on the page; the report keeps the words only. */
const linkText = (/** @type {string} */ value) => value.replace(/\s*↗$/, '');

/** @param {any} result */
function embeddedBlocks(result) {
	/** @type {{ param: string | null, source: string, url: string, encoding: string, redirectParam: boolean }[]} */
	const embedded = result.embedded;
	return [
		list(
			embedded.map((entry) => {
				const where =
					entry.source === 'wrapper'
						? t('url.embedded.wrapper')
						: t(`url.embedded.${entry.source}`, { param: entry.param ?? '' });
				const tags = [
					t(`url.encoding.${entry.encoding}`),
					entry.redirectParam ? t('url.embedded.redirect') : ''
				].filter(Boolean);
				return `${where} (${tags.join(', ')}): ${defang(entry.url)}`;
			})
		),
		result.chain.length > 1 &&
			fields([
				{ label: t('url.embedded.chain'), value: defang(result.chain[result.chain.length - 1]) }
			])
	];
}

/** @param {{ hops: { url: string, status: number }[], final: string | null, truncated: boolean }} data */
function expandBlocks(data) {
	return [
		list(
			data.hops.map((hop) => `${defang(hop.url)} (${t('url.expand.hop', { status: hop.status })})`)
		),
		data.final
			? fields([{ label: t('url.expand.final'), value: defang(data.final) }])
			: text(t('url.expand.noLocation')),
		data.final && data.truncated && text(t('url.expand.truncated', { count: MAX_EXPAND_HOPS }))
	];
}

/** @param {{ total: number, search_url: string, results: any[] }} data */
function urlscanBlocks(data) {
	return [
		text(t('url.urlscan.total', { count: data.total })),
		list(
			data.results.map((scan) => ({
				text: [
					scan.time,
					scan.malicious ? t('url.urlscan.malicious') : t('url.urlscan.noVerdict'),
					...(scan.tags ?? []),
					scan.status && `HTTP ${scan.status}`,
					scan.country,
					defang(scan.task_url ?? ''),
					scan.page_url && scan.page_url !== scan.task_url && `→ ${defang(scan.page_url)}`,
					scan.title
				]
					.filter(Boolean)
					.join(' · '),
				href: scan.result_url
			}))
		),
		list([{ text: linkText(t('url.urlscan.searchAll')), href: data.search_url }])
	];
}

/** @param {{ configured: boolean, listed?: boolean } & Record<string, any>} data */
function urlhausBlocks(data) {
	if (!data.configured) return [text(t('url.urlhaus.notConfigured'))];
	if (!data.listed) return [text(t('url.urlhaus.notListed'))];
	return [text(t('url.urlhaus.listed')), fields(urlhausRows(data))];
}

/** @param {{ snapshot: { url: string, date: string | null, status: string | null } | null, historyUrl: string }} data */
function waybackBlocks(data) {
	return [
		data.snapshot
			? fields([
					{ label: t('url.wayback.snapshot'), value: data.snapshot.url, href: data.snapshot.url },
					{ label: t('url.wayback.date'), value: data.snapshot.date },
					{ label: t('url.wayback.status'), value: data.snapshot.status }
				])
			: text(t('url.wayback.none')),
		list([{ text: t('url.wayback.history'), href: data.historyUrl }])
	];
}
