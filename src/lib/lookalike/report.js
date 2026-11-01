// Modified 2026 by realfulvio; original attribution in NOTICE.
import { formatNumber, t } from '$lib/i18n/i18n.svelte.js';
import { createReport, list, section, table, text } from '$lib/export/report.js';
import { GENERATORS, countByType } from './generators.js';

/** @typedef {import('./generators.js').Candidate} Candidate */
/** @typedef {{ status: 'done', records: import('./resolve.js').DnsRecords } | { status: 'error', error: string }} Result */

/**
 * Builds the exported report of the Lookalike Domain Finder page. Registered names are
 * listed with their observed DNS records; names without observed DNS are only counted, per type.
 * @param {{
 *   target: { domain: string, unicode: string },
 *   candidates: Candidate[],
 *   runList: Candidate[],
 *   results: Record<string, Result>,
 *   stopped: boolean
 * }} state
 */
export function buildLookalikeReport({ target, candidates, runList, results, stopped }) {
	const input =
		target.unicode === target.domain ? target.domain : `${target.unicode} (${target.domain})`;
	const recordsOf = (/** @type {Candidate} */ candidate) => {
		const result = results[candidate.domain];
		return result?.status === 'done' ? result.records : null;
	};
	const registered = runList.filter((candidate) => recordsOf(candidate)?.hasDns);
	const failed = runList.filter((candidate) => results[candidate.domain]?.status === 'error');
	const done = runList.filter((candidate) => results[candidate.domain]).length;

	const progress = runList.length
		? [
				t('lookalike.progress', {
					done: formatNumber(done),
					total: formatNumber(runList.length),
					registered: formatNumber(registered.length),
					errors: formatNumber(failed.length)
				}),
				stopped ? t('lookalike.stopped') : ''
			]
				.filter(Boolean)
				.join(' ')
		: t('lookalike.noResults');

	const typeLabel = (/** @type {string} */ type) =>
		GENERATORS.find((generator) => generator.id === type)?.label ?? type;

	const generated = countByType(candidates);
	const byType = GENERATORS.filter((generator) => generated[generator.id]).map((generator) => {
		const run = runList.filter((candidate) => candidate.type === generator.id);
		return [
			generator.label,
			generated[generator.id],
			run.filter((candidate) => results[candidate.domain]).length,
			run.filter((candidate) => recordsOf(candidate)?.hasDns).length
		];
	});

	return createReport({
		tool: 'lookalike',
		input,
		sections: [
			section(
				t('lookalike.resultsHeading'),
				[
					text(
						`${t('lookalike.generated', { count: candidates.length, domain: target.unicode })} · ${progress}`
					),
					table(
						[
							t('lookalike.col.domain'),
							t('lookalike.col.type'),
							t('lookalike.col.a'),
							t('lookalike.col.mx'),
							t('lookalike.col.ns')
						],
						registered.map((candidate) => {
							const records = /** @type {import('./resolve.js').DnsRecords} */ (
								recordsOf(candidate)
							);
							return [
								candidate.unicode === candidate.domain
									? candidate.domain
									: `${candidate.unicode} (${candidate.domain})`,
								typeLabel(candidate.type),
								[...records.a, ...records.aaaa].join(', '),
								records.mx.join(', '),
								records.ns.join(', ')
							];
						})
					),
					runList.length > 0 && !registered.length && done === runList.length
						? text(t('lookalike.noneRegistered'))
						: null,
					list(
						failed.map(
							(candidate) =>
								`${candidate.domain}: ${t('lookalike.lookupError', {
									message: /** @type {{ error: string }} */ (results[candidate.domain]).error
								})}`
						),
						t('lookalike.report.failed')
					)
				],
				{ source: 'Google DNS-over-HTTPS', note: t('lookalike.dnsNote') }
			),
			section(t('lookalike.report.byType'), [
				table(
					[
						t('lookalike.col.type'),
						t('lookalike.report.generated'),
						t('lookalike.report.resolved'),
						t('lookalike.report.registered')
					],
					byType
				)
			])
		]
	});
}
