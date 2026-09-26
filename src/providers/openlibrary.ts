import type { Candidate, Category, DetailRow, SearchQuery } from "../types.ts";
import { truncate } from "../text.ts";
import {
  asArray,
  asNumber,
  asRecord,
  asString,
  fetchJson,
  type Provider,
  type ProviderResult,
} from "./types.ts";

const ENDPOINT = "https://openlibrary.org/search.json";
const FIELDS = [
  "key", "title", "subtitle", "author_name", "first_publish_year", "publisher",
  "isbn", "cover_i", "number_of_pages_median", "language", "subject", "edition_count",
  "first_sentence",
].join(",");

const CATEGORIES: Category[] = ["book", "comic", "other"];

function coverUrl(coverId: number | null): string | null {
  return coverId == null ? null : `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
}

function strings(value: unknown): string[] {
  return asArray(value)
    .map(asString)
    .filter((entry): entry is string => Boolean(entry));
}

function toCandidate(doc: unknown): Candidate | null {
  const record = asRecord(doc);
  if (!record) return null;
  const title = asString(record.title);
  if (!title) return null;

  const key = asString(record.key);
  const authors = strings(record.author_name);
  const publishers = strings(record.publisher);
  const isbns = strings(record.isbn);
  const languages = strings(record.language);
  const subjects = strings(record.subject);
  const year = asNumber(record.first_publish_year);
  const pages = asNumber(record.number_of_pages_median);
  const editions = asNumber(record.edition_count);
  const coverId = asNumber(record.cover_i);
  const subtitle = asString(record.subtitle);
  const firstSentence = asString(record.first_sentence);

  const details: DetailRow[] = [];
  if (authors.length) details.push({ label: "Author", value: authors.slice(0, 3).join(", ") });
  if (publishers.length) details.push({ label: "Publisher", value: publishers.slice(0, 2).join(", ") });
  if (year != null) details.push({ label: "First published", value: String(year) });
  if (pages != null) details.push({ label: "Pages", value: String(pages) });
  if (editions != null) details.push({ label: "Editions", value: String(editions) });
  if (isbns.length) details.push({ label: "ISBN", value: isbns.slice(0, 2).join(", ") });
  if (languages.length) details.push({ label: "Language", value: languages.slice(0, 2).join(", ") });
  if (subjects.length) details.push({ label: "Subjects", value: subjects.slice(0, 4).join(", ") });

  const isComic = subjects.some((subject) => /comic|graphic novel|manga/i.test(subject));

  return {
    id: `openlibrary:${key ?? title}`,
    provider: "openlibrary",
    providerLabel: "Open Library",
    providerKey: key ?? title,
    title,
    subtitle: subtitle ?? (authors.length ? authors.slice(0, 2).join(", ") : null),
    category: isComic ? "comic" : "book",
    year,
    imageUrl: coverUrl(coverId),
    description: firstSentence ? truncate(firstSentence, 300) : null,
    sourceUrl: key ? `https://openlibrary.org${key}` : null,
    details,
    score: 0,
    matchReasons: [],
  };
}

/**
 * Build Open Library's full-text query.
 *
 * Two behaviours forced this shape, both verified against the live API:
 *  - `#` is query syntax, so a literal "Spider-Man #300" returns zero documents.
 *  - `q` matches all terms, so a year the user typed ("Watchmen Alan Moore
 *    1986") excludes the very book being looked for and yields zero documents.
 * The parser has already stripped the year and issue number into `query.title`,
 * which is exactly the tolerant, item-first query this endpoint wants.
 */
function sanitizeQuery(raw: string): string {
  return raw.replace(/[#"']/g, " ").replace(/\s+/g, " ").trim();
}

export const openLibraryProvider: Provider = {
  id: "openlibrary",
  label: "Open Library",
  categories: CATEGORIES,
  prefers: (query: SearchQuery) => query.category === "book" || query.category === "comic",
  async search(query: SearchQuery, signal: AbortSignal): Promise<ProviderResult> {
    const url = new URL(ENDPOINT);
    url.searchParams.set("q", sanitizeQuery(query.title || query.providerQuery));
    url.searchParams.set("limit", "10");
    url.searchParams.set("fields", FIELDS);

    const payload = asRecord(await fetchJson(url.href, signal));
    const candidates = asArray(payload?.docs)
      .map(toCandidate)
      .filter((candidate): candidate is Candidate => candidate !== null);
    return { candidates, warning: null };
  },
};
