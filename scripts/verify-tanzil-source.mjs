import fs from "node:fs/promises";
import crypto from "node:crypto";

const file = process.env.QURAN_FILE;
const expected = "bf4f57b968d03f4131c070b1e285da9be0e0a108a21c910e872801ca273312c8";
if (!file) throw new Error("Missing QURAN_FILE.");

const raw = await fs.readFile(file);
const actual = crypto.createHash("sha256").update(raw).digest("hex");
if (actual !== expected) throw new Error(`Checksum mismatch: expected ${expected}, got ${actual}`);

const lines = raw.toString("utf8").replace(/^\\uFEFF/, "").split(/\\r?\\n/).filter(Boolean);
const parsed = lines.map(line => {
  const [s, a, ...rest] = line.split("|");
  return { s: Number(s), a: Number(a), text: rest.join("|") };
}).filter(x => Number.isInteger(x.s) && Number.isInteger(x.a) && x.text.trim());

if (parsed.length !== 6236) throw new Error(`Expected 6236 ayahs, got ${parsed.length}`);
const surahs = new Set(parsed.map(x => x.s));
if (surahs.size !== 114) throw new Error(`Expected 114 surahs, got ${surahs.size}`);
if (Math.min(...surahs) !== 1 || Math.max(...surahs) !== 114) throw new Error("Surah range is invalid.");

console.log(JSON.stringify({ verified: true, sha256: actual, surahs: 114, ayahs: 6236 }));
