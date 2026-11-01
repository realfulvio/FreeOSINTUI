# Production deployment — 2026-11-01

- PR #1 merged as `a3b79a5b6de89476b6d1f9ee5b9f01b75e86b1ad`.
- Built with `VITE_SITE_URL=https://tracepunk.laccorsi-bondeno.workers.dev`.
- Dedicated Worker `tracepunk`, Workers Free confirmed in the account dashboard.
- Public URL: https://tracepunk.laccorsi-bondeno.workers.dev/
- `ABUSECH_AUTH_KEY` provisioned as `secret_text`; no key in Git or frontend assets.
- HTTP 200: homepage, crypto, footprint, health, username catalogue, Telegram public profile, URLhaus host and URL lookup, ThreatFox lookup.
- Chrome reputation lookup completed all three sources: OTX and URLhaus listed example.com; ThreatFox did not list it. These are source observations, not a maliciousness verdict.
- Wayback HTTP 200 with `truncated:true` and `homepageOnly:true`; reduced coverage remains explicit.
- Il Maneggio returned HTTP 200. Its Worker modification time and content etag exactly matched the pre-deployment baseline. No routes, domains, database or settings were changed. Rate-limit namespaces do not collide with either existing Worker.
- No paid resources or plan upgrades. The 100,000 daily dynamic-request allowance is shared across the account; rate limiting does not reserve quota for other Workers.
- Production CPU percentiles, sustained load and exhaustive external-provider coverage remain unmeasured. Smoke checks are not a load test.
