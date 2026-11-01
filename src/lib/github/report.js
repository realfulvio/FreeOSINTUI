// Modified 2026 by realfulvio; original attribution in NOTICE.
import { formatNumber, t } from '$lib/i18n/i18n.svelte.js';
import { createReport, fields, list, stateSection, table, text } from '$lib/export/report.js';
import {
	formatDate,
	profileRows,
	summarizeGpgKeys,
	summarizeRepos,
	summarizeSshKeys
} from './analyze.js';

/** @typedef {{ status: 'idle' | 'loading' | 'done' | 'error', data?: any, error?: string }} SectionState */

/**
 * Builds the exported report of the GitHub OSINT page.
 * @param {{
 *   username: string,
 *   commitsPerRepo: number,
 *   sections: Record<'profile' | 'repos' | 'emails' | 'orgs' | 'keys', SectionState>
 * }} state
 */
export function buildGithubReport({ username, commitsPerRepo, sections }) {
	const { profile, repos, emails, orgs, keys } = sections;
	const source = 'api.github.com';
	const user = profile.status === 'done' ? profile.data : null;

	const reportSections = [
		stateSection(
			t('github.section.profile'),
			toState(profile),
			(data) => [fields(profileRows(data))],
			{
				source
			}
		)
	];
	// Like the page, the other sections exist only once the account is found.
	if (user) {
		reportSections.push(
			stateSection(
				t('github.section.repos'),
				toState(repos),
				(data) => repoBlocks(data, user.public_repos),
				{ source, isEmpty: (data) => !data?.length, emptyText: t('github.repos.none') }
			),
			stateSection(
				t('github.section.emails'),
				toState(emails),
				(data) => emailBlocks(data, commitsPerRepo),
				{ source, note: t('github.emails.note') }
			),
			stateSection(t('github.section.orgs'), toState(orgs), orgBlocks, {
				source,
				note: t('github.orgs.note'),
				isEmpty: (data) => !data?.length,
				emptyText: t('github.orgs.none')
			}),
			stateSection(t('github.section.keys'), toState(keys), keyBlocks, {
				source,
				note: t('github.keys.note')
			})
		);
	}

	return createReport({ tool: 'github', input: username, sections: reportSections });
}

/**
 * The page has an extra 'idle' status for sections not started yet: report them as loading.
 * @param {SectionState} state
 * @returns {{ status: 'loading' | 'done' | 'error', data?: any, error?: string }}
 */
function toState(state) {
	return state.status === 'idle' ? { status: 'loading' } : /** @type {any} */ (state);
}

/**
 * @param {any[]} repos
 * @param {number | undefined} publicCount
 */
function repoBlocks(repos, publicCount) {
	const summary = summarizeRepos(repos);
	return [
		fields([
			{
				label: t('github.repos.total', { count: summary.total }),
				value: formatNumber(summary.total)
			},
			{
				label: t('github.repos.sources', { count: summary.sources }),
				value: formatNumber(summary.sources)
			},
			{
				label: t('github.repos.forks', { count: summary.forks }),
				value: formatNumber(summary.forks)
			},
			{
				label: t('github.repos.archived', { count: summary.archived }),
				value: formatNumber(summary.archived)
			},
			{
				label: t('github.repos.stars', { count: summary.stars }),
				value: formatNumber(summary.stars)
			}
		]),
		publicCount &&
			publicCount > repos.length &&
			text(t('github.repos.partial', { shown: repos.length, total: formatNumber(publicCount) })),
		list(
			summary.languages
				.slice(0, 8)
				.map((language) => `${language.name}: ${language.count} · ${language.percent}%`),
			`${t('github.repos.languages')} ${t('github.repos.languagesHint')}`
		),
		list(
			summary.topics.map((topic) => `${topic.name} (${topic.count})`),
			t('github.repos.topics')
		),
		list(
			summary.mostStarred.map((repo) => ({
				text: `${repo.name} ★ ${formatNumber(repo.stargazers_count)}`,
				href: repo.html_url
			})),
			t('github.repos.mostStarred')
		),
		table(
			[
				t('github.repos.colRepo'),
				t('github.report.description'),
				t('github.repos.colLanguage'),
				'★',
				t('github.repos.colPush')
			],
			summary.recent.map((repo) => [
				{ text: repoLabel(repo), href: repo.html_url },
				repo.description,
				repo.language ?? '—',
				formatNumber(repo.stargazers_count),
				formatDate(repo.pushed_at).slice(0, 10)
			]),
			t('github.repos.recent')
		)
	];
}

/** @param {any} repo */
function repoLabel(repo) {
	const tags = [
		repo.fork && t('github.repos.fork'),
		repo.archived && t('github.repos.archivedTag')
	].filter(Boolean);
	return tags.length ? `${repo.name} (${tags.join(', ')})` : repo.name;
}

/**
 * @param {{ emails: import('./analyze.js').EmailSummary[], scanned: string[], failed?: {repo: string, error: string}[] }} data
 * @param {number} commitsPerRepo
 */
function emailBlocks({ emails, scanned, failed = [] }, commitsPerRepo) {
	if (!scanned.length) return [text(t('github.emails.noRepos'))];
	return [
		text(t('github.emails.scanned', { count: commitsPerRepo, repos: scanned.join(', ') })),
		...(failed.length
			? [
					text(
						t('github.emails.failed', {
							repos: failed.map((item) => `${item.repo}: ${item.error}`).join('; ')
						})
					)
				]
			: []),
		emails.length
			? table(
					[
						t('github.report.email'),
						t('github.report.attribution'),
						t('github.report.names'),
						t('github.report.occurrences'),
						t('github.report.lastCommit')
					],
					emails.map((entry) => [
						entry.email,
						[
							entry.noreply && t('github.emails.noreply'),
							t(entry.linked ? 'github.emails.linked' : 'github.emails.unlinked')
						]
							.filter(Boolean)
							.join(', '),
						entry.names.join(', '),
						t('github.emails.occurrences', { count: entry.commits, repos: entry.repos.join(', ') }),
						entry.url
							? { text: formatDate(entry.lastSeen) || entry.url, href: entry.url }
							: formatDate(entry.lastSeen)
					])
				)
			: text(t('github.emails.none'))
	];
}

/** @param {any[]} orgs */
function orgBlocks(orgs) {
	return [
		list(
			orgs.map((org) => ({
				text: org.description ? `${org.login}: ${org.description}` : org.login,
				href: `https://github.com/${org.login}`
			}))
		)
	];
}

/** @param {{ ssh: any[], gpg: any[] }} keys */
function keyBlocks({ ssh, gpg }) {
	const sshSummary = summarizeSshKeys(ssh);
	const gpgKeys = summarizeGpgKeys(gpg);
	const sshTitle = t('github.keys.ssh', { count: sshSummary.count });
	const gpgTitle = t('github.keys.gpg', { count: gpgKeys.length });
	return [
		sshSummary.count
			? list(
					sshSummary.keys.map((key) =>
						[
							`${key.type} …${key.tail}`,
							key.created && t('github.keys.added', { date: key.created })
						]
							.filter(Boolean)
							.join(' · ')
					),
					sshTitle
				)
			: text(t('github.keys.noSsh'), sshTitle),
		gpgKeys.length
			? list(
					gpgKeys.map((key) =>
						[
							key.keyId,
							key.revoked && t('github.keys.revoked'),
							key.canSign && t('github.keys.canSign'),
							t('github.keys.details', {
								created: key.created,
								expires: key.expires,
								subkeys: t('github.keys.subkeys', { count: key.subkeys })
							}),
							...key.emails.map(
								(item) =>
									`${item.email} (${t(item.verified ? 'github.keys.verified' : 'github.keys.unverified')})`
							)
						]
							.filter(Boolean)
							.join(' · ')
					),
					gpgTitle
				)
			: text(t('github.keys.noGpg'), gpgTitle)
	];
}
