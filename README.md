# TRACE//PUNK

OSINT toolkit.

Hacker-punk interface with a searchable 20-tool catalogue, category filters and rewritten tool descriptions. Charcoal, cyan and magenta theme, responsive layouts, system fonts and no added UI runtime dependencies.

Svelte static frontend and TypeScript API prepared for Cloudflare Workers Free. Derived from [Kerlooo/FreeOSINTUI](https://github.com/Kerlooo/FreeOSINTUI); inspired also by [OSINT-UI](https://osint-ui.com/). The original author, license and third-party notices are preserved in [NOTICE](NOTICE) and [.github/LICENSE](.github/LICENSE). Apache 2.0 **with Commons Clause**, not plain Apache 2.0. WhatsMyName data retains CC BY-SA 4.0.

## Local development

Node.js 22.12+ (CI uses 24).

```sh
npm ci
npm run build
npm run dev:all
```

Open Vite's printed URL. Vite proxies `/api` to the local Worker on port 8787. For the built site and API together use `npm run preview:worker`, then open `http://localhost:8787`. Python in `backend/` is retained as reference and fixture/data provenance; it is not required to run this fork.

```sh
npm run check:worker
npm test
npm run test:worker
npm run lint
npm run deploy:check
```

The last command builds and packages locally; it does **not** deploy. Tests include original frontend suites, mocked upstream responses and Telegram fixtures executed with native Workers HTMLRewriter through Miniflare. The lockfile aligns Miniflare with the version bundled with Wrangler (including its prerelease suffix); update these together.

## Free-tier design

- Static pages and assets are served directly; only `/api/*` invokes TypeScript. No SSR invocation for page views.
- No KV, D1, R2, AI, queues, cron jobs or paid storage provisioned. Tor/DROP use the native ephemeral Cache API; user searches are not cached in shared storage.
- One source per username request, at most two external requests in other handlers. Redirects are manual. Public URLs being analyzed are never fetched except approved shorteners.
- Requests have deadlines and streaming byte limits. Truncated username responses become `unknown`; required Telegram profiles fail rather than falsely claiming an account is absent. Wayback explicitly marks truncated results. Incomplete reputation feeds fail closed.
- Native rate limiting: 1200 username checks/minute/client IP, 30/minute/IP/tool for other APIs. Limits are approximate and per Cloudflare location; shared-IP users share the allowance. Namespace IDs in `wrangler.jsonc` must be unique in the target account. These limits protect upstream services, **not** the daily account quota: rejected requests still invoke the Worker.
- Logging is disabled by default to avoid recording investigation query strings.

Cloudflare Free currently includes 100,000 Worker requests/day **across the account**, 10 ms CPU/invocation and 50 external subrequests/invocation. Static asset delivery is free/unlimited when it bypasses the Worker. A 500-site username scan consumes about 500 API requests, not one. Other sites on the account share the daily allowance. Free quota exhaustion causes failures; this configuration does not enable a paid plan.

Local tests and dry-run do not enforce or prove the production 10 ms CPU budget. After an explicitly authorized Free-account deployment, measure cold/warm CPU especially for reputation feeds and large Wayback/Telegram responses before announcing production readiness. Cloudflare and third-party quotas may change; see [limits](https://developers.cloudflare.com/workers/platform/limits/) and [pricing](https://developers.cloudflare.com/workers/platform/pricing/).

## Preparing a deployment

No automatic deployment workflow is configured. The GitHub workflow only validates.

1. Check the intended Cloudflare account is on **Workers Free**. Wrangler config cannot force account billing status; on a Paid account usage follows that account's paid pricing.
2. Pick the Worker name and verify rate-limit namespace IDs do not collide with existing Workers.
3. Set `VITE_SITE_URL=https://your-chosen-host` before building. This updates canonical links, reports, sitemap, robots and llms metadata. Default is localhost, not the original author's deployment.
4. Run the checks above. Deploy only when ready using `npx wrangler deploy` after building with that origin. A `workers.dev` address avoids buying another domain.
5. Test real sources, account consumption and CPU. Providers can rate-limit/block datacenter traffic; the UI must surface this as uncertainty/errors, never absence or safety.

Optional URLhaus/ThreatFox authentication uses `ABUSECH_AUTH_KEY`. Without it the existing APIs return `not_configured`/`configured:false`. For local use put it in ignored `.dev.vars`; for deployment use `npx wrangler secret put ABUSECH_AUTH_KEY` through its prompt. Never put keys in `VITE_*` or commit them. External services have their own terms and quotas.

## Validation of this migration

Local validation: 555 frontend tests and 126 Worker tests passed; TypeScript and lint passed; static build and Wrangler dry-run succeeded. Worker bundle approximately 238 KiB / 69 KiB gzip (includes the 716-site dataset). Local workerd smoke checks covered static routes, API JSON errors, optional-key behavior and site listing. No Cloudflare deployment or billing-plan change has been performed. Live third-party coverage and production CPU measurements remain deployment checks.

`npm audit --omit=dev` reported no production dependency advisories at validation. Development tools still report 18 low/moderate advisories; compatible fixes were applied without forcing breaking framework/toolchain upgrades.

## Acknowledgements

Thank you to [kerlo](https://github.com/Kerlooo) for creating [FreeOSINT-UI](https://github.com/Kerlooo/FreeOSINTUI) and making its code available. TRACEPUNK builds directly on that work; our interface, Workers port and subsequent changes do not replace the original author's credit.

Thanks also to [OSINT-UI](https://osint-ui.com/) for the original inspiration, and to the [WhatsMyName contributors](https://github.com/WebBreacher/WhatsMyName) and the maintainers of the public data sources and libraries used by these tools. See [NOTICE](NOTICE) for attribution and third-party licenses.

## Pre-publication tool review

The [functional audit](docs/quality/2026-11-01-tool-audit.md) records eight reproduced edge cases and their fixes: strict external-response handling, duplicate SPF/DMARC detection, Public Suffix List handling (including private suffixes), DNS evidence instead of inferred registration, partial GitHub results and archive-port deduplication. Regression tests include malformed and valid negative responses, partial/all-failed sources and hosted-domain boundaries. File-processing budgets and further functional improvements remain separate follow-up work.

### Local file processing and partial coverage

Metadata extraction now runs in a cancellable browser Web Worker: files up to 64 MiB, Office/PDF decompression limited to 4 MiB per entry and 16 MiB total, with a 30-second processing timeout. File hashing uses a separate Web Worker and 4 MiB chunks, with progress and cancellation; files are never uploaded.

Crypto lookups preserve successful sections when another endpoint fails and explicitly show unknown values and incomplete transaction coverage. Username scans can resume missing sites or retry errors/unknown results while preserving the original target and successful results. This state lasts only on the current page and is cleared by navigation or reload. See the [functional audit](docs/quality/2026-11-01-tool-audit.md) for validation and remaining limitations.
