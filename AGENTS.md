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
- `src/app.ts` — view rendering and routing (search / candidate / collection /
  group / group-items)
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

## Theming

Brand is "Vault": warm amber (`--cs-accent`) on ink, with teal
(`--cs-group`) reserved for grouping. Amber reads as collectible — newsprint,
slab labels, dealer-case light — where the previous indigo read as generic
product UI. Grouping is teal rather than amber so membership is distinguishable
from primary actions at a glance.

- Dark is the unconditional base rule and the default. Light lives behind
  `@media (prefers-color-scheme: light)` guarded by `:not([data-theme="dark"])`,
  plus an explicit `.cs-app[data-theme="light"]` for forcing. Set
  `data-theme` on the app root to pin either one.
- `--cs-amber` / `--cs-teal` / `--cs-teal-deep` are the raw brand values;
  themes map them onto semantic tokens. Light redefines the semantic tokens
  only, so it inherits the raw palette from the base rule.
- The app paints its own ground rather than inheriting host `--background` /
  `--card`. Outside Canvas there are no host variables, and the collection
  should look deliberate there too. Only `--primary` / `--primary-foreground`
  are honoured, as accent hints. Do not route `--cs-group` through
  `--primary`: grouping must stay teal even when a host overrides the accent.
- `--cs-border-strong` is the interactive-control border and must clear 3:1
  against `--cs-bg` (WCAG 1.4.11). `--cs-border` is decorative only and is
  intentionally too low-contrast for a control outline. Use `border-strong` on
  inputs, chips, and ghost buttons.
- Card surfaces must stay 1.1–1.25 apart from `--cs-bg`; flatter than that and
  cards read as a continuation of the background, especially in light mode.
- The `brand palette` test block in `tests/extension.test.ts` computes real
  WCAG contrast from the stylesheet text, so a token change that breaks
  legibility fails the suite. It resolves `var()` fallbacks itself; keep tokens
  as plain hex (no `color-mix`, no `oklch`) or the resolver will not see them.

## Conventions

- Money is stored as numbers; `money()` renders `—` for null and
  `parseMoney()` rounds to cents.
- The header/list totals prefer recorded estimated values but fall back to
  price paid, so a collection with only purchase prices never reads `$0.00`.
- Single-keyword queries are capped below "Strong match" via `resultTokens`.
- The group item picker (`group/<id>/items`) writes each toggle straight
  through; there is no Save button. Rows are `<label>`s wrapping a checkbox —
  nesting the checkbox inside a `<button>` would be invalid markup.
- `resolveView()` must match the trailing `items` segment before the plain
  `group/<id>` case, or "items" is swallowed into the group id.

## Repository access

- The workspace `GITHUB_TOKEN` is a GitHub App user-to-server token (`ghu_`).
  Write access requires the OpenHands AI app to be *installed* on the
  repository, not merely authorized. Authorization alone grants account-level
  access and cannot write; public repos are still readable either way, which
  makes the failure look like a scope problem when it is an installation
  problem. Verify with a ref-creation probe rather than assuming.
- The existing PR is #1 (`initial-import` -> `main`). Push new work to
  `initial-import` rather than opening another PR.
- `git push` over HTTPS needs the token inline; the bare remote prompts for a
  username and hangs. Use
  `git push "https://x-access-token:${GITHUB_TOKEN}@github.com/OWNER/REPO.git" BRANCH`.
- Group links are page-relative (`group/<id>`), so `resolveView()` must accept
  both that and the absolute `collection/group/<id>` form.
