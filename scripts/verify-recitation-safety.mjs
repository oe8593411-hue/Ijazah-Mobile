import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [recite, api, riwayah, corpusRaw, surahsSource] = await Promise.all([
  read("../app/recite.tsx"),
  read("../api/analyze-recitation.ts"),
  read("../src/quran/riwayah.ts"),
  read("../src/quran/verified-corpus.json"),
  read("../src/quran/surahs.ts"),
]);
const errors = [];
const expectedCorpus = JSON.parse(corpusRaw);
const surahs = [...surahsSource.matchAll(/number:\s*(\d+),\s*nameAr:\s*"[^"]+",\s*ayahCount:\s*(\d+)/g)]
  .map(match => ({ number: Number(match[1]), ayahCount: Number(match[2]) }));
if (expectedCorpus.source !== "Tanzil Quran Text"
  || expectedCorpus.edition !== "Tanzil Uthmani"
  || expectedCorpus.riwayah !== "hafs"
  || expectedCorpus.script !== "uthmani"
  || expectedCorpus.version !== "1.1"
  || expectedCorpus.sha256 !== "bf4f57b968d03f4131c070b1e285da9be0e0a108a21c910e872801ca273312c8"
  || expectedCorpus.ayahs?.length !== 6236) {
  errors.push("The packaged Quran corpus must match the pinned Tanzil Uthmani 1.1 / Hafs source identity and 6,236-ayah count.");
}
const corpusCounts = new Map();
for (const item of expectedCorpus.ayahs || []) {
  corpusCounts.set(item.surah, (corpusCounts.get(item.surah) || 0) + 1);
}
if (surahs.length !== 114 || surahs.some((item, index) =>
  item.number !== index + 1 || item.ayahCount !== corpusCounts.get(item.number))
  || surahs.reduce((total, item) => total + item.ayahCount, 0) !== 6236) {
  errors.push("Surah metadata must match the exact ayah counts in the verified Quran corpus.");
}

if (!recite.includes('replace(/[^\\u0621-\\u064A\\s]/g," ").replace(/\\s+/g," ")')) {
  errors.push("Client Arabic normalization must preserve whitespace and collapse repeated spaces.");
}
const analyze = recite.slice(recite.indexOf("async function analyzeRecording"), recite.indexOf("async function toggleRecording"));
const toggle = recite.slice(recite.indexOf("async function toggleRecording"), recite.indexOf(" return <View style={s.root}>"));
if (!toggle.includes("void analyzeRecording(audioUri ?? undefined)")
  || !analyze.includes('const analysisScope=fullSurahMode?"surah":continuousMode?"range":"ayah";')
  || !analyze.includes('if(!fullSurahMode && heardText.trim()')) {
  errors.push("Recording must route to the matching analysis scope, and browser-only fallback must not create full-surah findings.");
}
if (!analyze.includes('analysisLevel:"browser_speech_to_text_alignment"')
  || !analyze.includes('acousticTajweed:{status:"not_configured"')) {
  errors.push("Browser speech recognition must stay clearly distinct from acoustic tajweed analysis.");
}
if (!api.includes('process.env.IJAZAH_ANALYSIS_ENABLED !== "true"')) {
  errors.push("Server analysis must stay disabled unless explicitly enabled.");
}
if (!api.includes('scope === "surah"') || !api.includes("expectedWordLocations") || !api.includes("full_surah_speech_to_text_alignment")) {
  errors.push("Full-surah analysis must align against the selected surah and map differences to ayah locations.");
}
if (!recite.includes('&scope="+analysisScope+"&ayah=') || !recite.includes('typeof item.ayah==="number"')) {
  errors.push("Client must request the selected analysis scope and display ayah locations for differences.");
}
if (!api.includes('requestedRiwaya !== "hafs"')) {
  errors.push("Server analysis must reject unverified riwayat.");
}
if (!api.includes("total > 20 * 1024 * 1024")) {
  errors.push("Audio upload size limit must remain enforced.");
}
if (!api.includes('contentGate === "passed_consensus_no_mismatch"')
  || !api.includes('contentGate === "passed_consensus_with_mismatches"')
  || !api.includes('scope !== "ayah"')) {
  errors.push("Acoustic tajweed findings must require cross-engine consensus and remain disabled for multi-ayah analysis.");
}
if (!riwayah.includes('name === "حفص عن عاصم" ? "verified_hafs_only" as const : "not_verified" as const')) {
  errors.push("Only the verified Hafs reference may be enabled.");
}

if (errors.length) {
  console.error("Recitation safety checks failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log("Recitation safety checks passed: verified corpus identity/counts, surah metadata, scoped analysis, browser/acoustic separation, Arabic normalization, Hafs-only guard, disabled-by-default API, upload limit, cross-engine consensus, and multi-ayah tajweed guard.");
