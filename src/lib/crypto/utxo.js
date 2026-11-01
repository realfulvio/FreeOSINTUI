// Modified 2026 by realfulvio; original attribution in NOTICE.
import { collectSections, amount, count } from './coverage.js';
import { t } from '$lib/i18n/i18n.svelte.js';
import { fetchJson } from '$lib/net.js';

/**
 * Totals of an Esplora address stats object (confirmed + mempool), in satoshi.
 * @param {any} data response of /api/address/<address>
 */
export function summarizeUtxoStats(data) {
	const chain = data.chain_stats;
	const pool = data.mempool_stats;
	const received = amount(chain.funded_txo_sum) + amount(pool.funded_txo_sum);
	const sent = amount(chain.spent_txo_sum) + amount(pool.spent_txo_sum);
	return {
		balance: received - sent,
		received,
		sent,
		txCount: count(chain.tx_count) + count(pool.tx_count),
		pendingTxCount: count(pool.tx_count)
	};
}

/**
 * Describes an Esplora transaction from the point of view of one address:
 * net amount, direction and the addresses on the other side.
 * @param {any} tx
 * @param {string} address
 */
export function parseUtxoTx(tx, address) {
	if (typeof tx?.txid !== 'string' || !tx.txid || !Array.isArray(tx.vin) || !Array.isArray(tx.vout))
		throw new Error(t('crypto.invalidData'));
	const inputs = tx.vin.map((input) => ({
		address: input.prevout?.scriptpubkey_address ?? null,
		value: BigInt(input.prevout?.value ?? 0)
	}));
	const outputs = tx.vout.map((output) => ({
		address: output.scriptpubkey_address ?? null,
		value: BigInt(output.value ?? 0)
	}));

	const sum = (items) => items.reduce((total, item) => total + item.value, 0n);
	const sent = sum(inputs.filter((i) => i.address === address));
	const received = sum(outputs.filter((o) => o.address === address));
	const net = received - sent;

	const otherOutputs = outputs.filter((o) => o.address && o.address !== address);
	let direction;
	let counterparties;
	if (sent === 0n) {
		direction = 'in';
		counterparties = inputs.map((i) => i.address);
	} else if (!otherOutputs.length) {
		direction = 'self';
		counterparties = [];
	} else {
		direction = net < 0n ? 'out' : 'in';
		counterparties = otherOutputs.map((o) => o.address);
	}

	return {
		id: tx.txid,
		time: tx.status?.block_time ? new Date(tx.status.block_time * 1000) : null,
		confirmed: Boolean(tx.status?.confirmed),
		failed: false,
		coinbase: tx.vin.some((input) => input.is_coinbase),
		direction,
		amount: net < 0n ? -net : net,
		fee: tx.fee != null ? BigInt(tx.fee) : null,
		counterparties: [...new Set(counterparties.filter((a) => a && a !== address))]
	};
}

/**
 * Loads address totals and the latest transactions from an Esplora API.
 * @param {{ api: string }} chain
 * @param {string} address
 * @param {{ signal?: AbortSignal, fetch?: typeof fetch }} [options]
 */
export async function fetchUtxoAddress(chain, address, options = {}) {
	const base = `${chain.api}/address/${encodeURIComponent(address)}`;
	const sections = await collectSections(
		{
			summary: async () => summarizeUtxoStats(await fetchJson(base, options)),
			transactions: async () => {
				const txs = await fetchJson(`${base}/txs`, options);
				if (!Array.isArray(txs)) throw new Error(t('crypto.invalidData'));
				return txs.map((tx) => parseUtxoTx(tx, address));
			}
		},
		options.signal
	);
	return {
		...(sections.summary.value ?? {
			balance: null,
			received: null,
			sent: null,
			txCount: null,
			pendingTxCount: null
		}),
		extra: [],
		txs: sections.transactions.value ?? [],
		sections,
		hasMore: false
	};
}
