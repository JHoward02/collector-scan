/** Shared domain types for Collector Scan. */

export const CATEGORIES = [
  "comic", "tcg", "sports-card", "book", "video-game", "figure", "toy",
  "coin", "vinyl", "sneaker", "other",
] as const;
export type Category = (typeof CATEGORIES)[number];
export type CategoryFilter = Category | "all";
export type ProviderId = "openlibrary" | "wikipedia" | "cardlists" | "scryfall" | "ygoprodeck" | "lorcanajson" | "fab";

export interface DetailRow { label: string; value: string; }
export interface Candidate {
  id: string; provider: ProviderId; providerLabel: string; providerKey: string; title: string;
  subtitle: string | null; category: Category; year: number | null; imageUrl: string | null;
  description: string | null; sourceUrl: string | null; details: DetailRow[]; score: number; matchReasons: string[];
}
export interface SearchQuery {
  raw: string; title: string; providerQuery: string; category: Category | null; year: number | null;
  number: string | null; publisher: string | null; detectionReasons: string[];
}
export const CONDITIONS = ["mint","near mint","excellent","good","fair","poor","graded","raw"] as const;
export type Condition = (typeof CONDITIONS)[number];
export interface CollectionGroup { id: string; name: string; createdAt: number; updatedAt: number; }
export interface CollectionItem {
  id:string; addedAt:number; updatedAt:number; title:string; subtitle:string|null; category:Category; year:number|null;
  imageUrl:string|null; description:string|null; sourceUrl:string|null; sourceLabel:string; details:DetailRow[];
  condition:Condition; grade:string; quantity:number; pricePaid:number|null; estimatedValue:number|null; notes:string;
  favorite:boolean; groupId:string|null;
}
export type SearchStatus = "idle" | "loading" | "ready" | "error";
export const CATEGORY_LABELS: Record<Category,string> = {
  comic:"Comic",tcg:"TCG","sports-card":"Sports card",book:"Book","video-game":"Video game",
  figure:"Figure",toy:"Toy",coin:"Coin",vinyl:"Vinyl",sneaker:"Sneaker",other:"Collectible",
};
export const CATEGORY_FILTER_LABELS: Record<Category,string> = {
  comic:"Comics",tcg:"TCG","sports-card":"Sports cards",book:"Books","video-game":"Video games",
  figure:"Figures",toy:"Toys",coin:"Coins",vinyl:"Vinyl",sneaker:"Sneakers",other:"Other",
};
export const CATEGORY_GLYPHS: Record<Category,string> = {
  comic:"COMIC",tcg:"TCG","sports-card":"CARD",book:"BOOK","video-game":"GAME",figure:"FIGURE",
  toy:"TOY",coin:"COIN",vinyl:"VINYL",sneaker:"SHOE",other:"ITEM",
};
