import { CATEGORY_FILTER_LABELS, CATEGORIES, type Category } from "./types.ts";
import type { TcgGame } from "./session.ts";

let category: Category | null = null;
let tcgGame: TcgGame | null = null;

export function getSearchSelection(): { category: Category | null; tcgGame: TcgGame | null } {
  return { category, tcgGame };
}

const GAMES: { value: TcgGame; label: string }[] = [
  { value: "magic", label: "Magic: The Gathering" },
  { value: "yugioh", label: "Yu-Gi-Oh!" },
  { value: "pokemon", label: "Pokémon" },
  { value: "lorcana", label: "Lorcana" },
  { value: "one-piece", label: "One Piece" },
  { value: "fab", label: "Flesh and Blood" },
  { value: "other", label: "Other" },
];

function button(label: string, pressed: boolean, onClick: () => void): HTMLButtonElement {
  const node = document.createElement("button");
  node.type = "button";
  node.className = "cs-chip";
  node.textContent = label;
  node.setAttribute("aria-pressed", String(pressed));
  node.addEventListener("click", onClick);
  return node;
}

function section(title: string): { root: HTMLElement; chips: HTMLElement } {
  const root = document.createElement("div");
  root.className = "cs-section cs-search-selection";
  const heading = document.createElement("h3");
  heading.className = "cs-section__title";
  heading.textContent = title;
  const chips = document.createElement("div");
  chips.className = "cs-chips";
  chips.setAttribute("role", "group");
  root.append(heading, chips);
  return { root, chips };
}

/** Adds required search routing controls without changing collection filters. */
export function enhanceSearchSelection(root: HTMLElement): void {
  const form = root.querySelector<HTMLFormElement>('form[role="search"]');
  if (!form || root.querySelector("[data-shelfie-search-selection]")) return;

  // The legacy chip row immediately after the search form mixed search routing
  // with result filtering and included Any type. Replace it for Find only.
  const legacy = form.nextElementSibling;
  if (legacy?.classList.contains("cs-chips")) legacy.remove();

  const type = section("Choose a type");
  type.root.dataset.shelfieSearchSelection = "true";
  type.chips.setAttribute("aria-label", "Collectible type");
  for (const value of CATEGORIES) {
    type.chips.append(button(CATEGORY_FILTER_LABELS[value], category === value, () => {
      category = value;
      if (value !== "tcg") tcgGame = null;
      enhanceRefresh(root);
    }));
  }

  form.insertAdjacentElement("afterend", type.root);
  if (category === "tcg") {
    const game = section("Choose a TCG");
    game.root.dataset.shelfieTcgSelection = "true";
    game.chips.setAttribute("aria-label", "Trading card game");
    for (const item of GAMES) {
      game.chips.append(button(item.label, tcgGame === item.value, () => {
        tcgGame = item.value;
        enhanceRefresh(root);
      }));
    }
    type.root.insertAdjacentElement("afterend", game.root);
  }
}

function enhanceRefresh(root: HTMLElement): void {
  root.querySelectorAll("[data-shelfie-search-selection],[data-shelfie-tcg-selection]").forEach((node) => node.remove());
  enhanceSearchSelection(root);
}

export function clearSearchSelection(): void {
  category = null;
  tcgGame = null;
}
