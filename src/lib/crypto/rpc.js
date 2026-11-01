// Read-only Ethereum balance fallback; never sends transactions or requests a wallet.
export const ETH_RPC = 'https://ethereum-rpc.publicnode.com';
export async function fetchRpcBalance(address, options = {}) {
	const signal = options.signal
		? AbortSignal.any([options.signal, AbortSignal.timeout(10000)])
		: AbortSignal.timeout(10000);
	const response = await (options.fetch ?? fetch)(ETH_RPC, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		signal,
		body: JSON.stringify({
			jsonrpc: '2.0',
			id: 1,
			method: 'eth_getBalance',
			params: [address, 'latest']
		})
	});
	if (!response.ok) throw new Error(`PublicNode HTTP ${response.status}`);
	const data = await response.json();
	if (
		data?.jsonrpc !== '2.0' ||
		data.id !== 1 ||
		data.error ||
		!/^0x(?:0|[1-9a-f][0-9a-f]{0,63})$/i.test(data.result ?? '')
	)
		throw new Error('Invalid PublicNode balance response');
	return BigInt(data.result).toString();
}
