import { runLocalTask } from '$lib/local/task.js';
import { checkFileSize } from './budget.js';
export async function readMetadataLocal(file, options) {
	checkFileSize(file);
	return runLocalTask(
		() => new Worker(new URL('./metadata.worker.js', import.meta.url), { type: 'module' }),
		file,
		options
	);
}
