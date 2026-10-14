import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/quran/riwayah.ts", import.meta.url), "utf8");
const candidateManifest = JSON.parse(await readFile(new URL("../src/quran/riwayah-source-candidates.json", import.meta.url), "utf8"));

if (candidateManifest.status !== "source_candidates_only") errors.push("Source candidate manifest must remain disabled");
if (candidateManifest.upstreamCommit !== "b7c62daa3ac4c9ec37a398b35b8f246cee5bb217") errors.push("Upstream catalog commit must be pinned");
if (!Array.isArray(candidateManifest.riwayat) || candidateManifest.riwayat.length !== 7) errors.push("Expected seven upstream source candidates");
if (new Set((candidateManifest.riwayat || []).map((item) => item.key)).size !== 7) errors.push("Source candidate keys must be unique");
for (const item of candidateManifest.riwayat || []) {
  if (item.status !== "candidate_not_enabled") errors.push(`Source candidate ${item.key} must not be enabled`);
  if (!item.source || !item.upstreamFile || !Number.isInteger(item.expectedAyahCount)) errors.push(`Source metadata incomplete for ${item.key}`);
}
const expectedCounts = { hafs: 6236, shubah: 6236, warsh: 6214, qalun: 6214, duri: 6217, susi: 6218, bazzi: 6220 };
for (const [key, count] of Object.entries(expectedCounts)) {
  const item = (candidateManifest.riwayat || []).find((entry) => entry.key === key);
  if (!item || item.expectedAyahCount !== count) errors.push(`Unexpected ayah-count metadata for ${key}`);
}
const readers = [...source.matchAll(/\{ reader: "([^"]+)", riwayat: \[([^\]]+)\] \}/g)];
const riwayat = readers.flatMap((match) => [...match[2].matchAll(/"([^"]+)"/g)].map((item) => item[1]));
const errors = [];
if (readers.length !== 10) errors.push(`Expected 10 qiraat, found ${readers.length}`);
if (riwayat.length !== 20) errors.push(`Expected 20 riwayat, found ${riwayat.length}`);
if (new Set(riwayat).size !== 20) errors.push("Riwayah names must be unique");
if (!riwayat.includes("ابن جمّاز عن أبي جعفر")) errors.push("Abu Jafar second narrator must be Ibn Jammaz");
if (riwayat.includes("عبيد بن الصباح عن أبي جعفر")) errors.push("Unexpected/incorrect Abu Jafar narrator entry");
if (!source.includes('name === "حفص عن عاصم" ? "verified_hafs_only" as const : "not_verified" as const')) errors.push("Only Hafs may be marked available");
if (!source.includes('name === "حفص عن عاصم" ? "tanzil-uthmani-hafs-v1.1" : null')) errors.push("Corpus identity must be explicit and Hafs-only");
if (errors.length) {
  console.error("Riwayah registry validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log("Riwayah registry OK: 10 qiraat, 20 unique riwayat; only verified Hafs is enabled.");
