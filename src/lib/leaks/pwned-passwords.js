// Modified 2026 by realfulvio; original attribution in NOTICE.
import { t } from '$lib/i18n/i18n.svelte.js';
import { FetchError, fetchText } from '$lib/net.js';

/**
 * Uppercase hex SHA-1 of a string, computed locally with Web Crypto.
 * @param {string} text
 */
export async function sha1Hex(text) {
	const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('')
		.toUpperCase();
}

/**
 * Splits a SHA-1 hash into the 5-character prefix sent to the API and the suffix kept locally.
 * @param {string} hash
 */
export function splitHash(hash) {
	const upper = hash.toUpperCase();
	return { prefix: upper.slice(0, 5), suffix: upper.slice(5) };
}

/**
 * Finds how many times a hash suffix appears in a range response ("SUFFIX:COUNT" per line).
 * Padding lines have a count of 0, so they never produce a false match.
 * @param {string} text
 * @param {string} suffix
 */
export function countInRange(text, suffix) {
	const wanted = suffix.toUpperCase();
	const lines = text.trim().split(/\r?\n/);
	let matches = 0;
	for (const line of lines) {
		const match = /^([A-F0-9]{35}):(\d+)$/i.exec(line.trim());
		if (!match || !Number.isSafeInteger(Number(match[2])))
			throw new FetchError(t('common.invalidResponse', { host: 'Have I Been Pwned' }));
		if (match[1].toUpperCase() === wanted) matches = Math.max(matches, Number(match[2]));
	}
	return matches;
}

/**
 * Checks a password against Have I Been Pwned with k-anonymity: only the first 5 hex
 * characters of its SHA-1 leave the browser.
 * @param {string} password
 * @param {{ signal?: AbortSignal, fetch?: typeof fetch }} [options]
 */
export async function checkPwnedPassword(password, options = {}) {
	const { prefix, suffix } = splitHash(await sha1Hex(password));
	const text = await fetchText(`https://api.pwnedpasswords.com/range/${prefix}`, {
		...options,
		headers: { 'Add-Padding': 'true' }
	});
	return { prefix, count: countInRange(text, suffix) };
}
