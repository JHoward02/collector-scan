/**
 * App styles. Every selector is scoped under `.cs-app` so nothing leaks into
 * Canvas. Colours prefer Canvas CSS variables and fall back to self-contained
 * values so the app renders correctly outside Canvas too.
 */

export const STYLE_MARKER = "collector-scan-styles";

export const styles = `
.cs-app {
  --cs-bg: var(--background, #ffffff);
  --cs-surface: var(--card, var(--secondary, #f7f7f8));
  --cs-border: var(--border, rgba(127, 127, 127, 0.28));
  --cs-text: var(--foreground, #16181d);
  --cs-muted: var(--muted-foreground, #6b7280);
  --cs-accent: var(--primary, #4f46e5);
  --cs-accent-text: var(--primary-foreground, #ffffff);
  --cs-danger: var(--destructive, #b42318);
  --cs-radius: 14px;
  --cs-tap: 44px;

  box-sizing: border-box;
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
.cs-title { font-size: 20px; font-weight: 650; letter-spacing: -0.01em; margin: 0; }
.cs-subtitle { color: var(--cs-muted); font-size: 13px; margin: 0; }
.cs-count {
  background: var(--cs-surface);
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
  background: var(--cs-bg);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.14);
  color: var(--cs-text);
}

/* ---------- forms ---------- */
.cs-search { display: flex; flex-direction: column; gap: 8px; }
.cs-search__row { display: flex; gap: 8px; }
.cs-input, .cs-select, .cs-textarea {
  background: var(--cs-bg);
  border: 1px solid var(--cs-border);
  border-radius: var(--cs-radius);
  color: var(--cs-text);
  font: inherit;
  min-height: var(--cs-tap);
  padding: 10px 12px;
  width: 100%;
}
.cs-textarea { min-height: 72px; resize: vertical; }
.cs-input::placeholder { color: var(--cs-muted); opacity: 0.85; }
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
  font-weight: 600;
  gap: 6px;
  justify-content: center;
  min-height: var(--cs-tap);
  padding: 10px 16px;
  white-space: nowrap;
}
.cs-button:disabled { cursor: not-allowed; opacity: 0.55; }
.cs-button--ghost {
  background: var(--cs-bg);
  border-color: var(--cs-border);
  color: var(--cs-text);
}
.cs-button--danger { background: transparent; border-color: var(--cs-border); color: var(--cs-danger); }
.cs-button--block { width: 100%; }

.cs-chips { display: flex; flex-wrap: wrap; gap: 7px; }
.cs-chip {
  background: var(--cs-bg);
  border: 1px solid var(--cs-border);
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
  font-weight: 600;
}
.cs-hint { color: var(--cs-muted); font-size: 12.5px; margin: 0; }

/* ---------- cards / results ---------- */
.cs-results { display: flex; flex-direction: column; gap: 10px; list-style: none; margin: 0; padding: 0; }
.cs-card {
  background: var(--cs-surface);
  border: 1px solid var(--cs-border);
  border-radius: var(--cs-radius);
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
  background: var(--cs-bg);
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
  display: flex;
  gap: 12px;
  padding: 10px;
}
.cs-item__actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.cs-item__value { font-size: 13px; font-variant-numeric: tabular-nums; }
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
.cs-star[aria-pressed="true"] { color: #e8a33d; }

.cs-toast {
  background: var(--cs-text);
  border-radius: 10px;
  bottom: 14px;
  color: var(--cs-bg);
  font-size: 13.5px;
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
