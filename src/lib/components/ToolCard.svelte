<!-- Modified 2026 by realfulvio; original attribution in NOTICE. -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { t } from '$lib/i18n/i18n.svelte.js';
	let {
		tool,
		index = 1
	}: {
		tool: { id?: string; name: string; route: string; description: string; category?: string };
		index?: number;
	} = $props();
</script>

<a class="card" href={resolve(tool.route)}>
	<div class="card-top">
		<span class="number">/{String(index).padStart(2, '0')}</span><span class="category"
			>{t(`tools.category.${tool.category}`)}</span
		><span class="arrow" aria-hidden="true">↗</span>
	</div>
	<h3>{tool.name}</h3>
	<p>{tool.description}</p>
	<div class="card-bottom">
		<span class="command" aria-hidden="true">&gt; {tool.id}</span><span
			>{t('home.open')} <span aria-hidden="true">→</span></span
		>
	</div>
</a>

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		height: 100%;
		padding: 1.25rem;
		background: #0f141d;
		border: 1px solid var(--color-border);
		text-decoration: none;
		color: var(--color-text);
		position: relative;
		transition:
			border-color 0.15s,
			background 0.15s,
			transform 0.15s;
	}
	.card::after {
		content: '';
		position: absolute;
		width: 10px;
		height: 10px;
		right: -1px;
		bottom: -1px;
		border-right: 1px solid var(--color-punk);
		border-bottom: 1px solid var(--color-punk);
	}
	.card:hover {
		border-color: var(--color-accent);
		background: #131e27;
		transform: translateY(-2px);
	}
	.card:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 3px;
	}
	.card-top {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.55rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-muted);
	}
	.number {
		color: var(--color-punk);
	}
	.category {
		flex: 1;
	}
	.arrow {
		color: var(--color-accent);
		font-size: 1.2rem;
	}
	h3 {
		font-family: var(--font-display);
		font-size: 1.2rem;
		font-weight: 700;
		letter-spacing: -0.025em;
		line-height: 1.25;
		margin: 0.3rem 0 0;
	}
	p {
		flex: 1;
		margin: 0;
		color: var(--color-text-dim);
		font-size: 0.72rem;
		line-height: 1.8;
	}
	.card-bottom {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 0.6rem;
		padding-top: 0.75rem;
		border-top: 1px solid #ffffff0b;
		font-size: 0.62rem;
		color: var(--color-accent);
	}
	.command {
		color: var(--color-text-muted);
	}
</style>
