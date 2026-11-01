import { hashFile } from './compute.js';
self.onmessage = async ({ data }) => {
	try {
		const value = await hashFile(data, {
			onProgress: (value) => self.postMessage({ type: 'progress', value })
		});
		self.postMessage({ type: 'result', value });
	} catch (error) {
		self.postMessage({ type: 'error', message: error.message });
	}
};
