# Ten Qiraat: source audit and release gates

Audit date: 2026-10-14

## Non-negotiable rule

No new riwayah is enabled by a selector label, an audio recording, an AI transcription, or a third-party mirror alone. Each corpus must be pinned to a named edition, source, license, checksum, verse numbering scheme, and independent review. Until then it remains unavailable for Quran display and recitation scoring.

## Source leads identified (not yet imported or approved)

### King Fahd Glorious Quran Printing Complex (official)

- Developer platform: https://qurancomplex.gov.sa/en/techquran/dev/
- The official platform describes downloadable Unicode Quran text for Hafs, Warsh, and Qalun, including data formats for application developers and source-specific reliability hashes.
- Status for Ijazah: candidate source for Warsh and Qalun only after downloading the exact files, reading the accompanying license/usage terms, preserving attribution, validating hashes, checking numbering, and independent specialist review.
- Important: the existence of a downloadable text does not by itself authorize redistribution or establish that the app's parser preserves every orthographic mark.

### Quran.ws Quran Text

- Website: https://text.quran.ws/
- Riwayah documentation: https://quran.ws/docs/concepts/riwayat/
- The site describes machine-readable editions for seven riwayat and fixed file URLs. This is a useful technical lead, not automatic approval as a canonical source.
- Status for Ijazah: candidate for source comparison only. Before use, verify upstream provenance for each edition, licensing/redistribution terms, exact file hashes, completeness, numbering conventions, and all differences against an independent authoritative Mushaf. Do not use it as the sole verification source.

## Coverage gap

The identified official source lead covers Hafs, Warsh, and Qalun. The Quran.ws lead reports seven riwayat. These leads do not establish verified source coverage for all 20 riwayat in the ten-qiraat inventory. The remaining narrations require separate source discovery and documented review; do not fill gaps by copying Hafs text or generating text.

## Verification record required for each corpus

1. Exact reader and narrator, including transmission path where relevant.
2. Edition, script, verse numbering convention, source URL, source version, and retrieval date.
3. License review for mobile distribution, storage, modification constraints, and attribution.
4. Preserved original file and SHA-256; checksums per ayah and a manifest.
5. Structural validation: surahs, ayahs, duplicates, empty records, and ordering.
6. Independent comparison against a second trusted source; every discrepancy explained.
7. Qualified Quran-specialist sign-off for orthography, diacritics, and known riwayah differences.
8. Regression tests that ensure text display and audio analysis are bound to the same corpus ID.
9. Only after all gates pass may status change from not_verified to verified.

## Current runtime behavior

- Hafs is the only in-app verified text corpus.
- Non-Hafs choices must not be used for text display or analysis.
- The analysis API rejects requests without explicit `riwaya=hafs`.
- Automated checks verify that the registry contains ten readers and 20 unique narrator entries, and that only Hafs is marked available.

## References

- King Fahd Complex official developer platform: https://qurancomplex.gov.sa/en/techquran/dev/
- Quran.ws Quran Text: https://text.quran.ws/
- Quran.ws riwayah notes: https://quran.ws/docs/concepts/riwayat/
- Tanzil usage terms for the existing Hafs corpus: https://tanzil.net/download/

## Pinned upstream metadata inspected

The repository `quran-ws/quran-text` was inspected at commit `b7c62daa3ac4c9ec37a398b35b8f246cee5bb217`; its `data/catalog.json` blob is pinned as `b950f08266f3a99dfafc816bd9b1951b9c468df5`. The catalog generated date is 2026-09-08. The app now records metadata for seven source candidates in `src/quran/riwayah-source-candidates.json`.

| Candidate | Upstream ayah count | Counting system |
|---|---:|---|
| Hafs | 6,236 | Kufi |
| Shu’bah | 6,236 | Kufi |
| Warsh | 6,214 | Last Madani |
| Qalun | 6,214 | Last Madani |
| Duri (Abu Amr) | 6,217 | First Madani |
| Susi | 6,218 | First Madani |
| Bazzi | 6,220 | Makki |

These are metadata reported by the upstream catalog, not counts independently verified by Ijazah. All seven remain `candidate_not_enabled`. This manifest does not ship or display their Quran text. The next corpus-ingestion step must fetch the pinned exact bytes, check the upstream-published SHA-256 and the applicable KFGQPC terms, validate the full data structure and ayah boundaries, compare against an independent authoritative source, and obtain qualified review before any status changes.
