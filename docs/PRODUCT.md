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

## Advanced Recitation Intelligence
Ijazah is designed to compete on measurable recitation quality, not marketing claims.

### Multi-layer analysis
- Layer A — Quran alignment: identify the exact surah, ayah, word and reading position.
- Layer B — lexical accuracy: detect substitutions, omissions, additions and repetitions.
- Layer C — harakah/phoneme analysis: detect likely vowel and articulation mismatches only when acoustic evidence supports the result.
- Layer D — Tajweed engine: evaluate measurable signals for madd, ghunnah, qalqalah, ikhfa, idgham, iqlab, izhar, tafkhim and tarqiq, with riwayah-aware rules.
- Layer E — confidence gate: suppress uncertain findings instead of inventing an error.
- Layer F — explanation: convert verified findings into a short, learner-friendly correction.
- Layer G — progress intelligence: track recurring error patterns and generate targeted revision exercises.

### Real-time and post-session modes
- Live mode gives low-latency guidance when confidence is sufficient.
- Deep mode performs a more complete post-recording analysis.
- The UI distinguishes confirmed findings from low-confidence observations.
- The app never presents an AI guess as a Quran or Tajweed fact.

### Personalized learning
- Build an error profile per learner.
- Rank recurring errors by frequency, severity and confidence.
- Create focused drills from verified Quran passages.
- Detect improvement over time using consistent evaluation metrics.
- Teacher review can override or annotate a result; learner-facing explanations remain linked to the underlying evidence.

### Accuracy benchmark
Before claiming that Ijazah is better than another product, evaluate the same benchmark set across:
- word error rate;
- phoneme error rate;
- Tajweed precision and recall;
- false-positive rate;
- false-negative rate;
- error localization accuracy;
- latency;
- performance across microphones, noise levels, reciters and supported riwayat.

### Safety and trust
- Quran text always comes from a verified corpus, never from an LLM.
- Tajweed decisions come from measurable speech/alignment evidence plus a deterministic ruleset.
- LLMs may explain a verified result but may not create Quran text or independently declare a Tajweed violation from raw audio.
- Raw user audio is deleted after processing by default unless the user explicitly enables retention.
- Secrets remain server-side and all user data is scoped to the authenticated account.

No LLM is allowed to invent Quran text or independently decide a Tajweed violation from raw audio.
