import type { Candidate, Category, CollectionGroup, CollectionItem, Condition } from "./types.ts";

/**
 * Storage schema version. Bumping this changes the storage key and would orphan
 * an existing collection, so only bump it for a breaking change. Groups were
 * added as a purely additive field, so the version stays at 1 and older
 * payloads simply revive with no groups.
 */
const SCHEMA_VERSION = 1;

export interface StoreSnapshot {
  items: CollectionItem[];
  groups: CollectionGroup[];
  /** Set when persisted data could not be read, so the UI can warn once. */
  warning: string | null;
}

interface PersistedShape {
  schemaVersion: number;
  items: unknown[];
  groups: unknown[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Defensive parse: unknown or corrupt entries are dropped, never thrown. */
function reviveItem(value: unknown): CollectionItem | null {
  if (!isRecord(value)) return null;
  const title = text(value.title).trim();
  const id = text(value.id).trim();
  if (!id || !title) return null;

  const category = text(value.category, "other") as Category;
  const addedAt = optionalNumber(value.addedAt) ?? Date.now();
  const details = Array.isArray(value.details)
    ? value.details
        .filter(isRecord)
        .map((row) => ({ label: text(row.label), value: text(row.value) }))
        .filter((row) => row.label && row.value)
    : [];

  return {
    id,
    addedAt,
    updatedAt: optionalNumber(value.updatedAt) ?? addedAt,
    title,
    subtitle: optionalText(value.subtitle),
    category,
    year: optionalNumber(value.year),
    imageUrl: optionalText(value.imageUrl),
    description: optionalText(value.description),
    sourceUrl: optionalText(value.sourceUrl),
    sourceLabel: text(value.sourceLabel, "Manual entry"),
    details,
    condition: (text(value.condition, "good") as Condition) || "good",
    grade: text(value.grade),
    quantity: Math.max(1, Math.trunc(optionalNumber(value.quantity) ?? 1)),
    pricePaid: optionalNumber(value.pricePaid),
    estimatedValue: optionalNumber(value.estimatedValue),
    notes: text(value.notes),
    favorite: value.favorite === true,
    groupId: optionalText(value.groupId),
  };
}

/** Groups with no usable id or name are dropped. */
function reviveGroup(value: unknown): CollectionGroup | null {
  if (!isRecord(value)) return null;
  const id = text(value.id).trim();
  const name = text(value.name).trim();
  if (!id || !name) return null;
  const createdAt = optionalNumber(value.createdAt) ?? Date.now();
  return { id, name, createdAt, updatedAt: optionalNumber(value.updatedAt) ?? createdAt };
}

export function makeId(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") return cryptoObj.randomUUID();
  return `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function itemFromCandidate(candidate: Candidate): CollectionItem {
  const now = Date.now();
  return {
    id: makeId(),
    addedAt: now,
    updatedAt: now,
    title: candidate.title,
    subtitle: candidate.subtitle,
    category: candidate.category,
    year: candidate.year,
    imageUrl: candidate.imageUrl,
    description: candidate.description,
    sourceUrl: candidate.sourceUrl,
    sourceLabel: candidate.providerLabel,
    details: candidate.details,
    condition: "good",
    grade: "",
    quantity: 1,
    pricePaid: null,
    estimatedValue: null,
    notes: "",
    favorite: false,
    groupId: null,
  };
}

/**
 * Collection storage scoped to one Canvas backend. The key is namespaced by app
 * name and backend id so switching backends never mixes collections.
 */
export class CollectionStore {
  readonly key: string;

  constructor(
    appName: string,
    backendId: string,
    private readonly storage: Storage | null = safeStorage(),
  ) {
    this.key = `openhands:apps:${appName}:${backendId}:collection:v${SCHEMA_VERSION}`;
  }

  get available(): boolean {
    return this.storage !== null;
  }

  load(): StoreSnapshot {
    if (!this.storage) {
      return { items: [], groups: [], warning: "Local storage is unavailable in this browser." };
    }
    let raw: string | null = null;
    try {
      raw = this.storage.getItem(this.key);
    } catch {
      return { items: [], groups: [], warning: "Could not read saved collection data." };
    }
    if (!raw) return { items: [], groups: [], warning: null };

    try {
      const parsed: unknown = JSON.parse(raw);
      // Older payloads predate groups entirely; they revive as an empty list.
      const rawItems = isRecord(parsed) && Array.isArray(parsed.items) ? parsed.items : [];
      const rawGroups = isRecord(parsed) && Array.isArray(parsed.groups) ? parsed.groups : [];

      const groups = rawGroups
        .map(reviveGroup)
        .filter((group): group is CollectionGroup => group !== null);

      const known = new Set(groups.map((group) => group.id));
      const items = rawItems
        .map(reviveItem)
        .filter((item): item is CollectionItem => item !== null)
        // Drop dangling membership so a deleted group can never hide an item.
        .map((item) => (item.groupId && !known.has(item.groupId) ? { ...item, groupId: null } : item));

      return { items, groups, warning: null };
    } catch {
      return { items: [], groups: [], warning: "Saved collection data was unreadable and has been reset." };
    }
  }

  save(items: CollectionItem[], groups: CollectionGroup[]): string | null {
    if (!this.storage) return "Local storage is unavailable, so changes will not persist.";
    const payload: PersistedShape = { schemaVersion: SCHEMA_VERSION, items, groups };
    try {
      this.storage.setItem(this.key, JSON.stringify(payload));
      return null;
    } catch {
      return "Could not save the collection. Device storage may be full.";
    }
  }

  clear(): void {
    try {
      this.storage?.removeItem(this.key);
    } catch {
      /* storage unavailable; nothing to clear */
    }
  }
}

function safeStorage(): Storage | null {
  try {
    const probe = "__cs_probe__";
    globalThis.localStorage.setItem(probe, "1");
    globalThis.localStorage.removeItem(probe);
    return globalThis.localStorage;
  } catch {
    return null;
  }
}
