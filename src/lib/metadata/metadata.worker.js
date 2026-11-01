import { readMetadata } from './reader.js';
self.onmessage = async ({ data }) => {
	try {
		self.postMessage({ type: 'result', value: await readMetadata(data) });
	} catch (error) {
		self.postMessage({ type: 'error', message: error.message });
	}
};
