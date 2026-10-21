# Ijazah Recitation Intelligence Engine

## Goal
Build a trustworthy Quran recitation analyzer that can identify reading errors and supported Tajweed deviations while refusing to guess when evidence is weak.

## Processing contract
1. Client requests an authenticated analysis session.
2. Server issues a short-lived upload authorization scoped to that user/session.
3. Audio is uploaded privately.
4. Audio quality and voice-activity checks run before recognition.
5. Quran-aware alignment identifies the expected passage and reading position.
6. Lexical comparison detects additions, omissions, substitutions and repetitions.
7. Phoneme/harakah analysis runs only where the model has adequate acoustic evidence.
8. Tajweed rules are evaluated from measurable features and the selected riwayah.
9. Confidence gating suppresses uncertain findings.
10. Results are stored under the authenticated user and session.
11. Raw audio is deleted by default after processing.
12. A separate explanation layer converts verified findings into concise learner guidance.

## Error object
Every finding should carry:
- finding ID;
- session ID;
- surah number;
- ayah number;
- word index;
- optional phoneme/letter position;
- category;
- expected reference;
- observed evidence;
- confidence;
- severity;
- rule ID when applicable;
- explanation;
- timestamp/range in audio when available.

## Confidence policy
- High confidence: may be shown as a confirmed finding.
- Medium confidence: show as a suggestion and request a retry when appropriate.
- Low confidence: do not present as an error.

## Tajweed rule families
Support a versioned, riwayah-aware ruleset for:
- madd;
- ghunnah;
- ikhfa;
- idgham;
- iqlab;
- izhar;
- qalqalah;
- tafkhim;
- tarqiq;
- and additional rules after validated acoustic features are available.

## Real-time mode
The live path is optimized for latency and only surfaces findings that meet strict confidence thresholds. It must never trade safety for speed.

## Deep analysis mode
The post-session path may use more compute and broader acoustic context to improve alignment and Tajweed analysis.

## Current implementation boundary (important)
The application currently contains a Quran-context rule planner and a guarded adapter for a separately hosted acoustic model. The planner marks possible rule locations from the verified Hafs text; it does not hear audio and must not be described as detecting a mistake. Acoustic findings are accepted only when the provider returns a rule ID present in the contextual candidates, confidence >= 0.80, explicit evidence, and valid optional time offsets. Accepted findings remain preliminary until benchmarked and reviewed by qualified teachers.

### Acoustic provider contract
Configure only on the server:
- `IJAZAH_TAJWEED_ENGINE_URL`: private HTTPS endpoint for the specialist model.
- `IJAZAH_TAJWEED_ENGINE_TOKEN`: bearer token stored as a server secret.
- `IJAZAH_ANALYSIS_ENABLED=true` and `OPENAI_API_KEY` are separate requirements for the current transcription route; do not enable public paid analysis until authentication and per-user rate limits are implemented.

The provider receives multipart fields `file`, `surah`, `ayah`, `riwaya=hafs`, `referenceText`, `expectedRuleChecks`, and `responseContract`. It must return JSON with `rulesEvaluated: string[]`, `findings: {ruleId, confidence, evidence, startMs?, endMs?}[]`, and optional `message` / `confidence`. Findings that do not meet the server-side allowlist and confidence checks are discarded. A provider URL/token alone is not evidence that the model is accurate; run a labeled benchmark before enabling it for users.

### Rule-planner limitations
The text planner currently proposes review locations for common patterns (noon sakinah/tanween, selected meem-sakinah contexts, visible sukun on qalqalah letters, and possible madd letters). Orthographic marks and word-boundary cases vary; the list is a candidate checklist, not a complete Tajweed parser. It cannot judge ghunnah duration, madd duration, articulation, tafkhim/tarqiq, or whether a reciter actually performed a rule correctly. Do not convert candidates into errors or a score.

## Evaluation gate
No production claim of superiority is allowed until benchmark results are collected for:
- word error rate;
- phoneme error rate;
- Tajweed precision/recall;
- false positives/negatives;
- localization accuracy;
- latency;
- noise/microphone robustness;
- supported reciters and riwayat.

## Security
- No database or AI provider secrets in the mobile app.
- Every session/result query is server-side user-scoped.
- Upload URLs are short-lived and private.
- Audio retention is opt-in.
- Audit sensitive operations.
