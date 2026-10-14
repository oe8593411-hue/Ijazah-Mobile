/** Shared riwayah selection for the current app session.
 * Non-Hafs selections are choices only until a verified corpus and tested
 * analysis pipeline for that riwayah are integrated.
 */
export const RIWAYAT = [
  "حفص عن عاصم",
  "شعبة عن عاصم",
  "ورش عن نافع",
  "قالون عن نافع",
  "البزي عن ابن كثير",
  "قنبل عن ابن كثير",
  "الدوري عن أبي عمرو",
  "السوسي عن أبي عمرو",
  "هشام عن ابن عامر",
  "ابن ذكوان عن ابن عامر",
  "خلف عن حمزة",
  "خلاد عن حمزة",
  "أبو الحارث عن الكسائي",
  "الدوري عن الكسائي",
  "رويس عن يعقوب",
  "روح عن يعقوب",
  "إسحاق عن خلف العاشر",
  "إدريس عن خلف العاشر",
  "عبيد بن الصباح عن أبي جعفر",
  "ابن وردان عن أبي جعفر",
] as const;

let selectedRiwayah: string = "حفص عن عاصم";

export function getSelectedRiwayah(): string {
  return selectedRiwayah;
}

export function setSelectedRiwayah(value: string): void {
  if (RIWAYAT.some((riwayah) => riwayah === value)) {
    selectedRiwayah = value;
  }
}

export function isRiwayahCorpusAvailable(value: string): boolean {
  return value === "حفص عن عاصم";
}
