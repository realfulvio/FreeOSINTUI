# First paint and populated-result readability — 2026-11-01

PR #3: https://github.com/realfulvio/tracepunk/pull/3

Deployed merge `d693d69964d6aca5819a3cdb4f1499f6247beb51`, Worker version `5915a531-ce05-4e18-9ff5-ac8a51fbb40e`.

## Readability defect found by the user

The RDAP table on `/ip?q=8.8.8.8` was unreadable: the long contact-role label expanded an intrinsic-width column and squeezed every value into a narrow strip. Empty-page smoke checks in the previous pass had missed this populated state.

The shared KeyValueTable now reserves 40%/60% tracks for labels/values, with wrapping allowed on both sides. IP result cards have a 28rem minimum instead of 26rem and align to their own height. This prevents three cramped cards and avoids stretching short panels to match a tall neighbor.

Verified actual IPv4 and IPv6 provider results, including RDAP ranges and long contact labels. At widths 390, 768, 1024, 1440 and 1920, the IPv4 value columns measured approximately 301, 379, 246, 356 and 356 CSS pixels, with no overflowing `dt`/`dd` elements or page-width overflow. Production IPv4 recheck: minimum value width 356px, zero table overflows. Also checked populated domain results (four definition lists) and sample email-header analysis (ten definition lists): no overflowing cells. This does not claim exhaustive visual coverage of every possible provider payload.

## CSS delivery optimization

SvelteKit `inlineStyleThreshold: 16384` embeds small route styles into the HTML. Homepage CSS definitions, colors, artwork, layout and animation keyframes are unchanged by this setting. Styles arrive without the additional render-blocking requests. Larger styles remain separate/cacheable; embedded styles increase HTML size, a deliberate tradeoff.

On the public site, checked running artwork animations, paused all seven artwork animations with the toggle, and resumed them. Client navigation from home to the hash tool succeeded, and `abc` produced MD5 `900150983cd24fb0d6963f7d28e17f72`.

## New paired measurements

Same conditions as the prior report: Chrome desktop profile, mobile viewport 390×844 DPR1, CPU slowdown4, latency150ms, download200000 B/s, upload93750 B/s, HTTP cache disabled, Italian locale. Three alternating original/TRACEPUNK runs, each observed for five seconds. Browser extensions present, network connections/CDN potentially warm. Only the public deployments are included; a preliminary local test with stale preview assets was discarded.

| Metric                             |         Original |        TRACEPUNK |
| ---------------------------------- | ---------------: | ---------------: |
| LCP runs                           | 528, 536, 564 ms | 392, 400, 380 ms |
| Median LCP                         |           536 ms |           392 ms |
| Median encoded initial payload     |        169,456 B |         71,715 B |
| Median observed layout shift score |            0.198 |            0.072 |

LCP is **26.9% lower than the original in this sample**, and **40.6% lower than TRACEPUNK's prior 660ms median**. Initial payload is 57.7% lower than the original. Earlier rendering can expose the subsequent English-to-Italian locale replacement: two runs recorded ~0.072 layout shift and one recorded zero. Do not reuse the prior zero-shift claim for this version.

These are lab observations, not field INP, a Lighthouse score, or a guarantee that every tool runs faster. The earlier identical-work hash benchmark remains relevant because hashing code is unchanged.

Individual samples: [first-paint-results.json](2026-11-01-first-paint-results.json).

Validation: both CI checks passed (622 frontend and 130 Worker tests, lint, Worker types, build/dry-run). No secret values, billing changes or Maneggio resources are part of this change.
