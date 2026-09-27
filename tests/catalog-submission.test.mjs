import { test } from "node:test";
import { strict as assert } from "node:assert";
import { parseSubmission, applyCatalogEvent } from "../scripts/catalog-submission.mjs";

const issue = {
  number: 42,
  html_url: "https://github.com/JHoward02/collector-scan/issues/42",
  state: "open",
  body: `<!-- shelfie-catalog-submission:v1 -->

### Name

Batman McFarlane figure

### Category

figure

### Line / game

mcfarlane

### Year

2024

### Maker

McFarlane Toys

### Identifier

12345

### Photo

![figure](https://github.com/user-attachments/assets/example)
`,
};

test("an owner approval snapshots reviewed submission details", () => {
  const entry = parseSubmission(issue);
  assert.deepEqual(entry, {
    id: "issue-42", title: "Batman McFarlane figure", category: "figure", year: 2024,
    line: "mcfarlane", maker: "McFarlane Toys", identifier: "12345",
    imageUrl: "https://github.com/user-attachments/assets/example", sourceUrl: issue.html_url,
  });
  const owner = { action: "created", comment: { body: "/approve-catalog", user: { login: "JHoward02" } }, issue };
  assert.deepEqual(applyCatalogEvent([], owner), [entry]);
  assert.deepEqual(applyCatalogEvent([entry], { ...owner, comment: { ...owner.comment, body: "/remove-catalog" } }), []);
  assert.deepEqual(applyCatalogEvent([entry], { action: "closed", issue }), []);
});

test("invalid and unapproved submissions cannot enter the catalog", () => {
  assert.throws(() => parseSubmission({ ...issue, body: issue.body.replace("### Category\n\nfigure", "### Category\n\nunlisted") }), /valid category/);
  assert.throws(() => parseSubmission({ ...issue, body: "arbitrary issue text" }), /Not a Shelfie/);
  assert.deepEqual(applyCatalogEvent([], { action: "created", comment: { body: "/approve-catalog", user: { login: "stranger" } }, issue }), []);
});
