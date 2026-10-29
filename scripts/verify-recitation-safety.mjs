import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [recite, api, riwayah] = await Promise.all([
  read("../app/recite.tsx"),
  read("../api/analyze-recitation.ts"),
  read("../src/quran/riwayah.ts"),
]);
const errors = [];

if (!/\[\^(\\u0621-\\u064A|ء-ي)\\s\]/.test(recite) || !recite.includes('.replace(/\\s+/g, " ")')) {
  errors.push("Client Arabic normalization must preserve whitespace and collapse repeated spaces.");
}
// The client no longer calls the server analysis API; it must not present
// tajweed verdicts, and it must not show riwayat other than the verified Hafs.
if (/tajweed.*(finding|verdict|حكم)/i.test(recite.replace(/\/\/.*$/gm, ""))) {
  errors.push("Client must not render tajweed verdicts from the browser comparison.");
}
if (!recite.includes("حفص عن عاصم") || recite.includes("analyze-recitation")) {
  errors.push("Client must stay Hafs-only and must not call the server analysis endpoint until it is enabled and authenticated.");
}
if (!api.includes('process.env.IJAZAH_ANALYSIS_ENABLED !== "true"')) {
  errors.push("Server analysis must stay disabled unless explicitly enabled.");
}
if (!api.includes('scope === "surah"') || !api.includes("expectedWordLocations") || !api.includes("full_surah_speech_to_text_alignment")) {
  errors.push("Full-surah analysis must align against the selected surah and map differences to ayah locations.");
}
if (!api.includes('requestedRiwaya !== "hafs"')) {
  errors.push("Server analysis must reject unverified riwayat.");
}
if (!api.includes("total > 20 * 1024 * 1024")) {
  errors.push("Audio upload size limit must remain enforced.");
}
if (!api.includes("matchRate >= 80")) {
  errors.push("Tajweed analysis must remain behind the preliminary text-confidence gate.");
}
if (!riwayah.includes('name === "حفص عن عاصم" ? "verified_hafs_only" as const : "not_verified" as const')) {
  errors.push("Only the verified Hafs reference may be enabled.");
}

if (errors.length) {
  console.error("Recitation safety checks failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log("Recitation safety checks passed: mode separation, Arabic normalization, Hafs-only guard, disabled-by-default API, upload limit, and confidence gate.");
