# Workers Free Implementation Plan

Goal: package every existing tool for Svelte static assets plus a TypeScript Worker.
Architecture: Workers Static Assets serves the UI; /api/* invokes bounded TypeScript handlers preserving the Python API contracts.
Tech stack: Svelte, TypeScript, Wrangler, Vitest.
Spec: ../specs/2026-11-01-workers-design.md

## Constraints

No deployment, paid resources, name change or removal of attribution. No arbitrary outbound proxy or automatic redirects. Preserve user-facing functions.

## Review focus

Invalid destinations and redirects; timeout/body limits; malformed upstream data; optional secrets absent; static and API routing isolation.

## Tasks

- [x] Port username and Telegram handlers with fixture tests.
- [x] Port URL and reputation handlers with fixture tests.
- [x] Implement common transport, Wayback handler, routing and configuration; validate errors and limits.
- [x] Adapt frontend API integration, document local use/free limits, add CI.
- [x] Run existing tests, new tests, type checks, build, dry run and local runtime smoke tests. Review combined changes.
