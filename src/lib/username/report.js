// Modified 2026 by realfulvio; original attribution in NOTICE.
import { t } from '$lib/i18n/i18n.svelte.js';
import { createReport, fields, section, table, text } from '$lib/export/report.js';
import { STATUSES, groupByCategory, summarize } from './results.js';

/** @typedef {{ site: string, name: string, category: string, status: string, url: string | null, unreliable?: boolean }} Result */

/**
 * Builds the exported report of the Username Analyzer page: status counts and the found
 * accounts only, since listing hundreds of "not found" sites would bury them.
 * @param {{ username: string, total: number, scanning: boolean, results: Result[] }} state
 */
export function buildUsernameReport({ username, total, scanning, results }) {
	const counts = summarize(results);
	const found = groupByCategory(results, ['found']).flatMap((group) =>
		group.results.map((result) => [
			group.label,
			result.unreliable ? `${result.name} *` : result.name,
			result.url ? { text: result.url, href: result.url } : ''
		])
	);

	return createReport({
		tool: 'username',
		input: username,
		sections: [
			section(
				t('username.report.summary'),
				[
					fields([
						{
							label: t('username.sitesChecked'),
							value: `${results.length} / ${total}`
						},
						...STATUSES.map((status) => ({ label: status.label, value: counts[status.id] }))
					])
				],
				scanning
					? { note: t('username.report.running') }
					: results.length < total
						? { note: t('username.report.paused') }
						: {}
			),
			section(
				t('username.status.found'),
				[
					found.length
						? table(
								[
									t('username.report.category'),
									t('username.report.site'),
									t('username.report.profile')
								],
								found
							)
						: text(t('username.report.noneFound'))
				],
				{ source: 'WhatsMyName', note: t('username.falsePositives') }
			)
		]
	});
}
