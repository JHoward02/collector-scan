/**
 * App styles. Every selector is scoped under `.cs-app` so nothing leaks into
 * Canvas.
 *
 * Brand: "Vault" — warm amber on ink. Amber is the colour of newsprint, graded
 * slab labels, and dealer-case lighting, so it reads as *collectible* rather
 * than as generic product UI. Teal is reserved for grouping, which keeps group
 * membership legible at a glance without competing with primary actions.
 *
 * Dark is the default and is fully self-contained: the app has to look
 * deliberate when it renders outside Canvas, where there are no host variables
 * to inherit. Where a host does provide `--primary`, it nudges the accent only.
 * The collection is the point of the app, so the app paints its own ground
 * rather than borrowing an unpredictable one.
 */

export const STYLE_MARKER = "collector-scan-styles";

export const styles = `
.cs-app,
.cs-app[data-theme="dark"] {
  --cs-amber: #f5a524;
  --cs-amber-ink: #1a1305;
  --cs-teal: #2dd4bf;
  --cs-teal-deep: #0f766e;

  --cs-bg: #0c0e13;
  --cs-bg-tint: #131722;
  --cs-surface: #161a22;
  --cs-surface-2: #1e2430;
  --cs-border: #2a3140;
  --cs-border-strong: #5a667e;
  --cs-text: #f2efe6;
  --cs-muted: #98a2b3;
  --cs-accent: var(--primary, var(--cs-amber));
  --cs-accent-text: var(--primary-foreground, var(--cs-amber-ink));
  --cs-group: var(--cs-teal);
  --cs-danger: #fb7185;
  --cs-star: #f5a524;
  --cs-shadow: 0 1px 2px rgba(0, 0, 0, 0.45), 0 10px 26px -14px rgba(0, 0, 0, 0.75);

  --cs-radius: 14px;
  --cs-radius-sm: 9px;
  --cs-tap: 44px;

  box-sizing: border-box;
  color-scheme: dark;
  color: var(--cs-text);
  display: flex;
  flex-direction: column;
  gap: 14px;
  font-size: 15px;
  line-height: 1.45;
  margin: 0 auto;
  max-width: 760px;
  padding: 4px 0 96px;
  width: 100%;
}

/* Light is opt-in via the OS, or forced with data-theme="light". */
@media (prefers-color-scheme: light) {
  .cs-app:not([data-theme="dark"]) {
    --cs-bg: #f4f1e8;
    --cs-bg-tint: #eeeadf;
    --cs-surface: #ffffff;
    --cs-surface-2: #ede8db;
    --cs-border: #e3dccd;
    --cs-border-strong: #8f8266;
    --cs-text: #1a1712;
    --cs-muted: #6a6355;
    --cs-accent: var(--primary, #a85a00);
    --cs-accent-text: var(--primary-foreground, #ffffff);
    --cs-group: var(--cs-teal-deep);
    --cs-danger: #b42318;
    --cs-star: #b8860b;
    --cs-shadow: 0 1px 2px rgba(60, 50, 30, 0.08), 0 10px 26px -18px rgba(60, 50, 30, 0.45);
    color-scheme: light;
  }
}

.cs-app[data-theme="light"] {
  --cs-bg: #f4f1e8;
  --cs-bg-tint: #eeeadf;
  --cs-surface: #ffffff;
  --cs-surface-2: #ede8db;
  --cs-border: #e3dccd;
  --cs-border-strong: #8f8266;
  --cs-text: #1a1712;
  --cs-muted: #6a6355;
  --cs-accent: var(--primary, #a85a00);
  --cs-accent-text: var(--primary-foreground, #ffffff);
  --cs-group: var(--cs-teal-deep);
  --cs-danger: #b42318;
  --cs-star: #b8860b;
  --cs-shadow: 0 1px 2px rgba(60, 50, 30, 0.08), 0 10px 26px -18px rgba(60, 50, 30, 0.45);
  color-scheme: light;
}

.cs-app {
  /* A single soft wash from the top gives the surface depth without a flat
     fill; it is the app's own ground, so it never depends on the host. */
  background: radial-gradient(140% 70% at 50% 0%, var(--cs-bg-tint) 0%, var(--cs-bg) 62%);
  min-height: 100%;
}
.cs-app *, .cs-app *::before, .cs-app *::after { box-sizing: border-box; }

.cs-app :focus-visible {
  outline: 2px solid var(--cs-accent);
  outline-offset: 2px;
  border-radius: 6px;
}

.cs-visually-hidden {
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  height: 1px;
  overflow: hidden;
  position: absolute;
  white-space: nowrap;
  width: 1px;
}

/* ---------- header ---------- */
.cs-header { display: flex; flex-direction: column; gap: 10px; padding: 0 2px; }
.cs-header__row { align-items: center; display: flex; gap: 10px; justify-content: space-between; }
.cs-title { font-size: 20px; font-weight: 700; letter-spacing: -0.015em; margin: 0; }
/* The wordmark carries a small amber rule, the app's one recurring signature. */
.cs-title::after {
  background: var(--cs-accent);
  border-radius: 2px;
  content: "";
  display: block;
  height: 2px;
  margin-top: 4px;
  width: 26px;
}
.cs-subtitle { color: var(--cs-muted); font-size: 13px; margin: 0; }
.cs-count {
  background: var(--cs-surface-2);
  border: 1px solid var(--cs-border);
  border-radius: 999px;
  color: var(--cs-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  padding: 3px 10px;
  white-space: nowrap;
}

/* ---------- tabs ---------- */
.cs-tabs {
  background: var(--cs-surface);
  border: 1px solid var(--cs-border);
  border-radius: 999px;
  display: grid;
  gap: 4px;
  grid-template-columns: 1fr 1fr;
  padding: 4px;
}
.cs-tab {
  background: transparent;
  border: 0;
  border-radius: 999px;
  color: var(--cs-muted);
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  font-weight: 550;
  min-height: 38px;
  padding: 8px 12px;
}
.cs-tab[aria-selected="true"] {
  background: var(--cs-accent);
  color: var(--cs-accent-text);
  font-weight: 650;
}

/* ---------- forms ---------- */
.cs-search { display: flex; flex-direction: column; gap: 8px; }
.cs-search__row { display: flex; gap: 8px; }
.cs-input, .cs-select, .cs-textarea {
  background: var(--cs-bg);
  border: 1px solid var(--cs-border-strong);
  border-radius: var(--cs-radius);
  color: var(--cs-text);
  font: inherit;
  min-height: var(--cs-tap);
  padding: 10px 12px;
  width: 100%;
}
.cs-textarea { min-height: 72px; resize: vertical; }
.cs-input::placeholder { color: var(--cs-muted); opacity: 0.9; }
.cs-input:focus, .cs-select:focus, .cs-textarea:focus { border-color: var(--cs-accent); }
.cs-field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.cs-field__label { color: var(--cs-muted); font-size: 12px; font-weight: 600; letter-spacing: 0.02em; text-transform: uppercase; }

.cs-button {
  align-items: center;
  background: var(--cs-accent);
  border: 1px solid transparent;
  border-radius: var(--cs-radius);
  color: var(--cs-accent-text);
  cursor: pointer;
  display: inline-flex;
  font: inherit;
  font-weight: 650;
  gap: 6px;
  justify-content: center;
  min-height: var(--cs-tap);
  padding: 10px 16px;
  white-space: nowrap;
}
.cs-button:disabled { cursor: not-allowed; opacity: 0.55; }
.cs-button--ghost {
  background: var(--cs-surface);
  border-color: var(--cs-border-strong);
  color: var(--cs-text);
}
.cs-button--danger { background: transparent; border-color: var(--cs-border); color: var(--cs-danger); }
.cs-button--block { width: 100%; }

.cs-chips { display: flex; flex-wrap: wrap; gap: 7px; }
.cs-chip {
  background: var(--cs-surface);
  border: 1px solid var(--cs-border-strong);
  border-radius: 999px;
  color: var(--cs-muted);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  min-height: 34px;
  padding: 5px 12px;
}
.cs-chip[aria-pressed="true"] {
  background: var(--cs-accent);
  border-color: var(--cs-accent);
  color: var(--cs-accent-text);
  font-weight: 650;
}
/* Group names get long ("Sonic the Hedgehog Comics from Archie"), so this row
   scrolls sideways on a phone instead of wrapping into a tall stack. */
.cs-chips--scroll {
  flex-wrap: nowrap;
  margin: 0 -2px;
  overflow-x: auto;
  padding: 2px;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.cs-chips--scroll::-webkit-scrollbar { display: none; }
.cs-chips--scroll .cs-chip { flex: 0 0 auto; white-space: nowrap; }
.cs-chip--new { border-style: dashed; }
.cs-hint { color: var(--cs-muted); font-size: 12.5px; margin: 0; }

/* ---------- cards / results ---------- */
.cs-results { display: flex; flex-direction: column; gap: 10px; list-style: none; margin: 0; padding: 0; }
.cs-card {
  background: var(--cs-surface);
  border: 1px solid var(--cs-border);
  border-radius: var(--cs-radius);
  box-shadow: var(--cs-shadow);
  display: flex;
  gap: 12px;
  padding: 10px;
}
.cs-card--tappable { cursor: pointer; text-align: left; width: 100%; font: inherit; color: inherit; }
.cs-card__body { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; }
.cs-card__title { font-size: 15px; font-weight: 620; margin: 0; overflow-wrap: anywhere; }
.cs-card__meta { color: var(--cs-muted); font-size: 12.5px; margin: 0; overflow-wrap: anywhere; }
.cs-card__desc { font-size: 13px; margin: 0; overflow-wrap: anywhere; }
.cs-card__tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 2px; }

.cs-tag {
  background: var(--cs-surface-2);
  border: 1px solid var(--cs-border);
  border-radius: 6px;
  color: var(--cs-muted);
  font-size: 11px;
  letter-spacing: 0.03em;
  padding: 2px 7px;
  text-transform: uppercase;
}
.cs-tag--score { color: var(--cs-text); font-variant-numeric: tabular-nums; }
.cs-tag--muted { color: var(--cs-muted); font-style: italic; }
.cs-tag--group {
  border-color: var(--cs-group);
  color: var(--cs-group);
  font-weight: 600;
}

/* ---------- groups ---------- */
.cs-item__group { margin: 0; }
.cs-grouptag {
  background: transparent;
  border: 0;
  color: var(--cs-group);
  cursor: pointer;
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  padding: 0;
  text-align: left;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.cs-media {
  align-items: center;
  background: var(--cs-bg);
  border: 1px solid var(--cs-border);
  border-radius: 10px;
  display: flex;
  flex: none;
  justify-content: center;
  overflow: hidden;
}
.cs-media--thumb { height: 84px; width: 84px; }
.cs-media--hero { aspect-ratio: 3 / 2; max-height: 260px; width: 100%; }
.cs-media__img { height: 100%; object-fit: contain; width: 100%; }
.cs-media__glyph {
  color: var(--cs-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-align: center;
}
.cs-media__note {
  color: var(--cs-muted);
  font-size: 10px;
  letter-spacing: 0.02em;
  opacity: 0.75;
  text-align: center;
}
/* The thumbnail is small; keep only the glyph there and let the hero explain. */
.cs-media--thumb .cs-media__note { display: none; }

/* ---------- states ---------- */
.cs-state {
  align-items: center;
  border: 1px dashed var(--cs-border);
  border-radius: var(--cs-radius);
  color: var(--cs-muted);
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 26px 18px;
  text-align: center;
}
.cs-state__title { color: var(--cs-text); font-size: 15px; font-weight: 600; margin: 0; }
.cs-state__body { font-size: 13.5px; margin: 0; max-width: 42ch; }
.cs-state--error { border-color: var(--cs-danger); border-style: solid; }
.cs-state--error .cs-state__title { color: var(--cs-danger); }

.cs-spinner {
  animation: cs-spin 0.9s linear infinite;
  border: 2.5px solid var(--cs-border);
  border-radius: 50%;
  border-top-color: var(--cs-accent);
  height: 26px;
  width: 26px;
}
@keyframes cs-spin { to { transform: rotate(360deg); } }

.cs-skeleton { display: flex; flex-direction: column; gap: 10px; }
.cs-skeleton__row {
  animation: cs-pulse 1.4s ease-in-out infinite;
  background: var(--cs-surface);
  border-radius: var(--cs-radius);
  height: 104px;
}
@keyframes cs-pulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }

/* ---------- detail ---------- */
.cs-detail { display: flex; flex-direction: column; gap: 14px; }
.cs-section {
  background: var(--cs-surface);
  border: 1px solid var(--cs-border);
  border-radius: var(--cs-radius);
  box-shadow: var(--cs-shadow);
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
}
.cs-section__title { font-size: 13px; font-weight: 650; letter-spacing: 0.02em; margin: 0; text-transform: uppercase; color: var(--cs-muted); }
.cs-detail__head { display: flex; flex-direction: column; gap: 6px; }
.cs-detail__title { font-size: 19px; font-weight: 650; line-height: 1.25; margin: 0; overflow-wrap: anywhere; }
.cs-detail__sub { color: var(--cs-muted); font-size: 13.5px; margin: 0; }
.cs-detail__desc { font-size: 14px; margin: 0; }
.cs-detail__link { color: var(--cs-accent); font-size: 13.5px; }
.cs-dl { display: grid; gap: 6px 12px; grid-template-columns: minmax(0, 1fr); margin: 0; }
.cs-dl__row { border-bottom: 1px solid var(--cs-border); display: flex; gap: 10px; justify-content: space-between; padding-bottom: 6px; }
.cs-dl__row:last-child { border-bottom: 0; padding-bottom: 0; }
.cs-dl dt { color: var(--cs-muted); font-size: 13px; margin: 0; }
.cs-dl dd { font-size: 13.5px; margin: 0; text-align: right; overflow-wrap: anywhere; }

.cs-grid2 { display: grid; gap: 10px; grid-template-columns: 1fr 1fr; }

.cs-item {
  align-items: stretch;
  background: var(--cs-surface);
  border: 1px solid var(--cs-border);
  border-radius: var(--cs-radius);
  box-shadow: var(--cs-shadow);
  display: flex;
  gap: 12px;
  padding: 10px;
}
.cs-item__actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.cs-item__value { font-size: 13px; font-variant-numeric: tabular-nums; }

/* ---------- group item picker ---------- */
.cs-pick {
  align-items: center;
  background: var(--cs-surface);
  border: 1px solid var(--cs-border);
  border-radius: var(--cs-radius);
  cursor: pointer;
  display: flex;
  gap: 12px;
  min-height: var(--cs-tap);
  padding: 10px;
}
.cs-pick--on {
  border-color: var(--cs-group);
  box-shadow: inset 0 0 0 1px var(--cs-group);
}
.cs-pick__box {
  accent-color: var(--cs-group);
  flex: none;
  height: 20px;
  margin: 0;
  width: 20px;
}
.cs-pick__body { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
.cs-pick__state {
  color: var(--cs-group);
  flex: none;
  font-size: 17px;
  font-weight: 700;
  min-width: 18px;
  text-align: right;
}
.cs-star {
  background: transparent;
  border: 0;
  color: var(--cs-muted);
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
  min-height: 34px;
  min-width: 34px;
  padding: 4px;
}
.cs-star[aria-pressed="true"] { color: var(--cs-star); }

.cs-toast {
  background: var(--cs-accent);
  border-radius: 10px;
  bottom: 14px;
  box-shadow: var(--cs-shadow);
  color: var(--cs-accent-text);
  font-size: 13.5px;
  font-weight: 550;
  left: 50%;
  max-width: calc(100% - 24px);
  padding: 10px 14px;
  position: fixed;
  transform: translateX(-50%);
  z-index: 40;
}

.cs-toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: end; }
.cs-toolbar > .cs-field { flex: 1 1 132px; }

@media (min-width: 640px) {
  .cs-dl { grid-template-columns: 1fr 1fr; }
  .cs-dl__row { border-bottom: 0; flex-direction: column; gap: 2px; padding-bottom: 0; }
  .cs-dl dd { text-align: left; }
}

@media (prefers-reduced-motion: reduce) {
  .cs-app * { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; }
}
`;
