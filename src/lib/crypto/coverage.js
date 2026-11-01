import { t } from '$lib/i18n/i18n.svelte.js';
export async function collectSections(jobs, signal) {
	const entries = await Promise.all(
		Object.entries(jobs).map(async ([key, job]) => {
			try {
				return [key, { status: 'done', value: await job() }];
			} catch (error) {
				return [
					key,
					{ status: 'error', error: error instanceof Error ? error.message : String(error) }
				];
			}
		})
	);
	signal?.throwIfAborted();
	const sections = Object.fromEntries(entries);
	if (entries.every(([, section]) => section.status === 'error'))
		throw new Error(
			entries.map(([key, section]) => `${t(`crypto.section.${key}`)}: ${section.error}`).join('; ')
		);
	return sections;
}
export function count(value) {
	if (!/^[0-9]+$/.test(String(value)) || !Number.isSafeInteger(Number(value)))
		throw new Error(t('crypto.invalidData'));
	return Number(value);
}
export function amount(value) {
	if (
		!/^[0-9]+$/.test(String(value)) ||
		(typeof value === 'number' && !Number.isSafeInteger(value))
	)
		throw new Error(t('crypto.invalidData'));
	return BigInt(value);
}
export function coverageNotes(data) {
	const failures = Object.entries(data.sections ?? {}).filter(
		([, section]) => section.status === 'error'
	);
	return failures.map(
		([key, section]) => `${t('crypto.partial')}: ${t(`crypto.section.${key}`)} — ${section.error}`
	);
}
export function historyNote(data) {
	return t(data.historyComplete ? 'crypto.coverageComplete' : 'crypto.coveragePartial', {
		loaded: data.txs.length,
		total: data.txCount ?? t('crypto.unknown')
	});
}
