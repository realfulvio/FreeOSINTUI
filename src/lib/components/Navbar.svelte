<!-- Modified 2026 by realfulvio; original attribution in NOTICE. -->
<script>
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { toolsByCategory } from '$lib/tools.js';
	import { t } from '$lib/i18n/i18n.svelte.js';
	import LanguageSwitch from './LanguageSwitch.svelte';
	import { SITE_NAME } from '$lib/site.js';
	import NavbarClock from './NavbarClock.svelte';

	const groups = toolsByCategory();

	let menuOpen = $state(false);
	/** @type {HTMLDetailsElement | undefined} */
	let menu = $state();

	afterNavigate(() => (menuOpen = false));

	/** Closes the menu on outside click or Escape. */
	function handleWindowClick(/** @type {MouseEvent} */ event) {
		if (menuOpen && menu && !menu.contains(/** @type {Node} */ (event.target))) menuOpen = false;
	}
</script>

<svelte:window
	onclick={handleWindowClick}
	onkeydown={(event) => event.key === 'Escape' && (menuOpen = false)}
/>

<header>
	<nav aria-label={t('nav.main')}>
		<a class="brand" href={resolve('/')}>
			<span class="brand-mark" aria-hidden="true">↗</span><span
				>{SITE_NAME}<small>OPEN SOURCE INTELLIGENCE</small></span
			>
		</a>
		<ul class="top">
			<li>
				<NavbarClock />
			</li>
			<li>
				<a href={resolve('/')} aria-current={page.url.pathname === '/' ? 'page' : undefined}
					>{t('nav.home')}</a
				>
			</li>
			<li>
				<details bind:this={menu} bind:open={menuOpen}>
					<summary>{t('nav.tools')}</summary>
					<div class="menu">
						{#each groups as group (group.id)}
							<div class="group">
								<span class="group-label">{group.label}</span>
								<ul>
									{#each group.tools as tool (tool.id)}
										<li>
											<a
												href={resolve(tool.route)}
												aria-current={page.url.pathname.startsWith(tool.route) ? 'page' : undefined}
											>
												{tool.name}
											</a>
										</li>
									{/each}
								</ul>
							</div>
						{/each}
					</div>
				</details>
			</li>
			<li>
				<LanguageSwitch />
			</li>
		</ul>
	</nav>
</header>

<style>
	.brand-mark {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		background: var(--color-accent);
		color: var(--color-bg);
		font-size: 1.9rem;
		line-height: 1;
	}
	.brand small {
		display: block;
		color: var(--color-text-muted);
		font: 0.5rem var(--font-mono);
		letter-spacing: 0.1em;
		margin-top: 0.15rem;
	}
	.top {
		font-size: 0.7rem;
	}
	header {
		border-bottom: 1px solid var(--color-border);
		background: var(--color-bg);
		position: sticky;
		top: 0;
		z-index: 10;
	}

	nav {
		position: relative;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem 1.5rem;
		max-width: var(--content-width);
		margin: 0 auto;
		padding: 0.9rem 1rem;
	}

	.brand {
		font-weight: 700;
		font-size: 1.15rem;
		text-decoration: none;
		font-family: var(--font-display);
		letter-spacing: -0.04em;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: var(--color-text);
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.top {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem 1.25rem;
		min-width: 0;
	}

	a,
	summary {
		color: var(--color-text-dim);
		text-decoration: none;
		cursor: pointer;
	}

	a:hover,
	summary:hover,
	a[aria-current='page'],
	details[open] summary {
		color: var(--color-text);
	}

	a[aria-current='page']::before {
		content: '// ';
		color: var(--color-accent);
	}

	summary {
		list-style: none;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	summary::after {
		content: ' ▾';
	}

	details[open] summary::after {
		content: ' ▴';
	}

	.menu {
		position: absolute;
		top: 100%;
		right: 1rem;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
		gap: 1.25rem 2rem;
		width: min(44rem, calc(100% - 2rem));
		max-height: calc(100vh - 5rem);
		max-height: calc(100dvh - 5rem);
		overflow-y: auto;
		padding: 1.25rem;
		background: var(--color-bg);
		border: 1px solid var(--color-text-muted);
		border-radius: var(--radius);
		box-shadow: 8px 8px 0 #0008;
	}

	.group-label {
		display: block;
		margin-bottom: 0.4rem;
		color: var(--color-text-muted);
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.group li + li {
		margin-top: 0.25rem;
	}

	/* Touch screens: ~44px tap targets. */
	@media (pointer: coarse) {
		a,
		summary {
			padding-block: 0.6rem;
		}

		a {
			display: inline-block;
		}

		.menu a {
			display: block;
		}

		.group li + li {
			margin-top: 0;
		}
	}

	@media (max-width: 40rem) {
		.top > li:first-child {
			display: none;
		}
		/* The wrapped navbar is tall: not sticky, so the open menu can be scrolled with the page. */
		header {
			position: relative;
		}

		nav {
			gap: 0.25rem 1rem;
			padding: 0.5rem 1rem;
		}

		.top {
			gap: 0.25rem 0.75rem;
		}

		.menu {
			gap: 1rem;
			max-height: none;
			padding: 1rem;
		}
	}
</style>
