import { describe, expect, it } from 'vitest';
import { traceAddress } from './trace.js';
import { buildCryptoReport } from './report.js';
import { toMarkdown } from '$lib/export/markdown.js';
import { CHAINS } from './chains.js';
const target = { chain: 'eth', address: '0xabc', type: 'evm', checksumKind: 'none' };
const info = { coin_balance: '42', is_contract: false };
const tx = {
	hash: '0x1',
	from: { hash: '0xdef' },
	to: { hash: '0xabc' },
	value: '2',
	timestamp: '2024-01-01T00:00:00Z',
	block_number: 1
};
const fetcher = (summary, counters, page) => async (url) => {
	const body = url.endsWith('/counters')
		? counters
		: url.endsWith('/transactions')
			? page
			: summary;
	return body instanceof Response ? body : Response.json(body);
};
const failure = () => new Response('unavailable', { status: 503 });
describe('partial blockchain coverage', () => {
	it('keeps balance and transactions when counters fail, without inventing zero or first activity', async () => {
		const data = await traceAddress(target, { fetch: fetcher(info, failure(), { items: [tx] }) });
		expect(data.balance).toBe(42n);
		expect(data.txCount).toBeNull();
		expect(data.firstSeen).toBeNull();
		expect(data.txs).toHaveLength(1);
		const report = toMarkdown(buildCryptoReport({ target, chain: CHAINS.eth, data, error: '' }));
		expect(report).toContain('Partial results');
		expect(report).toContain('Unknown');
		expect(report).toContain('0x1');
	});
	it('marks failed transactions as unavailable in reports, never as an empty history', async () => {
		const data = await traceAddress(target, {
			fetch: fetcher(info, { transactions_count: '1' }, failure())
		});
		const report = buildCryptoReport({ target, chain: CHAINS.eth, data, error: '' });
		expect(data.balance).toBe(42n);
		expect(report.sections[1].status).toBe('error');
		expect(toMarkdown(report)).not.toContain('No transactions found');
	});
	it('keeps transactions without a balance and rejects malformed counters', async () => {
		const data = await traceAddress(target, {
			fetch: fetcher({ maintenance: true }, { transactions_count: 'NaN' }, { items: [tx] })
		});
		expect(data.balance).toBeNull();
		expect(data.txCount).toBeNull();
		expect(data.sections.summary.status).toBe('error');
		expect(data.txs).toHaveLength(1);
	});
	it('does not call paginated history complete despite an inconsistent counter', async () => {
		const data = await traceAddress(target, {
			fetch: fetcher(
				info,
				{ transactions_count: '1' },
				{ items: [tx], next_page_params: { block_number: 1 } }
			)
		});
		expect(data.historyComplete).toBe(false);
		expect(data.firstSeen).toBeNull();
	});
	it('keeps total failure and cancellation as errors', async () => {
		await expect(
			traceAddress(target, { fetch: fetcher(failure(), failure(), failure()) })
		).rejects.toThrow();
		const controller = new AbortController();
		controller.abort();
		await expect(
			traceAddress(target, {
				signal: controller.signal,
				fetch: fetcher(info, { transactions_count: '0' }, { items: [] })
			})
		).rejects.toMatchObject({ name: 'AbortError' });
	});
	it('preserves a successful UTXO summary if transactions fail', async () => {
		const data = await traceAddress(
			{ chain: 'btc', address: 'fixture' },
			{
				fetch: async (url) =>
					url.endsWith('/txs')
						? failure()
						: Response.json({
								chain_stats: { funded_txo_sum: 100, spent_txo_sum: 0, tx_count: 1 },
								mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 0, tx_count: 0 }
							})
			}
		);
		expect(data.balance).toBe(100n);
		expect(data.sections.transactions.status).toBe('error');
		expect(data.historyComplete).toBe(false);
	});
	it('does not convert an unindexed EVM 404 into a zero balance', async () => {
		const data = await traceAddress(target, {
			fetch: fetcher(new Response('', { status: 404 }), { transactions_count: '0' }, { items: [] })
		});
		expect(data.balance).toBeNull();
		expect(data.sections.summary.status).toBe('error');
	});
	it('keeps UTXO transactions if totals are unavailable', async () => {
		const data = await traceAddress(
			{ chain: 'btc', address: 'fixture' },
			{
				fetch: async (url) =>
					url.endsWith('/txs')
						? Response.json([
								{ txid: 'abc', vin: [], vout: [], status: { confirmed: true, block_time: 1 } }
							])
						: failure()
			}
		);
		expect(data.balance).toBeNull();
		expect(data.txCount).toBeNull();
		expect(data.txs).toHaveLength(1);
		expect(data.firstSeen).toBeNull();
	});
	it('isolates malformed transaction data without discarding a valid balance', async () => {
		const data = await traceAddress(target, {
			fetch: fetcher(info, { transactions_count: '1' }, { items: [{}] })
		});
		expect(data.balance).toBe(42n);
		expect(data.sections.transactions.status).toBe('error');
	});
});
