import { loadRouteMessages } from '$lib/i18n/catalog.js';

export const prerender = true;

/** @type {import('./$types').LayoutLoad} */
export async function load({ url }) {
	await loadRouteMessages(url.pathname);
	return {};
}
