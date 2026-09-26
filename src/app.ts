import { append, clear, el, money, parseMoney, safeUrl, thumbnail, type Child } from "./dom.ts";
import type { CanvasExtensionHost } from "./host.ts";
import { confidenceLabel, type ScoredCandidate } from "./match.ts";
import { searchAll } from "./providers/index.ts";
import { parseQuery } from "./query.ts";
import type { AppSession, SortKey, Tab } from "./session.ts";
import { CollectionStore, itemFromCandidate } from "./store.ts";
import { formatDate, normalizeText, tokenize } from "./text.ts";
import {
  CATEGORY_GLYPHS,
  CATEGORY_LABELS,
  CONDITIONS,
  type Candidate,
  type Category,
  type CategoryFilter,
  type CollectionItem,
  type Condition,
} from "./types.ts";

const PAGE_ROOT = "/collection";

type ViewName = "search" | "collection" | "candidate" | "item" | "unknown";

const SUGGESTIONS = ["Amazing Spider-Man #300", "1952 Topps Mickey Mantle", "Watchmen", "Action Comics #1"];

const SORT_LABELS: Record<SortKey, string> = {
  recent: "Recently added",
  title: "Title A–Z",
  value: "Highest value",
  category: "Category",
};

export class CollectorApp {
  private readonly store: CollectionStore;
  private items: CollectionItem[] = [];
  private root: HTMLElement | null = null;
  private listHost: HTMLElement | null = null;
  private searchAbort: AbortController | null = null;
  private flashTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(
    private readonly host: CanvasExtensionHost,
    private readonly session: AppSession,
    private readonly navigate: (path: string) => void,
    private readonly path: string,
  ) {
    this.store = new CollectionStore(host.extension.name, host.backend.id);
    const snapshot = this.store.load();
    this.items = snapshot.items;
    if (snapshot.warning) this.session.warnings.push(snapshot.warning);
    if (!this.store.available) {
      this.session.warnings.push("Local storage is unavailable, so the collection will not persist.");
    }
  }

  /** Render into the Canvas-supplied container. Returns the mount disposer. */
  mount(container: HTMLElement): () => void {
    const root = el("div", { class: "cs-app" });
    container.append(root);
    this.root = root;
    this.render();
    if (this.session.flash) this.armFlash();

    return () => {
      this.disposed = true;
      this.searchAbort?.abort(new Error("unmounted"));
      this.searchAbort = null;
      if (this.flashTimer) clearTimeout(this.flashTimer);
      this.flashTimer = null;
      this.listHost = null;
      this.root = null;
      if (root.parentNode) root.parentNode.removeChild(root);
    };
  }

  // ---------------------------------------------------------------- routing

  private base(): string {
    return `/extensions/${encodeURIComponent(this.host.extension.name)}${PAGE_ROOT}`;
  }

  private go(subpath = ""): void {
    this.navigate(subpath ? `${this.base()}/${subpath}` : this.base());
  }

  private resolveView(): { view: ViewName; param: string } {
    const segments = this.path.split("/").map((part) => part.trim()).filter(Boolean);
    if (segments.length === 0) return { view: "search", param: "" };
    const [head, ...rest] = segments;
    const param = rest.join("/");
    if (head === "collection" && rest.length === 0) return { view: "collection", param: "" };
    if (head === "candidate" && param) return { view: "candidate", param };
    if (head === "item" && param) return { view: "item", param };
    if (head === "search" && rest.length === 0) return { view: "search", param: "" };
    return { view: "unknown", param: "" };
  }

  // ---------------------------------------------------------------- rendering

  private render(): void {
    const root = this.root;
    if (!root) return;
    const active = document.activeElement;
    const focusedId = active instanceof HTMLElement && root.contains(active) ? active.id : null;
    const selectionStart =
      active instanceof HTMLInputElement && focusedId ? active.selectionStart : null;

    const { view, param } = this.resolveView();

    clear(root);
    root.append(this.renderHeader());

    if (view !== "candidate" && view !== "item") root.append(this.renderTabs());

    switch (view) {
      case "search":
        root.append(this.renderSearchView());
        break;
      case "collection":
        root.append(this.renderCollectionView());
        break;
      case "candidate":
        root.append(this.renderCandidateView(decodeURIComponent(param)));
        break;
      case "item":
        root.append(this.renderItemView(decodeURIComponent(param)));
        break;
      default:
        root.append(this.renderUnknownView());
    }

    if (this.session.flash) {
      root.append(el("div", { class: "cs-toast", attrs: { role: "status" }, text: this.session.flash }));
    }

    if (focusedId) {
      const next = root.querySelector<HTMLElement>(`#${focusedId}`);
      if (next) {
        next.focus();
        if (selectionStart != null && next instanceof HTMLInputElement) {
          try {
            next.setSelectionRange(selectionStart, selectionStart);
          } catch {
            /* input type does not support selection ranges */
          }
        }
      }
    }
  }

  /**
   * Totals the collection for the header and list captions. Prefer recorded
   * estimated values, but fall back to what was actually paid: a collection
   * where the user only logged purchase prices should not read as "$0.00".
   */
  private collectionTotal(items: CollectionItem[]): { text: string; count: number } {
    const count = items.reduce((total, item) => total + item.quantity, 0);
    const sum = (pick: (item: CollectionItem) => number | null): number | null => {
      const known = items.filter((item) => pick(item) != null);
      if (!known.length) return null;
      return known.reduce((total, item) => total + (pick(item) as number) * item.quantity, 0);
    };
    const estimated = sum((item) => item.estimatedValue);
    const paid = sum((item) => item.pricePaid);
    const value = estimated ?? paid;
    const suffix = estimated != null ? " est." : paid != null ? " paid" : "";
    return { text: value == null ? "" : ` · ${money(value)}${suffix}`, count };
  }

  private renderHeader(): HTMLElement {
    const { text, count } = this.collectionTotal(this.items);
    const summary =
      count === 0 ? "Your collection is empty" : `${count} ${count === 1 ? "item" : "items"}${text}`;

    return el("header", { class: "cs-header" }, [
      el("div", { class: "cs-header__row" }, [
        el("h2", { class: "cs-title", text: "Collector Scan" }),
        el("span", { class: "cs-count", text: summary }),
      ]),
      el("p", {
        class: "cs-subtitle",
        text: "Search a comic, card, or book, pick the right match, and track it.",
      }),
    ]);
  }

  private renderTabs(): HTMLElement {
    const tab = (id: Tab, label: string): HTMLElement =>
      el("button", {
        class: "cs-tab",
        text: label,
        attrs: { type: "button", role: "tab", "aria-selected": String(this.session.activeTab === id) },
        on: {
          click: () => {
            if (this.session.activeTab === id) return;
            this.session.activeTab = id;
            this.go(id === "search" ? "" : "collection");
            this.render();
          },
        },
      });

    return el("div", { class: "cs-tabs", attrs: { role: "tablist", "aria-label": "Sections" } }, [
      tab("search", "Find an item"),
      tab("collection", "My collection"),
    ]);
  }

  private stateBlock(title: string, body: string, variant?: "error" | "loading"): HTMLElement {
    return el("div", { class: `cs-state${variant === "error" ? " cs-state--error" : ""}` }, [
      variant === "loading" ? el("div", { class: "cs-spinner", attrs: { "aria-hidden": "true" } }) : null,
      el("p", { class: "cs-state__title", text: title }),
      el("p", { class: "cs-state__body", text: body }),
    ]);
  }

  // ---------------------------------------------------------------- search

  private renderSearchView(): HTMLElement {
    const wrap = el("div", { class: "cs-search" });
    wrap.append(
      el("form", { class: "cs-search__row", attrs: { role: "search" } }, [
        el("label", { class: "cs-visually-hidden", attrs: { for: "cs-search-input" }, text: "Search for a collectible" }),
        el("input", {
          class: "cs-input",
          attrs: {
            id: "cs-search-input",
            type: "search",
            name: "q",
            value: this.session.query,
            placeholder: "e.g. Amazing Spider-Man #300",
            autocomplete: "off",
            autocapitalize: "off",
            spellcheck: "false",
            enterkeyhint: "search",
          },
        }),
        el("button", {
          class: "cs-button",
          text: this.session.status === "loading" ? "Searching…" : "Search",
          attrs: { type: "submit", disabled: this.session.status === "loading" },
        }),
      ]),
    );
    const form = wrap.firstElementChild as HTMLFormElement;
    const input = form.querySelector("input") as HTMLInputElement;
    input.addEventListener("input", () => {
      this.session.query = input.value;
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.session.query = input.value;
      void this.runSearch();
    });

    wrap.append(this.renderCategoryChips());
    append(wrap, this.renderQueryHint());

    if (this.session.status === "idle") {
      wrap.append(this.renderSuggestions());
      return wrap;
    }
    if (this.session.status === "loading") {
      wrap.append(
        el("div", { class: "cs-skeleton", attrs: { "aria-hidden": "true" } }, [
          el("div", { class: "cs-skeleton__row" }),
          el("div", { class: "cs-skeleton__row" }),
        ]),
      );
      wrap.append(el("p", { class: "cs-hint", attrs: { role: "status" }, text: "Looking up matches…" }));
      return wrap;
    }
    if (this.session.status === "error") {
      wrap.append(
        this.stateBlock("Lookup failed", this.session.error ?? "Something went wrong.", "error"),
      );
      append(wrap, this.renderWarnings());
      return wrap;
    }

    wrap.append(this.renderResultsList());
    append(wrap, this.renderWarnings());
    return wrap;
  }

  private renderSuggestions(): HTMLElement {
    return el("div", { class: "cs-section" }, [
      el("h3", { class: "cs-section__title", text: "Try one of these" }),
      el(
        "div",
        { class: "cs-chips" },
        SUGGESTIONS.map((suggestion) =>
          el("button", {
            class: "cs-chip",
            text: suggestion,
            attrs: { type: "button" },
            on: {
              click: () => {
                this.session.query = suggestion;
                void this.runSearch();
              },
            },
          }),
        ),
      ),
    ]);
  }

  private renderCategoryChips(): HTMLElement {
    const options: { value: CategoryFilter; label: string }[] = [
      { value: "all", label: "Any type" },
      { value: "comic", label: "Comics" },
      { value: "sports-card", label: "Sports cards" },
      { value: "book", label: "Books" },
      { value: "other", label: "Other" },
    ];
    return el("div", { class: "cs-chips", attrs: { role: "group", "aria-label": "Filter by type" } }, [
      ...options.map((option) =>
        el("button", {
          class: "cs-chip",
          text: option.label,
          attrs: { type: "button", "aria-pressed": String(this.session.categoryFilter === option.value) },
          on: {
            click: () => {
              this.session.categoryFilter = option.value;
              this.render();
            },
          },
        }),
      ),
    ]);
  }

  private renderQueryHint(): Child {
    if (!this.session.query.trim()) return null;
    const parsed = parseQuery(this.session.query);
    const bits: string[] = [];
    if (parsed.category) bits.push(CATEGORY_LABELS[parsed.category].toLowerCase());
    if (parsed.number) bits.push(`issue ${parsed.number}`);
    if (parsed.year) bits.push(String(parsed.year));
    if (parsed.publisher) bits.push(parsed.publisher);
    if (!bits.length) return null;
    return el("p", { class: "cs-hint", text: `Reading this as: ${bits.join(" · ")}` });
  }

  private renderWarnings(): Child {
    const warnings = this.session.warnings;
    if (!warnings.length) return null;
    return el("div", { class: "cs-state" }, [
      el("p", { class: "cs-state__title", text: "Heads up" }),
      ...warnings.map((warning) => el("p", { class: "cs-state__body", text: warning })),
    ]);
  }

  private visibleResults(): ScoredCandidate[] {
    const filter = this.session.categoryFilter;
    if (filter === "all") return this.session.results;
    return this.session.results.filter((result) => result.category === filter);
  }

  private renderResultsList(): HTMLElement {
    const host = el("div", { attrs: { id: "cs-list" } });
    this.listHost = host;
    this.fillResults(host);
    return host;
  }

  private fillResults(host: HTMLElement): void {
    clear(host);
    const results = this.visibleResults();
    if (!results.length) {
      host.append(
        this.stateBlock(
          "No matches",
          this.session.results.length
            ? "No results in this type. Try choosing “Any type”."
            : "Nothing came back for that search. Try fewer words, or add the year or issue number.",
        ),
      );
      return;
    }

    const list = el("ul", { class: "cs-results" });
    for (const result of results) list.append(el("li", {}, [this.renderResultCard(result)]));
    host.append(
      el("p", {
        class: "cs-hint",
        text: `${results.length} ${results.length === 1 ? "match" : "matches"} · best guess first`,
      }),
    );
    host.append(list);
  }

  private renderResultCard(result: ScoredCandidate): HTMLElement {
    const metaParts = [
      CATEGORY_LABELS[result.category],
      result.year ? String(result.year) : null,
      result.subtitle,
    ].filter((part): part is string => Boolean(part));

    return el(
      "button",
      {
        class: "cs-card cs-card--tappable",
        attrs: { type: "button" },
        on: {
          click: () => {
            this.session.flash = null;
            this.go(`candidate/${encodeURIComponent(result.id)}`);
            this.render();
          },
        },
      },
      [
        thumbnail(result.imageUrl, CATEGORY_GLYPHS[result.category], result.title),
        el("div", { class: "cs-card__body" }, [
          el("p", { class: "cs-card__title", text: result.title }),
          el("p", { class: "cs-card__meta", text: metaParts.join(" · ") }),
          el("div", { class: "cs-card__tags" }, [
            el("span", {
              class: "cs-tag cs-tag--score",
              text: confidenceLabel(result.score, this.session.resultTokens),
            }),
            el("span", { class: "cs-tag", text: result.providerLabel }),
            ...(result.imageUrl ? [] : [el("span", { class: "cs-tag cs-tag--muted", text: "no image" })]),
            ...result.matchReasons.slice(0, 2).map((reason) =>
              el("span", { class: "cs-tag", text: reason }),
            ),
          ]),
        ]),
      ],
    );
  }

  // ---------------------------------------------------------------- detail

  private renderCandidateView(id: string): HTMLElement {
    const candidate = this.session.results.find((result) => result.id === id);
    if (!candidate) {
      return el("div", { class: "cs-detail" }, [
        this.stateBlock(
          "Match no longer loaded",
          "That result is not in the current search. Run the search again to reload it.",
        ),
        this.backButton("Back to search"),
      ]);
    }

    const wrap = el("div", { class: "cs-detail" });
    wrap.append(this.backButton("Back to matches"));

    const source = safeUrl(candidate.sourceUrl);
    wrap.append(
      el("section", { class: "cs-section" }, [
        thumbnail(candidate.imageUrl, CATEGORY_GLYPHS[candidate.category], candidate.title, "hero"),
        el("div", { class: "cs-detail__head" }, [
          el("h3", { class: "cs-detail__title", text: candidate.title }),
          candidate.subtitle ? el("p", { class: "cs-detail__sub", text: candidate.subtitle }) : null,
          el("div", { class: "cs-card__tags" }, [
            el("span", { class: "cs-tag", text: CATEGORY_LABELS[candidate.category] }),
            el("span", { class: "cs-tag", text: candidate.providerLabel }),
            el("span", {
              class: "cs-tag cs-tag--score",
              text: confidenceLabel(candidate.score, this.session.resultTokens),
            }),
          ]),
        ]),
        candidate.description ? el("p", { class: "cs-detail__desc", text: candidate.description }) : null,
        source
          ? el("a", {
              class: "cs-detail__link",
              text: "View source page",
              attrs: { href: source, target: "_blank", rel: "noopener noreferrer" },
            })
          : null,
      ]),
    );

    if (candidate.details.length) {
      wrap.append(
        el("section", { class: "cs-section" }, [
          el("h3", { class: "cs-section__title", text: "Details" }),
          el(
            "dl",
            { class: "cs-dl" },
            candidate.details.map((row) =>
              el("div", { class: "cs-dl__row" }, [
                el("dt", { text: row.label }),
                el("dd", { text: row.value }),
              ]),
            ),
          ),
        ]),
      );
    }

    wrap.append(this.renderAddForm(candidate));
    return wrap;
  }

  private renderAddForm(candidate: Candidate): HTMLElement {
    const section = el("section", { class: "cs-section" });
    section.append(el("h3", { class: "cs-section__title", text: "Add to collection" }));

    const condition = el("select", { class: "cs-select", attrs: { id: "cs-add-condition" } }, [
      ...CONDITIONS.map((value) =>
        el("option", { text: value === "graded" ? "Graded / slabbed" : value, attrs: { value, selected: value === "good" } }),
      ),
    ]);
    const grade = el("input", {
      class: "cs-input",
      attrs: { id: "cs-add-grade", type: "text", placeholder: "e.g. CGC 9.8", autocomplete: "off" },
    });
    const price = el("input", {
      class: "cs-input",
      attrs: { id: "cs-add-price", type: "text", inputmode: "decimal", placeholder: "0.00", autocomplete: "off" },
    });
    const quantity = el("input", {
      class: "cs-input",
      attrs: { id: "cs-add-qty", type: "number", min: "1", step: "1", value: "1", inputmode: "numeric" },
    });
    const notes = el("textarea", {
      class: "cs-textarea",
      attrs: { id: "cs-add-notes", rows: "3", placeholder: "Where you found it, defects, asking price…" },
    });

    section.append(
      el("div", { class: "cs-grid2" }, [
        this.field("Condition", condition),
        this.field("Grade / slab", grade),
      ]),
      el("div", { class: "cs-grid2" }, [
        this.field("Price paid", price),
        this.field("Quantity", quantity),
      ]),
      this.field("Notes", notes),
    );

    section.append(
      el("button", {
        class: "cs-button cs-button--block",
        text: "Save to collection",
        attrs: { type: "button" },
        on: {
          click: () => {
            const item = itemFromCandidate(candidate);
            item.condition = condition.value as Condition;
            item.grade = grade.value.trim();
            item.pricePaid = parseMoney(price.value);
            item.quantity = Math.max(1, Math.trunc(Number(quantity.value) || 1));
            item.notes = notes.value.trim();
            this.items = [item, ...this.items];
            this.persist();
            this.session.activeTab = "collection";
            this.session.flash = `Added “${item.title}” to your collection.`;
            this.go("collection");
            this.render();
            this.armFlash();
          },
        },
      }),
    );

    return section;
  }

  private renderItemView(id: string): HTMLElement {
    const item = this.items.find((entry) => entry.id === id);
    if (!item) {
      return el("div", { class: "cs-detail" }, [
        this.stateBlock("Item not found", "This item is no longer in your collection."),
        this.backButton("Back to collection"),
      ]);
    }

    const wrap = el("div", { class: "cs-detail" });
    wrap.append(this.backButton("Back to collection"));

    const source = safeUrl(item.sourceUrl);
    wrap.append(
      el("section", { class: "cs-section" }, [
        thumbnail(item.imageUrl, CATEGORY_GLYPHS[item.category], item.title, "hero"),
        el("div", { class: "cs-detail__head" }, [
          el("h3", { class: "cs-detail__title", text: item.title }),
          item.subtitle ? el("p", { class: "cs-detail__sub", text: item.subtitle }) : null,
          el("div", { class: "cs-card__tags" }, [
            el("span", { class: "cs-tag", text: CATEGORY_LABELS[item.category] }),
            el("span", { class: "cs-tag", text: item.condition }),
            item.grade ? el("span", { class: "cs-tag", text: item.grade }) : null,
            el("span", { class: "cs-tag", text: `Added ${formatDate(item.addedAt)}` }),
          ]),
        ]),
        item.description ? el("p", { class: "cs-detail__desc", text: item.description }) : null,
        source
          ? el("a", {
              class: "cs-detail__link",
              text: `Source: ${item.sourceLabel}`,
              attrs: { href: source, target: "_blank", rel: "noopener noreferrer" },
            })
          : null,
      ]),
    );

    if (item.details.length) {
      wrap.append(
        el("section", { class: "cs-section" }, [
          el("h3", { class: "cs-section__title", text: "Lookup details" }),
          el(
            "dl",
            { class: "cs-dl" },
            item.details.map((row) =>
              el("div", { class: "cs-dl__row" }, [el("dt", { text: row.label }), el("dd", { text: row.value })]),
            ),
          ),
        ]),
      );
    }

    wrap.append(this.renderEditForm(item));
    return wrap;
  }

  private renderEditForm(item: CollectionItem): HTMLElement {
    const section = el("section", { class: "cs-section" });
    section.append(el("h3", { class: "cs-section__title", text: "My copy" }));

    const condition = el("select", { class: "cs-select", attrs: { id: "cs-edit-condition" } }, [
      ...CONDITIONS.map((value) =>
        el("option", {
          text: value === "graded" ? "Graded / slabbed" : value,
          attrs: { value, selected: value === item.condition },
        }),
      ),
    ]);
    const grade = el("input", {
      class: "cs-input",
      attrs: { id: "cs-edit-grade", type: "text", value: item.grade, autocomplete: "off", placeholder: "e.g. CGC 9.8" },
    });
    const price = el("input", {
      class: "cs-input",
      attrs: {
        id: "cs-edit-price",
        type: "text",
        inputmode: "decimal",
        value: item.pricePaid == null ? "" : item.pricePaid.toFixed(2),
        placeholder: "0.00",
      },
    });
    const value = el("input", {
      class: "cs-input",
      attrs: {
        id: "cs-edit-value",
        type: "text",
        inputmode: "decimal",
        value: item.estimatedValue == null ? "" : item.estimatedValue.toFixed(2),
        placeholder: "0.00",
      },
    });
    const quantity = el("input", {
      class: "cs-input",
      attrs: { id: "cs-edit-qty", type: "number", min: "1", step: "1", inputmode: "numeric", value: String(item.quantity) },
    });
    const notes = el("textarea", {
      class: "cs-textarea",
      attrs: { id: "cs-edit-notes", rows: "3" },
    });
    notes.value = item.notes;

    section.append(
      el("div", { class: "cs-grid2" }, [this.field("Condition", condition), this.field("Grade / slab", grade)]),
      el("div", { class: "cs-grid2" }, [this.field("Price paid", price), this.field("Estimated value", value)]),
      el("div", { class: "cs-grid2" }, [
        this.field("Quantity", quantity),
        this.field("Favourite", this.favoriteToggle(item)),
      ]),
      this.field("Notes", notes),
    );

    section.append(
      el("div", { class: "cs-grid2" }, [
        el("button", {
          class: "cs-button",
          text: "Save changes",
          attrs: { type: "button" },
          on: {
            click: () => {
              const updated: CollectionItem = {
                ...item,
                condition: condition.value as Condition,
                grade: grade.value.trim(),
                pricePaid: parseMoney(price.value),
                estimatedValue: parseMoney(value.value),
                quantity: Math.max(1, Math.trunc(Number(quantity.value) || 1)),
                notes: notes.value.trim(),
                updatedAt: Date.now(),
              };
              this.items = this.items.map((entry) => (entry.id === item.id ? updated : entry));
              this.persist();
              this.session.flash = "Changes saved.";
              this.render();
              this.armFlash();
            },
          },
        }),
        el("button", {
          class: "cs-button cs-button--danger",
          text: "Remove item",
          attrs: { type: "button" },
          on: {
            click: () => {
              this.items = this.items.filter((entry) => entry.id !== item.id);
              this.persist();
              this.session.flash = "Item removed.";
              this.go("collection");
              this.render();
              this.armFlash();
            },
          },
        }),
      ]),
    );

    return section;
  }

  private favoriteToggle(item: CollectionItem): HTMLElement {
    const button = el("button", {
      class: "cs-star",
      text: item.favorite ? "★" : "☆",
      attrs: { type: "button", "aria-pressed": String(item.favorite), "aria-label": "Favourite" },
      on: {
        click: () => {
          this.toggleFavorite(item.id);
          this.render();
        },
      },
    });
    return el("div", { class: "cs-field" }, [button]);
  }

  private field(label: string, control: HTMLElement): HTMLElement {
    const id = control.getAttribute("id");
    if (id) {
      const labelEl = el("label", { class: "cs-field__label", attrs: { for: id }, text: label });
      return el("div", { class: "cs-field" }, [labelEl, control]);
    }
    return el("div", { class: "cs-field" }, [
      el("span", { class: "cs-field__label", text: label }),
      control,
    ]);
  }

  private backButton(label: string): HTMLElement {
    return el("button", {
      class: "cs-button cs-button--ghost",
      text: `← ${label}`,
      attrs: { type: "button" },
      on: {
        click: () => {
          this.session.activeTab = "search";
          this.go("");
          this.render();
        },
      },
    });
  }

  // ---------------------------------------------------------------- collection

  private filteredItems(): CollectionItem[] {
    const needle = normalizeText(this.session.collectionQuery);
    let items = this.items.filter((item) => {
      if (this.session.favoritesOnly && !item.favorite) return false;
      if (this.session.collectionFilter !== "all" && item.category !== this.session.collectionFilter) return false;
      if (!needle) return true;
      const haystack = normalizeText(
        [item.title, item.subtitle ?? "", item.notes, item.grade, ...item.details.map((row) => row.value)].join(" "),
      );
      return haystack.includes(needle);
    });

    const sort = this.session.collectionSort;
    items = [...items].sort((a, b) => {
      switch (sort) {
        case "title":
          return a.title.localeCompare(b.title);
        case "value":
          return (b.estimatedValue ?? 0) - (a.estimatedValue ?? 0);
        case "category":
          return a.category.localeCompare(b.category) || a.title.localeCompare(b.title);
        default:
          return b.addedAt - a.addedAt;
      }
    });
    return items;
  }

  private renderCollectionView(): HTMLElement {
    const wrap = el("div", { class: "cs-search" });

    if (this.items.length === 0) {
      wrap.append(
        this.stateBlock(
          "Nothing tracked yet",
          "Find an item on the Find tab and save it here. Everything stays on this device.",
        ),
        el("button", {
          class: "cs-button cs-button--block",
          text: "Find an item",
          attrs: { type: "button" },
          on: {
            click: () => {
              this.session.activeTab = "search";
              this.go("");
              this.render();
            },
          },
        }),
      );
      return wrap;
    }

    const search = el("input", {
      class: "cs-input",
      attrs: {
        id: "cs-collection-search",
        type: "search",
        value: this.session.collectionQuery,
        placeholder: "Filter my collection",
        autocomplete: "off",
        autocapitalize: "off",
        spellcheck: "false",
      },
    });
    search.addEventListener("input", () => {
      this.session.collectionQuery = search.value;
      if (this.listHost) this.fillCollection(this.listHost);
    });

    const categorySelect = el("select", { class: "cs-select", attrs: { id: "cs-collection-category" } }, [
      el("option", { text: "Any type", attrs: { value: "all", selected: this.session.collectionFilter === "all" } }),
      ...(["comic", "sports-card", "book", "other"] as Category[]).map((category) =>
        el("option", {
          text: CATEGORY_LABELS[category],
          attrs: { value: category, selected: this.session.collectionFilter === category },
        }),
      ),
    ]);
    categorySelect.addEventListener("change", () => {
      this.session.collectionFilter = categorySelect.value as CategoryFilter;
      if (this.listHost) this.fillCollection(this.listHost);
    });

    const sortSelect = el("select", { class: "cs-select", attrs: { id: "cs-collection-sort" } }, [
      ...(Object.keys(SORT_LABELS) as SortKey[]).map((key) =>
        el("option", { text: SORT_LABELS[key], attrs: { value: key, selected: this.session.collectionSort === key } }),
      ),
    ]);
    sortSelect.addEventListener("change", () => {
      this.session.collectionSort = sortSelect.value as SortKey;
      if (this.listHost) this.fillCollection(this.listHost);
    });

    wrap.append(
      el("div", { class: "cs-toolbar" }, [
        this.field("Search", search),
        this.field("Type", categorySelect),
        this.field("Sort", sortSelect),
        el("button", {
          class: "cs-chip",
          text: "★ Favourites",
          attrs: { type: "button", "aria-pressed": String(this.session.favoritesOnly) },
          on: {
            click: () => {
              this.session.favoritesOnly = !this.session.favoritesOnly;
              this.render();
            },
          },
        }),
      ]),
    );

    const host = el("div", { attrs: { id: "cs-list" } });
    this.listHost = host;
    this.fillCollection(host);
    wrap.append(host);
    return wrap;
  }

  private fillCollection(host: HTMLElement): void {
    clear(host);
    const items = this.filteredItems();
    if (!items.length) {
      host.append(this.stateBlock("No items match", "Clear the filter or search for something else."));
      return;
    }

    const { text } = this.collectionTotal(items);
    host.append(
      el("p", {
        class: "cs-hint",
        text: `${items.length} ${items.length === 1 ? "entry" : "entries"}${text || " · no value recorded"}`,
      }),
    );

    const list = el("ul", { class: "cs-results" });
    for (const item of items) list.append(el("li", {}, [this.renderItemCard(item)]));
    host.append(list);
  }

  private renderItemCard(item: CollectionItem): HTMLElement {
    const meta = [
      CATEGORY_LABELS[item.category],
      item.condition,
      item.grade || null,
      item.quantity > 1 ? `×${item.quantity}` : null,
      item.year ? String(item.year) : null,
    ].filter((part): part is string => Boolean(part));

    const valueLine =
      item.estimatedValue == null
        ? item.pricePaid == null
          ? "No value recorded"
          : `Paid ${money(item.pricePaid)}`
        : `Est. ${money(item.estimatedValue)}${item.pricePaid != null ? ` · paid ${money(item.pricePaid)}` : ""}`;

    return el("div", { class: "cs-item" }, [
      thumbnail(item.imageUrl, CATEGORY_GLYPHS[item.category], item.title),
      el("div", { class: "cs-card__body" }, [
        el("p", { class: "cs-card__title", text: item.title }),
        el("p", { class: "cs-card__meta", text: meta.join(" · ") }),
        el("p", { class: "cs-card__meta cs-item__value", text: valueLine }),
        el("div", { class: "cs-item__actions" }, [
          el("button", {
            class: "cs-button cs-button--ghost",
            text: "Open",
            attrs: { type: "button" },
            on: {
              click: () => {
                this.session.activeTab = "collection";
                this.go(`item/${encodeURIComponent(item.id)}`);
                this.render();
              },
            },
          }),
          el("button", {
            class: "cs-button cs-button--ghost",
            text: item.favorite ? "★ Favourite" : "☆ Favourite",
            attrs: { type: "button", "aria-pressed": String(item.favorite) },
            on: {
              click: () => {
                this.toggleFavorite(item.id);
                if (this.listHost) this.fillCollection(this.listHost);
              },
            },
          }),
        ]),
      ]),
    ]);
  }

  private renderUnknownView(): HTMLElement {
    return el("div", { class: "cs-detail" }, [
      this.stateBlock("Page not found", "That screen does not exist in this app."),
      this.backButton("Back to search"),
    ]);
  }

  // ---------------------------------------------------------------- actions

  private async runSearch(): Promise<void> {
    const raw = this.session.query.trim();
    if (!raw) {
      this.session.status = "idle";
      this.session.results = [];
      this.session.warnings = [];
      this.session.error = null;
      this.render();
      return;
    }

    this.searchAbort?.abort(new Error("superseded"));
    const controller = new AbortController();
    this.searchAbort = controller;

    const query = parseQuery(raw);
    this.session.status = "loading";
    this.session.error = null;
    this.session.warnings = [];
    this.session.activeTab = "search";
    if (this.resolveView().view !== "search") this.go("");
    this.render();

    const outcome = await searchAll(query, controller.signal);
    if (controller.signal.aborted || this.disposed) return;

    this.session.results = outcome.results;
    this.session.warnings = outcome.warnings;
    this.session.error = outcome.error;
    this.session.resultsFor = raw;
    this.session.resultTokens = tokenize(query.title).length;
    this.session.status = outcome.error ? "error" : "ready";
    this.render();
  }

  private toggleFavorite(id: string): void {
    this.items = this.items.map((item) =>
      item.id === id ? { ...item, favorite: !item.favorite, updatedAt: Date.now() } : item,
    );
    this.persist();
  }

  private persist(): void {
    const warning = this.store.save(this.items);
    if (warning && !this.session.warnings.includes(warning)) this.session.warnings.push(warning);
  }

  private armFlash(): void {
    if (this.flashTimer) clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => {
      this.flashTimer = null;
      if (this.disposed) return;
      this.session.flash = null;
      this.render();
    }, 2600);
  }
}
