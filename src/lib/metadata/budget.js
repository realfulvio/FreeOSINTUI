import { Inflate, Unzlib } from 'fflate';
export const MAX_FILE_BYTES = 64 * 1024 * 1024;
export const MAX_ENTRY_BYTES = 4 * 1024 * 1024;
export const MAX_EXPANDED_BYTES = 16 * 1024 * 1024;
export class MetadataLimitError extends Error {
	constructor() {
		super('local.metadataLimit');
	}
}
export function checkFileSize(file) {
	if (file.size > MAX_FILE_BYTES) throw new MetadataLimitError();
}
export function joinChunks(chunks, size) {
	const output = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		output.set(chunk, offset);
		offset += chunk.length;
	}
	return output;
}
// Small compressed chunks bound temporary inflate output, too (DEFLATE expansion ~1032x).
export function inflateBounded(bytes, wrapped, budget) {
	const chunks = [];
	let size = 0;
	const decoder = new (wrapped ? Unzlib : Inflate)((chunk) => {
		size += chunk.length;
		budget.used += chunk.length;
		if (size > MAX_ENTRY_BYTES || budget.used > MAX_EXPANDED_BYTES) throw new MetadataLimitError();
		chunks.push(chunk);
	});
	for (let offset = 0; offset < bytes.length; offset += 1024)
		decoder.push(bytes.subarray(offset, offset + 1024), offset + 1024 >= bytes.length);
	return joinChunks(chunks, size);
}
