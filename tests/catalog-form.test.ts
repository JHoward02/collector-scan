import { afterEach, expect, it, vi } from "vitest";
import { installManualEntry } from "../src/manual-entry.ts";
import { clearSearchSelection } from "../src/search-selection.ts";
import { parseSubmission } from "../scripts/catalog-submission.mjs";

let cleanup: (() => void) | null = null;
afterEach(() => { cleanup?.(); cleanup = null; clearSearchSelection(); document.body.innerHTML = ""; vi.restoreAllMocks(); });

it("prefills a public catalog proposal without leaking private notes or local image", () => {
  document.body.innerHTML = '<input id="cs-search-input" value="Batman figure"><div id="cs-list"></div>';
  cleanup = installManualEntry();
  document.dispatchEvent(new Event("shelfie:manual-entry"));
  const form = document.querySelector<HTMLFormElement>("#shelfie-manual-modal form")!;
  (form.elements.namedItem("category") as HTMLSelectElement).value = "figure";
  (form.elements.namedItem("notes") as HTMLTextAreaElement).value = "My private note";
  const open = vi.spyOn(window, "open").mockImplementation(() => null);
  form.querySelector<HTMLButtonElement>("[data-catalog]")!.click();
  expect(open).toHaveBeenCalledOnce();
  const url = new URL(open.mock.calls[0][0]!);
  expect(url.origin + url.pathname).toBe("https://github.com/JHoward02/collector-scan/issues/new");
  expect(url.searchParams.get("title")).toContain("Batman figure");
  expect(url.searchParams.get("body")).toContain("### Category\n\nfigure");
  expect(url.searchParams.get("body")).not.toContain("My private note");
  expect(parseSubmission({ number: 42, html_url: "https://github.com/JHoward02/collector-scan/issues/42", body: url.searchParams.get("body") })).toMatchObject({ title: "Batman figure", category: "figure" });
});
