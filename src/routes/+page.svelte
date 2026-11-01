<!-- Modified 2026 by realfulvio: hacker-punk catalogue. Original attribution in NOTICE. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import PageMeta from '$lib/components/PageMeta.svelte';
	import ToolCard from '$lib/components/ToolCard.svelte';
	import { TOOLS, toolsByCategory } from '$lib/tools.js';
	import { t } from '$lib/i18n/i18n.svelte.js';
	import { structuredDataTag } from '$lib/site.js';
	const groups = toolsByCategory();
	let motionPaused = $state(false);
	let motionVisible = $state(true);
	let motionDocumentVisible = $state(true);
	let heroElement: HTMLElement;
	onMount(() => {
		const observer = new IntersectionObserver(([entry]) => {
			motionVisible = entry.isIntersecting;
		});
		observer.observe(heroElement);
		const visibility = () => {
			motionDocumentVisible = !document.hidden;
		};
		visibility();
		document.addEventListener('visibilitychange', visibility);
		return () => {
			observer.disconnect();
			document.removeEventListener('visibilitychange', visibility);
		};
	});
	let query = $state('');
	let category = $state('all');
	const filtered = $derived(
		TOOLS.filter(
			(tool) =>
				(category === 'all' || tool.category === category) &&
				`${tool.name} ${tool.description} ${tool.id}`
					.toLocaleLowerCase()
					.includes(query.trim().toLocaleLowerCase())
		)
	);
	function reset() {
		query = '';
		category = 'all';
	}
</script>

<PageMeta title={t('home.title')} description={t('home.metaDescription')} />
<svelte:head>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- Own structured data with escaped markup. -->
	{@html structuredDataTag({ description: t('home.metaDescription'), tools: TOOLS })}
</svelte:head>
<section
	class="hero"
	bind:this={heroElement}
	class:motion-paused={motionPaused || !motionVisible || !motionDocumentVisible}
	aria-labelledby="hero-title"
>
	<div class="hero-copy">
		<div class="eyebrow">
			<span class="square"></span>
			{t('home.eyebrow')} <span class="edition">// VOL. 01</span>
		</div>
		<h1 id="hero-title">{t('home.headlineA')}<br /><span>{t('home.headlineB')}</span></h1>
		<p class="intro">{t('home.tagline')}</p>
		<a class="launch" href="#catalogue">{t('home.browse')} <span aria-hidden="true">↗</span></a>
		<button
			class="motion-toggle"
			aria-pressed={!motionPaused}
			onclick={() => (motionPaused = !motionPaused)}
			>{t('home.animations')} <span aria-hidden="true">{motionPaused ? '▶' : 'Ⅱ'}</span></button
		>
	</div>
	<div class="signal" aria-hidden="true">
		<div class="signal-top"><span>FIELD NOTES / OSINT</span><span>[01—20]</span></div>
		<div class="signal-art">
			<div class="radar-sweep"></div>
			<div class="orbit orbit-one"></div>
			<div class="orbit orbit-two"></div>
			<div class="crosshair"></div>
			<span class="axis a1">IDENTITY</span><span class="axis a2">NETWORK</span><span class="axis a3"
				>ARTIFACTS</span
			>
			<div class="core">[ <span>↗</span> ]</div>
			<span class="point p1"></span><span class="point p2"></span><span class="point p3"></span>
		</div>
		<div class="signal-bottom">
			<span>OBSERVE.<br />QUESTION. CONNECT.</span><span class="barcode">|||| ||| || ||||</span>
		</div>
	</div>
</section>
<div class="manifesto">
	<span>PUBLIC DATA. HUMAN CURIOSITY.</span><span
		>{TOOLS.length} {t('home.tools')} <b>×</b> {groups.length} {t('home.categories')}</span
	><span>NO ACCOUNT / NO PAYWALL</span>
</div>
<section class="catalogue" id="catalogue" aria-labelledby="catalogue-title">
	<aside>
		<p class="section-id">01 / {t('home.categories')}</p>
		<div class="filters" aria-label={t('home.categories')}>
			<button
				class:active={category === 'all'}
				aria-pressed={category === 'all'}
				onclick={() => (category = 'all')}
				><span>{t('home.all')}</span><span>{TOOLS.length.toString().padStart(2, '0')}</span></button
			>
			{#each groups as group (group.id)}
				<button
					class:active={category === group.id}
					aria-pressed={category === group.id}
					onclick={() => (category = group.id)}
					><span>{group.label}</span><span>{group.tools.length.toString().padStart(2, '0')}</span
					></button
				>
			{/each}
		</div>
		<p class="side-note"><span aria-hidden="true">↳</span> {t('home.sourceNote')}</p>
	</aside>
	<div class="tool-browser">
		<div class="catalogue-top">
			<div>
				<p class="section-id">02 / {t('home.catalogue')}</p>
				<h2 id="catalogue-title">
					{t('home.tools')}<span class="count" aria-live="polite"
						>[{filtered.length.toString().padStart(2, '0')}]</span
					>
				</h2>
			</div>
			<label class="search"
				><span class="visually-hidden">{t('home.searchLabel')}</span><span aria-hidden="true"
					>⌕</span
				><input type="search" bind:value={query} placeholder={t('home.searchPlaceholder')} /></label
			>
		</div>
		{#if filtered.length}
			<ul class="grid">
				{#each filtered as tool (tool.id)}<li>
						<ToolCard {tool} index={TOOLS.indexOf(tool) + 1} />
					</li>{/each}
			</ul>
		{:else}
			<div class="empty">
				<span aria-hidden="true">[ ∅ ]</span>
				<p>{t('home.empty')}</p>
				<button onclick={reset}>{t('home.clear')} ↗</button>
			</div>
		{/if}
		<p class="local-note">{t('home.localNote')}</p>
	</div>
</section>

<style>
	.motion-toggle {
		display: block;
		margin-top: 1rem;
		padding: 0.4rem 0;
		border: 0;
		background: none;
		color: var(--color-text-dim);
		font-size: 0.65rem;
	}
	.motion-toggle span {
		color: var(--color-accent);
		margin-left: 0.6rem;
	}
	.signal {
		animation: signal-drift 7s ease-in-out infinite;
	}
	.radar-sweep {
		position: absolute;
		width: 240px;
		height: 240px;
		left: 50%;
		top: 50%;
		border-radius: 50%;
		background: conic-gradient(
			from 0deg,
			transparent 0deg 260deg,
			#59f5e130 340deg,
			#59f5e180 359deg,
			transparent 360deg
		);
		animation: radar-turn 6s linear infinite;
	}
	.orbit-two {
		animation: radar-turn 32s linear infinite reverse;
	}
	.point {
		animation: node-pulse 3.6s ease-in-out infinite;
	}
	.p2 {
		animation-delay: -1.2s;
	}
	.p3 {
		animation-delay: -2.4s;
	}
	.core span {
		animation: core-drift 4s ease-in-out infinite;
	}
	.motion-paused .signal,
	.motion-paused .signal * {
		animation-play-state: paused;
	}
	.hero-copy {
		animation: hero-arrive 0.6s ease-out both;
	}
	.launch {
		transition:
			transform 0.2s,
			box-shadow 0.2s,
			background 0.2s;
	}
	.launch span {
		transition: transform 0.2s;
	}
	.launch:hover,
	.launch:focus-visible {
		transform: translateY(-3px);
		box-shadow: 6px 7px 0 #ff55b440;
	}
	.launch:hover span,
	.launch:focus-visible span {
		transform: translate(3px, -3px);
	}
	.filters button {
		transition:
			color 0.18s,
			background 0.18s,
			transform 0.18s;
	}
	.filters button:hover {
		transform: translateX(3px);
	}
	.search {
		transition:
			border-color 0.2s,
			box-shadow 0.2s;
	}
	.search:focus-within {
		border-color: var(--color-accent);
		box-shadow: 4px 4px 0 #59f5e118;
	}
	.grid li {
		animation: arrive 0.35s ease-out both;
	}
	/* Keep the headline visible in the first paint; movement remains animated. */
	@keyframes hero-arrive {
		from {
			transform: translateY(12px);
		}
		to {
			transform: translateY(0);
		}
	}
	@keyframes arrive {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	@keyframes radar-turn {
		from {
			transform: translate(-50%, -50%) rotate(0);
		}
		to {
			transform: translate(-50%, -50%) rotate(360deg);
		}
	}
	@keyframes signal-drift {
		0%,
		100% {
			transform: translateY(0) rotate(2deg);
		}
		50% {
			transform: translateY(-7px) rotate(0.5deg);
		}
	}
	@keyframes node-pulse {
		0%,
		100% {
			opacity: 0.5;
			transform: scale(0.85);
		}
		50% {
			opacity: 1;
			transform: scale(1.3);
		}
	}
	@keyframes core-drift {
		0%,
		100% {
			transform: translate(0, 0);
		}
		50% {
			transform: translate(3px, -3px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.motion-toggle {
			display: none;
		}
	}

	aside,
	.tool-browser {
		min-width: 0;
	}
	.hero {
		display: grid;
		grid-template-columns: 1.5fr 1fr;
		gap: 3rem;
		padding: 3rem 0 3.5rem;
		align-items: center;
	}
	.eyebrow {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		font-size: 0.68rem;
		color: var(--color-accent);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.square {
		width: 7px;
		height: 7px;
		background: var(--color-accent);
	}
	.edition {
		margin-left: auto;
		color: var(--color-text-muted);
	}
	h1 {
		font-family: var(--font-display);
		font-weight: 900;
		font-size: clamp(2.5rem, 4.8vw, 4.9rem);
		letter-spacing: -0.065em;
		line-height: 0.98;
		margin: 2rem 0 1.5rem;
		max-width: 12ch;
	}
	h1 span {
		color: var(--color-accent);
	}
	.intro {
		color: var(--color-text-dim);
		font-size: 0.9rem;
		max-width: 48ch;
		line-height: 1.8;
	}
	.launch {
		display: inline-flex;
		align-items: center;
		gap: 2rem;
		margin-top: 1rem;
		padding: 0.8rem 1.25rem;
		background: var(--color-accent);
		color: #090b10;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		text-decoration: none;
		box-shadow: 4px 4px 0 #59f5e12b;
	}
	.launch:hover {
		background: #fff;
	}
	.launch span {
		font-size: 1.4rem;
		line-height: 1;
	}
	.signal {
		border: 1px solid var(--color-border);
		background: #0d1119;
		transform: rotate(2deg);
		box-shadow: 10px 10px 0 #ff55b40d;
		position: relative;
	}
	.signal::before {
		content: '';
		width: 65px;
		height: 16px;
		background: var(--color-punk);
		position: absolute;
		top: -8px;
		left: calc(50% - 30px);
		transform: rotate(-9deg);
	}
	.signal-top,
	.signal-bottom {
		display: flex;
		justify-content: space-between;
		padding: 1rem;
		color: var(--color-text-muted);
		font-size: 0.6rem;
		letter-spacing: 0.08em;
	}
	.signal-top {
		border-bottom: 1px solid var(--color-border);
	}
	.signal-bottom {
		border-top: 1px solid var(--color-border);
		align-items: center;
	}
	.barcode {
		font-size: 1.5rem;
		color: var(--color-punk);
	}
	.signal-art {
		height: 230px;
		position: relative;
		overflow: hidden;
		background:
			linear-gradient(#59f5e108 1px, transparent 1px),
			linear-gradient(90deg, #59f5e108 1px, transparent 1px);
		background-size: 22px 22px;
	}
	.orbit {
		position: absolute;
		border: 1px solid #59f5e13d;
		border-radius: 50%;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
	}
	.orbit-one {
		width: 160px;
		height: 160px;
	}
	.orbit-two {
		width: 240px;
		height: 240px;
		border-style: dashed;
	}
	.crosshair {
		position: absolute;
		left: 50%;
		top: 0;
		height: 100%;
		border-left: 1px solid #59f5e125;
		transform: rotate(40deg);
	}
	.crosshair::after {
		content: '';
		position: absolute;
		width: 350px;
		top: 50%;
		left: -175px;
		border-top: 1px solid #59f5e125;
	}
	.core {
		position: absolute;
		inset: 0;
		display: flex;
		justify-content: center;
		align-items: center;
		font-size: 3.6rem;
		gap: 1rem;
		color: var(--color-accent);
	}
	.core span {
		color: var(--color-punk);
	}
	.axis {
		position: absolute;
		font-size: 0.55rem;
		letter-spacing: 0.1em;
		background: #0d1119;
		padding: 0.2rem 0.4rem;
		color: var(--color-text-dim);
	}
	.a1 {
		top: 25px;
		left: 15px;
	}
	.a2 {
		right: 10px;
		top: 100px;
	}
	.a3 {
		bottom: 16px;
		left: 40px;
	}
	.point {
		position: absolute;
		width: 7px;
		height: 7px;
		background: var(--color-punk);
		box-shadow: 0 0 0 5px #ff55b41a;
	}
	.p1 {
		left: 33%;
		top: 20%;
	}
	.p2 {
		right: 25%;
		bottom: 25%;
	}
	.p3 {
		left: 26%;
		bottom: 20%;
		background: var(--color-accent);
	}
	.manifesto {
		border-block: 1px solid var(--color-border);
		padding: 0.85rem 0;
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		font-size: 0.62rem;
		letter-spacing: 0.07em;
		color: var(--color-text-muted);
	}
	.manifesto b {
		color: var(--color-punk);
		margin: 0 0.6rem;
	}
	.catalogue {
		display: grid;
		grid-template-columns: 200px 1fr;
		gap: 2.5rem;
		padding-top: 2.5rem;
	}
	.section-id {
		color: var(--color-text-muted);
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.15em;
		margin: 0 0 1.2rem;
	}
	.filters {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.filters button {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		align-items: center;
		text-align: left;
		background: none;
		border: 1px solid transparent;
		color: var(--color-text-dim);
		padding: 0.7rem 0.8rem;
		font-size: 0.7rem;
		min-height: 44px;
	}
	.filters button:hover {
		background: var(--color-surface);
		color: var(--color-text);
	}
	.filters button.active {
		border-color: #59f5e14a;
		background: #59f5e10c;
		color: var(--color-accent);
		border-left: 3px solid var(--color-accent);
	}
	.filters button span:last-child {
		font-size: 0.6rem;
		color: var(--color-text-muted);
	}
	.side-note {
		border-top: 1px solid var(--color-border);
		margin-top: 2rem;
		padding-top: 1rem;
		font-size: 0.65rem;
		color: var(--color-text-muted);
		line-height: 1.9;
	}
	.side-note span {
		color: var(--color-punk);
	}
	.catalogue-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		margin-bottom: 1.5rem;
	}
	h2 {
		font-family: var(--font-display);
		font-size: 1.8rem;
		letter-spacing: -0.03em;
		margin: 0;
	}
	.catalogue-top .section-id {
		margin-bottom: 0.6rem;
	}
	.count {
		font: 0.75rem var(--font-mono);
		color: var(--color-punk);
		vertical-align: middle;
		margin-left: 1rem;
	}
	.search {
		display: flex;
		align-items: center;
		border: 1px solid var(--color-border);
		background: #0d1119;
		max-width: 20rem;
		min-width: 0;
	}
	.search > span:not(.visually-hidden) {
		font-size: 1.4rem;
		color: var(--color-accent);
		padding-left: 0.8rem;
	}
	.search input {
		border: 0;
		background: none;
		font-size: 0.72rem;
		min-width: 0;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.local-note {
		color: var(--color-text-muted);
		font-size: 0.65rem;
		margin-top: 1.5rem;
	}
	.empty {
		border: 1px dashed var(--color-border);
		padding: 3rem;
		text-align: center;
	}
	.empty > span {
		color: var(--color-punk);
		font-size: 2rem;
	}
	.empty button {
		background: var(--color-accent);
		color: var(--color-bg);
		border: 0;
		padding: 0.75rem;
	}
	@media (min-width: 1400px) {
		.grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	@media (max-width: 900px) {
		.hero {
			gap: 2rem;
			grid-template-columns: 1.5fr 1fr;
		}
		.signal-art {
			height: 200px;
		}
		.catalogue {
			grid-template-columns: 170px 1fr;
			gap: 1.5rem;
		}
		.catalogue-top {
			align-items: stretch;
			flex-direction: column;
			gap: 1rem;
		}
		.search {
			max-width: none;
		}
		.edition {
			display: none;
		}
	}
	@media (max-width: 640px) {
		.hero {
			grid-template-columns: 1fr;
			padding: 1.5rem 0 2rem;
			gap: 2rem;
		}
		.signal {
			display: none;
		}
		h1 {
			font-size: clamp(2.6rem, 11vw, 4rem);
			max-width: 15ch;
		}
		.manifesto {
			flex-wrap: wrap;
			font-size: 0.55rem;
		}
		.manifesto > span:last-child {
			display: none;
		}
		.catalogue {
			grid-template-columns: 1fr;
			padding-top: 1.5rem;
			gap: 1.5rem;
		}
		.filters {
			flex-direction: row;
			overflow-x: auto;
			padding-bottom: 0.4rem;
		}
		.filters button {
			flex-shrink: 0;
		}
		.side-note {
			display: none;
		}
		.section-id {
			margin-bottom: 0.7rem;
		}
		.grid {
			grid-template-columns: 1fr;
		}
		.catalogue-top {
			flex-direction: column;
			align-items: stretch;
		}
		.search {
			max-width: none;
		}
		.intro {
			font-size: 0.8rem;
		}
	}
</style>
