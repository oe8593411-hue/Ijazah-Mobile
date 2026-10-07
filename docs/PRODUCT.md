# Ijazah Product Blueprint

Ijazah is a mobile-first Quran memorization, revision, recitation and Tajweed platform.

## Product principles
- Verified Quran corpus is authoritative; AI never generates Quran text.
- Recitation analysis is evidence-based: alignment and measurable phonetic/Tajweed signals first, explanation second.
- Mobile client never receives database credentials or AI provider secrets.
- Audio is private, short-lived and deleted after processing by default.
- Accuracy is benchmarked before making claims about superiority.

## Initial mobile experience
- Home dashboard with daily wird and progress.
- Quran reading.
- Recitation mode.
- Memorization and revision.
- Tajweed lessons.
- Progress and streaks.
- Teacher/student and Ijazah tracking.
- Arabic/English and dark/light themes.

## AI pipeline
1. Secure audio upload.
2. Voice activity detection and quality checks.
3. Quran-specific speech recognition/alignment.
4. Word/phoneme comparison against verified Quran text.
5. Deterministic Tajweed rule checks.
6. Confidence scoring and error localization.
7. Explanation layer for the learner.
8. Secure result storage and optional audio retention.

No LLM is allowed to invent Quran text or independently decide a Tajweed violation from raw audio.
