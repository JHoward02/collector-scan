import type { Candidate, SearchQuery } from "../types.ts";
import { asArray, asRecord, asString, fetchJson, type Provider } from "./types.ts";

const API_ROOT = "https://api.github.com/repos/robert-porter/CardLists/contents";
const RAW_ROOT = "https://raw.githubusercontent.com/robert-porter/CardLists/main";
const REPO_ROOT = "https://github.com/robert-porter/CardLists";
const MAX_SETS = 12;

interface ContentEntry { name: string; path: string; type: string; downloadUrl: string | null }

function entries(value: unknown): ContentEntry[] {
  return asArray(value).flatMap((item) => {
    const record = asRecord(item);
    if (!record) return [];
    const name = asString(record.name);
    const path = asString(record.path);
    const type = asString(record.type);
    if (!name || !path || !type) return [];
    return [{ name, path, type, downloadUrl: asString(record.download_url) }];
  });
}

function terms(query: SearchQuery): string[] {
  return query.providerQuery.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 1 && term !== String(query.year ?? ""));
}

function likelyFiles(files: ContentEntry[], query: SearchQuery): ContentEntry[] {
  const needles = terms(query);
  const ranked = files
    .filter((file) => file.type === "file" && file.name.endsWith(".json"))
    .map((file) => ({ file, score: needles.reduce((score, term) => score + (file.name.toLowerCase().includes(term) ? 1 : 0), 0) }))
    .sort((a, b) => b.score - a.score);
  const matching = ranked.filter((entry) => entry.score > 0);
  return (matching.length ? matching : ranked).slice(0, MAX_SETS).map((entry) => entry.file);
}

function setCandidates(payload: unknown, file: ContentEntry, query: SearchQuery): Candidate[] {
  const root = asRecord(payload);
  if (!root) return [];
  const productName = asString(root.name) ?? file.name.replace(/\.json$/i, "").replaceAll("-", " ");
  const yearMatch = productName.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? Number.parseInt(yearMatch[0], 10) : query.year;
  const wanted = terms(query);
  const cardNumber = query.number?.replace(/^#/, "").toLowerCase() ?? null;
  const candidates: Candidate[] = [];

  for (const setValue of asArray(root.sets)) {
    const set = asRecord(setValue);
    if (!set) continue;
    const subset = asString(set.name) ?? "Base Set";
    for (const cardValue of asArray(set.cards)) {
      const card = asRecord(cardValue);
      if (!card) continue;
      const number = asString(card.number);
      const name = asString(card.name);
      if (!number || !name) continue;
      const haystack = `${name} ${productName} ${subset} ${number}`.toLowerCase();
      const nameHit = wanted.length === 0 || wanted.every((term) => haystack.includes(term));
      const numberHit = !cardNumber || number.toLowerCase() === cardNumber;
      if (!nameHit || !numberHit) continue;

      const attributes = asArray(card.attributes).map(asString).filter((value): value is string => Boolean(value));
      const providerKey = `${file.path}:${subset}:${number}:${name}`;
      candidates.push({
        id: `cardlists:${providerKey}`,
        provider: "cardlists",
        providerLabel: "CardLists",
        providerKey,
        title: name,
        subtitle: `${productName} • ${subset} • #${number}`,
        category: "sports-card",
        year,
        imageUrl: null,
        description: attributes.length ? `Card attributes: ${attributes.join(", ")}` : null,
        sourceUrl: `${REPO_ROOT}/blob/main/${file.path}`,
        details: [
          { label: "Set", value: productName },
          { label: "Subset", value: subset },
          { label: "Card #", value: number },
          ...(attributes.length ? [{ label: "Attributes", value: attributes.join(", ") }] : []),
          { label: "Data source", value: "CardLists (MIT licensed)" },
        ],
        score: 0,
        matchReasons: [],
      });
      if (candidates.length >= 40) return candidates;
    }
  }
  return candidates;
}

export const cardListsProvider: Provider = {
  id: "cardlists",
  label: "CardLists",
  categories: ["sports-card"],
  prefers(query) { return query.category === "sports-card"; },
  async search(query, signal) {
    if (query.category && query.category !== "sports-card") return { candidates: [], warning: null };
    if (!query.year) {
      return { candidates: [], warning: "Add a year to search the free sports-card catalog (for example, 1990 Topps Nolan Ryan #1)." };
    }

    const directory = await fetchJson(`${API_ROOT}/baseball/${query.year}?ref=main`, signal);
    const files = likelyFiles(entries(directory), query);
    if (!files.length) return { candidates: [], warning: `No CardLists baseball sets are available for ${query.year}.` };

    const settled = await Promise.allSettled(files.map(async (file) => {
      const url = file.downloadUrl ?? `${RAW_ROOT}/${file.path}`;
      return setCandidates(await fetchJson(url, signal), file, query);
    }));
    const candidates = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    const failures = settled.filter((result) => result.status === "rejected").length;
    return {
      candidates,
      warning: failures ? `${failures} CardLists set file${failures === 1 ? "" : "s"} could not be loaded.` : null,
    };
  },
};
