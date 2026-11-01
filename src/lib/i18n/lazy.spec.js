import { afterAll, describe, expect, it, vi } from 'vitest';

vi.resetModules();
const { MESSAGES, LOCALES, loadNamespace, loadRouteMessages, translate } =
	await import('./catalog.js');
afterAll(() => vi.unstubAllEnvs());

const all = import.meta.glob('./messages/*.js', { eager: true });

describe('browser catalogue loading', () => {
	it('starts with shell messages, without tool-specific dictionaries', () => {
		expect(translate('it', 'nav.home')).toBe('Home');
		expect(MESSAGES.en['crypto.title']).toBeUndefined();
		expect(MESSAGES.en['headers.title']).toBeUndefined();
	});

	it('loads every language for direct entry and dependent report components', async () => {
		await loadRouteMessages('/reputation');
		for (const namespace of ['reputation', 'email', 'ip']) {
			for (const { code } of LOCALES) {
				for (const [key, value] of Object.entries(
					all[`./messages/${namespace}.js`].default[code]
				)) {
					expect(MESSAGES[code][`${namespace}.${key}`]).toEqual(value);
				}
			}
		}
	});

	it('deduplicates overlapping preloads and keeps earlier translations', async () => {
		const first = loadNamespace('crypto');
		expect(loadNamespace('crypto')).toBe(first);
		await first;
		await loadRouteMessages('/headers/');
		expect(MESSAGES.it['crypto.title']).toBe(all['./messages/crypto.js'].default.it.title);
		expect(MESSAGES.ja['headers.title']).toBe(all['./messages/headers.js'].default.ja.title);
	});

	it('preserves the complete catalogue after visiting all tools', async () => {
		await Promise.all(
			Object.keys(all).map((path) =>
				loadRouteMessages('/' + path.split('/').pop().replace('.js', ''))
			)
		);
		for (const [path, module] of Object.entries(all)) {
			const namespace = path.split('/').pop().replace('.js', '');
			for (const { code } of LOCALES) {
				for (const [key, value] of Object.entries(module.default[code])) {
					expect(MESSAGES[code][`${namespace}.${key}`]).toEqual(value);
				}
			}
		}
	});
});
