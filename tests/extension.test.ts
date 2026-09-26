import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activate } from "../src/extension.ts";
import { confidenceLabel } from "../src/match.ts";
import { styles } from "../src/styles.ts";
import { createHostDouble, jsonResponse } from "./host-double.ts";

describe("brand palette", () => {
  const blockFor = (selector: string): string => {
    const start = styles.indexOf(selector);
    expect(start, `missing theme block: ${selector}`).toBeGreaterThan(-1);
    return styles.slice(start, styles.indexOf("}", start));
  };

  /** WCAG relative luminance. */
  const luminance = (hex: string): number => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const contrast = (a: string, b: string): number => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  /**
   * Resolves a token the way the browser would without a host: follow an
   * internal `var(--cs-*)` reference, otherwise take the last hex fallback.
   * `--cs-accent: var(--primary, var(--cs-amber))` therefore yields the amber.
   */
  const token = (block: string, name: string, depth = 0): string => {
    const decls = new Map<string, string>();
    for (const match of block.matchAll(/--cs-([a-z0-9-]+):\s*([^;]+);/g)) {
      decls.set(match[1], match[2].trim());
    }
    const raw = decls.get(name);
    expect(raw, `missing --cs-${name}`).toBeDefined();
    if (depth > 8) throw new Error(`circular token: --cs-${name}`);

    const internal = raw!.match(/var\(\s*--cs-([a-z0-9-]+)/);
    if (internal) return token(block, internal[1], depth + 1);

    const hexes = raw!.match(/#[0-9a-f]{6}/g);
    expect(hexes, `no hex value for --cs-${name}: ${raw}`).not.toBeNull();
    return hexes![hexes!.length - 1];
  };

  // The dark rule doubles as the shared brand palette (it defines the raw
  // amber/teal values every theme builds on), so light layers on top of it.
  const base = blockFor('.cs-app,\n.cs-app[data-theme="dark"]');
  const themes = [
    { label: "dark", block: base },
    { label: "light", block: `${base}\n${blockFor('.cs-app[data-theme="light"]')}` },
  ];

  it.each(themes)("keeps $label text legible on every surface", ({ block }) => {
    const surfaces = [token(block, "bg"), token(block, "surface"), token(block, "surface-2")];
    for (const surface of surfaces) {
      expect(contrast(token(block, "text"), surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(token(block, "muted"), surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(themes)("keeps $label accent and group colours legible", ({ block }) => {
    for (const surface of [token(block, "bg"), token(block, "surface")]) {
      expect(contrast(token(block, "accent"), surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(token(block, "group"), surface)).toBeGreaterThanOrEqual(4.5);
    }
    // Buttons and active chips put accent-text on an accent fill.
    expect(contrast(token(block, "accent-text"), token(block, "accent"))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(themes)("keeps $label control borders visible", ({ block }) => {
    // WCAG 1.4.11 wants 3:1 for the boundary of an interactive control. Inputs
    // sit on --cs-bg, so that is the surface that matters here.
    expect(contrast(token(block, "border-strong"), token(block, "bg"))).toBeGreaterThanOrEqual(3);
  });

  it.each(themes)("separates $label cards from the page ground", ({ block }) => {
    // Below ~1.1 a card reads as a flat continuation of the background.
    const separation = contrast(token(block, "surface"), token(block, "bg"));
    expect(separation).toBeGreaterThanOrEqual(1.1);
    expect(separation).toBeLessThanOrEqual(1.25);
  });

  it("uses the amber/teal brand rather than the previous indigo", () => {
    expect(styles).toContain("--cs-amber: #f5a524");
    expect(styles).toContain("--cs-teal: #2dd4bf");
    expect(styles).not.toContain("#4f46e5");
  });

  it("lets the OS preference choose a theme but keeps dark the default", () => {
    // Dark must not be inside a media query: it is the unconditional base.
    const darkIndex = styles.indexOf('.cs-app,\n.cs-app[data-theme="dark"]');
    const mediaIndex = styles.indexOf("@media (prefers-color-scheme: light)");
    expect(mediaIndex).toBeGreaterThan(darkIndex);
    expect(styles).toContain(".cs-app:not([data-theme=\"dark\"])");
  });

  it("honours a host-provided primary colour without losing the brand", () => {
    expect(styles).toContain("--cs-accent: var(--primary,");
    expect(styles).toContain("--cs-group: var(--cs-teal)");
    // Grouping must stay teal even when the host overrides the accent.
    expect(styles).not.toContain("--cs-group: var(--primary");
  });

  it("declares the colour scheme so native controls match", () => {
    expect(styles).toContain("color-scheme: dark");
    expect(styles).toContain("color-scheme: light");
  });
});

describe("confidenceLabel", () => {
  it("bands a well-specified query by score", () => {
    expect(confidenceLabel(0.95, 3)).toBe("Strong match");
    expect(confidenceLabel(0.7, 3)).toBe("Good match");
    expect(confidenceLabel(0.4, 3)).toBe("Possible match");
    expect(confidenceLabel(0.1, 3)).toBe("Weak match");
  });

  it("never calls a single-keyword query a strong match", () => {
    // "Watchmen" alone cannot distinguish the series from the film or a list page.
    expect(confidenceLabel(0.95, 1)).toBe("Good match");
    expect(confidenceLabel(1, 0)).toBe("Good match");
  });
});

const WIKI_PAYLOAD = {
  query: {
    pages: [
      {
        pageid: 12345,
        title: "The Amazing Spider-Man",
        extract: "The Amazing Spider-Man is a comic book series published by Marvel Comics.",
        thumbnail: { source: "https://example.org/spidey.jpg" },
        fullurl: "https://en.wikipedia.org/wiki/The_Amazing_Spider-Man",
      },
    ],
  },
};

const OL_PAYLOAD = {
  docs: [
    {
      key: "/works/OL123W",
      title: "Watchmen",
      author_name: ["Alan Moore", "Dave Gibbons"],
      first_publish_year: 1986,
      publisher: ["DC Comics"],
      cover_i: 7774899,
      isbn: ["9780930289232"],
      number_of_pages_median: 416,
      subject: ["Comic books, strips", "Graphic novels"],
    },
  ],
};

function stubFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("wikipedia.org")) return jsonResponse(WIKI_PAYLOAD);
    if (url.includes("openlibrary.org")) return jsonResponse(OL_PAYLOAD);
    throw new Error(`Unexpected request: ${url}`);
  });
}

function mountContainer(): HTMLElement {
  const container = document.createElement("div");
  document.body.append(container);
  return container;
}

function typeSearch(container: HTMLElement, value: string): void {
  const input = container.querySelector<HTMLInputElement>("#cs-search-input");
  if (!input) throw new Error("search input not rendered");
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function submitSearch(container: HTMLElement): void {
  const form = container.querySelector("form");
  if (!form) throw new Error("search form not rendered");
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
}

beforeEach(() => {
  globalThis.fetch = stubFetch() as unknown as typeof fetch;
  localStorage.clear();
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("activate", () => {
  it("registers exactly the declared page and unregisters on deactivation", () => {
    const double = createHostDouble();
    const dispose = activate(double.host);

    expect(double.registeredIds).toEqual(["collection"]);
    expect(double.host.registerPage).toHaveBeenCalledTimes(1);

    dispose();
    expect(double.unregister).toHaveBeenCalledTimes(1);
  });

  it("fails clearly on an unsupported host API version", () => {
    const double = createHostDouble({ apiVersion: "2" });
    expect(() => activate(double.host)).toThrowError(/host API 1/);
    expect(double.host.registerPage).not.toHaveBeenCalled();
  });

  it("injects one scoped stylesheet and removes it on deactivation", () => {
    const double = createHostDouble();
    const dispose = activate(double.host);

    const styles = document.head.querySelectorAll('style[data-cs="collector-scan-styles"]');
    expect(styles.length).toBe(1);
    expect(styles[0]?.textContent).toContain(".cs-app");

    dispose();
    expect(document.head.querySelectorAll('style[data-cs="collector-scan-styles"]').length).toBe(0);
  });

  it("does not duplicate the stylesheet across repeated activations", () => {
    const first = activate(createHostDouble().host);
    const second = activate(createHostDouble().host);
    expect(document.head.querySelectorAll('style[data-cs="collector-scan-styles"]').length).toBe(1);
    second();
    first();
    expect(document.head.querySelectorAll('style[data-cs="collector-scan-styles"]').length).toBe(0);
  });
});

describe("page mount", () => {
  it("renders the initial search state with suggestions", async () => {
    const double = createHostDouble();
    activate(double.host);
    const container = mountContainer();

    await double.open("collection", { container });

    expect(container.querySelector(".cs-app")).toBeTruthy();
    expect(container.textContent).toContain("Collector Scan");
    expect(container.querySelector("#cs-search-input")).toBeTruthy();
    expect(container.textContent).toContain("Amazing Spider-Man #300");
    expect(container.querySelectorAll("main")).toHaveLength(0);
  });

  it("queries both providers with the expected request shape and shows ranked matches", async () => {
    const double = createHostDouble();
    activate(double.host);
    const container = mountContainer();
    await double.open("collection", { container });

    typeSearch(container, "Watchmen 1986");
    submitSearch(container);

    await vi.waitFor(() => {
      expect(container.textContent).toContain("Watchmen");
    });

    const calls = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const urls = calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes("en.wikipedia.org/w/api.php"))).toBe(true);
    expect(urls.some((url) => url.includes("openlibrary.org/search.json"))).toBe(true);

    const wikiUrl = new URL(urls.find((url) => url.includes("wikipedia.org"))!);
    expect(wikiUrl.searchParams.get("origin")).toBe("*");
    expect(wikiUrl.searchParams.get("format")).toBe("json");
    expect(wikiUrl.searchParams.get("gsrsearch")).toBe("Watchmen 1986");
    // Non-free cover art is excluded from pageimages unless explicitly allowed.
    expect(wikiUrl.searchParams.get("pilicense")).toBe("any");

    const olUrl = new URL(urls.find((url) => url.includes("openlibrary"))!);
    // The parsed year is held back from the query; it still drives scoring.
    expect(olUrl.searchParams.get("q")).toBe("Watchmen");
    expect(olUrl.searchParams.get("fields")).toContain("cover_i");

    // Best match is surfaced first with an explainable score.
    const cards = [...container.querySelectorAll(".cs-card__title")].map((node) => node.textContent);
    expect(cards[0]).toBe("Watchmen");
    expect(container.textContent).toMatch(/(Strong|Good|Possible|Weak) match/);
    expect(container.textContent).toContain("Open Library");
  });

  it("ranks a series above its adaptations and reference pages", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("wikipedia.org")) {
        return jsonResponse({
          query: {
            pages: [
              {
                pageid: 2,
                title: "List of The Amazing Spider-Man issues",
                extract: "The Amazing Spider-Man issues, The Amazing Spider-Man volumes and The Amazing Spider-Man list.",
              },
              {
                pageid: 3,
                title: "The Amazing Spider-Man (film)",
                extract: "The Amazing Spider-Man is a film based on The Amazing Spider-Man.",
              },
              {
                pageid: 1,
                title: "The Amazing Spider-Man",
                extract: "The Amazing Spider-Man is a comic book series.",
              },
            ],
          },
        });
      }
      return jsonResponse({ docs: [] });
    }) as unknown as typeof fetch;

    const double = createHostDouble();
    activate(double.host);
    const container = mountContainer();
    await double.open("collection", { container });

    typeSearch(container, "The Amazing Spider-Man");
    submitSearch(container);
    await vi.waitFor(() => expect(container.textContent).toContain("The Amazing Spider-Man"));

    const titles = [...container.querySelectorAll(".cs-card__title")].map((node) => node.textContent);
    expect(titles[0]).toBe("The Amazing Spider-Man");
    // Demoted, but still offered so the user can pick an adaptation deliberately.
    expect(titles).toContain("The Amazing Spider-Man (film)");
    expect(titles).toContain("List of The Amazing Spider-Man issues");
  });

  it("loads a candidate detail view with image, details, and add form", async () => {
    const double = createHostDouble();
    activate(double.host);
    const container = mountContainer();
    await double.open("collection", { container });

    typeSearch(container, "Watchmen");
    submitSearch(container);
    await vi.waitFor(() => expect(container.textContent).toContain("Watchmen"));

    const firstCard = container.querySelector<HTMLButtonElement>(".cs-card--tappable");
    firstCard!.click();

    // Canvas remounts on navigation; emulate the route change it performs.
    await double.open("collection", { container, path: `candidate/${encodeURIComponent("openlibrary:/works/OL123W")}` });

    await vi.waitFor(() => {
      expect(container.textContent).toContain("Add to collection");
    });
    expect(container.querySelector(".cs-media--hero")).toBeTruthy();
    expect(container.querySelector('img[src="https://covers.openlibrary.org/b/id/7774899-L.jpg"]')).toBeTruthy();
    expect(container.textContent).toContain("Alan Moore");
    expect(container.textContent).toContain("9780930289232");
    expect(container.querySelector("#cs-add-condition")).toBeTruthy();
    expect(container.querySelector("#cs-add-price")).toBeTruthy();
    expect(container.textContent).toContain("View source page");
  });

  it("saves a candidate into the collection and lists it", async () => {
    const double = createHostDouble();
    activate(double.host);
    const container = mountContainer();
    await double.open("collection", { container, path: `candidate/${encodeURIComponent("openlibrary:/works/OL123W")}` });
    // Results live in the activation-scoped session, so a direct deep link has none.
    expect(container.textContent).toContain("Match no longer loaded");

    // Full flow: search, open match, save, then view the collection.
    await double.open("collection", { container });
    typeSearch(container, "Watchmen");
    submitSearch(container);
    await vi.waitFor(() => expect(container.textContent).toContain("Watchmen"));
    container.querySelector<HTMLButtonElement>(".cs-card--tappable")!.click();
    await double.open("collection", { container, path: `candidate/${encodeURIComponent("openlibrary:/works/OL123W")}` });
    await vi.waitFor(() => expect(container.textContent).toContain("Save to collection"));

    container.querySelector<HTMLButtonElement>(".cs-button--block")!.click();
    await double.open("collection", { container, path: "collection" });

    await vi.waitFor(() => expect(container.textContent).toContain("My collection"));
    expect(container.textContent).toContain("Watchmen");
    expect(container.querySelector("#cs-collection-search")).toBeTruthy();

    const stored = Object.keys(localStorage).filter((key) => key.includes("collector-scan"));
    expect(stored).toHaveLength(1);
    expect(stored[0]).toContain("openhands:apps:collector-scan:local-test");
  });

  it("scopes the storage key to the active backend", async () => {
    const stored = (backendId: string) => `openhands:apps:collector-scan:${backendId}:collection:v1`;

    const first = createHostDouble({ backendId: "backend-a" });
    activate(first.host);
    const containerA = mountContainer();
    await first.open("collection", { container: containerA });

    typeSearch(containerA, "Watchmen");
    submitSearch(containerA);
    await vi.waitFor(() => expect(containerA.textContent).toContain("Watchmen"));
    containerA.querySelector<HTMLButtonElement>(".cs-card--tappable")!.click();
    await first.open("collection", {
      container: containerA,
      path: `candidate/${encodeURIComponent("openlibrary:/works/OL123W")}`,
    });
    await vi.waitFor(() => expect(containerA.textContent).toContain("Save to collection"));
    containerA.querySelector<HTMLButtonElement>(".cs-button--block")!.click();

    expect(Object.keys(localStorage)).toEqual([stored("backend-a")]);

    // A different backend starts from its own, empty collection.
    const second = createHostDouble({ backendId: "backend-b" });
    activate(second.host);
    const containerB = mountContainer();
    await second.open("collection", { container: containerB, path: "collection" });

    expect(containerB.textContent).toContain("Nothing tracked yet");
    expect(Object.keys(localStorage).sort()).toEqual([stored("backend-a")]);
  });

  it("renders an error state when every provider fails", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("network down");
    }) as unknown as typeof fetch;

    const double = createHostDouble();
    activate(double.host);
    const container = mountContainer();
    await double.open("collection", { container });

    typeSearch(container, "anything");
    submitSearch(container);

    await vi.waitFor(() => expect(container.textContent).toContain("Lookup failed"));
    expect(container.querySelector(".cs-state--error")).toBeTruthy();
    expect(container.textContent).toContain("Could not reach the lookup service");
  });

  it("degrades to a warning when only one provider fails", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("openlibrary.org")) throw new TypeError("offline");
      return jsonResponse(WIKI_PAYLOAD);
    }) as unknown as typeof fetch;

    const double = createHostDouble();
    activate(double.host);
    const container = mountContainer();
    await double.open("collection", { container });

    typeSearch(container, "Amazing Spider-Man");
    submitSearch(container);

    await vi.waitFor(() => expect(container.textContent).toContain("The Amazing Spider-Man"));
    expect(container.textContent).toContain("Open Library");
    expect(container.textContent).toContain("Could not reach the lookup service");
    expect(container.querySelector(".cs-state--error")).toBeNull();
  });

  it("survives malformed provider payloads", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("wikipedia.org")) return jsonResponse({ query: { pages: "not-an-array" } });
      return jsonResponse({ docs: [null, 42, { title: "" }, { title: "Valid Book" }] });
    }) as unknown as typeof fetch;

    const double = createHostDouble();
    activate(double.host);
    const container = mountContainer();
    await double.open("collection", { container });

    typeSearch(container, "Valid Book");
    submitSearch(container);

    await vi.waitFor(() => expect(container.textContent).toContain("Valid Book"));
    expect(container.querySelectorAll(".cs-card").length).toBe(1);
  });

  it("sends Open Library a tolerant query and keeps the raw text for Wikipedia", async () => {
    const double = createHostDouble();
    activate(double.host);
    const container = mountContainer();
    await double.open("collection", { container });

    typeSearch(container, 'Watchmen Alan Moore 1986 "deluxe"');
    submitSearch(container);
    await vi.waitFor(() => expect(container.textContent).toContain("Watchmen"));

    const urls = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map((call) =>
      String(call[0]),
    );
    const olUrl = new URL(urls.find((url) => url.includes("openlibrary"))!);
    const q = olUrl.searchParams.get("q")!;
    // Open Library's `q` ANDs every term, so a typed year would exclude the book.
    expect(q).not.toContain("1986");
    expect(q).not.toContain('"');
    expect(q).toContain("Watchmen");
    expect(q).toContain("Alan Moore");
    // Wikipedia ranks its own search text, so it gets the user's raw input.
    const wikiUrl = new URL(urls.find((url) => url.includes("wikipedia"))!);
    expect(wikiUrl.searchParams.get("gsrsearch")).toBe('Watchmen Alan Moore 1986 "deluxe"');
  });

  it("strips query-syntax characters that make Open Library return nothing", async () => {
    const double = createHostDouble();
    activate(double.host);
    const container = mountContainer();
    await double.open("collection", { container });

    typeSearch(container, 'The Amazing Spider-Man #300 "variant"');
    submitSearch(container);
    await vi.waitFor(() => expect(container.textContent).toContain("Watchmen"));

    const urls = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map((call) =>
      String(call[0]),
    );
    const olUrl = new URL(urls.find((url) => url.includes("openlibrary"))!);
    const q = olUrl.searchParams.get("q")!;
    expect(q).not.toContain("#");
    expect(q).not.toContain('"');
    expect(q).toContain("Spider-Man");
    // Wikipedia keeps the issue number, which its search handles well.
    const wikiUrl = new URL(urls.find((url) => url.includes("wikipedia"))!);
    expect(wikiUrl.searchParams.get("gsrsearch")).toContain("#300");
  });

  it("labels matches that have no cover art instead of leaving a blank tile", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("wikipedia.org")) {
        return jsonResponse({
          query: {
            pages: [
              { pageid: 1, title: "Coverless Comic", extract: "A comic with no cover art available." },
            ],
          },
        });
      }
      return jsonResponse({ docs: [] });
    }) as unknown as typeof fetch;

    const double = createHostDouble();
    activate(double.host);
    const container = mountContainer();
    await double.open("collection", { container });

    typeSearch(container, "Coverless Comic");
    submitSearch(container);
    await vi.waitFor(() => expect(container.textContent).toContain("Coverless Comic"));

    expect(container.querySelector(".cs-tag--muted")?.textContent).toBe("no image");
    expect(container.querySelector(".cs-media--thumb .cs-media__note")?.textContent).toBe("No image");

    // The detail view spells it out for the large image slot.
    container.querySelector<HTMLButtonElement>(".cs-card--tappable")!.click();
    await double.open("collection", {
      container,
      path: `candidate/${encodeURIComponent("wikipedia:1")}`,
    });
    await vi.waitFor(() => expect(container.textContent).toContain("Add to collection"));
    expect(container.querySelector(".cs-media--hero .cs-media__note")?.textContent).toBe("No image");
  });

  it("rejects non-https image URLs instead of rendering them", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("wikipedia.org")) {
        return jsonResponse({
          query: {
            pages: [
              {
                pageid: 7,
                title: "Sketchy Item",
                extract: "A collectible.",
                thumbnail: { source: "javascript:alert(1)" },
              },
            ],
          },
        });
      }
      return jsonResponse({ docs: [] });
    }) as unknown as typeof fetch;

    const double = createHostDouble();
    activate(double.host);
    const container = mountContainer();
    await double.open("collection", { container });

    typeSearch(container, "Sketchy Item");
    submitSearch(container);
    await vi.waitFor(() => expect(container.textContent).toContain("Sketchy Item"));

    expect(container.querySelectorAll("img").length).toBe(0);
    expect(container.querySelector(".cs-media__glyph")).toBeTruthy();
  });

  it("handles nested routes, unknown routes, and route remounts", async () => {
    const double = createHostDouble();
    activate(double.host);

    const nested = mountContainer();
    await double.open("collection", { container: nested, path: "collection" });
    expect(nested.textContent).toContain("My collection");

    const unknown = mountContainer();
    await double.open("collection", { container: unknown, path: "does/not/exist" });
    expect(unknown.textContent).toContain("Page not found");
  });

  it("disposes DOM and stops late async updates on unmount", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    globalThis.fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    ) as unknown as typeof fetch;

    const double = createHostDouble();
    activate(double.host);
    const container = mountContainer();
    const dispose = await double.open("collection", { container });

    typeSearch(container, "slow query");
    submitSearch(container);
    expect(container.textContent).toContain("Looking up matches");

    dispose();
    expect(container.childElementCount).toBe(0);

    // A response arriving after disposal must not repopulate the container.
    resolveFetch(jsonResponse(WIKI_PAYLOAD));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(container.childElementCount).toBe(0);
  });

  it("does not search when the query is empty", async () => {
    const double = createHostDouble();
    activate(double.host);
    const container = mountContainer();
    await double.open("collection", { container });

    typeSearch(container, "   ");
    submitSearch(container);

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect((globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
    expect(container.textContent).toContain("Try one of these");
  });

  it("keeps results across a remount and lets the user re-open a match", async () => {
    const double = createHostDouble();
    activate(double.host);
    const container = mountContainer();
    await double.open("collection", { container });

    typeSearch(container, "Watchmen");
    submitSearch(container);
    await vi.waitFor(() => expect(container.textContent).toContain("Watchmen"));

    // Simulate leaving to the detail route and coming back.
    await double.open("collection", { container, path: `candidate/${encodeURIComponent("openlibrary:/works/OL123W")}` });
    expect(container.textContent).toContain("Add to collection");

    await double.open("collection", { container, path: "" });
    await vi.waitFor(() => expect(container.textContent).toContain("Watchmen"));
    expect((globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
  });

  it("filters the collection by type and favourites", async () => {
    const double = createHostDouble();
    activate(double.host);
    const container = mountContainer();
    await double.open("collection", { container });

    typeSearch(container, "Watchmen");
    submitSearch(container);
    await vi.waitFor(() => expect(container.textContent).toContain("Watchmen"));
    container.querySelector<HTMLButtonElement>(".cs-card--tappable")!.click();
    await double.open("collection", { container, path: `candidate/${encodeURIComponent("openlibrary:/works/OL123W")}` });
    await vi.waitFor(() => expect(container.textContent).toContain("Save to collection"));
    container.querySelector<HTMLButtonElement>(".cs-button--block")!.click();
    await double.open("collection", { container, path: "collection" });
    await vi.waitFor(() => expect(container.textContent).toContain("Watchmen"));

    const filter = container.querySelector<HTMLSelectElement>("#cs-collection-category")!;
    filter.value = "sports-card";
    filter.dispatchEvent(new Event("change", { bubbles: true }));
    expect(container.textContent).toContain("No items match");

    filter.value = "book";
    filter.dispatchEvent(new Event("change", { bubbles: true }));
    expect(container.textContent).toContain("Watchmen");

    const favourites = [...container.querySelectorAll<HTMLButtonElement>(".cs-chip")].find((button) =>
      button.textContent?.includes("Favourites"),
    )!;
    favourites.click();
    expect(container.textContent).toContain("No items match");
  });

  it("totals purchase price when no estimated value is recorded", async () => {
    const double = createHostDouble();
    activate(double.host);
    const container = mountContainer();
    await double.open("collection", { container });

    typeSearch(container, "Watchmen");
    submitSearch(container);
    await vi.waitFor(() => expect(container.textContent).toContain("Watchmen"));
    container.querySelector<HTMLButtonElement>(".cs-card--tappable")!.click();
    await double.open("collection", { container, path: `candidate/${encodeURIComponent("openlibrary:/works/OL123W")}` });
    await vi.waitFor(() => expect(container.textContent).toContain("Save to collection"));

    const price = container.querySelector<HTMLInputElement>("#cs-add-price")!;
    price.value = "24.50";
    container.querySelector<HTMLButtonElement>(".cs-button--block")!.click();
    await double.open("collection", { container, path: "collection" });

    // "1 item · $0.00 est." would read as worthless; the paid total is the honest number.
    await vi.waitFor(() => expect(container.textContent).toContain("1 item"));
    expect(container.textContent).toContain("$24.50 paid");
    expect(container.textContent).not.toContain("$0.00");
  });
});

/** Drives the search -> open match -> save flow, returning to the collection. */
async function saveFirstMatch(
  container: HTMLElement,
  double: ReturnType<typeof createHostDouble>,
  configure?: (root: HTMLElement) => void,
): Promise<void> {
  await double.open("collection", { container, path: "" });
  typeSearch(container, "Watchmen");
  submitSearch(container);
  await vi.waitFor(() => expect(container.textContent).toContain("Watchmen"));
  activeRoot(container).querySelector<HTMLButtonElement>(".cs-card--tappable")!.click();
  await double.open("collection", {
    container,
    path: `candidate/${encodeURIComponent("openlibrary:/works/OL123W")}`,
  });
  await vi.waitFor(() => expect(container.textContent).toContain("Save to collection"));
  configure?.(activeRoot(container));
  activeRoot(container).querySelector<HTMLButtonElement>(".cs-button--block")!.click();
  await double.open("collection", { container, path: "collection" });
  await vi.waitFor(() => expect(container.textContent).toContain("My collection"));
}

/**
 * The host double never disposes a mount, so roots accumulate in the container.
 * Every assertion has to look at the newest root or it will read stale DOM.
 */
function activeRoot(container: HTMLElement): HTMLElement {
  const roots = container.querySelectorAll<HTMLElement>(".cs-app");
  return roots[roots.length - 1] ?? container;
}

/** Chooses "+ New group…" in a group picker and types the name. */
function createGroupViaSelect(root: HTMLElement, prefix: string, name: string): void {
  const select = root.querySelector<HTMLSelectElement>(`#${prefix}-group`)!;
  select.value = "__new_group__";
  select.dispatchEvent(new Event("change", { bubbles: true }));
  const input = root.querySelector<HTMLInputElement>(`#${prefix}-group-name`)!;
  input.value = name;
}

function clickChip(root: HTMLElement, label: string): void {
  const chip = [...root.querySelectorAll<HTMLButtonElement>(".cs-chip")].find((button) =>
    button.textContent?.includes(label),
  );
  if (!chip) throw new Error(`chip not found: ${label}`);
  chip.click();
}

/** Chip buttons do not expose ids, so read the persisted group instead. */
function firstGroupId(): string {
  const raw = JSON.parse(localStorage.getItem("openhands:apps:collector-scan:local-test:collection:v1")!);
  return raw.groups[0].id;
}

describe("collection groups", () => {
  it("creates a group while saving an item and files the item into it", async () => {
    const double = createHostDouble();
    activate(double.host);
    const container = mountContainer();

    await saveFirstMatch(container, double, (root) =>
      createGroupViaSelect(root, "cs-add", "Sonic the Hedgehog Comics from Archie"),
    );

    const root = activeRoot(container);
    // The new group is offered as a filter chip and named on the item card.
    expect(root.textContent).toContain("Sonic the Hedgehog Comics from Archie (1)");
    expect(root.querySelector(".cs-grouptag")?.textContent).toBe("Sonic the Hedgehog Comics from Archie");
  });

  it("filters the collection by group, keeping ungrouped items separate", async () => {
    const double = createHostDouble();
    activate(double.host);
    const container = mountContainer();

    // First item is ungrouped.
    await saveFirstMatch(container, double);
    expect(activeRoot(container).textContent).toContain("Ungrouped (1)");

    // Second item goes into a new group.
    await saveFirstMatch(container, double, (root) =>
      createGroupViaSelect(root, "cs-add", "Sonic the Hedgehog Comics from Archie"),
    );

    clickChip(activeRoot(container), "Ungrouped");
    let root = activeRoot(container);
    expect(root.textContent).toContain("1 entry");
    expect(root.querySelectorAll(".cs-grouptag")).toHaveLength(0);

    clickChip(activeRoot(container), "Sonic the Hedgehog Comics from Archie");
    root = activeRoot(container);
    expect(root.textContent).toContain("1 entry");
    expect(root.querySelectorAll(".cs-grouptag")).toHaveLength(1);

    clickChip(activeRoot(container), "All");
    expect(activeRoot(container).textContent).toContain("2 entries");
  });

  it("creates a group from the collection view before any item exists", async () => {
    const double = createHostDouble();
    activate(double.host);
    const container = mountContainer();
    await double.open("collection", { container, path: "collection" });

    expect(activeRoot(container).textContent).toContain("Nothing tracked yet");

    clickChip(activeRoot(container), "+ New group");
    const root = activeRoot(container);
    const input = root.querySelector<HTMLInputElement>("#cs-new-group-name")!;
    input.value = "Sonic the Hedgehog Comics from Archie";
    root.querySelector<HTMLFormElement>(".cs-search__row")!.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );

    const after = activeRoot(container);
    expect(after.textContent).toContain("Sonic the Hedgehog Comics from Archie");
    // Still empty, but the group now exists.
    expect(after.textContent).toContain("Nothing tracked yet");
  });

  it("lets an empty group be managed and deleted", async () => {
    const double = createHostDouble();
    activate(double.host);
    const container = mountContainer();
    await double.open("collection", { container, path: "collection" });

    clickChip(activeRoot(container), "+ New group");
    let root = activeRoot(container);
    root.querySelector<HTMLInputElement>("#cs-new-group-name")!.value = "Sonic the Hedgehog Comics from Archie";
    root.querySelector<HTMLFormElement>(".cs-search__row")!.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );

    // An empty group has no item card to tap, so it needs its own way in.
    root = activeRoot(container);
    const manage = [...root.querySelectorAll<HTMLButtonElement>(".cs-button")].find((button) =>
      button.textContent?.includes("Manage"),
    );
    expect(manage?.textContent).toContain("Sonic the Hedgehog Comics from Archie");

    // Navigation is host-driven, so follow the same await pattern as other tests.
    await double.open("collection", {
      container,
      path: `collection/group/${encodeURIComponent(firstGroupId())}`,
    });
    root = activeRoot(container);
    expect(root.textContent).toContain("Group settings");
    expect(root.textContent).toContain("This group has no items.");

    [...root.querySelectorAll<HTMLButtonElement>(".cs-button--danger")]
      .find((button) => button.textContent?.includes("Delete group"))!
      .click();
    await double.open("collection", { container, path: "collection" });

    root = activeRoot(container);
    expect(root.textContent).toContain("Nothing tracked yet");
    expect(root.textContent).not.toContain("Sonic the Hedgehog Comics from Archie (");
  });

  it("renames a group from its detail view", async () => {
    const double = createHostDouble();
    activate(double.host);
    const container = mountContainer();

    await saveFirstMatch(container, double, (root) =>
      createGroupViaSelect(root, "cs-add", "Sonic the Hedgehog Comics from Archie"),
    );
    const id = firstGroupId();

    await double.open("collection", { container, path: `collection/group/${encodeURIComponent(id)}` });
    let root = activeRoot(container);
    expect(root.textContent).toContain("Group settings");

    const name = root.querySelector<HTMLInputElement>("#cs-group-name")!;
    name.value = "Sonic (Archie)";
    root.querySelector<HTMLFormElement>(".cs-search__row")!.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );

    root = activeRoot(container);
    expect(root.textContent).toContain("Sonic (Archie)");
    expect(root.textContent).not.toContain("from Archie");
  });

  it("deletes a group but keeps its items as ungrouped", async () => {
    const double = createHostDouble();
    activate(double.host);
    const container = mountContainer();

    await saveFirstMatch(container, double, (root) =>
      createGroupViaSelect(root, "cs-add", "Sonic the Hedgehog Comics from Archie"),
    );
    const id = firstGroupId();

    await double.open("collection", { container, path: `collection/group/${encodeURIComponent(id)}` });
    [...activeRoot(container).querySelectorAll<HTMLButtonElement>(".cs-button--danger")]
      .find((button) => button.textContent?.includes("Delete group"))!
      .click();
    await double.open("collection", { container, path: "collection" });

    // The item survives; only its membership is cleared. The toast names the
    // deleted group, so check the chips and card rather than the whole view.
    const root = activeRoot(container);
    expect(root.textContent).toContain("Watchmen");
    expect(root.textContent).toContain("Ungrouped (1)");
    expect(root.querySelector(".cs-grouptag")).toBeNull();
    const chips = [...root.querySelectorAll<HTMLButtonElement>(".cs-chip")].map((b) => b.textContent ?? "");
    expect(chips.some((label) => label.includes("from Archie"))).toBe(false);

    const raw = JSON.parse(localStorage.getItem("openhands:apps:collector-scan:local-test:collection:v1")!);
    expect(raw.groups).toHaveLength(0);
    expect(raw.items).toHaveLength(1);
    expect(raw.items[0].groupId).toBeNull();
  });

  it("revives a legacy payload that predates groups", async () => {
    // Payload written by the previous version: no `groups` key at all.
    localStorage.setItem(
      "openhands:apps:collector-scan:local-test:collection:v1",
      JSON.stringify({
        schemaVersion: 1,
        items: [{ id: "legacy-1", title: "Watchmen", category: "comic" }],
      }),
    );

    const double = createHostDouble();
    activate(double.host);
    const container = mountContainer();
    await double.open("collection", { container, path: "collection" });

    // The pre-existing item still loads, and is treated as ungrouped.
    const root = activeRoot(container);
    expect(root.textContent).toContain("Watchmen");
    expect(root.textContent).toContain("Ungrouped (1)");
    expect(root.querySelector(".cs-grouptag")).toBeNull();
  });

  it("drops membership pointing at a group that no longer exists", async () => {
    localStorage.setItem(
      "openhands:apps:collector-scan:local-test:collection:v1",
      JSON.stringify({
        schemaVersion: 1,
        items: [{ id: "orphan-1", title: "Watchmen", category: "comic", groupId: "deleted-group" }],
        groups: [{ id: "kept-group", name: "Sonic the Hedgehog Comics from Archie" }],
      }),
    );

    const double = createHostDouble();
    activate(double.host);
    const container = mountContainer();
    await double.open("collection", { container, path: "collection" });

    // The item is still listed rather than hidden behind a missing group.
    const root = activeRoot(container);
    expect(root.textContent).toContain("Watchmen");
    expect(root.querySelector(".cs-grouptag")).toBeNull();
    expect(root.textContent).toContain("Sonic the Hedgehog Comics from Archie (0)");
  });
});

describe("group item picker", () => {
  /** Creates a group from the collection view's inline form. */
  async function createGroupFromCollection(container: HTMLElement, name: string): Promise<void> {
    await double0.open("collection", { container, path: "collection" });
    clickChip(activeRoot(container), "+ New group");
    const root = activeRoot(container);
    root.querySelector<HTMLInputElement>("#cs-new-group-name")!.value = name;
    root.querySelector<HTMLFormElement>(".cs-search__row")!.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  }

  let double0: ReturnType<typeof createHostDouble>;
  beforeEach(() => {
    double0 = createHostDouble();
    activate(double0.host);
  });

  it("sends the user to the picker after creating a group with items on hand", async () => {
    const container = mountContainer();
    await saveFirstMatch(container, double0);

    await createGroupFromCollection(container, "Sonic the Hedgehog Comics from Archie");

    // The host drives navigation, so assert the route it was handed.
    const routed = double0.navigate.mock.calls.map((call) => String(call[0]));
    expect(routed.some((path) => path.includes("group/") && path.endsWith("/items"))).toBe(true);

    await double0.open("collection", {
      container,
      path: `collection/group/${encodeURIComponent(firstGroupId())}/items`,
    });
    const root = activeRoot(container);
    expect(root.textContent).toContain("0 of 1 item in this group.");
    expect(root.querySelectorAll(".cs-pick")).toHaveLength(1);
  });

  it("stays on the collection view when there is nothing to pick", async () => {
    const container = mountContainer();
    await createGroupFromCollection(container, "Sonic the Hedgehog Comics from Archie");

    // An empty collection has no candidates, so an empty picker would be a dead end.
    const routed = double0.navigate.mock.calls.map((call) => String(call[0]));
    expect(routed.some((path) => path.endsWith("/items"))).toBe(false);
    expect(activeRoot(container).textContent).toContain("Nothing tracked yet");
  });

  it("adds and removes an item by toggling it in the picker", async () => {
    const container = mountContainer();
    await saveFirstMatch(container, double0);
    await createGroupFromCollection(container, "Sonic the Hedgehog Comics from Archie");
    const id = firstGroupId();

    await double0.open("collection", {
      container,
      path: `collection/group/${encodeURIComponent(id)}/items`,
    });
    expect(activeRoot(container).textContent).toContain("0 of 1 item in this group.");

    activeRoot(container).querySelector<HTMLInputElement>(".cs-pick__box")!.click();
    let root = activeRoot(container);
    expect(root.textContent).toContain("1 of 1 item in this group.");
    expect(root.querySelector(".cs-pick--on")).not.toBeNull();

    const saved = JSON.parse(
      localStorage.getItem("openhands:apps:collector-scan:local-test:collection:v1")!,
    );
    expect(saved.items[0].groupId).toBe(id);

    // Toggling again files it back out.
    activeRoot(container).querySelector<HTMLInputElement>(".cs-pick__box")!.click();
    root = activeRoot(container);
    expect(root.textContent).toContain("0 of 1 item in this group.");
    expect(root.querySelector(".cs-pick--on")).toBeNull();
    expect(
      JSON.parse(localStorage.getItem("openhands:apps:collector-scan:local-test:collection:v1")!).items[0]
        .groupId,
    ).toBeNull();
  });

  it("moves an item out of another group", async () => {
    const container = mountContainer();
    await saveFirstMatch(container, double0, (root) =>
      createGroupViaSelect(root, "cs-add", "Sonic the Hedgehog Comics from Archie"),
    );
    const first = firstGroupId();

    // A second group is created from the collection view, then the item is
    // reassigned to it through the picker.
    await createGroupFromCollection(container, "Mickey Mantle");
    const saved = JSON.parse(
      localStorage.getItem("openhands:apps:collector-scan:local-test:collection:v1")!,
    );
    const second = saved.groups.find((group: { id: string }) => group.id !== first).id;

    await double0.open("collection", {
      container,
      path: `collection/group/${encodeURIComponent(second)}/items`,
    });
    const root = activeRoot(container);
    expect(root.textContent).toContain("tap to move here");

    root.querySelector<HTMLInputElement>(".cs-pick__box")!.click();
    expect(
      JSON.parse(localStorage.getItem("openhands:apps:collector-scan:local-test:collection:v1")!).items[0]
        .groupId,
    ).toBe(second);
  });

  it("keeps the picker reachable from the group detail view", async () => {
    const container = mountContainer();
    await saveFirstMatch(container, double0, (root) =>
      createGroupViaSelect(root, "cs-add", "Sonic the Hedgehog Comics from Archie"),
    );
    const id = firstGroupId();

    await double0.open("collection", { container, path: `collection/group/${encodeURIComponent(id)}` });
    const entry = [...activeRoot(container).querySelectorAll<HTMLButtonElement>(".cs-button")].find((button) =>
      button.textContent?.includes("Add or remove items"),
    );
    expect(entry).toBeDefined();

    entry!.click();
    const routed = double0.navigate.mock.calls.map((call) => String(call[0]));
    expect(routed.some((path) => path.includes("group/") && path.endsWith("/items"))).toBe(true);
  });

  it("does not confuse the picker route with a group id", async () => {
    const container = mountContainer();
    await saveFirstMatch(container, double0, (root) =>
      createGroupViaSelect(root, "cs-add", "Sonic the Hedgehog Comics from Archie"),
    );
    const id = firstGroupId();

    // Without matching the trailing segment first, "items" would be read as part
    // of the group id and this would fall through to "Group not found".
    await double0.open("collection", {
      container,
      path: `collection/group/${encodeURIComponent(id)}/items`,
    });
    expect(activeRoot(container).textContent).not.toContain("Group not found");

    // The plain group route still resolves to the detail view.
    await double0.open("collection", { container, path: `collection/group/${encodeURIComponent(id)}` });
    expect(activeRoot(container).textContent).toContain("Group settings");
  });
});
