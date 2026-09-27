import { expect, it, vi } from "vitest";
import { amiiboProvider } from "../src/providers/amiibo.ts";
import { jsonResponse } from "./host-double.ts";

it("searches the live AmiiboAPI host and maps an amiibo for the collection", async () => {
  const originalFetch = globalThis.fetch;
  const fetchMock = vi.fn(async (_input: RequestInfo | URL) => jsonResponse({ amiibo: [{
    name: "Mario", head: "00000000", tail: "00340102", type: "Figure",
    amiiboSeries: "Super Smash Bros.", gameSeries: "Super Mario",
    image: "https://example.com/mario.png",
    release: { na: null, jp: "2014-12-06" },
  }] }));
  globalThis.fetch = fetchMock as typeof fetch;
  try {
    const result = await amiiboProvider.search({
      raw: "Mario amiibo", title: "Mario amiibo", providerQuery: "Mario amiibo",
      category: "figure", year: null, number: null, publisher: null, detectionReasons: [],
    }, new AbortController().signal);
    expect(fetchMock.mock.calls[0][0]).toBe("https://amiiboapi.org/api/amiibo/?name=Mario");
    expect(result.candidates[0]).toMatchObject({
      id: "amiiboapi:0000000000340102", title: "Mario", category: "figure",
      year: 2014, imageUrl: "https://example.com/mario.png",
    });
    expect(result.candidates[0].details).toContainEqual({ label: "Japan release", value: "2014-12-06" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
