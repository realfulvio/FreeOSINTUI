// Modified 2026 by realfulvio for Cloudflare Workers; original attribution in NOTICE.
import { emptyFootprintMessage } from '$lib/footprint/coverage.js';
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
import { CC_INDEXES } from './commoncrawl.js';
import { GROUP_IDS } from './classify.js';
import { archiveUrl, timestampDay } from './merge.js';

/** @typedef {import('./merge.js').FootprintEntry} FootprintEntry */
/** @typedef {{ status: 'loading' | 'done' | 'error', data?: any, error?: string, backendDown?: boolean }} SectionState */

/**
 * Builds the exported report of the Passive Site Footprint page. Every merged URL is
 * exported (the page's type and text filters are ignored), one table per group and a
 * final table with all of them; links go to the archived copy, never the live site.
 * @param {{
 *   target: { domain: string, subdomains: boolean },
 *   cc: SectionState,
 *   wayback: SectionState,
 *   entries: FootprintEntry[],
 *   stats: ReturnType<typeof import('./stats.js').computeStats>,
 *   groups: Record<string, FootprintEntry[]>,
 *   subdomains: { host: string, count: number }[],
 *   params: { name: string, count: number }[]
 * }} state
 */
export function buildFootprintReport({
	target,
	cc,
	wayback,
	entries,
	stats,
	groups,
	subdomains,
	params
}) {
	const urls = (/** @type {number} */ count) => t('footprint.urls', { count, n: count });

	const sourceSections = [
		stateSection(
			t('footprint.source.commoncrawl'),
			cc,
			(/** @type {import('./commoncrawl.js').CcResult} */ data) => [
				list(
					data.indexes.map(
						(index) =>
							`${index.name}: ${
								index.error ??
								[
									t('footprint.captures', { count: index.count, n: index.count }),
									index.truncated ? t('footprint.limitReached') : ''
								]
									.filter(Boolean)
									.join(' ')
							}`
					)
				)
			],
			{ source: 'index.commoncrawl.org', note: t('footprint.cc.note', { count: CC_INDEXES }) }
		),
		stateSection(
			t('footprint.source.wayback'),
			wayback.status === 'error' && wayback.backendDown
				? {
						status: 'error',
						error: `${t('backend.down')} ${t('footprint.wayback.backendNeeded')}`
					}
				: wayback,
			(/** @type {{ records: any[], truncated: boolean }} */ data) => [
				text(
					[
						t('footprint.captures', { count: data.records.length, n: data.records.length }),
						data.truncated ? t('footprint.limitReached') : ''
					]
						.filter(Boolean)
						.join(' ')
				)
			],
			{ source: 'web.archive.org', note: t('footprint.wayback.note') }
		)
	];

	if (!entries.length) {
		return createReport({
			tool: 'footprint',
			input: scopeInput(target),
			sections: [
				...sourceSections,
				section(t('footprint.list.title'), [text(t(emptyFootprintMessage(cc, wayback)))])
			]
		});
	}

	const countRows = (/** @type {{ label: string, count: number }[]} */ rows) =>
		rows.map(({ label, count }) => ({ label, value: count }));

	return createReport({
		tool: 'footprint',
		input: scopeInput(target),
		sections: [
			...sourceSections,
			section(
				t('footprint.stats.title'),
				[
					text(`${stats.total} ${t('footprint.stats.total', { count: stats.total })}`),
					fields(
						countRows([
							{ label: t('footprint.stats.onlyCommoncrawl'), count: stats.bySource.commoncrawl },
							{ label: t('footprint.stats.onlyWayback'), count: stats.bySource.wayback },
							{ label: t('footprint.stats.both'), count: stats.bySource.both }
						]),
						t('footprint.stats.bySource')
					),
					fields(
						countRows(
							stats.byStatus.map(({ value, count }) => ({
								label: value ?? t('footprint.stats.unknown'),
								count
							}))
						),
						t('footprint.stats.byStatus')
					),
					fields(
						countRows([
							...stats.byMime.map(({ value, count }) => ({
								label: value ?? t('footprint.stats.unknown'),
								count
							})),
							...(stats.otherMime
								? [{ label: t('footprint.stats.other'), count: stats.otherMime }]
								: [])
						]),
						t('footprint.stats.byMime')
					),
					fields(
						countRows(stats.byYear.map(({ year, count }) => ({ label: year, count }))),
						t('footprint.stats.byYear')
					)
				],
				{ note: t('footprint.stats.note') }
			),
			section(
				t('footprint.list.title'),
				[
					...GROUP_IDS.flatMap((id) =>
						groups[id]?.length
							? [
									text(
										id === 'documents'
											? `${t(`footprint.groupHint.${id}`)} ${t('tools.metadata.name')}.`
											: t(`footprint.groupHint.${id}`),
										`${t(`footprint.group.${id}`)} (${groups[id].length})`
									),
									urlTable(groups[id])
								]
							: []
					),
					urlTable(entries, `${t('footprint.group.all')} (${entries.length})`)
				],
				{ note: t('footprint.list.hint') }
			),
			section(
				t('footprint.subdomains.title', { n: subdomains.length }),
				[
					subdomains.length
						? list(subdomains.map(({ host, count }) => `${host} (${urls(count)})`))
						: text(t('footprint.subdomains.empty'))
				],
				{ note: subdomains.length ? t('footprint.subdomains.hint') : undefined }
			),
			section(
				t('footprint.params.title', { n: params.length }),
				[
					params.length
						? list(params.map(({ name, count }) => `${name} (${urls(count)})`))
						: text(t('footprint.params.empty'))
				],
				{ note: params.length ? t('footprint.params.hint') : undefined }
			)
		]
	});
}

/**
 * Searched scope as typed on the page: `*.example.com` when subdomains are included.
 * @param {{ domain: string, subdomains: boolean }} target
 */
const scopeInput = (target) => (target.subdomains ? `*.${target.domain}` : target.domain);

/**
 * @param {FootprintEntry[]} entries
 * @param {string} [title]
 */
function urlTable(entries, title) {
	return table(
		[
			t('footprint.report.url'),
			t('footprint.report.seen'),
			t('footprint.report.status'),
			t('footprint.report.mime'),
			t('footprint.report.sources')
		],
		entries.map((entry) => {
			const first = timestampDay(entry.first);
			const last = timestampDay(entry.last);
			return [
				{ text: entry.url, href: archiveUrl(entry) },
				first === last ? first : t('footprint.list.seen', { first, last }),
				entry.status,
				entry.mime,
				entry.sources.map((source) => t(`footprint.sourceShort.${source}`)).join(' + ')
			];
		}),
		title
	);
}
