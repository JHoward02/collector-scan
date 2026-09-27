import { asRecord, asString, fetchJson } from "./types.ts";

export interface FandomImageLicense {
  reusable: boolean;
  imageUrl: string | null;
  descriptionUrl: string | null;
  license: string | null;
  licenseUrl: string | null;
  attribution: string | null;
  reason: string;
}

const FREE_LICENSE = /(cc[ -]?(by|by-sa|by-nd|by-nc|by-nc-sa|by-nc-nd)|creative commons|public domain|cc0)/i;
const NONFREE = /(fair use|non[- ]?free|copyrighted|all rights reserved)/i;

function metaValue(meta: Record<string, unknown> | null, key: string): string | null {
  const field = asRecord(meta?.[key]);
  return asString(field?.value);
}

/**
 * Checks the file page's machine-readable MediaWiki metadata before Shelfie
 * displays a Fandom-hosted image. Unknown, fair-use, and non-free files fail
 * closed. This is intentionally stricter than merely checking that an image
 * URL exists.
 */
export async function checkFandomImageLicense(
  wikiApi: string,
  fileTitle: string,
  signal: AbortSignal,
): Promise<FandomImageLicense> {
  const url = new URL(wikiApi);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("titles", fileTitle.startsWith("File:") ? fileTitle : `File:${fileTitle}`);
  url.searchParams.set("iiprop", "url|extmetadata");
  url.searchParams.set("iiextmetadatafilter", "LicenseShortName|LicenseUrl|UsageTerms|Copyrighted|Attribution|AttributionRequired|NonFree|Artist|Credit|Restrictions");

  const payload = asRecord(await fetchJson(url.href, signal));
  const query = asRecord(payload?.query);
  const pages = asRecord(query?.pages);
  const page = pages ? Object.values(pages).map(asRecord).find(Boolean) ?? null : null;
  const info = page && Array.isArray(page.imageinfo) ? asRecord(page.imageinfo[0]) : null;
  const meta = asRecord(info?.extmetadata);
  const license = metaValue(meta, "LicenseShortName") ?? metaValue(meta, "UsageTerms");
  const licenseUrl = metaValue(meta, "LicenseUrl");
  const nonFree = metaValue(meta, "NonFree");
  const copyrighted = metaValue(meta, "Copyrighted");
  const attribution = metaValue(meta, "Attribution") ?? metaValue(meta, "Credit") ?? metaValue(meta, "Artist");
  const imageUrl = asString(info?.url);
  const descriptionUrl = asString(info?.descriptionurl);

  if (!info || !imageUrl) return { reusable:false,imageUrl:null,descriptionUrl,license,licenseUrl,attribution,reason:"No verifiable file metadata was returned." };
  if (/true|1/i.test(nonFree ?? "")) return { reusable:false,imageUrl:null,descriptionUrl,license,licenseUrl,attribution,reason:"The file is marked non-free." };
  if (NONFREE.test(license ?? "")) return { reusable:false,imageUrl:null,descriptionUrl,license,licenseUrl,attribution,reason:"The file is marked fair-use, copyrighted, or otherwise non-free." };
  const publicDomain = /false|0/i.test(copyrighted ?? "") || /public domain|cc0/i.test(license ?? "");
  const licensed = FREE_LICENSE.test(license ?? "") && !/by-nc/i.test(license ?? "");
  if (!publicDomain && !licensed) return { reusable:false,imageUrl:null,descriptionUrl,license,licenseUrl,attribution,reason:"Shelfie could not verify a reusable commercial license, so the image was omitted." };

  return { reusable:true,imageUrl,descriptionUrl,license,licenseUrl,attribution,reason:"Reusable license verified from the file's MediaWiki metadata." };
}
