# Workers Free migration

Approved direction in chat: retain Svelte, use TypeScript for Workers, prepare without deployment or paid services. Keep current name and upstream notices.

Serve prerendered Svelte assets directly; route only /api/* to a TypeScript Worker. Preserve all existing API response contracts and tools. Keep Python as reference, not a production dependency. Use bounded outbound reads, explicit timeouts, manual redirects and validated fixed destinations. No database, AI, queues or paid storage required. API secrets optional; absent keys return existing not-configured results.

Considered: full Rust rewrite (unmeasured benefit for network-bound work), existing Python backend (additional runtime), TypeScript Worker (selected for platform fit). Measure bundle and validate the local Workers runtime; local tests cannot prove the deployed Free CPU budget. Shared account request quota must be documented. No account plan change or deployment.
