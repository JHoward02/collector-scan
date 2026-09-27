# Shelfie community catalog

Shelfie is a static GitHub Pages site. Users can save private manual entries locally, or click **Submit to Shelfie catalog on GitHub** from the manual-entry form. The latter opens a prefilled GitHub issue; the contributor must sign in and submit it there. Title, type, line/game, year, maker, and identifier are public. Private notes and local images are not transferred. A contributor can attach a photo on the GitHub issue if they choose.

## Review and publish

1. Open a catalog submission issue and verify the item is an actual collectible. Check spelling, category, year, maker, identifier, photo rights and duplicates.
2. As repository owner `JHoward02`, comment exactly `/approve-catalog` on the issue. The `catalog.yml` workflow snapshots the reviewed fields into `public/community-catalog.json`, commits the file, builds the site, and deploys it to GitHub Pages. The new item then appears in catalog search for its category.
3. If the submission needs correction, ask the contributor to edit it before approving. Edits after approval do not automatically change the published snapshot; comment `/approve-catalog` again after reviewing the changes.
4. Comment `/remove-catalog`, or close the issue, to remove its record and redeploy. Keep approved issues open while published.

The workflow only accepts these commands from the repository owner. Public issue text is parsed as data and never executed. The committed JSON is the catalog snapshot; issue comments and unreviewed submissions do not appear in search.
