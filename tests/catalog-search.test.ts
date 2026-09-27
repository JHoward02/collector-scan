import { afterEach, expect, it, vi } from "vitest";
import { searchAll } from "../src/providers/index.ts";
import { shelfieCatalogProvider } from "../src/providers/shelfie-catalog.ts";
import { clearSearchSelection, enhanceSearchSelection } from "../src/search-selection.ts";
import { parseQuery } from "../src/query.ts";

afterEach(() => { clearSearchSelection(); document.body.innerHTML = ""; vi.unstubAllGlobals(); });

it("shows an approved community item as a searchable Shelfie catalog result", async () => {
  document.body.innerHTML = '<div><form role="search"></form></div>';
  const root = document.body.firstElementChild as HTMLElement;
  enhanceSearchSelection(root);
  [...root.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent === "Figures")!.click();
  [...root.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent === "McFarlane")!.click();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([{
    id: "issue-42", title: "Batman McFarlane figure", category: "figure", year: 2024,
    line: "mcfarlane", maker: "McFarlane Toys", identifier: "12345", imageUrl: null,
    sourceUrl: "https://github.com/JHoward02/collector-scan/issues/42",
  }]), { status: 200 })));
  const outcome = await searchAll(parseQuery("Batman McFarlane figure"), "figure", new AbortController().signal, null, [shelfieCatalogProvider]);
  expect(outcome.manualOnly).toBe(false);
  expect(outcome.results[0]).toMatchObject({ title: "Batman McFarlane figure", providerLabel: "Shelfie catalog" });
});
