// Local browser jobs: cancellation terminates computation, not merely its UI updates.
export function runLocalTask(createWorker, payload, { signal, onProgress, timeout = 30000 } = {}) {
	return new Promise((resolve, reject) => {
		signal?.throwIfAborted();
		const worker = createWorker();
		let timer;
		let settled = false;
		const finish = (error, result) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			signal?.removeEventListener('abort', abort);
			worker.terminate();
			if (error) reject(error);
			else resolve(result);
		};
		const abort = () => finish(signal.reason ?? new DOMException('Aborted', 'AbortError'));
		signal?.addEventListener('abort', abort, { once: true });
		worker.onmessage = ({ data }) => {
			if (settled) return;
			if (data.type === 'progress') onProgress?.(data.value);
			else if (data.type === 'error') finish(new Error(data.message));
			else if (data.type === 'result') finish(null, data.value);
		};
		worker.onerror = () => finish(new Error('local.workerError'));
		worker.onmessageerror = () => finish(new Error('local.workerError'));
		if (timeout) timer = setTimeout(() => finish(new Error('local.timeout')), timeout);
		try {
			worker.postMessage(payload);
		} catch (error) {
			finish(error);
		}
	});
}
