// Modified 2026 by realfulvio; original attribution in NOTICE.
import { coverageNotes, historyNote } from './coverage.js';
import { t } from '$lib/i18n/i18n.svelte.js';
import { createReport, fields, list, stateSection, table, text } from '$lib/export/report.js';
import { formatAmount } from './format.js';
import { detectionRows, formatUtc, summaryRows } from './rows.js';

/** Counterparties written per transaction, as on the page. */
const SHOWN_COUNTERPARTIES = 3;

/**
 * Builds the exported report of the Crypto Tracer page. Every loaded transaction is
 * exported, not only the ones shown on the page.
 * @param {{
 *   target: { chain: 'btc' | 'ltc' | 'eth', address: string, type: string, checksumKind: 'eip55' | 'none' | 'bech32' | 'bech32m' | 'base58check' },
 *   chain: typeof import('./chains.js').CHAINS.btc,
 *   data: Awaited<ReturnType<typeof import('./trace.js').traceAddress>> | null,
 *   error: string
 * }} state
 */
export function buildCryptoReport({ target, chain, data, error }) {
	/** @type {{ status: 'loading' | 'done' | 'error', data?: any, error?: string }} */
	const trace = data
		? { status: 'done', data }
		: error
			? { status: 'error', error }
			: { status: 'loading' };
	const source = new URL(chain.api).host;

	return createReport({
		tool: 'crypto',
		input: target.address,
		sections: [
			stateSection(
				t('crypto.summary'),
				trace,
				(loaded) => [
					...coverageNotes(loaded).map((note) => text(note)),
					text(historyNote(loaded)),
					fields([
						{ label: t('crypto.addressHeading'), value: target.address },
						...detectionRows(target, chain),
						...summaryRows(loaded, chain)
					]),
					list(
						chain.explorers.map((explorer) => ({
							text: explorer.name,
							href: explorer.address(target.address)
						}))
					)
				],
				{ source }
			),
			stateSection(
				t('crypto.latestTxs'),
				data?.sections?.transactions.status === 'error'
					? { status: 'error', error: data.sections.transactions.error }
					: trace,
				(loaded) => [...txBlocks(loaded.txs, target, chain), text(historyNote(loaded))],
				{
					source,
					emptyText: t('crypto.noTxs'),
					isEmpty: (loaded) => !loaded.txs.length
				}
			)
		]
	});
}

/**
 * @param {{ id: string, time: Date | null, confirmed: boolean, failed: boolean, coinbase: boolean, direction: string, amount: bigint, method?: string | null, counterparties: string[] }[]} txs
 * @param {{ chain: string }} target
 * @param {typeof import('./chains.js').CHAINS.btc} chain
 */
function txBlocks(txs, target, chain) {
	const rows = txs.map((tx) => {
		const sign = tx.direction === 'out' ? '-' : tx.direction === 'in' ? '+' : '';
		const tags = [
			tx.failed && t('crypto.tx.failed'),
			!tx.confirmed && t('crypto.tx.unconfirmed'),
			tx.coinbase && t('crypto.tx.coinbase'),
			tx.method
		].filter(Boolean);
		const extra = tx.counterparties.length - SHOWN_COUNTERPARTIES;
		const parties = tx.counterparties.slice(0, SHOWN_COUNTERPARTIES).join(', ');
		return [
			{ text: tx.id, href: chain.explorers[0].tx(tx.id) },
			formatUtc(tx.time) ?? t('crypto.tx.pending'),
			[t(`crypto.tx.${tx.direction}`), ...tags].join(' · '),
			sign + formatAmount(tx.amount, chain),
			extra > 0 ? `${parties} ${t('crypto.tx.more', { count: extra })}` : parties
		];
	});
	return [
		table(
			[
				t('crypto.col.tx'),
				t('crypto.col.date'),
				t('crypto.col.direction'),
				t('crypto.col.amount'),
				t('crypto.col.counterparties')
			],
			rows
		),
		target.chain === 'eth' && text(t('crypto.ethNativeOnly'))
	];
}
