import extension from "./extension.ts";
import type { CanvasExtensionHost, CanvasExtensionPageMount } from "./host.ts";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Missing #app root");

let mountPage: CanvasExtensionPageMount | null = null;
let cleanup: void | (() => void);

function routePath(): string {
  const hash = location.hash.replace(/^#\/?/, "");
  return hash || "";
}

async function render(): Promise<void> {
  if (!mountPage) return;
  if (typeof cleanup === "function") cleanup();
  root.replaceChildren();
  cleanup = await mountPage({
    container: root,
    path: routePath(),
    navigate(path: string) {
      const marker = "/collection";
      const index = path.indexOf(marker);
      const relative = index >= 0 ? path.slice(index + marker.length).replace(/^\//, "") : "";
      location.hash = relative ? `#/${relative}` : "#/";
    },
  });
}

const host: CanvasExtensionHost = {
  apiVersion: "1",
  extension: { name: "collector-scan", version: "0.1.0", resolvedRef: null },
  backend: { id: "standalone", kind: "local", orgId: null },
  registerPage(_contributionId, mount) {
    mountPage = mount;
    void render();
    return () => {
      mountPage = null;
      if (typeof cleanup === "function") cleanup();
      cleanup = undefined;
    };
  },
  navigate(path) {
    const marker = "/collection";
    const index = path.indexOf(marker);
    const relative = index >= 0 ? path.slice(index + marker.length).replace(/^\//, "") : "";
    location.hash = relative ? `#/${relative}` : "#/";
  },
  agentServer: {
    async request<T>(): Promise<T> {
      throw new Error("Agent server is unavailable in the standalone web build.");
    },
  },
};

extension.activate(host);
window.addEventListener("hashchange", () => void render());
