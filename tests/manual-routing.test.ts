import { afterEach, expect, it, vi } from "vitest";
import { searchAll, PROVIDERS } from "../src/providers/index.ts";
import { clearSearchSelection } from "../src/search-selection.ts";
import { parseQuery } from "../src/query.ts";

const query = parseQuery("test collectible");
afterEach(() => { clearSearchSelection(); vi.restoreAllMocks(); });

it.each(["video-game", "coin", "other", "figure", "toy"] as const)("uses manual entry for %s without a dedicated source", async (category) => {
  // Figure and toy selections are set through the same UI state as the app.
  if (category === "figure" || category === "toy") {
    document.body.innerHTML = '<div><form role="search"></form></div>';
    const { enhanceSearchSelection } = await import("../src/search-selection.ts");
    const root = document.body.firstElementChild as HTMLElement;
    enhanceSearchSelection(root);
    [...root.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent === (category === "figure" ? "Figures" : "Toys"))?.click();
    [...root.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent === (category === "figure" ? "McFarlane" : "LEGO"))?.click();
  }
  const calls = PROVIDERS.map(p => vi.spyOn(p, "search"));
  const result = await searchAll(query, category, new AbortController().signal);
  expect(result).toMatchObject({ manualOnly: true, results: [], error: null });
  expect(calls.every(call => call.mock.calls.length === 0)).toBe(true);
});
