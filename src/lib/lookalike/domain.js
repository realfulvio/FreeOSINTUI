// Modified 2026 by realfulvio; original attribution in NOTICE.
import { parse } from 'tldts';
import { t } from '$lib/i18n/i18n.svelte.js';
import { toAscii, toUnicode } from './punycode.js';

/**
 * Checks one ASCII label: 1 to 63 letters, digits or hyphens, no hyphen at either end,
 * and `--` in positions 3-4 only for `xn--` labels.
 * @param {string} label
 */
export function isValidLabel(label) {
	if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) return false;
	return label.slice(2, 4) !== '--' || label.startsWith('xn--');
}

/**
 * Checks a whole ASCII domain name.
 * @param {string} domain
 */
export function isValidDomain(domain) {
	const labels = domain.split('.');
	return domain.length <= 253 && labels.length >= 2 && labels.every(isValidLabel);
}

/**
 * Splits an ASCII hostname into subdomain, registrable name and public suffix.
 * @param {string} hostname
 */
export function splitDomain(hostname) {
	const result = parse(hostname, { allowPrivateDomains: true });
	return {
		subdomain: result.subdomain ?? '',
		name: result.domainWithoutSuffix ?? '',
		suffix: result.publicSuffix ?? ''
	};
}

/**
 * Normalizes user input to a registrable domain: strips scheme, path, port, `www.` and any
 * other subdomain, lowercases and converts IDN to Punycode.
 * @param {string} input
 * @returns {{ error: string } | { error?: undefined, domain: string, unicode: string, name: string, suffix: string }}
 */
export function parseDomain(input) {
	let raw = input.trim().toLowerCase();
	if (!raw) return { error: t('lookalike.error.empty') };
	raw = raw
		.replace(/^[a-z][a-z\d+.-]*:\/\//, '')
		.replace(/[/?#].*$/, '')
		.replace(/\.$/, '');
	let hostname;
	try {
		hostname = new URL(`http://${raw}`).hostname;
	} catch {
		return { error: t('lookalike.error.invalid') };
	}
	hostname = toAscii(hostname.replace(/^www\./, ''));
	if (/^[\d.]+$/.test(hostname) || hostname.startsWith('['))
		return { error: t('lookalike.error.ip') };
	if (!isValidDomain(hostname)) return { error: t('lookalike.error.invalid') };
	const { name, suffix } = splitDomain(hostname);
	if (!name) return { error: t('lookalike.error.suffixOnly') };
	const domain = `${name}.${suffix}`;
	return { domain, unicode: toUnicode(domain), name: toUnicode(name), suffix };
}
