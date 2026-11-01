/** Supported languages, in the order shown by the language switch. */
export const LOCALES = [
	{ code: 'en', label: 'English', short: 'EN' },
	{ code: 'it', label: 'Italiano', short: 'IT' },
	{ code: 'fr', label: 'Français', short: 'FR' },
	{ code: 'ja', label: '日本語', short: 'JA' }
];

export const DEFAULT_LOCALE = 'en';

/**
 * A message is a string with `{name}` placeholders, or an object of plural forms
 * (`one`, `other`, ... as returned by Intl.PluralRules) selected by the `count` parameter.
 * @typedef {string | Record<string, string>} Message
 */

/**
 * Every file in `messages/` is one namespace: `messages/phone.js` exports
 * `{ en: { title: '...' }, it: {...}, fr: {...}, ja: {...} }` and its keys are read as `phone.title`.
 * @type {Record<string, { default: Record<string, Record<string, Message>> }>}
 */
const shared = import.meta.glob(
	[
		'./messages/common.js',
		'./messages/nav.js',
		'./messages/tools.js',
		'./messages/home.js',
		'./messages/backend.js',
		'./messages/export.js',
		'./messages/local.js',
		'./messages/dns.js'
	],
	{ eager: true }
);
const loaders = import.meta.glob('./messages/*.js');

/** @type {Record<string, Record<string, Message>>} locale -> flat key -> message */
export const MESSAGES = Object.fromEntries(LOCALES.map(({ code }) => [code, {}]));
const loaded = new Set();
/** @type {Map<string, Promise<void>>} */
const pending = new Map();

/** @param {string} path @param {{ default: Record<string, Record<string, Message>> }} module */
function register(path, module) {
	const namespace = path.slice(path.lastIndexOf('/') + 1, -'.js'.length);
	for (const { code } of LOCALES) {
		for (const [key, message] of Object.entries(module.default[code] ?? {})) {
			MESSAGES[code][`${namespace}.${key}`] = message;
		}
	}
	loaded.add(namespace);
}
for (const [path, module] of Object.entries(shared)) register(path, module);

/** Load all four languages for a namespace before rendering its tool.
 * Failed loads are retryable; overlapping navigation/preload calls share a promise.
 * @param {string} namespace
 */
export function loadNamespace(namespace) {
	if (loaded.has(namespace)) return Promise.resolve();
	const path = `./messages/${namespace}.js`;
	if (!loaders[path]) return Promise.resolve();
	if (!pending.has(namespace)) {
		pending.set(
			namespace,
			loaders[path]()
				.then((module) => {
					register(
						path,
						/** @type {{ default: Record<string, Record<string, Message>> }} */ (module)
					);
				})
				.finally(() => pending.delete(namespace))
		);
	}
	return pending.get(namespace);
}

/** @param {string} pathname */
export async function loadRouteMessages(pathname) {
	const namespace = pathname.split('/').filter(Boolean)[0] || 'home';
	// Shared analyzers/report builders sometimes use another tool's messages.
	const dependencies = {
		domain: ['dorks', 'footprint'],
		footprint: ['dorks'],
		hash: ['metadata'],
		headers: ['ip'],
		leaks: ['email'],
		reputation: ['email', 'ip'],
		url: ['ip']
	};
	const namespaces = [namespace, ...(dependencies[namespace] ?? [])];
	await Promise.all(namespaces.map(loadNamespace));
}

/** @param {string | null | undefined} code */
export function isLocale(code) {
	return LOCALES.some((locale) => locale.code === code);
}

/**
 * Picks the first supported language from a list such as `navigator.languages`.
 * @param {readonly string[]} languages
 */
export function matchLocale(languages) {
	for (const language of languages) {
		const code = language.toLowerCase().split('-')[0];
		if (isLocale(code)) return code;
	}
	return DEFAULT_LOCALE;
}

/**
 * Looks up a message and fills its placeholders. Falls back to English, then to the key.
 * @param {string} locale
 * @param {string} key
 * @param {Record<string, unknown>} [params]
 */
export function translate(locale, key, params = {}) {
	let message = MESSAGES[locale]?.[key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key;
	if (typeof message === 'object') {
		const form = new Intl.PluralRules(locale).select(Number(params.count ?? 0));
		message = message[form] ?? message.other ?? key;
	}
	return message.replace(/\{(\w+)\}/g, (match, name) =>
		name in params ? String(params[name]) : match
	);
}
