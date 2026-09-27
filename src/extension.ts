import { CollectorApp } from "./app.ts";
import { clear } from "./dom.ts";
import type { CanvasExtensionHost, CanvasExtensionPageContext } from "./host.ts";
import { STYLE_MARKER, styles } from "./styles.ts";
import { BRAND_STYLE_MARKER, brandStyles } from "./brand-styles.ts";
import { clearSession, createSession, type AppSession } from "./session.ts";
import { clearSearchSelection, enhanceSearchSelection } from "./search-selection.ts";

const PAGE_ID = "collection";
const SUPPORTED_API_VERSION = "1";

function injectStyle(marker: string, css: string): () => void {
  const existing = document.querySelector(`style[data-cs="${marker}"]`);
  const style = document.createElement("style");
  style.setAttribute("data-cs", marker);
  style.textContent = css;
  if (existing) existing.replaceWith(style); else document.head.append(style);
  return () => { if (style.parentNode) style.parentNode.removeChild(style); };
}

function enhanceLogoHome(container: HTMLElement, goHome: () => void): void {
  const logo = container.querySelector<HTMLElement>(".cs-title");
  if (!logo) return;

  // Render the brand art as a real image inside the existing title element.
  // The click target is the title wrapper; the image itself never intercepts
  // pointer events, so navigation styling cannot cover or clip the artwork.
  let image = logo.querySelector<HTMLImageElement>(".cs-title__logo");
  if (!image) {
    logo.replaceChildren();
    image = document.createElement("img");
    image.className = "cs-title__logo";
    image.src = `${import.meta.env.BASE_URL}LogoV3.png?v=logo-real-1`;
    image.alt = "Shelfie";
    image.decoding = "async";
    image.draggable = false;
    logo.append(image);
  }

  if (logo.dataset.shelfieHome === "true") return;
  logo.dataset.shelfieHome = "true";
  logo.setAttribute("role", "link");
  logo.setAttribute("tabindex", "0");
  logo.setAttribute("aria-label", "Shelfie home");
  logo.addEventListener("click", goHome);
  logo.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      goHome();
    }
  });
}

export function activate(host: CanvasExtensionHost): () => void {
  if (host.apiVersion !== SUPPORTED_API_VERSION) throw new Error(`Collector Scan requires Canvas host API ${SUPPORTED_API_VERSION}; received ${host.apiVersion}.`);
  const removeStyles = injectStyle(STYLE_MARKER, styles);
  const removeBrandStyles = injectStyle(BRAND_STYLE_MARKER, brandStyles);
  const session: AppSession = createSession();

  const unregister = host.registerPage(PAGE_ID, async (context: CanvasExtensionPageContext) => {
    const app = new CollectorApp(host, session, context.navigate, context.path);
    const unmount = app.mount(context.container);
    const goHome = (): void => {
      session.activeTab = "search";
      context.navigate(`/extensions/${encodeURIComponent(host.extension.name)}/collection`);
    };
    const enhance = (): void => {
      enhanceSearchSelection(context.container);
      enhanceLogoHome(context.container, goHome);
    };
    enhance();
    // CollectorApp re-renders after searches and tab changes. Re-attach
    // progressive enhancements to the newly rendered DOM.
    const observer = new MutationObserver(enhance);
    observer.observe(context.container, { childList: true, subtree: true });
    return () => { observer.disconnect(); unmount(); clear(context.container); };
  });

  return () => {
    unregister(); removeBrandStyles(); removeStyles(); clearSearchSelection(); clearSession(session);
  };
}

export default { activate };
