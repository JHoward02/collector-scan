import { el } from "./dom.ts";

const CONTACT_EMAIL = "getshelfiecollect@gmail.com";
const CARDLISTS_URL = "https://github.com/robert-porter/CardLists";

const MIT_NOTICE = `MIT License

Copyright (c) 2025 JunkWaxData

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;

function ensureFooterStyles(): void {
  if (document.querySelector("#shelfie-footer-styles")) return;
  const style = document.createElement("style");
  style.id = "shelfie-footer-styles";
  style.textContent = `
.cs-footer{display:flex;justify-content:center;align-items:center;gap:10px;flex-wrap:wrap;margin:8px auto 28px;padding:18px 16px 0;border-top:1px solid var(--cs-border,#2a3140);max-width:760px;color:var(--cs-muted,#98a2b3);font-size:13px}
.cs-footer__link{appearance:none;background:none;border:0;color:inherit;cursor:pointer;font:inherit;padding:6px 2px;text-decoration:none}.cs-footer__link:hover,.cs-footer__link:focus-visible{color:var(--cs-accent,#f5a524);text-decoration:underline}.cs-footer__dot{opacity:.55}
.cs-info-dialog{width:min(620px,calc(100vw - 32px));max-height:80vh;padding:0;border:1px solid #2a3140;border-radius:14px;background:#161a22;color:#f2efe6;box-shadow:0 24px 70px rgba(0,0,0,.55)}.cs-info-dialog::backdrop{background:rgba(0,0,0,.7)}.cs-info-dialog__body{padding:22px;line-height:1.5}.cs-info-dialog__head{display:flex;align-items:center;justify-content:space-between;gap:16px}.cs-info-dialog__title{margin:0;font-size:22px}.cs-info-dialog__subtitle{margin:22px 0 6px}.cs-info-dialog__close{border:1px solid #5a667e;border-radius:9px;background:#1e2430;color:#f2efe6;padding:8px 12px;cursor:pointer}.cs-info-dialog a{color:#f5a524}.cs-license{margin-top:18px;padding:14px;border-radius:9px;background:#0c0e13;white-space:pre-wrap;overflow-wrap:anywhere;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:#cbd2df}
`;
  document.head.append(style);
}

function infoDialog(title: string, children: HTMLElement[]): HTMLDialogElement {
  const dialog = el("dialog", { class: "cs-info-dialog" }, [el("div", { class: "cs-info-dialog__body" }, [
    el("div", { class: "cs-info-dialog__head" }, [el("h2", { class: "cs-info-dialog__title", text: title }), el("button", { class: "cs-info-dialog__close", text: "Close", attrs: { type: "button", "aria-label": `Close ${title}` }, on: { click: () => dialog.close() } })]),
    ...children,
  ])]) as HTMLDialogElement;
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  document.body.append(dialog);
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  return dialog;
}

export function renderFooter(): HTMLElement {
  ensureFooterStyles();
  const openAbout = (): void => infoDialog("About Shelfie", [
    el("p", { text: "Shelfie is a simple place to log, organize, and enjoy the collectibles you already own." }),
    el("p", { text: "Search for an item, confirm the right match, add your own collection details, and keep everything organized on your Shelfie." }),
  ]).showModal();
  const openAttribution = (): void => infoDialog("Attribution", [
    el("p", { text: "Shelfie uses open data and services to help identify collectibles. We’re grateful to the projects and contributors who make that possible." }),
    el("h3", { class: "cs-info-dialog__subtitle", text: "CardLists / JunkWaxData" }),
    el("p", { text: "Sports-card checklist data may be provided by CardLists, an open-source project licensed under the MIT License." }),
    el("a", { text: "View CardLists on GitHub", attrs: { href: CARDLISTS_URL, target: "_blank", rel: "noopener noreferrer" } }),
    el("pre", { class: "cs-license", text: MIT_NOTICE }),
  ]).showModal();

  return el("footer", { class: "cs-footer", attrs: { "aria-label": "Shelfie information" } }, [
    el("a", { class: "cs-footer__link", text: "Contact Us", attrs: { href: `mailto:${CONTACT_EMAIL}?subject=Shelfie%20feedback` } }),
    el("span", { class: "cs-footer__dot", text: "·", attrs: { "aria-hidden": "true" } }),
    el("button", { class: "cs-footer__link", text: "About", attrs: { type: "button" }, on: { click: openAbout } }),
    el("span", { class: "cs-footer__dot", text: "·", attrs: { "aria-hidden": "true" } }),
    el("button", { class: "cs-footer__link", text: "Attribution", attrs: { type: "button" }, on: { click: openAttribution } }),
  ]);
}
