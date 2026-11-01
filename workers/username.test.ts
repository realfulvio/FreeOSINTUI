/** Modified Workers-port tests for FreeOSINT-UI by kerlo (Kerlooo). */
import { describe, expect, it, vi } from 'vitest';
import { detect, handleUsername, parseSites, siteRequest, sites } from './username';
vi.mock('./http', async (importOriginal) => ({
	...(await importOriginal<typeof import('./http')>()),
	fetchText: vi.fn()
}));
import { fetchText } from './http';
const raw = {
	name: 'Example',
	uri_check: 'https://example.com/{account}',
	e_code: 200,
	e_string: 'profile',
	m_code: 404,
	m_string: 'missing'
};
const site = parseSites({ sites: [raw] })[0];
describe('WhatsMyName rules', () => {
	it('requires status and marker and preserves rate limit uncertainty', () => {
		expect(detect(site, 200, 'profile')[0]).toBe('found');
		expect(detect(site, 200, 'other')[0]).toBe('unknown');
		expect(detect(site, 404, 'missing')[0]).toBe('not_found');
		expect(detect(site, 403, 'denied')[0]).toBe('unknown');
		expect(detect({ ...site, m_code: 302, m_string: '' }, 302, '')[0]).toBe('not_found');
	});
	it('filters unsupported sites, deduplicates IDs and keeps protection metadata', () => {
		expect(
			parseSites({
				sites: [
					raw,
					{ ...raw, name: 'Example!' },
					{ ...raw, name: 'Invalid', valid: false },
					{ ...raw, uri_check: 'ftp://bad' },
					{ ...raw, name: 'Protected', protection: ['captcha'] }
				]
			}).map((s) => [s.id, s.unreliable])
		).toEqual([
			['example', false],
			['example-2', false],
			['protected', true]
		]);
	});
	it('substitutes stripped account names and keeps API-only profiles null', () => {
		expect(siteRequest({ ...site, strip_bad_char: '.' }, 'john.doe').check).toBe(
			'https://example.com/johndoe'
		);
		expect(
			siteRequest(
				{ ...site, uri_check: 'https://example.com/api', post_body: '{"u":"{account}"}' },
				'john'
			)
		).toEqual({
			account: 'john',
			check: 'https://example.com/api',
			body: '{"u":"john"}',
			profile: null
		});
	});
	it('loads bundled IDs and credits', async () => {
		expect(sites.size).toBeGreaterThan(500);
		expect(sites.has('github-user')).toBe(true);
		expect(await handleUsername(new URL('https://local/api/username/sites'))).toMatchObject({
			source: 'WhatsMyName',
			license: 'CC BY-SA 4.0'
		});
	});
	it.each(['', 'a b', 'x/../y', 'a'.repeat(65)])(
		'rejects invalid username %j before any request',
		async (username) => {
			vi.mocked(fetchText).mockClear();
			await expect(
				handleUsername(
					new URL(
						`https://local/api/username/check?site=github-user&username=${encodeURIComponent(username)}`
					)
				)
			).rejects.toMatchObject({ status: 422 });
			expect(fetchText).not.toHaveBeenCalled();
		}
	);
	it('returns a full check response from a bounded fetch', async () => {
		vi.mocked(fetchText).mockResolvedValue({
			status: 429,
			body: 'blocked',
			headers: new Headers(),
			complete: true
		});
		expect(
			await handleUsername(
				new URL('https://local/api/username/check?site=github-user&username=synthetic_test')
			)
		).toMatchObject({ site: 'github-user', http_status: 429, status: 'unknown' });
	});
});

it('does not report a match from an incomplete body', async () => {
	vi.mocked(fetchText).mockResolvedValue({
		status: 200,
		body: 'profile',
		headers: new Headers(),
		complete: false
	});
	expect(
		await handleUsername(
			new URL('https://local/api/username/check?site=github-user&username=synthetic_test')
		)
	).toMatchObject({
		status: 'unknown',
		reason: 'The response exceeded the size limit; detection is inconclusive.'
	});
});
