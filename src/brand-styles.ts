export const BRAND_STYLE_MARKER = "shelfie-brand-v021";

export const brandStyles = `
.cs-app {
  --cs-bg: #f7f5ef !important;
  --cs-bg-tint: #fffdf8 !important;
  --cs-surface: #ffffff !important;
  --cs-surface-2: #f2f4f7 !important;
  --cs-border: #e2e6ec !important;
  --cs-border-strong: #aab4c3 !important;
  --cs-text: #07111f !important;
  --cs-muted: #667085 !important;
  --cs-accent: #ffcf18 !important;
  --cs-accent-text: #07111f !important;
  --cs-group: #087dcc !important;
  --cs-danger: #ef2b2d !important;
  --cs-shadow: 0 12px 34px -24px rgba(7,17,31,.32) !important;
  color-scheme: light !important;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
  max-width: 1040px !important;
  gap: 20px !important;
  padding: 20px 22px 110px !important;
}
.cs-app { background: linear-gradient(180deg,#fff 0,#f7f5ef 34%,#f7f5ef 100%) !important; }
.cs-header { padding: 0 !important; gap: 4px !important; }
.cs-header__row { min-height: 82px; }
.cs-title { font-size: 0 !important; display:flex; align-items:center; gap:12px; }
.cs-title[data-shelfie-home="true"] { cursor:pointer; width:max-content; border-radius:8px; }
.cs-title[data-shelfie-home="true"]:focus-visible { outline:3px solid #087dcc; outline-offset:5px; }
.cs-title::before { content:"SHELFIE"; font-size:30px; line-height:1; font-weight:950; font-style:italic; letter-spacing:-.05em; color:#ffcf18; -webkit-text-stroke: 2px #07111f; text-shadow:3px 3px 0 #ef2b2d; }
.cs-title::after { display:none !important; }
.cs-subtitle { display:none !important; }
.cs-count { background:#07111f !important; border:0 !important; color:#fff !important; font-weight:700; padding:8px 12px !important; }
.cs-tabs { align-self:flex-end; width:auto; display:flex !important; background:transparent !important; border:0 !important; border-radius:10px !important; padding:0 !important; margin-top:-62px; z-index:2; margin-right:150px; }
.cs-tab { border-radius:9px !important; min-height:38px !important; color:#475467 !important; padding:8px 14px !important; }
.cs-tab[aria-selected="true"] { background:#07111f !important; color:#fff !important; }
.cs-search { gap:14px !important; padding-top:44px; }
.cs-search::before { content:"Add to your Shelfie"; display:block; font-size:clamp(30px,5vw,52px); font-weight:850; letter-spacing:-.045em; line-height:1.02; max-width:680px; color:#07111f; }
.cs-search::after { content:"Search comics, sports cards, books, and more. Find it, save it, build your Shelfie."; display:block; order:-1; color:#667085; font-size:16px; margin-top:-6px; }
.cs-search__row { background:#fff; border:2px solid #07111f; border-radius:18px; padding:5px; box-shadow:0 18px 44px -28px rgba(7,17,31,.45); }
.cs-search__row .cs-input { border:0 !important; background:#fff !important; min-height:54px !important; font-size:16px; padding-left:16px !important; }
.cs-search__row .cs-input:focus { outline:0 !important; }
.cs-search__row .cs-button { background:#ef2b2d !important; color:#fff !important; border-radius:12px !important; min-width:112px; }
.cs-button { background:#07111f !important; color:#fff !important; border-radius:10px !important; }
.cs-button--ghost { background:#fff !important; color:#07111f !important; }
.cs-chips { gap:8px !important; }
.cs-chip { background:#fff !important; color:#344054 !important; border-color:#d0d5dd !important; min-height:38px !important; font-weight:650; }
.cs-chip[aria-pressed="true"] { background:#ffcf18 !important; color:#07111f !important; border-color:#07111f !important; box-shadow:2px 2px 0 #07111f; }
.cs-state,.cs-card { border-color:#e4e7ec !important; box-shadow:0 12px 34px -26px rgba(7,17,31,.35) !important; }
.cs-card { border-radius:16px !important; }
.cs-media { background:#f2f4f7 !important; }
.cs-tag--group,.cs-grouptag { color:#087dcc !important; }
.cs-toast { background:#07111f !important; color:#fff !important; }
.cs-suggestions, .cs-state { background:#fff !important; }
@media (max-width: 640px) {
  .cs-app { padding:14px 14px 92px !important; gap:14px !important; }
  .cs-header__row { min-height:66px; }
  .cs-title::before { font-size:25px; -webkit-text-stroke:1.5px #07111f; text-shadow:2px 2px 0 #ef2b2d; }
  .cs-count { font-size:11px !important; padding:6px 9px !important; }
  .cs-tabs { margin:0 !important; align-self:stretch; justify-content:space-between; border-bottom:1px solid #e4e7ec !important; }
  .cs-tab { flex:1; }
  .cs-search { padding-top:12px; }
  .cs-search::before { font-size:34px; }
  .cs-search__row { flex-direction:column; border:0; background:transparent; padding:0; box-shadow:none; }
  .cs-search__row .cs-input { border:2px solid #07111f !important; border-radius:14px !important; }
  .cs-search__row .cs-button { width:100%; min-height:50px !important; }
}
`;
