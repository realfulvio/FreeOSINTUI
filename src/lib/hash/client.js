import { runLocalTask } from '$lib/local/task.js';
export function hashFileLocal(file, options) {
	return runLocalTask(
		() => new Worker(new URL('./hash.worker.js', import.meta.url), { type: 'module' }),
		file,
		{ ...options, timeout: 0 }
	);
}
