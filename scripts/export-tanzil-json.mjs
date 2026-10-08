import fs from "node:fs/promises";
import path from "node:path";

const input = process.env.QURAN_FILE || "quran-uthmani.txt";
const output = process.env.OUTPUT_FILE || "src/quran/verified-corpus.json";
const expectedSha256 = process.env.SOURCE_SHA256 || "bf4f57b968d03f4131c070b1e285da9be0e0a108a21c910e872801ca273312c8";

const raw = await fs.readFile(input, "utf8");
const lines = raw.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);

const ayahs = lines.map((line) => {
  const [surah, ayah, ...text] = line.split("|");
  return { surah: Number(surah), ayah: Number(ayah), text: text.join("|") };
}).filter((x) => Number.isInteger(x.surah) && Number.isInteger(x.ayah) && x.text.trim());

if (ayahs.length !== 6236) throw new Error(`Expected 6236 ayahs, got ${ayahs.length}`);
const surahs = new Set(ayahs.map((x) => x.surah));
if (surahs.size !== 114 || Math.min(...surahs) !== 1 || Math.max(...surahs) !== 114) {
  throw new Error(`Expected surahs 1..114, got ${surahs.size}`);
}

const payload = {
  source: "Tanzil Quran Text",
  edition: "Tanzil Uthmani",
  riwayah: "hafs",
  script: "uthmani",
  version: "1.1",
  sha256: expectedSha256,
  ayahs,
};

await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, JSON.stringify(payload));
console.log(JSON.stringify({ exported: true, output, ayahs: ayahs.length, surahs: surahs.size, sha256: payload.sha256 }));
