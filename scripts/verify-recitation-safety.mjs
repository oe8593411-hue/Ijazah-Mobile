import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [recite, api, riwayah] = await Promise.all([
  read("../app/recite.tsx"),
  read("../api/analyze-recitation.ts"),
  read("../src/quran/riwayah.ts"),
]);
const errors = [];

if (!recite.includes('replace(/[^\\u0621-\\u064A\\s]/g," ").replace(/\\s+/g," ")')) {
  errors.push("Client Arabic normalization must preserve whitespace and collapse repeated spaces.");
}
const toggle = recite.slice(recite.indexOf("async function toggleRecording"), recite.indexOf(" return <View style={s.root}>"));
if (!toggle.includes('if(fullSurahMode && mode!=="deep")') || !toggle.includes('else if(mode==="deep")')) {
  errors.push("Recording stop must keep full-surah analysis gated and run server analysis only in deep mode.");
}
if (!toggle.includes("void analyzeRecording(audioUri ?? undefined)") || !toggle.includes("الوضع المباشر يعرض تعرّف المتصفح")) {
  errors.push("Live mode must remain clearly distinct from server-side deep analysis.");
}
if (!api.includes('process.env.IJAZAH_ANALYSIS_ENABLED !== "true"')) {
  errors.push("Server analysis must stay disabled unless explicitly enabled.");
}
if (!api.includes('scope === "surah"') || !api.includes("expectedWordLocations") || !api.includes("full_surah_speech_to_text_alignment")) {
  errors.push("Full-surah analysis must align against the selected surah and map differences to ayah locations.");
}
if (!recite.includes('&scope="+(fullSurahMode?"surah":"ayah")') || !recite.includes('typeof item.ayah==="number"')) {
  errors.push("Client must request full-surah alignment and display ayah locations for differences.");
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
