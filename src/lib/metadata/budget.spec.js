import { describe, expect, it } from 'vitest';
import { zipSync, zlibSync } from 'fflate';
import { MAX_ENTRY_BYTES, MAX_EXPANDED_BYTES, MAX_FILE_BYTES, inflateBounded } from './budget.js';
import { readMetadata } from './reader.js';
import { parseOffice } from './office.js';
import { parsePdf } from './pdf.js';
const enc = new TextEncoder();
describe('local metadata resource budgets', () => {
	it('rejects oversized files before reading any bytes', async () => {
		await expect(
			readMetadata({
				size: MAX_FILE_BYTES + 1,
				slice() {
					throw new Error('read attempted');
				}
			})
		).rejects.toThrow('local.metadataLimit');
	});
	it('refuses a highly compressed Office metadata entry', () => {
		const zip = zipSync({
			'[Content_Types].xml': enc.encode('<Types/>'),
			'docProps/core.xml': new Uint8Array(MAX_ENTRY_BYTES + 1)
		});
		expect(() => parseOffice(zip)).toThrow('local.metadataLimit');
	});
	it('counts actual ZIP output even when declared size lies', () => {
		const zip = zipSync({ 'docProps/core.xml': new Uint8Array(MAX_ENTRY_BYTES + 1) });
		new DataView(zip.buffer).setUint32(22, 1, true);
		expect(() => parseOffice(zip)).toThrow('local.metadataLimit');
	});
	it('skips large non-metadata members without inflating them', () => {
		const zip = zipSync({
			'[Content_Types].xml': enc.encode('<Types/>'),
			'word/document.xml': new Uint8Array(MAX_ENTRY_BYTES + 1),
			'docProps/core.xml': enc.encode('<dc:creator>Test</dc:creator>')
		});
		expect(parseOffice(zip).core.creator).toBe('Test');
	});
	it('propagates PDF decompression limits instead of reporting missing metadata', () => {
		const compressed = zlibSync(new Uint8Array(MAX_ENTRY_BYTES + 1));
		const prefix = enc.encode(
			`%PDF-1.5\n1 0 obj << /Type /Metadata /Filter /FlateDecode /Length ${compressed.length} >>\nstream\n`
		);
		const suffix = enc.encode('\nendstream\nendobj');
		const pdf = new Uint8Array(prefix.length + compressed.length + suffix.length);
		pdf.set(prefix);
		pdf.set(compressed, prefix.length);
		pdf.set(suffix, prefix.length + compressed.length);
		expect(() => parsePdf(pdf)).toThrow('local.metadataLimit');
	});
	it('enforces the shared expanded byte budget across streams', () => {
		const budget = { used: MAX_EXPANDED_BYTES - 2 };
		expect(() => inflateBounded(zlibSync(enc.encode('four')), true, budget)).toThrow(
			'local.metadataLimit'
		);
	});
	it('limits cumulative Office output across otherwise acceptable entries', () => {
		const files = Object.fromEntries(
			[
				'docProps/core.xml',
				'docProps/app.xml',
				'docProps/custom.xml',
				'word/comments.xml',
				'ppt/commentAuthors.xml'
			].map((name) => [name, new Uint8Array(MAX_ENTRY_BYTES)])
		);
		expect(() => parseOffice(zipSync(files))).toThrow('local.metadataLimit');
	});
});
