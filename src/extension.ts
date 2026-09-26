import { CollectorApp } from "./app.ts";
import { clear } from "./dom.ts";
import type { CanvasExtensionHost, CanvasExtensionPageContext } from "./host.ts";
import { STYLE_MARKER, styles } from "./styles.ts";
import { BRAND_STYLE_MARKER, brandStyles } from "./brand-styles.ts";
import { clearSession, createSession, type AppSession } from "./session.ts";

const PAGE_ID = "collection";
const SUPPORTED_API_VERSION = "1";

function injectStyle(marker: string, css: string): () => void {
  const existing = document.querySelector(`style[data-cs="${marker}"]`);
  const style = document.createElement("style");
  style.setAttribute("data-cs", marker);
  style.textContent = css;
  if (existing) existing.replaceWith(style);
  else document.head.append(style);
  return () => { if (style.parentNode) style.parentNode.removeChild(style); };
}

export function activate(host: CanvasExtensionHost): () => void {
  if (host.apiVersion !== SUPPORTED_API_VERSION) {
    throw new Error(`Collector Scan requires Canvas host API ${SUPPORTED_API_VERSION}; received ${host.apiVersion}.`);
  }

  const removeStyles = injectStyle(STYLE_MARKER, styles);
  const removeBrandStyles = injectStyle(BRAND_STYLE_MARKER, brandStyles);
  const session: AppSession = createSession();

  const unregister = host.registerPage(PAGE_ID, async (context: CanvasExtensionPageContext) => {
    const app = new CollectorApp(host, session, context.navigate, context.path);
    const unmount = app.mount(context.container);
    return () => {
      unmount();
      clear(context.container);
    };
  });

  return () => {
    unregister();
    removeBrandStyles();
    removeStyles();
    clearSession(session);
  };
}

export default { activate };
