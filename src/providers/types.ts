import type { Candidate, Category, SearchQuery } from "../types.ts";

export interface ProviderResult {
  candidates: Candidate[];
  /** Non-fatal provider problem, surfaced as a warning instead of an error. */
  warning: string | null;
}

export interface Provider {
  id: Candidate["provider"];
  label: string;
  categories: Category[];
  /** True when this provider is a sensible default for the detected category. */
  prefers(query: SearchQuery): boolean;
  search(query: SearchQuery, signal: AbortSignal): Promise<ProviderResult>;
}

export class ProviderError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ProviderError";
  }
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/**
 * Shared fetch wrapper: bounded timeout, abort propagation, and a single place
 * where network failures become readable ProviderErrors.
 */
export async function fetchJson(
  url: string,
  signal: AbortSignal,
  timeoutMs = 9000,
): Promise<unknown> {
  const controller = new AbortController();
  const onAbort = () => controller.abort(signal.reason);
  if (signal.aborted) controller.abort(signal.reason);
  else signal.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new ProviderError(
        response.status === 429
          ? "The lookup service is rate limiting requests. Wait a moment and try again."
          : `Lookup service responded with ${response.status}.`,
        response.status,
      );
    }
    return await response.json();
  } catch (error) {
    if (signal.aborted) throw error;
    if (error instanceof ProviderError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderError("The lookup timed out. Check your connection and try again.");
    }
    throw new ProviderError("Could not reach the lookup service. Check your connection.");
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}
