# Ijazah AI Recitation Engine

## Goal
Build an evidence-first Quran recitation coach that aims to outperform existing memorization-focused apps on Tajweed feedback, while never claiming superiority until independent benchmark results support it.

## Core pipeline
1. Secure microphone capture and audio-quality/VAD checks.
2. Quran-specific speech recognition and forced alignment.
3. Word, character, vowel/diacritic and phoneme comparison against a verified Quran corpus.
4. Deterministic Tajweed rule engine for measurable acoustic/phonetic signals.
5. Confidence calibration and abstention: if evidence is weak, say "غير متأكد" instead of inventing an error.
6. Error localization at ayah -> word -> letter/phoneme where confidence permits.
7. Explanation layer that teaches the rule without generating or altering Quran text.
8. Personal error history and adaptive revision recommendations.

## Tajweed coverage target
Madd, Ghunnah, Qalqalah, Ikhfa, Idgham, Izhar, Iqlab, Tafkhim/Tarqiq, rules of Ra and Lam, stopping/starting rules, and selected articulation/pronunciation checks.

## Competitive advantage
- Word-level + diacritic + phonetic/Tajweed evidence instead of only word-level recognition.
- Real-time feedback where latency permits, with a post-session high-accuracy pass.
- Confidence score for every detected issue.
- Teacher review mode with evidence clips and correction history.
- Personalized mistake heatmap and revision plan.
- Riwayah-aware rules so the engine does not mark a valid reading as an error.
- Verified corpus is authoritative; AI never invents Quran text.

## Accuracy policy
No "perfect" or "better than Tarteel" marketing claim is allowed until benchmark evaluation demonstrates it. Evaluate word error rate, phoneme error rate, Tajweed false-positive/false-negative rates, robustness to noise and microphones, latency, and performance across reciters, ages, accents, and supported riwayat.

## Security
- AI provider secrets remain server-side.
- Audio is private and user-scoped.
- Short-lived signed upload/download URLs.
- Raw audio deleted after processing by default unless the user explicitly opts in.
- Rate limits and abuse detection.
- Audit events for sensitive operations.
