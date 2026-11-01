// Modified 2026 by realfulvio; original attribution in NOTICE.
import { t } from '$lib/i18n/i18n.svelte.js';
export { detectFormat, IMAGE_FORMATS } from './magic.js';
/**
 * Display name of a detected format, in the current language.
 * @param {string | null} format
 */
export function formatLabel(format) {
	return t(format ? `metadata.format.${format}` : 'metadata.format.unknown');
}
