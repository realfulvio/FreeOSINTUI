# Performance comparison — 2026-11-01

Compared the public [FreeOSINT-UI deployment](https://freeosintui.vercel.app/) with [TRACE//PUNK](https://tracepunk.laccorsi-bondeno.workers.dev/), before and after PR #2. This is a small browser lab comparison, not a claim that every tool is faster.

## Changes and functional coverage

- Load tool-specific translation namespaces before their route renders, retaining all four languages and the shared analyzer/report dependencies. Parallel preloads share a promise; failed imports can be retried.
- Keep the homepage headline visible during its movement animation instead of initially transparent. The animated artwork, pause control and reduced-motion behavior remain.
- The initial common translation chunk decreased from approximately 122 KB to 17 KB encoded over the network. Other dictionaries remain available on demand, rather than being deleted.
- 622 frontend tests and 130 Worker tests passed in CI, together with lint, Worker types, build and dry-run.
- Chrome direct-entry smoke checks covered all 20 tool pages. A populated header analysis switched between EN/IT/FR/JA without unresolved translation keys. Its downloaded JSON report parsed successfully and contained seven sections with translated labels. Hashes for `abc` and the shared file fixture were checked in the browser.
- PR #2 merged as `0b5e5f216564ffb91ac889232cfba011c113b641`; deployed Worker version `9e6126ff-999e-4217-9d35-cca33cd68c4c`. API health and authenticated ThreatFox smoke checks returned HTTP 200 after deployment. No backend or billing configuration change.

## Homepage measurements

Three measured reloads per version in the same Chrome desktop profile, Italian locale, viewport 390×844, DPR 1, CPU slowdown 4×, simulated download 200,000 B/s, upload 93,750 B/s and latency 150 ms. Browser HTTP cache disabled; connections and the CDN may be warm. PerformanceObserver collected buffered LCP/layout-shift entries; Navigation/Resource Timing recorded encoded payload sizes. The initial document is included in total bytes. No API requests or search results are part of these homepage measurements.

| Median                                      |  Original | TRACEPUNK before | TRACEPUNK after |
| ------------------------------------------- | --------: | ---------------: | --------------: |
| Initial document + resource payload         | 169,456 B |        176,059 B |        72,256 B |
| Largest Contentful Paint                    |    520 ms |         2,956 ms |          660 ms |
| First Contentful Paint                      |    520 ms |           640 ms |          660 ms |
| Layout shift score in observation window    |     0.198 |            0.071 |           0.000 |
| Last initial same-origin resource completed |  1,235 ms |         1,322 ms |        1,192 ms |

TRACEPUNK transfers **57.4% fewer bytes than the original** and **59.0% fewer than its previous version**. Its LCP improved **77.7% against its own previous version**, but remains **140 ms slower than the original** in this sample. The resource-completion difference versus the original is small (~3.5%) and should not be presented as a robust general speedup. Resource completion is not a measurement of interactivity.

Original LCP range: 520–544 ms. TRACEPUNK before: 2,224–3,072 ms. TRACEPUNK after: 632–680 ms. The original's simpler headline and our larger, different design are not identical rendering workloads. Delayed locale replacement can also affect layout shifts. The observed zero score is not a guarantee of zero shifts in every language/device.

## Same work: 64 MiB file, twelve hash algorithms

Both public sites processed the identical synthetic file: the bytes 0–255 repeated to 67,108,864 bytes. All twelve resulting digests matched exactly in every run. SHA-256: `281e519df3077b557c6b03f5da83c4e8d397219259615dd7c3308f89cae8f2a6`.

Desktop CPU at normal speed, no network throttling, three runs each. Timing starts on the file input change event and ends when the table contains all twelve digests. A PerformanceObserver records main-thread tasks longer than 50 ms during the operation. The file is processed locally and never uploaded. All measured runs retained visible document state.

| Metric                                |       Original |        TRACEPUNK |
| ------------------------------------- | -------------: | ---------------: |
| Median computation + result rendering |       1,985 ms |         1,975 ms |
| Range                                 | 1,956–1,998 ms |   1,973–2,520 ms |
| Main-thread long tasks per run        |   16 / 16 / 16 |        0 / 0 / 0 |
| Longest recorded main-thread task     |         133 ms | none above 50 ms |
| Matching digests                      |          12/12 |            12/12 |

Computation speed is effectively tied; the ~0.5% median difference is not meaningful. TRACEPUNK's first run included extra worker/WASM startup and was slower. The concrete improvement is responsiveness: the expensive hashing runs in a worker rather than repeatedly blocking the main thread. Zero recorded long tasks does not mean zero CPU usage or a measured field INP.

## Limits and reproducibility

- Small sample, one computer, browser extensions present, emulated mobile conditions rather than a physical phone. No field Core Web Vitals, Lighthouse score, sustained-load benchmark or statistical confidence claim.
- Tests were performed sequentially without build/test processes competing with measured work. Raw results preserve individual samples rather than only a best run.
- Network speed includes the actual differences between Vercel and Cloudflare delivery/compression. This does not isolate compiler or language performance.
- Third-party API latency and incomplete remote results are excluded from speed comparisons. No exhaustive performance claim for all twenty tools.
- JSON export checked through the actual downloaded file; the automation download-event listener timed out, but the download itself succeeded.
- Browser performance emulation was removed from the deliverable tab; temporary measurement tabs were closed. No permanent instrumentation was added to the site.

Individual samples and digests: [performance-results.json](2026-11-01-performance-results.json).
