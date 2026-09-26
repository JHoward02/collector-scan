/** Small DOM helpers. Everything goes through DOM APIs, never raw HTML strings. */

export type Child = Node | string | null | undefined | false;

export interface ElementOptions {
  class?: string;
  text?: string;
  attrs?: Record<string, string | number | boolean | null | undefined>;
  on?: Record<string, EventListener>;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {},
  children: Child[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.class) node.className = options.class;
  if (options.text != null) node.textContent = options.text;
  for (const [name, value] of Object.entries(options.attrs ?? {})) {
    if (value == null || value === false) continue;
    node.setAttribute(name, value === true ? "" : String(value));
  }
  for (const [type, listener] of Object.entries(options.on ?? {})) {
    node.addEventListener(type, listener);
  }
  for (const child of children) {
    if (child == null || child === false) continue;
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Append a possibly-absent child, so conditional content reads inline. */
export function append(parent: HTMLElement, child: Child): void {
  if (child == null || child === false) return;
  parent.append(typeof child === "string" ? document.createTextNode(child) : child);
}

/** Only https URLs are accepted, so provider data can never inject a script URL. */
export function safeUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

/**
 * Thumbnail with a text fallback. Returns a wrapper so a broken image degrades
 * into a labelled placeholder instead of an empty box.
 */
export function thumbnail(
  rawUrl: string | null,
  glyph: string,
  alt: string,
  variant: "thumb" | "hero" = "thumb",
): HTMLElement {
  const safe = safeUrl(rawUrl);
  const wrap = el("div", { class: `cs-media cs-media--${variant}` });
  const placeholder = (): void => {
    clear(wrap);
    wrap.append(
      el("span", { class: "cs-media__glyph", text: glyph }),
      el("span", { class: "cs-media__note", text: "No image" }),
    );
    wrap.setAttribute("role", "img");
    wrap.setAttribute("aria-label", `${alt} (no image available)`);
  };
  if (!safe) {
    placeholder();
    return wrap;
  }
  const img = el("img", {
    class: "cs-media__img",
    attrs: { src: safe, alt, loading: "lazy", decoding: "async", referrerpolicy: "no-referrer" },
  });
  img.addEventListener("error", placeholder);
  wrap.append(img);
  return wrap;
}

export function money(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `$${value.toFixed(2)}`;
}

export function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : null;
}
