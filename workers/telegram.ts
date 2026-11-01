/** Modified 2026 by realfulvio: Workers port of FreeOSINT-UI Telegram parsers by kerlo (Kerlooo). */
import { decodeHTML } from 'entities';
import { fetchText, HttpError } from './http';

type Node = { text: string; attrs: Record<string, string | null>; nested: boolean; owner: number };
/** Collect selected text in the native streaming parser; never execute remote HTML. */
async function collect(html: string, selectors: Record<string, string>, scope?: string) {
	const nodes: Record<string, Node[]> = {};
	const stacks: Record<string, Node[]> = {};
	let owner = -1;
	let parser = new HTMLRewriter();
	if (scope)
		parser = parser.on(scope, {
			element() {
				owner++;
			}
		});
	for (const [key, selector] of Object.entries(selectors)) {
		nodes[key] = [];
		stacks[key] = [];
		parser = parser.on(selector, {
			element(element) {
				const stack = stacks[key];
				if (stack.length) stack[stack.length - 1].nested = true;
				const node: Node = {
					text: '',
					attrs: Object.fromEntries(element.attributes),
					nested: false,
					owner
				};
				nodes[key].push(node);
				if (
					[
						'area',
						'base',
						'br',
						'col',
						'embed',
						'hr',
						'img',
						'input',
						'link',
						'meta',
						'param',
						'source',
						'track',
						'wbr'
					].includes(element.tagName)
				)
					return;
				stack.push(node);
				element.onEndTag(() => {
					stack.pop();
				});
			},
			text(chunk) {
				const stack = stacks[key];
				if (stack.length) stack[stack.length - 1].text += chunk.text;
			}
		});
	}
	parser = parser.on('br', {
		element() {
			for (const stack of Object.values(stacks))
				if (stack.length) stack[stack.length - 1].text += '\n';
		}
	});
	await parser
		.transform(new Response(html, { headers: { 'content-type': 'text/html;charset=utf-8' } }))
		.text();
	return nodes;
}
function text(node?: Node): string {
	return decodeHTML(node?.text ?? '')
		.split('\n')
		.map((line) => line.replace(/[ \t\u00a0]+/g, ' ').trim())
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}
export async function parseProfile(html: string, username: string) {
	const nodes = await collect(html, {
		title: '.tgme_page_title',
		verified: '.tgme_page_title .verified-icon',
		extra: '.tgme_page_extra',
		button: '.tgme_action_button_new',
		preview: 'a.tgme_page_context_link',
		pageTitle: 'title',
		image: 'img.tgme_page_photo_image',
		description: '.tgme_page_description',
		meta: 'meta[property="og:description"]'
	});
	const result = {
		exists: false,
		type: null as string | null,
		title: null as string | null,
		verified: false,
		description: null as string | null,
		image: null as string | null,
		extra: [] as string[],
		has_preview: false
	};
	const title = text(nodes.title[0]).replaceAll('✔', '').trim();
	if (!title) return result;
	const extra = nodes.extra
		.filter((n) => !n.nested)
		.map(text)
		.filter(Boolean);
	const button = text(nodes.button[0]).toLowerCase();
	const has_preview =
		nodes.preview[0]?.attrs.href?.toLowerCase() === `/s/${username.toLowerCase()}`;
	const joined = extra.join(' ').toLowerCase();
	const type =
		button === 'start bot' || text(nodes.pageTitle[0]).startsWith('Telegram: Launch')
			? 'bot'
			: joined.includes('member')
				? 'group'
				: joined.includes('subscriber') || has_preview
					? 'channel'
					: button === 'send message'
						? 'user'
						: 'unknown';
	return {
		...result,
		exists: true,
		type,
		title,
		verified: !!nodes.verified.length,
		description:
			text(nodes.description[0]) || decodeHTML(nodes.meta[0]?.attrs.content ?? '').trim() || null,
		image: nodes.image[0]?.attrs.src ? decodeHTML(nodes.image[0].attrs.src) : null,
		extra,
		has_preview
	};
}
export async function parseChannelPosts(html: string, limit = 10) {
	const counterNodes = await collect(
		html,
		{
			counter: '.tgme_channel_info_counter',
			value: '.tgme_channel_info_counter .counter_value',
			kind: '.tgme_channel_info_counter .counter_type'
		},
		'.tgme_channel_info_counter'
	);
	const counters: Record<string, string> = {};
	for (const counter of counterNodes.counter) {
		const value = text(counterNodes.value.find((n) => n.owner === counter.owner));
		const kind = text(counterNodes.kind.find((n) => n.owner === counter.owner));
		if (value && kind) counters[kind] = value;
	}
	const nodes = await collect(
		html,
		{
			message: '.tgme_widget_message[data-post]',
			date: '.tgme_widget_message[data-post] a.tgme_widget_message_date time[datetime]',
			text: '.tgme_widget_message[data-post] .tgme_widget_message_text.js-message_text',
			views: '.tgme_widget_message[data-post] .tgme_widget_message_views',
			media:
				'.tgme_widget_message[data-post] .tgme_widget_message_photo_wrap, .tgme_widget_message[data-post] .tgme_widget_message_video_player, .tgme_widget_message[data-post] .tgme_widget_message_document, .tgme_widget_message[data-post] .tgme_widget_message_roundvideo_player'
		},
		'.tgme_widget_message[data-post]'
	);
	const posts = nodes.message
		.map((message) => {
			const owned = (key: string) => nodes[key].find((n) => n.owner === message.owner);
			const id = message.attrs['data-post'] ?? '';
			const body = text(owned('text'));
			const chars = [...body];
			return {
				id,
				url: /^[A-Za-z0-9_]+\/\d+$/.test(id) ? `https://t.me/${id}` : null,
				date: owned('date')?.attrs.datetime ?? null,
				views: text(owned('views')) || null,
				text: chars.length <= 400 ? body : chars.slice(0, 399).join('').trimEnd() + '…',
				media: !!owned('media')
			};
		})
		.reverse()
		.slice(0, limit);
	return { counters, posts };
}
export async function handleTelegram(url: URL): Promise<unknown> {
	let username: string;
	try {
		username = decodeURIComponent(url.pathname.slice('/api/telegram/'.length));
	} catch {
		throw new HttpError(422, 'Invalid Telegram username.');
	}
	if (!/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(username))
		throw new HttpError(
			422,
			"Invalid Telegram username: 5-32 characters, letters, digits and '_', starting with a letter."
		);
	let page;
	try {
		page = await fetchText(`https://t.me/${username}`);
	} catch (error) {
		if (error instanceof Error && /timeout|abort|in time/i.test(error.name + ' ' + error.message))
			throw new HttpError(504, 't.me did not answer in time.');
		throw new HttpError(502, 'Could not reach t.me.');
	}
	if (!page.complete) throw new HttpError(502, 'The t.me response exceeded the size limit.');
	if (page.status !== 200) throw new HttpError(502, `t.me answered with HTTP ${page.status}.`);
	// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Internal parser field is excluded from the API.
	const { has_preview: _, ...profile } = await parseProfile(page.body, username);
	let preview: { counters: Record<string, string>; posts: unknown[] } = { counters: {}, posts: [] };
	if (profile.exists && profile.type === 'channel') {
		try {
			const response = await fetchText(`https://t.me/s/${username}`);
			if (response.status === 200 && response.complete)
				preview = await parseChannelPosts(response.body);
		} catch {
			/* The public posts preview is optional. */
		}
	}
	return { username, url: `https://t.me/${username}`, ...profile, ...preview };
}
