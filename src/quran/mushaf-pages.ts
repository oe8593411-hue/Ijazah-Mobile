import PAGE_STARTS from "./mushaf-page-map.json";

export type MushafPageStart = { page: number; sura: number; aya: number };

const starts = PAGE_STARTS as MushafPageStart[];

export const MADINAH_MUSHAF_PAGE_COUNT = 604;
export const MADINAH_MUSHAF_EDITION = "Madinah 15-line Mushaf · Hafs ‘an ‘Asim · Uthmani script";

if (starts.length !== MADINAH_MUSHAF_PAGE_COUNT) {
  throw new Error("Invalid Madinah Mushaf page map: expected 604 page starts.");
}

/** Returns the first ayah reference recorded for a Madinah Mushaf page. */
export function getMushafPageStart(page: number): MushafPageStart | null {
  if (!Number.isInteger(page) || page < 1 || page > MADINAH_MUSHAF_PAGE_COUNT) return null;
  return starts[page - 1] ?? null;
}

/** Finds the page containing the beginning of the requested ayah. */
export function getMushafPageForAyah(sura: number, aya: number): number | null {
  if (!Number.isInteger(sura) || !Number.isInteger(aya) || sura < 1 || sura > 114 || aya < 1) return null;

  let low = 0;
  let high = starts.length - 1;
  let answer = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const item = starts[mid];
    const isAtOrBefore = item.sura < sura || (item.sura === sura && item.aya <= aya);

    if (isAtOrBefore) {
      answer = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return answer < 0 ? null : starts[answer].page;
}

/**
 * Attribution: page-boundary metadata adapted from Mushaf-Learning/quran-text
 * (metadata/pages.json), MIT License. The map identifies page-start ayahs only;
 * it is not a line/word layout and must not be used as a substitute for the
 * verified Quran text or for exact per-page glyph rendering.
 */
