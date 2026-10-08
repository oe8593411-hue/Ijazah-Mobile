import fs from "node:fs/promises";

const input = process.env.QURAN_FILE || "quran-uthmani.txt";
const output = process.env.OUTPUT_FILE || "src/quran/verified-corpus.json";

const raw = await fs.readFile(input, "utf8");
const lines = raw.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);

const ayahs = lines.map((line) => {
  const [surah, ayah, ...text] = line.split("|");
  return {
    surah: Number(surah),
    ayah: Number(ayah),
    text: text.join("|"),
  };
});

if (ayahs.length !== 6236) throw new Error(`Expected 6236 ayahs, got ${ayahs.length}`);
if (new Set(ayahs.map((x) => x.surah)).size !== 114) throw new Error("Expected 114 surahs");

const payload = {
  source: "Tanzil Quran Text",
  edition: "Tanzil Uthmani",
  riwayah: "hafs",
  script: "uthmani",
  version: "1.1",
  sha256: process.env.SOURCE_SHA256 || "bf4f57b968d03f4131c070b1e285da9be0e0a108a21c910e872801ca273312c8",
  ayahs,
};

await fs.mkdir(new URL(".", `file://${process.cwd()}/${output}`), { recursive: true }).catch(() => {});
await fs.writeFile(output, JSON.stringify(payload));
console.log(JSON.stringify({ exported: true, output, ayahs: ayahs.length, surahs: 114, sha256: payload.sha256 }));
