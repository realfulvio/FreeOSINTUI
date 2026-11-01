<!-- Modified 2026 by realfulvio; original attribution in NOTICE. -->
<script>
	import { t } from '$lib/i18n/i18n.svelte.js';
	import { SITE_NAME } from '$lib/site.js';
</script>

<footer>
	<div class="inner">
		<div class="identity">
			<strong>{SITE_NAME}<span aria-hidden="true">_</span></strong>
			<p>{t('nav.footerAbout')}</p>
		</div>
		<div class="credits">
			<a href="https://github.com/realfulvio/FreeOSINTUI" target="_blank" rel="noopener noreferrer"
				>GitHub ↗</a
			>
			<p>
				Based on <a href="https://github.com/Kerlooo/FreeOSINTUI">FreeOSINT-UI / kerlo</a><br />{t(
					'nav.inspiredBy'
				)} <a href="https://osint-ui.com/">OSINT-UI</a> ·
				<a href="https://github.com/realfulvio/FreeOSINTUI/blob/main/.github/LICENSE"
					>License &amp; credits</a
				>
			</p>
		</div>
	</div>
</footer>

<style>
	footer {
		border-top: 1px solid var(--color-border);
		background: #0d1119;
	}
	.inner {
		display: flex;
		justify-content: space-between;
		gap: 2rem;
		max-width: var(--content-width);
		margin: auto;
		padding: 2rem 2.5rem;
	}
	.identity {
		max-width: 36rem;
	}
	strong {
		font: 900 1.3rem var(--font-display);
		letter-spacing: -0.04em;
	}
	strong span {
		color: var(--color-punk);
	}
	p {
		color: var(--color-text-muted);
		font-size: 0.65rem;
		line-height: 1.8;
		margin: 0.7rem 0 0;
	}
	.credits {
		text-align: right;
		font-size: 0.75rem;
	}
	.credits p a {
		color: var(--color-text-dim);
	}
	a {
		text-decoration: none;
	}
	a:hover {
		text-decoration: underline;
	}
	@media (max-width: 640px) {
		.inner {
			padding: 1.5rem 1rem;
			flex-direction: column;
			gap: 1.5rem;
		}
		.credits {
			text-align: left;
		}
	}
</style>
