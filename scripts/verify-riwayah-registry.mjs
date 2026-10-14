import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/quran/riwayah.ts", import.meta.url), "utf8");
const readers = [...source.matchAll(/\{ reader: "([^"]+)", riwayat: \[([^\]]+)\] \}/g)];
const riwayat = readers.flatMap((match) => [...match[2].matchAll(/"([^"]+)"/g)].map((item) => item[1]));
const errors = [];
if (readers.length !== 10) errors.push(`Expected 10 qiraat, found ${readers.length}`);
if (riwayat.length !== 20) errors.push(`Expected 20 riwayat, found ${riwayat.length}`);
if (new Set(riwayat).size !== 20) errors.push("Riwayah names must be unique");
if (!riwayat.includes("ابن جمّاز عن أبي جعفر")) errors.push("Abu Jafar second narrator must be Ibn Jammaz");
if (riwayat.includes("عبيد بن الصباح عن أبي جعفر")) errors.push("Unexpected/incorrect Abu Jafar narrator entry");
if (!source.includes('name === "حفص عن عاصم" ? "verified_hafs_only" : "not_verified"')) errors.push("Only Hafs may be marked available");
if (!source.includes('name === "حفص عن عاصم" ? "tanzil-uthmani-hafs-v1.1" : null')) errors.push("Corpus identity must be explicit and Hafs-only");
if (errors.length) {
  console.error("Riwayah registry validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log("Riwayah registry OK: 10 qiraat, 20 unique riwayat; only verified Hafs is enabled.");
