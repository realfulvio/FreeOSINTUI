// Modified 2026 by realfulvio; extracted from upstream parsers, original attribution in NOTICE.
import { detectFormat, IMAGE_FORMATS } from './magic.js';
import { readImageMetadata } from './image-reader.js';
import { parseOffice } from './office.js';
import { parsePdf } from './pdf.js';
import { checkFileSize } from './budget.js';
export async function readMetadata(file) {
	checkFileSize(file);
	const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
	const format = detectFormat(head);
	/** @type {import('./extract.js').RawMetadata} */
	const raw = {
		format,
		file: { name: file.name, size: file.size, type: file.type, lastModified: file.lastModified },
		image: null,
		pdf: null,
		office: null
	};
	if (format && IMAGE_FORMATS.has(format)) raw.image = await readImageMetadata(file, format);
	else if (format === 'pdf') raw.pdf = parsePdf(new Uint8Array(await file.arrayBuffer()));
	else if (format === 'zip') raw.office = parseOffice(new Uint8Array(await file.arrayBuffer()));
	return raw;
}
