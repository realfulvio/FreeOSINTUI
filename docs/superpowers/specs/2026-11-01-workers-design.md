# Workers Free migration

Approved direction in chat: retain Svelte, use TypeScript for Workers, prepare without deployment or paid services. Keep current name and upstream notices.

Serve prerendered Svelte assets directly; route only /api/* to a TypeScript Worker. Preserve all existing API response contracts and tools. Keep Python as reference, not a production dependency. Use bounded outbound reads, explicit timeouts, manual redirects and validated fixed destinations. No database, AI, queues or paid storage required. API secrets optional; absent keys return existing not-configured results.

Considered: full Rust rewrite (unmeasured benefit for network-bound work), existing Python backend (additional runtime), TypeScript Worker (selected for platform fit). Measure bundle and validate the local Workers runtime; local tests cannot prove the deployed Free CPU budget. Shared account request quota must be documented. No account plan change or deployment.

## Visual direction (user correction)

User requested a new interface retaining a strong hacker-punk theme, rewritten names/descriptions, then optional functional improvements. Implemented charcoal/cyan/magenta design, display typography, catalogue search and category filters, numbered tool cards and redesigned navigation/header/footer. All 20 tools and their routes retained. OSINT / LAB is a working display name, not a final brand decision. Existing code provenance is described as derived from FreeOSINT-UI, with OSINT-UI inspiration and licenses retained. More substantial feature changes and deployment remain separate.
