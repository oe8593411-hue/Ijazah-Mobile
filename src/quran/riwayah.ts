/** Canonical inventory of the ten qiraat and their two riwayat.
 * Only Hafs currently has a verified in-app text corpus and preliminary analysis.
 * Do not mark another riwayah verified before source, checksum, independent comparison,
 * licensing and qualified Qur’an-specialist review are complete.
 */
export const QIRAAT = [
  { reader: "نافع المدني", riwayat: ["قالون عن نافع", "ورش عن نافع"] },
  { reader: "ابن كثير المكي", riwayat: ["البزي عن ابن كثير", "قنبل عن ابن كثير"] },
  { reader: "أبو عمرو البصري", riwayat: ["الدوري عن أبي عمرو", "السوسي عن أبي عمرو"] },
  { reader: "ابن عامر الشامي", riwayat: ["هشام عن ابن عامر", "ابن ذكوان عن ابن عامر"] },
  { reader: "عاصم الكوفي", riwayat: ["شعبة عن عاصم", "حفص عن عاصم"] },
  { reader: "حمزة الكوفي", riwayat: ["خلف عن حمزة", "خلاد عن حمزة"] },
  { reader: "الكسائي الكوفي", riwayat: ["أبو الحارث عن الكسائي", "الدوري عن الكسائي"] },
  { reader: "أبو جعفر المدني", riwayat: ["ابن وردان عن أبي جعفر", "ابن جمّاز عن أبي جعفر"] },
  { reader: "يعقوب الحضرمي", riwayat: ["رويس عن يعقوب", "روح عن يعقوب"] },
  { reader: "خلف العاشر", riwayat: ["إسحاق عن خلف العاشر", "إدريس عن خلف العاشر"] },
] as const;

export type RiwayahName = typeof QIRAAT[number]["riwayat"][number];

export const RIWAYAT = QIRAAT.flatMap((entry) =>
  entry.riwayat.map((name) => ({
    name,
    reader: entry.reader,
    status: name === "حفص عن عاصم" ? "verified_hafs_only" as const : "not_verified" as const,
    corpusId: name === "حفص عن عاصم" ? "tanzil-uthmani-hafs-v1.1" : null,
  }))
);

let selectedRiwayah: string = "حفص عن عاصم";

export function getSelectedRiwayah(): string { return selectedRiwayah; }

export function setSelectedRiwayah(value: string): void {
  if (RIWAYAT.some((item) => item.name === value)) selectedRiwayah = value;
}

export function isRiwayahCorpusAvailable(value: string): boolean {
  return RIWAYAT.some((item) => item.name === value && item.status === "verified_hafs_only");
}
