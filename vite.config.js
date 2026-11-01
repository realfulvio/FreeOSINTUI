// Modified for Cloudflare Workers; original attribution in NOTICE.
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [
		sveltekit({
			// Small route styles arrive with the HTML, avoiding a render-blocking CSS round trip.
			inlineStyleThreshold: 16384,
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		})
	],
	// The TypeScript Worker serves /api; proxy it in dev and preview so there is no CORS.
	server: {
		proxy: { '/api': 'http://127.0.0.1:8787' }
	},
	preview: {
		proxy: { '/api': 'http://127.0.0.1:8787' }
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.js',
				test: {
					name: 'server',
					environment: 'node',
					setupFiles: ['./src/lib/i18n/test-setup.js'],
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
