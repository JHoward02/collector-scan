# Collector Scan

Browser-only OpenHands Canvas App (Canvas Extensions API, manifest schema 1 /
host API 1). No backend, no Sidecar: the app runs entirely in the browser and
persists the collection to `localStorage`.

## Commands

- `npm run typecheck` — `tsc --noEmit`
- `npm test` — vitest, `tests/extension.test.ts`
- `npm run check` — typecheck + test + build + validate + validate:dist + smoke
  (use this before declaring work done)
- `npm run build && node scripts/sync-entrypoint.mjs` — rebuild the bundle that
  the preview server and the Canvas host actually load
- `node tests/smoke/preview.mjs [port]` — visual preview harness (not part of
  `check`)

## Layout

- `src/extension.ts` — `activate()`: builds `AppSession` + `CollectionStore`,
  registers the `collection` page, injects scoped styles
- `src/app.ts` — view rendering and routing (search / candidate / collection)
- `src/session.ts` — activation-scoped state, including `resultTokens`
- `src/match.ts` — scoring and `confidenceLabel(score, tokenCount?)`
- `src/providers/` — `openlibrary.ts`, `wikipedia.ts`
- `src/dom.ts` — DOM helpers incl. `thumbnail()` with a text fallback
- `tests/host-double.ts` — fake Canvas host for tests
- `tests/smoke/preview.mjs` — preview harness with stubbed provider payloads

## Provider rules

Only CORS-enabled public APIs. Both are verified to send
`access-control-allow-origin: *`.

- Open Library (`openlibrary.org/search.json`, covers via
  `covers.openlibrary.org`) — books / collected editions.
- Wikipedia (`en.wikipedia.org/w/api.php`) — comics, cards, other.
- Google Books is deliberately excluded (quota exhausted). Do not add it.

### Wikipedia images need `pilicense=any`

Comic and trading-card covers are almost always non-free files, and
`prop=pageimages` skips those by default. Without `pilicense=any` every comic
result renders the "No image" placeholder. This was a real bug; keep the
parameter and the assertion in the request-shape test.

## Testing gotchas

- The Canvas host passes paths relative to its own root, so the preview
  harness must strip the absolute prefix (`/extensions/collector-scan/collection`)
  before calling `mount()`. See the `relative()` helper in `preview.mjs`.
- `preview.mjs` stubs provider responses. If a stub omits a field the real API
  returns (e.g. `thumbnail`), the preview shows a fallback that never occurs in
  production — keep stubs faithful to live payloads.
- Cover URLs do decode in Chromium with `referrerpolicy="no-referrer"`; when an
  image looks missing, check the provider response before the render code.
- A screenshot whose hash is unchanged across reloads usually means the harness
  is serving stale or unchanged data, not that the app ignored a fix.

## Conventions

- Money is stored as numbers; `money()` renders `—` for null and
  `parseMoney()` rounds to cents.
- The header/list totals prefer recorded estimated values but fall back to
  price paid, so a collection with only purchase prices never reads `$0.00`.
- Single-keyword queries are capped below "Strong match" via `resultTokens`.

## Repository access

- The workspace `GITHUB_TOKEN` is a GitHub App installation token with
  read-only access to `JHoward02/collector-scan`. It can read refs and PRs but
  cannot create refs or push (`403 Resource not accessible by integration`).
  Commit locally and report the branch; a human must push.
- The existing PR is #1 (`initial-import` -> `main`). Push new work to
  `initial-import` rather than opening another PR.
- Group links are page-relative (`group/<id>`), so `resolveView()` must accept
  both that and the absolute `collection/group/<id>` form.
