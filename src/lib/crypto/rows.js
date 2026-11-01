// Modified 2026 by realfulvio; original attribution in NOTICE.
import { formatNumber, t } from '$lib/i18n/i18n.svelte.js';
import { checksumLabel, typeLabel } from './address.js';
import { formatAmount } from './format.js';

/** @typedef {typeof import('./chains.js').CHAINS.btc} Chain */

/**
 * Minute-precision UTC date, e.g. "2024-01-31 12:00 UTC".
 * @param {Date | null} date
 */
export function formatUtc(date) {
	return date ? date.toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : null;
}

/**
 * Rows describing what was detected from the address alone.
 * @param {{ type: string, checksumKind: 'eip55' | 'none' | 'bech32' | 'bech32m' | 'base58check' }} target
 * @param {{ name: string }} chain
 */
export function detectionRows(target, chain) {
	return [
		{ label: t('crypto.row.chain'), value: chain.name },
		{ label: t('crypto.row.type'), value: typeLabel(target.type) },
		{ label: t('crypto.row.checksum'), value: checksumLabel(target.checksumKind) }
	];
}

/**
 * Rows of the on-chain summary returned by traceAddress().
 * @param {Awaited<ReturnType<typeof import('./trace.js').traceAddress>>} data
 * @param {{ decimals: number, displayDecimals: number, symbol: string }} chain
 */
export function summaryRows(data, chain) {
	return [
		{
			label: t('crypto.row.balance'),
			value: data.balance === null ? t('crypto.unknown') : formatAmount(data.balance, chain)
		},
		{
			label: t('crypto.row.received'),
			value: data.received === null ? null : formatAmount(data.received, chain)
		},
		{
			label: t('crypto.row.sent'),
			value: data.sent === null ? null : formatAmount(data.sent, chain)
		},
		{
			label: t('crypto.row.txs'),
			value:
				data.txCount === null
					? t('crypto.unknown')
					: data.pendingTxCount
						? t('crypto.txCountUnconfirmed', {
								count: formatNumber(data.txCount),
								pending: formatNumber(data.pendingTxCount)
							})
						: formatNumber(data.txCount)
		},
		{ label: t('crypto.row.firstSeen'), value: formatUtc(data.firstSeen) },
		{ label: t('crypto.row.lastSeen'), value: formatUtc(data.lastSeen) },
		...data.extra
	];
}
