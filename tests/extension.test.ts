import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activate } from "../src/extension.ts";
import { confidenceLabel } from "../src/match.ts";
import { createHostDouble, jsonResponse } from "./host-double.ts";

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
