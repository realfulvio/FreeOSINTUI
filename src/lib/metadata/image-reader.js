// Modified 2026 by realfulvio; extracted from upstream parsers, original attribution in NOTICE.
import exifr from 'exifr';

/**
 * Image metadata (EXIF, GPS, XMP, IPTC, ICC) read with exifr's full build, which supports
 * JPEG, TIFF, PNG and HEIC/AVIF. WebP is not supported by exifr, so its EXIF and XMP
 * chunks are wrapped in a minimal JPEG container that exifr can read.
 */

/** exifr options: every segment we display, kept separate (mergeOutput: false). */
export const EXIFR_OPTIONS = {
	tiff: true,
	ifd0: true,
	ifd1: false,
	exif: true,
	gps: true,
	interop: false,
	xmp: true,
	iptc: true,
	icc: true,
	jfif: true,
	ihdr: true,
	makerNote: false,
	userComment: true,
	mergeOutput: false,
	translateKeys: true,
	translateValues: true,
	reviveValues: true,
	sanitize: true
};

/**
 * Collects the RIFF chunks of a WebP file.
 * @param {Uint8Array} bytes
 */
function webpChunks(bytes) {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	/** @type {Record<string, Uint8Array>} */
	const chunks = {};
	for (let i = 12; i + 8 <= bytes.length;) {
		const id = String.fromCharCode(...bytes.subarray(i, i + 4));
		const size = view.getUint32(i + 4, true);
		chunks[id] ??= bytes.subarray(i + 8, i + 8 + size);
		i += 8 + size + (size & 1);
	}
	return chunks;
}

/**
 * Wraps the EXIF and XMP chunks of a WebP file in a JPEG made of APP1 segments only,
 * so exifr can parse them. Returns null when the WebP has no metadata chunks.
 * @param {Uint8Array} bytes
 */
export function webpToJpegSegments(bytes) {
	const chunks = webpChunks(bytes);
	const encoder = new TextEncoder();
	/** @type {Uint8Array[]} */
	const parts = [new Uint8Array([0xff, 0xd8])];

	/** @param {Uint8Array} header @param {Uint8Array} data */
	const addSegment = (header, data) => {
		const length = header.length + data.length + 2;
		if (length > 0xffff) return;
		parts.push(new Uint8Array([0xff, 0xe1, length >> 8, length & 0xff]), header, data);
	};

	let exif = chunks.EXIF;
	if (exif) {
		// Some writers keep the JPEG-style "Exif\0\0" prefix inside the chunk.
		if (String.fromCharCode(...exif.subarray(0, 4)) === 'Exif') exif = exif.subarray(6);
		addSegment(encoder.encode('Exif\0\0'), exif);
	}
	if (chunks['XMP ']) addSegment(encoder.encode('http://ns.adobe.com/xap/1.0/\0'), chunks['XMP ']);
	if (parts.length === 1) return null;

	parts.push(new Uint8Array([0xff, 0xd9]));
	const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
}

/**
 * Parses image metadata. `input` is a File/Blob in the browser or bytes in tests.
 * Returns the exifr output grouped by segment, or {} when the image has no metadata.
 * @param {Blob | Uint8Array | ArrayBuffer} input
 * @param {string} format detected format (see detect.js)
 * @returns {Promise<Record<string, Record<string, unknown>>>}
 */
export async function readImageMetadata(input, format) {
	let source = input;
	if (format === 'webp') {
		const bytes =
			input instanceof Uint8Array
				? input
				: new Uint8Array(input instanceof ArrayBuffer ? input : await input.arrayBuffer());
		const wrapped = webpToJpegSegments(bytes);
		if (!wrapped) return {};
		source = wrapped;
	}
	const output = await exifr.parse(/** @type {any} */ (source), EXIFR_OPTIONS);
	return output ?? {};
}
