# Quran Corpus Import Gate

The app must never treat Quran text as AI-generated content.

Canonical corpus target:
- Source: Tanzil Quran Text
- Edition: Uthmani
- Riwayah: Hafs
- Version: 1.1
- Expected structure: 114 surahs / 6236 ayahs

Import is blocked unless:
1. The exact source file is downloaded from Tanzil.
2. SHA-256 matches the repository's protected TANZIL_SHA256 secret.
3. The source parses to exactly 6236 ayahs and 114 surahs.
4. Every ayah is stored with its own SHA-256 hash.
5. The corpus remains pending until all database validations pass.
6. Only then is verification_status changed to verified.

Do not replace the checksum with a value from an unverified mirror. Do not edit, normalize, regenerate, or translate the Quran text during import.

The mobile app may display Quran text only from a verified corpus. AI models are never an authority for Quran text.
