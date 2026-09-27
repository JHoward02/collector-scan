import type { Category, SearchQuery } from "./types.ts";

const CATEGORY_KEYWORDS: Record<Exclude<Category, "other">, string[]> = {
  comic: [
    "comic", "comics", "issue", "variant", "marvel", "dc comics", "dcu", "dark horse",
    "image comics", "idw", "manga", "graphic novel", "spider-man", "spiderman", "batman",
    "superman", "x-men", "xmen", "avengers", "justice league", "fantastic four", "silver surfer",
  ],
  "sports-card": [
    "card", "cards", "rookie", "rc", "topps", "panini", "upper deck", "fleer", "bowman",
    "donruss", "score", "prizm", "optic", "refractor", "holo", "psa", "bgs", "sgc", "cgc",
    "autograph", "auto", "patch", "jersey", "baseball card", "basketball card", "football card",
    "trading card", "insert", "parallel", "graded",
  ],
  tcg: ["tcg", "pokemon card", "pokémon card", "magic the gathering", "yu-gi-oh", "lorcana", "one piece card"],
  book: [
    "book", "novel", "hardcover", "paperback", "first edition", "1st edition", "isbn",
    "author", "published", "publisher", "omnibus", "tpb", "trade paperback",
  ],
  "video-game": ["video game", "videogame", "nintendo", "playstation", "xbox", "sega", "game cartridge", "game disc"],
  figure: ["action figure", "figurine", "funko pop", "statue", "nendoroid", "amiibo"],
  toy: ["toy", "toys", "lego", "hot wheels", "barbie", "plush"],
  coin: ["coin", "coins", "numismatic", "silver dollar", "mint mark"],
  vinyl: ["vinyl", "lp record", "record album", "12-inch single"],
  sneaker: ["sneaker", "sneakers", "air jordan", "air max", "yeezy", "dunk low"],
};

const PUBLISHERS = [
  "marvel", "dc", "image", "dark horse", "idw", "boom", "dynamite", "valiant",
  "topps", "panini", "upper deck", "fleer", "bowman", "donruss", "score",
  "penguin", "harpercollins", "random house", "scholastic", "tor", "vintage",
];

const NUMBER_PATTERNS = [
  /#\s*(\d+[a-z]?)/i,
  /\bissue\s*#?\s*(\d+[a-z]?)/i,
  /\bno\.?\s*(\d+[a-z]?)/i,
];

const YEAR_PATTERN = /\b(1[89]\d{2}|20\d{2})\b/;

/**
 * Turn free text like "1952 Topps Mickey Mantle RC" or "Amazing Spider-Man #300"
 * into a structured query. Detection is deliberately conservative: anything not
 * recognised simply stays part of the title.
 */
export function parseQuery(raw: string): SearchQuery {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  const lower = trimmed.toLowerCase();
  const detectionReasons: string[] = [];

  let category: Category | null = null;
  let bestHits = 0;
  for (const [key, keywords] of Object.entries(CATEGORY_KEYWORDS) as [Category, string[]][]) {
    const hits = keywords.filter((word) => lower.includes(word)).length;
    if (hits > bestHits) {
      bestHits = hits;
      category = key;
    }
  }
  if (category) detectionReasons.push(`looks like a ${category.replace("-", " ")}`);

  const yearMatch = lower.match(YEAR_PATTERN);
  const year = yearMatch ? Number.parseInt(yearMatch[1], 10) : null;

  let number: string | null = null;
  for (const pattern of NUMBER_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      number = match[1];
      break;
    }
  }

  const publisher = PUBLISHERS.find((name) => lower.includes(name)) ?? null;

  // Title text drops the structural tokens we already captured so keyword
  // matching is not diluted by years or issue numbers.
  let title = trimmed;
  if (yearMatch) title = title.replace(new RegExp(`\\b${yearMatch[1]}\\b`, "g"), " ");
  for (const pattern of NUMBER_PATTERNS) {
    title = title.replace(new RegExp(pattern.source, "gi"), " ");
  }
  title = title.replace(/\s+/g, " ").trim();
  if (!title) title = trimmed;

  return {
    raw: trimmed,
    title,
    providerQuery: trimmed,
    category,
    year,
    number,
    publisher,
    detectionReasons,
  };
}
