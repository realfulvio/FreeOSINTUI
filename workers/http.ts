// Cloudflare port, modified 2026 by realfulvio. Original attribution: ../NOTICE.
export class HttpError extends Error {
	constructor(
		public status: number,
		message: string
	) {
		super(message);
	}
}
export interface TextResult {
	status: number;
	body: string;
	headers: Headers;
	complete: boolean;
}
/** Bounds both the streamed body and the whole request, including body reads. Never follow redirects. */
export async function fetchText(
	url: string,
	init: RequestInit = {},
	options: { maxBytes?: number; timeoutMs?: number } = {}
): Promise<TextResult> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 10000);
	const maxBytes = options.maxBytes ?? 512 * 1024;
	const headers = new Headers(init.headers);
	if (!headers.has('Accept'))
		headers.set('Accept', 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8');
	if (!headers.has('Accept-Language')) headers.set('Accept-Language', 'en-US,en;q=0.9');
	if (!headers.has('User-Agent'))
		headers.set('User-Agent', 'FreeOSINTUI/1.0 (+https://github.com/realfulvio/FreeOSINTUI)');
	try {
		const response = await fetch(url, {
			...init,
			headers,
			redirect: 'manual',
			signal: init.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal
		});
		const reader = response.body?.getReader();
		const chunks: Uint8Array[] = [];
		let size = 0;
		let complete = true;
		if (reader) {
			try {
				while (true) {
					const { value, done } = await reader.read();
					if (done) break;
					const remaining = maxBytes - size;
					chunks.push(value.subarray(0, remaining));
					size += Math.min(value.length, remaining);
					if (value.length > remaining || size >= maxBytes) {
						complete = false;
						break;
					}
				}
			} finally {
				await reader.cancel();
				reader.releaseLock();
			}
		}
		const bytes = new Uint8Array(size);
		let offset = 0;
		for (const chunk of chunks) {
			bytes.set(chunk, offset);
			offset += chunk.length;
		}
		let decoder: TextDecoder;
		const charset = /charset=["']?([^;\s"']+)/i.exec(
			response.headers.get('Content-Type') ?? ''
		)?.[1];
		try {
			decoder = new TextDecoder(charset ?? 'utf-8');
		} catch {
			decoder = new TextDecoder();
		}
		return {
			status: response.status,
			body: decoder.decode(bytes),
			headers: response.headers,
			complete
		};
	} catch (error) {
		if (error instanceof HttpError) throw error;
		throw new HttpError(
			controller.signal.aborted ? 504 : 502,
			controller.signal.aborted
				? 'The source did not answer in time.'
				: 'Could not reach the source.'
		);
	} finally {
		clearTimeout(timer);
	}
}
export function requireOk(result: TextResult, name: string) {
	if (result.status !== 200)
		throw new HttpError(
			result.status === 429 ? 429 : 502,
			`${name} answered with HTTP ${result.status}.`
		);
}
