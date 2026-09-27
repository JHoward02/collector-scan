import type { Candidate, SearchQuery } from "../types.ts";
import { asArray, asRecord, asString, fetchJson, type Provider } from "./types.ts";

const GCD = "https://www.comics.org";

function records(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const root = asRecord(payload);
  return asArray(root?.results).length ? asArray(root?.results) : asArray(root?.issues).length ? asArray(root?.issues) : root ? [root] : [];
}

export const gcdProvider: Provider = {
  id: "gcd", label: "Grand Comics Database", categories: ["comic"],
  prefers: (query) => query.category === "comic",
  async search(query: SearchQuery, signal) {
    const series = (query.title || query.providerQuery).replace(/\s+#?\d+\s*$/, "").trim();
    const number = query.number?.replace(/^#/, "").trim();
    const base = `${GCD}/api/series/name/${encodeURIComponent(series)}`;
    const url = number
      ? `${base}/issue/${encodeURIComponent(number)}/${query.year ? `year/${query.year}/` : ""}`
      : `${base}/`;
    const payload = await fetchJson(url, signal);
    const candidates: Candidate[] = [];
    for (const value of records(payload).slice(0, 40)) {
      const issue = asRecord(value); if (!issue) continue;
      const id = asString(issue.id); if (!id) continue;
      const seriesObj = asRecord(issue.series);
      const seriesName = asString(seriesObj?.name) ?? asString(issue.series_name) ?? asString(issue.name) ?? series;
      const issueNumber = asString(issue.number) ?? asString(issue.issue_number);
      const keyDate = asString(issue.key_date) ?? asString(issue.publication_date) ?? asString(issue.on_sale_date);
      const publisherObj = asRecord(seriesObj?.publisher) ?? asRecord(issue.publisher);
      const publisher = asString(publisherObj?.name) ?? asString(issue.publisher_name);
      const cover = asString(issue.cover) ?? asString(issue.cover_url) ?? asString(issue.image);
      const resource = asString(issue.resource_url) ?? `${GCD}/issue/${id}/`;
      const year = keyDate ? Number.parseInt(keyDate.slice(0,4),10) : null;
      candidates.push({
        id:`gcd:${id}`, provider:"gcd", providerLabel:"Grand Comics Database", providerKey:id,
        title: seriesName, subtitle:[issueNumber ? `#${issueNumber}` : null, publisher, keyDate].filter(Boolean).join(" • ") || null,
        category:"comic", year:Number.isFinite(year) ? year : null,
        imageUrl: cover ? (cover.startsWith("http") ? cover : `${GCD}${cover.startsWith("/") ? "" : "/"}${cover}`) : null,
        description:asString(issue.notes), sourceUrl:resource.startsWith("http") ? resource : `${GCD}${resource}`,
        details:[...(issueNumber?[{label:"Issue",value:`#${issueNumber}`}]:[]),...(publisher?[{label:"Publisher",value:publisher}]:[]),...(keyDate?[{label:"Date",value:keyDate}]:[]),{label:"Data source",value:"Grand Comics Database (CC BY-SA 4.0)"}],
        score:0, matchReasons:[],
      });
    }
    return { candidates, warning:"GCD's anonymous API is rate-limited. Comic metadata is CC BY-SA 4.0; cover-image rights remain with their respective copyright holders." };
  },
};
