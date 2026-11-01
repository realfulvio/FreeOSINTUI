import { toMarkdown } from './markdown.js';

/** @typedef {import('./report.js').Report} Report */
/** @typedef {{ fontBaseUrl: string }} RenderContext */

/** @param {Report} report */
export function toJson(report) {
	return `${JSON.stringify(report, null, 2)}\n`;
}

/**
 * Export formats offered by ExportMenu, in menu order; the first one is the default.
 * @type {{ id: 'pdf' | 'markdown' | 'json', extension: string, mime: string, render: (report: Report, context: RenderContext) => Promise<string | Uint8Array> | string }[]}
 */
export const FORMATS = [
	{
		id: 'pdf',
		extension: 'pdf',
		mime: 'application/pdf',
		// jsPDF and the fonts are only downloaded when a PDF is requested.
		render: async (report, { fontBaseUrl }) => {
			const { toPdf, fontLoader } = await import('./pdf.js');
			return toPdf(report, { loadFont: fontLoader(fontBaseUrl) });
		}
	},
	{ id: 'markdown', extension: 'md', mime: 'text/markdown;charset=utf-8', render: toMarkdown },
	{ id: 'json', extension: 'json', mime: 'application/json;charset=utf-8', render: toJson }
];

/** @param {string | null | undefined} id */
export function findFormat(id) {
	return FORMATS.find((format) => format.id === id) ?? FORMATS[0];
}

/**
 * Safe file name such as `tracepunk-ip-8.8.8.8-20261003-1952.pdf`.
 * @param {Report} report
 * @param {string} extension
 */
export function reportFilename(report, extension) {
	const slug = report.input
		.normalize('NFKD')
		.replace(/[^\w.@-]+/g, '-')
		.replace(/^[-.]+|[-.]+$/g, '')
		.slice(0, 60);
	const stamp = report.generatedAt.slice(0, 16).replace(/-|:/g, '').replace('T', '-');
	return ['tracepunk', report.tool, slug, stamp].filter(Boolean).join('-') + `.${extension}`;
}

/**
 * Saves text or bytes as a file through a temporary link (browser only).
 * @param {string} filename
 * @param {string | Uint8Array} content
 * @param {string} mime
 */
export function downloadFile(filename, content, mime) {
	const url = URL.createObjectURL(new Blob([/** @type {BlobPart} */ (content)], { type: mime }));
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.append(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 0);
}
