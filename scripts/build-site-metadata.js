// Modified for the Cloudflare fork; original attribution in NOTICE.
import { readFile, writeFile } from 'node:fs/promises';
import { loadEnv } from 'vite';
const env = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env };
const origin = new URL(env.VITE_SITE_URL || 'http://localhost:8787').origin;
for (const file of ['sitemap.xml', 'robots.txt', 'llms.txt']) {
	const content = await readFile(`build/${file}`, 'utf8');
	await writeFile(`build/${file}`, content.replaceAll('http://localhost:8787', origin));
}
