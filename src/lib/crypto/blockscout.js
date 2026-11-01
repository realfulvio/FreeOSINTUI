import { fetchJson } from '$lib/net.js';

/** Retry a temporary server failure once, preserving access and rate-limit errors. */
export async function fetchBlockscout(url, options = {}) {
	try {
		return await fetchJson(url, options);
	} catch (error) {
		options.signal?.throwIfAborted();
		if (![500, 502, 503, 504].includes(error.status)) throw error;
		await new Promise((resolve, reject) => {
			const signal = options.signal;
			const abort = () => {
				clearTimeout(timer);
				reject(signal.reason);
			};
			const timer = setTimeout(() => {
				signal?.removeEventListener('abort', abort);
				resolve();
			}, 1000);
			signal?.addEventListener('abort', abort, { once: true });
			if (signal?.aborted) abort();
		});
		options.signal?.throwIfAborted();
		return fetchJson(url, options);
	}
}
