export interface CatalogSubmission {
  title: string;
  category: string;
  [key: string]: unknown;
}
export function parseSubmission(issue: { number: number; html_url: string; body: string | null }): CatalogSubmission | null;
export function applyCatalogEvent(items: unknown[], event: unknown): unknown[];
