const STORAGE_KEY = "openhands:apps:collector-scan:standalone:collection:v1";

const categoryMap: Record<string, string> = {
  Comics: "comic", TCG: "tcg", "Sports cards": "sports-card", Books: "book",
  "Video games": "video-game", Figures: "figure", Toys: "toy", Coins: "coin",
  Vinyl: "vinyl", Other: "other",
};

function selectedCategory(): string {
  const pressed = [...document.querySelectorAll<HTMLButtonElement>('.cs-chips button[aria-pressed="true"]')]
    .find((b) => b.textContent?.trim() !== "Any type");
  return categoryMap[pressed?.textContent?.trim() || ""] || "other";
}

function id(): string {
  return globalThis.crypto?.randomUUID?.() || `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function photoData(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 1200;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

function saveManual(item: Record<string, unknown>): void {
  let parsed: { schemaVersion: number; items: unknown[]; groups: unknown[] } = { schemaVersion: 1, items: [], groups: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const old = JSON.parse(raw);
      parsed = {
        schemaVersion: 1,
        items: Array.isArray(old.items) ? old.items : [],
        groups: Array.isArray(old.groups) ? old.groups : [],
      };
    }
  } catch { /* start a safe collection payload */ }
  parsed.items.unshift(item);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
}

function openManual(): void {
  document.querySelector("#shelfie-manual-modal")?.remove();
  const query = (document.querySelector<HTMLInputElement>("#cs-search-input")?.value || "").trim();
  const overlay = document.createElement("div");
  overlay.id = "shelfie-manual-modal";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:9999;display:flex;align-items:flex-end;justify-content:center;padding:16px";
  const panel = document.createElement("form");
  panel.style.cssText = "background:#fff;color:#111;width:min(560px,100%);max-height:90vh;overflow:auto;border-radius:18px;padding:20px;display:grid;gap:12px";
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><h3 style="margin:0">Add it to Shelfie</h3><button type="button" data-close aria-label="Close" style="font-size:24px;border:0;background:none">×</button></div>
    <p style="margin:0;color:#555">This creates a private item in your collection. It will not be added to Shelfie's shared catalog.</p>
    <label>Title / name<input required name="title" value="${query.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))}" class="cs-input" style="width:100%;margin-top:5px"></label>
    <label>Type<select name="category" class="cs-select" style="width:100%;margin-top:5px">
      <option value="comic">Comic</option><option value="tcg">TCG</option><option value="sports-card">Sports card</option><option value="book">Book</option><option value="video-game">Video game</option><option value="figure">Figure</option><option value="toy">Toy</option><option value="coin">Coin</option><option value="vinyl">Vinyl</option><option value="other">Other</option>
    </select></label>
    <label>Year <span style="color:#777">(optional)</span><input name="year" type="number" min="1000" max="2100" class="cs-input" style="width:100%;margin-top:5px"></label>
    <label>Maker / publisher / artist <span style="color:#777">(optional)</span><input name="maker" class="cs-input" style="width:100%;margin-top:5px"></label>
    <label>Identifier <span style="color:#777">UPC, ISBN, issue, catalog/model number, etc.</span><input name="identifier" class="cs-input" style="width:100%;margin-top:5px"></label>
    <label>Photo <span style="color:#777">(optional)</span><input name="photo" type="file" accept="image/*" capture="environment" style="display:block;margin-top:6px"></label>
    <label>Notes <span style="color:#777">(optional)</span><textarea name="notes" rows="3" class="cs-textarea" style="width:100%;margin-top:5px"></textarea></label>
    <button class="cs-button cs-button--block" type="submit">Save to my collection</button>`;
  (panel.elements.namedItem("category") as HTMLSelectElement).value = selectedCategory();
  panel.querySelector("[data-close]")?.addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  panel.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(panel);
    const title = String(fd.get("title") || "").trim();
    if (!title) return;
    const file = fd.get("photo") as File | null;
    let imageUrl: string | null = null;
    if (file?.size) {
      try { imageUrl = await photoData(file); } catch { imageUrl = null; }
    }
    const now = Date.now();
    const yearRaw = Number(fd.get("year"));
    const maker = String(fd.get("maker") || "").trim();
    const identifier = String(fd.get("identifier") || "").trim();
    saveManual({
      id: id(), addedAt: now, updatedAt: now, title, subtitle: maker || null,
      category: String(fd.get("category") || "other"), year: Number.isFinite(yearRaw) && yearRaw > 0 ? yearRaw : null,
      imageUrl, description: null, sourceUrl: null, sourceLabel: "Manual entry",
      details: [maker ? { label: "Maker / publisher / artist", value: maker } : null, identifier ? { label: "Identifier", value: identifier } : null].filter(Boolean),
      condition: "good", grade: "", quantity: 1, pricePaid: null, estimatedValue: null,
      notes: String(fd.get("notes") || "").trim(), favorite: false, groupId: null,
    });
    overlay.remove();
    location.hash = "#/collection";
    location.reload();
  });
  overlay.append(panel);
  document.body.append(overlay);
}

function installButton(): void {
  const list = document.querySelector<HTMLElement>("#cs-list");
  if (!list || document.querySelector("#shelfie-manual-add")) return;
  const button = document.createElement("button");
  button.id = "shelfie-manual-add";
  button.type = "button";
  button.className = "cs-button cs-button--block";
  button.style.marginTop = "14px";
  button.textContent = list.textContent?.includes("No matches") ? "+ Add it to Shelfie" : "Can't find yours? Add it manually";
  button.addEventListener("click", openManual);
  list.insertAdjacentElement("afterend", button);
}

export function installManualEntry(): () => void {
  const observer = new MutationObserver(installButton);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  installButton();
  return () => observer.disconnect();
}
