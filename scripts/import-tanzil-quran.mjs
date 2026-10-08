import fs from "node:fs/promises";
import crypto from "node:crypto";
import pg from "pg";

const file = process.env.QURAN_FILE;
const databaseUrl = process.env.DATABASE_URL;
const expectedSha256 = "7f30c647331a61100ebf24a80507dc0fcdd9f2df97f1312b5b2dfcb982a7f326";

if (!file || !databaseUrl) {
  throw new Error("Missing QURAN_FILE, DATABASE_URL, or TANZIL_SHA256.");
}

const raw = await fs.readFile(file);
const actualSha256 = crypto.createHash("sha256").update(raw).digest("hex");
if (actualSha256 !== expectedSha256.toLowerCase()) {
  throw new Error(`Tanzil checksum mismatch. Expected ${expectedSha256}, got ${actualSha256}.`);
}

const lines = raw.toString("utf8").replace(/^\\uFEFF/, "").split(/\\r?\\n/).filter(Boolean);
const rows = [];
for (const line of lines) {
  const parts = line.split("|");
  if (parts.length < 3) continue;
  const surah = Number(parts[0]);
  const ayah = Number(parts[1]);
  const text = parts.slice(2).join("|");
  if (!Number.isInteger(surah) || !Number.isInteger(ayah) || !text.trim()) continue;
  rows.push({ surah, ayah, text });
}

if (rows.length !== 6236) throw new Error(`Expected 6236 ayahs, got ${rows.length}.`);
const surahs = new Set(rows.map(r => r.surah));
if (surahs.size !== 114 || Math.min(...surahs) !== 1 || Math.max(...surahs) !== 114) {
  throw new Error("Expected exactly surahs 1 through 114.");
}

const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: true } });
await client.connect();
try {
  await client.query("BEGIN");
  const corpus = await client.query(
    `INSERT INTO public.quran_corpora
      (edition, riwayah, script, version, source_name, source_url, source_sha256, verification_status, verified_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',NULL)
     ON CONFLICT (edition, riwayah, script, version)
     DO UPDATE SET source_sha256=EXCLUDED.source_sha256, verification_status='pending', verified_at=NULL
     RETURNING id`,
    ["Tanzil Uthmani", "hafs", "uthmani", "1.1", "Tanzil Quran Text", "https://tanzil.net/docs/download", actualSha256]
  );
  const corpusId = corpus.rows[0].id;

  for (let surah = 1; surah <= 114; surah++) {
    await client.query(
      `INSERT INTO public.quran_surahs (corpus_id, number, name_ar, name_en)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT DO NOTHING`,
      [corpusId, surah, `سورة ${surah}`, `Surah ${surah}`, rows.filter(r => r.surah === surah).length]
    );
  }

  const surahIds = new Map();
  const sr = await client.query("SELECT id, number FROM public.quran_surahs WHERE corpus_id=$1 ORDER BY number", [corpusId]);
  for (const r of sr.rows) surahIds.set(Number(r.number), r.id);

  for (const r of rows) {
    await client.query(
      `INSERT INTO public.quran_ayahs
        (corpus_id, surah_id, surah_number, ayah_number, text_uthmani, text_sha256)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (corpus_id,surah_number,ayah_number)
       DO UPDATE SET text_uthmani=EXCLUDED.text_uthmani, text_sha256=EXCLUDED.text_sha256`,
      [corpusId, surahIds.get(r.surah), r.surah, r.ayah, r.text, crypto.createHash("sha256").update(r.text).digest("hex")]
    );
  }

  const counts = await client.query("SELECT COUNT(*)::int AS n, COUNT(DISTINCT surah_number)::int AS s FROM public.quran_ayahs WHERE corpus_id=$1", [corpusId]);
  if (counts.rows[0].n !== 6236 || counts.rows[0].s !== 114) throw new Error("Post-import validation failed.");

  await client.query(
    "UPDATE public.quran_corpora SET verification_status='verified', verified_at=now() WHERE id=$1",
    [corpusId]
  );
  await client.query("COMMIT");
  console.log(JSON.stringify({ ok: true, corpusId, sha256: actualSha256, ayahs: 6236, surahs: 114 }));
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}