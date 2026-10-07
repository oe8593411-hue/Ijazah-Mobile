# Ijazah Database Plan

The production database must be a dedicated Neon project, separate from ProfitGuard.

Core domains:
- identities and profiles
- devices and sessions
- Quran editions, surahs, ayahs and word/phoneme alignment
- memorization plans and revision sessions
- recitation attempts and analysis results
- Tajweed rules and detected violations
- teacher/student relationships and Ijazah records
- audio object metadata (never public URLs)
- progress, streaks and achievements
- security/audit events

Design principles: UUID identifiers, UTC timestamps, strict foreign keys, unique constraints, indexes for user-scoped queries, append-only audit events, soft deletion only where legally/business necessary, and server-side authorization.
