import { describe, expect, it, vi } from 'vitest';
import { ETH_RPC, fetchRpcBalance } from './rpc.js';
import { fetchEvmAddress } from './evm.js';
import { CHAINS } from './chains.js';
import { buildCryptoReport } from './report.js';
import { toMarkdown } from '$lib/export/markdown.js';
import { coverageNotes } from './coverage.js';
const address = '0x0000000000000000000000000000000000000001';
describe('Ethereum read-only fallback', () => {
	it('preserves exact wei and calls only eth_getBalance', async () => {
		const mock = vi.fn(async () =>
			Response.json({ jsonrpc: '2.0', id: 1, result: '0x20000000000001' })
		);
		expect(await fetchRpcBalance(address, { fetch: mock })).toBe('9007199254740993');
		expect(mock.mock.calls[0][0]).toBe(ETH_RPC);
		expect(JSON.parse(mock.mock.calls[0][1].body)).toEqual({
			jsonrpc: '2.0',
			id: 1,
			method: 'eth_getBalance',
			params: [address, 'latest']
		});
	});
	it.each([
		{ error: { code: -1 } },
		{ result: '0x' },
		{ result: '123' },
		{ result: '0x-1' },
		{ result: '0x1', id: 2 }
	])('rejects invalid RPC results %j', async (payload) => {
		await expect(
			fetchRpcBalance(address, {
				fetch: async () => Response.json({ jsonrpc: '2.0', id: 1, ...payload })
			})
		).rejects.toThrow();
	});
	it('keeps unknown history and account type when only RPC balance is available', async () => {
		const mock = vi.fn(async (url) =>
			url === ETH_RPC
				? Response.json({ jsonrpc: '2.0', id: 1, result: '0x0' })
				: new Response('', { status: 503 })
		);
		const data = await fetchEvmAddress(CHAINS.eth, address, { fetch: mock });
		expect(data.balance).toBe(0n);
		expect(data.txCount).toBeNull();
		expect(data.hasMore).toBe(true);
		expect(data.sections.transactions.status).toBe('error');
		expect(data.extra).not.toContainEqual(expect.objectContaining({ label: 'Account type' }));
		expect(coverageNotes(data).join(' ')).toContain('PublicNode');
		const report = buildCryptoReport({
			target: { chain: 'eth', address, type: 'account', checksumKind: 'none' },
			chain: CHAINS.eth,
			data,
			error: ''
		});
		expect(report.sections[0].source).toBe('ethereum-rpc.publicnode.com');
		expect(toMarkdown(report)).toContain('Balance recovered from PublicNode');
	});
	it.each([403, 404, 429])('does not fall back after HTTP %s', async (status) => {
		const mock = vi.fn(async () => new Response('', { status }));
		await expect(fetchEvmAddress(CHAINS.eth, address, { fetch: mock })).rejects.toThrow();
		expect(mock.mock.calls.some(([url]) => url === ETH_RPC)).toBe(false);
	});
	it('does not launch fallback after caller cancellation', async () => {
		const controller = new AbortController();
		const mock = vi.fn(async () => {
			controller.abort();
			throw new DOMException('Aborted', 'AbortError');
		});
		await expect(
			fetchEvmAddress(CHAINS.eth, address, { fetch: mock, signal: controller.signal })
		).rejects.toThrow();
		expect(mock.mock.calls.some(([url]) => url === ETH_RPC)).toBe(false);
	});
});
