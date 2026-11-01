/** Modified Workers-port fixture tests for FreeOSINT-UI by kerlo (Kerlooo). */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
let runtime: Miniflare;
beforeAll(async () => {
	const bundle = await build({
		stdin: {
			contents: `import {parseProfile,parseChannelPosts,handleTelegram} from './telegram';
 export default {async fetch(request) { const {html,username,kind,limit}=await request.json();
 const originalFetch = globalThis.fetch;
 if(kind === 'truncatedProfile' || kind === 'truncatedPosts') globalThis.fetch = async (url) => new Response(kind === 'truncatedPosts' && !String(url).includes('/s/') ? html : 'x'.repeat(600000));
 try {return Response.json(kind==='invalid' || kind==='truncatedProfile' || kind==='truncatedPosts' ? await handleTelegram(new URL('https://local/api/telegram/'+username)) : kind==='posts' ? await parseChannelPosts(html,limit) : await parseProfile(html,username));}
 catch(e){return Response.json({status:e.status,message:e.message});} finally {globalThis.fetch = originalFetch;} }};`,
			resolveDir: fileURLToPath(new URL('.', import.meta.url)),
			loader: 'ts'
		},
		bundle: true,
		write: false,
		format: 'esm',
		platform: 'browser'
	});
	runtime = new Miniflare(
		convertV4MiniflareOptions({
			workers: [
				{
					name: 'telegram-tests',
					modules: true,
					script: bundle.outputFiles[0].text,
					compatibilityDate: '2026-10-23'
				}
			]
		})
	);
}, 30000);
afterAll(async () => {
	await runtime?.dispose();
});
async function parse(input: Record<string, unknown>) {
	return (
		await runtime.dispatchFetch('https://local/', { method: 'POST', body: JSON.stringify(input) })
	).json() as Promise<{
		image?: string;
		counters: Record<string, string>;
		posts: { id: string; text: string; [key: string]: unknown }[];
		[key: string]: unknown;
	}>;
}
async function fixture(name: string) {
	return readFile(new URL(`../backend/tests/fixtures/${name}.html`, import.meta.url), 'utf8');
}
describe('native Telegram parser', () => {
	it.each([
		['channel', 'durov', 'channel', 'Pavel Durov'],
		['group', 'python', 'group', 'Python'],
		['user', 'levlam', 'user', 'Aliaksei Levin'],
		['bot', 'BotFather', 'bot', 'BotFather']
	])('parses %s fixture', async (file, username, type, title) => {
		expect(await parse({ html: await fixture(file), username })).toMatchObject({
			exists: true,
			type,
			title
		});
	});
	it('preserves verified marker, nested extra leaves and public image', async () => {
		const profile = await parse({ html: await fixture('channel'), username: 'durov' });
		expect(profile).toMatchObject({
			verified: true,
			description: 'Founder of Telegram.',
			extra: ['10 590 827 subscribers'],
			has_preview: true
		});
		expect(profile.image).toMatch(/^https:\/\/cdn4.telesco.pe\//);
	});
	it('handles missing accounts', async () => {
		expect(await parse({ html: await fixture('not_found'), username: 'synthetic' })).toMatchObject({
			exists: false,
			title: null,
			type: null
		});
	});
	it('decodes entities and preserves line breaks in text', async () => {
		expect(
			await parse({
				username: 'synthetic',
				html: '<div class="tgme_page_title">A &amp; B</div><div class="tgme_page_description">First&nbsp;line<br>Second &#128512;</div><div class="tgme_page_extra">Outer<div class="tgme_page_extra">42 members</div></div>'
			})
		).toMatchObject({
			title: 'A & B',
			description: 'First line\nSecond 😀',
			extra: ['42 members'],
			type: 'group'
		});
	});
	it('extracts posts newest first with counters, dates, media and limits', async () => {
		const result = await parse({ html: await fixture('channel_posts'), kind: 'posts' });
		expect(result.counters.subscribers).toBe('9.44M');
		expect(result.posts.map((p: { id: string }) => p.id)).toEqual([
			'telegram/460',
			'telegram/459',
			'telegram/441'
		]);
		expect(result.posts[2]).toMatchObject({
			url: 'https://t.me/telegram/441',
			date: '2026-05-14T16:08:31+00:00',
			views: '1.5M',
			media: true
		});
		expect(result.posts[2].text).toMatch(/^Bot-to-Bot Communication\./);
		expect(
			(await parse({ html: await fixture('channel_posts'), kind: 'posts', limit: 2 })).posts
		).toHaveLength(2);
	});
	it('bounds excerpts by Unicode characters and never links malformed post IDs', async () => {
		const result = await parse({
			kind: 'posts',
			html: `<div class="tgme_widget_message" data-post="https://invalid/7"><div class="tgme_widget_message_text js-message_text">${'😀'.repeat(410)}</div></div>`
		});
		expect(result.posts[0].url).toBeNull();
		expect([...result.posts[0].text]).toHaveLength(400);
		expect(result.posts[0].text.endsWith('…')).toBe(true);
	});
	it.each(['abc', '1durov', '_durov', 'du-rov', 'a'.repeat(33), 'durov%2F..%2Fx'])(
		'rejects invalid input %s without fetching',
		async (username) => {
			expect(await parse({ kind: 'invalid', username })).toMatchObject({ status: 422 });
		}
	);
});

it('rejects truncated profiles and omits truncated optional posts', async () => {
	expect(await parse({ kind: 'truncatedProfile', username: 'synthetic' })).toMatchObject({
		status: 502
	});
	expect(
		await parse({
			kind: 'truncatedPosts',
			username: 'synthetic',
			html: '<div class="tgme_page_title">Synthetic</div><div class="tgme_page_extra">10 subscribers</div>'
		})
	).toMatchObject({ exists: true, type: 'channel', posts: [], counters: {} });
});
