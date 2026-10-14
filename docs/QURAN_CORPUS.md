# Ijazah Verified Quran Corpus

## Source of truth

The initial Quran edition for Ijazah is Hafs 'an Asim, Uthmani script, sourced from the Tanzil Quran Text, Uthmani Version 1.1.

Tanzil states that its Uthmani text is carefully derived from the Medina Mushaf and was subjected to automatic, rule-based and manual verification against the Medina Mushaf. Tanzil also provides terms for use in applications under CC BY 3.0, requiring verbatim reproduction and clear attribution.

Source: https://tanzil.net/
Text information: https://tanzil.net/docs/tanzil_project

## Non-negotiable integrity rules

1. The application never asks an LLM to generate Quran text.
2. The production Quran corpus is immutable after release.
3. Any source update creates a new corpus version; it never silently replaces an existing version.
4. Every surah and ayah stores a SHA-256 checksum.
5. A build must fail if an expected checksum changes unexpectedly.
6. The imported source file is preserved verbatim with its required attribution notice.
7. Display text, search text and speech-alignment text are separate representations linked to the same canonical ayah.
8. Tajweed annotations are metadata linked to the canonical text; they cannot modify the Quran text.
9. The selected riwayah is part of the corpus identity. Hafs and future riwayat must never share a mutable text record.
10. Every production analysis records the exact corpus version used.

## Verification pipeline

Before a Quran corpus version can become production:

1. Pin the exact upstream source version.
2. Preserve the original source file byte-for-byte.
3. Parse the 114 surahs and 6,236 ayahs expected for the standard Hafs/Kufan numbering.
4. Validate surah and ayah numbering.
5. Validate that no ayah is empty or duplicated.
6. Compute SHA-256 for the source file.
7. Compute SHA-256 for every ayah.
8. Run Unicode normalization checks without changing the canonical stored text.
9. Run character and diacritic sanity checks.
10. Compare against an independent verification source.
11. Require zero unexplained differences.
12. Store the resulting corpus manifest.
13. Only then allow the version to be marked VERIFIED and used by the application.

## Database identity

Every Quran record must be scoped by:

- corpus_id
- edition
- riwayah
- script
- version
- source_name
- source_url
- source_sha256
- verified_at
- verification_status

Each ayah additionally stores:

- surah_number
- ayah_number
- text_uthmani
- text_sha256

## AI boundary

The Quran corpus is authoritative.

The speech system may:
- align audio to an ayah;
- compare observed speech against the canonical reference;
- report evidence-backed pronunciation findings.

The speech system may not:
- rewrite the canonical Quran text;
- generate a replacement ayah;
- use an LLM-generated verse as a reference;
- silently normalize the stored canonical text.

If there is a mismatch between sources, the analysis must stop and flag the corpus for review rather than guessing.

## Release gate

A Quran corpus release is accepted only when:

- source provenance is recorded;
- licensing notice is present;
- file and ayah checksums pass;
- independent comparison passes;
- automated integrity tests pass;
- human Quran-specialist review signs off;
- the release is immutable and versioned.

## Current planned release

Edition: Hafs 'an Asim
Script: Uthmani
Source: Tanzil Quran Text, Uthmani Version 1.1
Status: source selected; production import must be verified before release.

## Important

The text shown in the application must never be copied from an AI response, chat message, translation, search result, or arbitrary website.

For production, the source file and its license notice must be obtained directly from the cited source and verified before insertion into the database.


## Ten qiraat implementation status (safety gate)

The selector inventory is not evidence that a riwayah corpus is available. At present, only Hafs an Asim is backed by the existing Tanzil Uthmani 1.1 corpus. All other entries remain unavailable for Quran display and recitation analysis until separately verified.

Before adding any riwayah corpus:
- identify a qualified, traceable source specifically for that riwayah and edition;
- confirm its license permits the intended app distribution;
- preserve the source verbatim and its attribution;
- record source, version, riwayah, script, numbering and SHA-256 checksums;
- verify all surahs and ayahs against an independent authoritative reference;
- document orthographic and ayah-numbering differences rather than normalizing them away;
- require review by a qualified Qur’an specialist;
- add regression tests proving the analyzer cannot compare a riwayah against another riwayah’s text.

The analysis API fails closed unless the request explicitly identifies Hafs. It must never infer or silently substitute Hafs when another riwayah is selected.
