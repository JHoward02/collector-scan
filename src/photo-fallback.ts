const PHOTO_PREFIX = "shelfie:candidate-photo:";

function candidateIdFromHash(): string | null {
  const match = location.hash.match(/#\/?candidate\/([^/?#]+)/);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return null; }
}

function photoKey(id: string): string { return `${PHOTO_PREFIX}${id}`; }

export function getCandidatePhoto(id: string): string | null {
  try { return sessionStorage.getItem(photoKey(id)); } catch { return null; }
}

function setCandidatePhoto(id: string, value: string): void {
  try { sessionStorage.setItem(photoKey(id), value); } catch { /* best effort */ }
}

async function resizePhoto(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Could not read photo"));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not open photo"));
    img.src = dataUrl;
  });
  const max = 1200;
  const scale = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function enhanceCandidate(): void {
  const id = candidateIdFromHash();
  if (!id) return;
  const detail = document.querySelector<HTMLElement>(".cs-detail");
  if (!detail || detail.querySelector("[data-shelfie-photo-fallback]")) return;
  const hero = detail.querySelector<HTMLElement>(".cs-media--hero");
  if (!hero || hero.querySelector("img")) return;
  const note = hero.querySelector(".cs-media__note");
  if (!note || !/no image/i.test(note.textContent ?? "")) return;
  const addSection = Array.from(detail.querySelectorAll<HTMLElement>(".cs-section")).find((section) =>
    section.querySelector(".cs-section__title")?.textContent?.trim() === "Add to collection"
  );
  if (!addSection) return;

  const box = document.createElement("div");
  box.dataset.shelfiePhotoFallback = "1";
  box.className = "cs-field";
  const label = document.createElement("label");
  label.textContent = "Photo";
  label.className = "cs-label";
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.setAttribute("capture", "environment");
  input.className = "cs-input";
  const help = document.createElement("p");
  help.className = "cs-hint";
  help.textContent = "No catalog photo is available. Add your own photo from your camera or photo library.";
  const preview = document.createElement("img");
  preview.alt = "Your selected collectible photo";
  preview.style.cssText = "display:none;max-width:180px;max-height:180px;object-fit:contain;border-radius:10px;margin-top:8px";
  const saved = getCandidatePhoto(id);
  if (saved) { preview.src = saved; preview.style.display = "block"; }
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    help.textContent = "Preparing photo…";
    try {
      const photo = await resizePhoto(file);
      setCandidatePhoto(id, photo);
      preview.src = photo;
      preview.style.display = "block";
      help.textContent = "Your photo will be saved with this Shelfie item.";
    } catch {
      help.textContent = "That photo could not be loaded. Try another image.";
    }
  });
  box.append(label, input, help, preview);
  const save = addSection.querySelector("button.cs-button--block");
  if (save) addSection.insertBefore(box, save); else addSection.append(box);
}

export function installPhotoFallback(): () => void {
  let queued = false;
  const run = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; enhanceCandidate(); });
  };
  const observer = new MutationObserver(run);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", run);
  run();
  return () => { observer.disconnect(); window.removeEventListener("hashchange", run); };
}
