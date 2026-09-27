import { readFileSync, writeFileSync } from "node:fs";

const categories = new Set(["comic", "tcg", "sports-card", "book", "video-game", "figure", "toy", "coin", "vinyl", "sneaker", "other"]);

export function parseSubmission(issue) {
  if (!Number.isSafeInteger(issue?.number) || !/^https:\/\/github\.com\/JHoward02\/collector-scan\/issues\/\d+$/.test(issue?.html_url ?? "")) {
    throw new Error("Invalid catalog issue reference");
  }
  const body = issue.body ?? "";
  if (!body.includes("<!-- shelfie-catalog-submission:v1 -->")) throw new Error("Not a Shelfie catalog submission");
  const sections = Object.fromEntries([...body.matchAll(/^### (Name|Category|Line \/ game|Year|Maker|Identifier|Photo)\s*\n([\s\S]*?)(?=^### |$(?![\s\S]))/gm)].map(([, key, value]) => [key, value.trim()]));
  const text = (key, max) => (sections[key] ?? "").split("\n")[0].trim().slice(0, max);
  const title = text("Name", 200);
  const category = text("Category", 30);
  if (!title || !categories.has(category)) throw new Error("Submission needs a name and a valid category");
  const yearValue = text("Year", 4);
  const year = /^\d{4}$/.test(yearValue) && Number(yearValue) >= 1000 && Number(yearValue) <= 2100 ? Number(yearValue) : null;
  const imageMatch = (sections.Photo ?? "").match(/!\[[^\]]*\]\((https:\/\/(?:github\.com\/user-attachments\/assets|user-images\.githubusercontent\.com)\/[^\s)]+)\)/);
  return {
    id: `issue-${issue.number}`, title, category, year,
    line: text("Line / game", 100), maker: text("Maker", 160), identifier: text("Identifier", 100),
    imageUrl: imageMatch?.[1] ?? null, sourceUrl: issue.html_url,
  };
}

export function applyCatalogEvent(items, event) {
  const issue = event.issue;
  if (!issue || issue.pull_request) return items;
  const id = `issue-${issue.number}`;
  const other = items.filter(item => item.id !== id);
  const command = event.comment?.body?.trim();
  const approvedByOwner = event.action === "created" && event.comment?.user?.login === "JHoward02";
  if (approvedByOwner && command === "/approve-catalog" && issue.state === "open") {
    return [...other, parseSubmission(issue)].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  }
  if ((approvedByOwner && command === "/remove-catalog") || event.action === "closed") return other;
  return items;
}

if (process.argv[1]?.endsWith("catalog-submission.mjs") && process.argv[2]) {
  const file = "public/community-catalog.json";
  const event = JSON.parse(readFileSync(process.argv[2], "utf8"));
  const items = JSON.parse(readFileSync(file, "utf8"));
  writeFileSync(file, `${JSON.stringify(applyCatalogEvent(items, event), null, 2)}\n`);
}
