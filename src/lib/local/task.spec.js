import { afterEach, describe, expect, it, vi } from 'vitest';
import { runLocalTask } from './task.js';
afterEach(() => vi.useRealTimers());
const fake = () => ({ postMessage: vi.fn(), terminate: vi.fn(), onmessage: null });
describe('local computation lifecycle', () => {
	it('terminates on abort and ignores late results and progress', async () => {
		const worker = fake(),
			controller = new AbortController(),
			progress = vi.fn();
		const pending = runLocalTask(
			() => worker,
			{},
			{ signal: controller.signal, onProgress: progress }
		);
		controller.abort();
		worker.onmessage({ data: { type: 'progress', value: 1 } });
		worker.onmessage({ data: { type: 'result', value: 'stale' } });
		await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
		expect(worker.terminate).toHaveBeenCalledTimes(1);
		expect(progress).not.toHaveBeenCalled();
	});
	it('enforces the wall-clock budget even when the worker never replies', async () => {
		vi.useFakeTimers();
		const worker = fake();
		const pending = runLocalTask(() => worker, {});
		const rejected = expect(pending).rejects.toThrow('local.timeout');
		await vi.advanceTimersByTimeAsync(30000);
		await rejected;
		expect(worker.terminate).toHaveBeenCalledTimes(1);
	});
	it('cleans up after success and transports structured results', async () => {
		const worker = fake();
		const pending = runLocalTask(() => worker, { file: 'fixture' });
		worker.onmessage({ data: { type: 'result', value: { hash: 'abc' } } });
		await expect(pending).resolves.toEqual({ hash: 'abc' });
		expect(worker.terminate).toHaveBeenCalledTimes(1);
	});
});
