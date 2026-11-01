<!-- Modified 2026 by realfulvio; original attribution in NOTICE. -->
<script>
	/** @type {{ title: string, description: string }} */
	let { title, description } = $props();
</script>

<header>
	<div class="tool-kicker">
		<span aria-hidden="true">↗</span> TRACE//PUNK <span aria-hidden="true">//</span> FIELD TOOL
	</div>
	<h1>{title}</h1>
	<p>{description}</p>
</header>

<style>
	.tool-kicker {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		color: var(--color-text-muted);
		font-size: 0.6rem;
		letter-spacing: 0.1em;
		margin-bottom: 1rem;
	}
	.tool-kicker span {
		color: var(--color-punk);
	}
	header {
		margin-bottom: 2rem;
		border-left: 3px solid var(--color-accent);
		padding-left: 1.5rem;
	}

	h1 {
		margin: 0 0 0.75rem;
		font-size: clamp(2rem, 5vw, 3.3rem);
		font-family: var(--font-display);
		letter-spacing: -0.05em;
	}

	p {
		max-width: 44rem;
		margin: 0;
		color: var(--color-text-dim);
	}
</style>
