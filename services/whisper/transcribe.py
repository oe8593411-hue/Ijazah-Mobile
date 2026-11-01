"""Local Whisper transcription for recitation evaluation.

Prints the words the model hears, with timestamps and probabilities, as one JSON object.
The expected verse is never sent to the model: a prompt with the expected text makes
Whisper write the verse back, which hides the mistakes the app has to catch.

Usage:
    python3 services/whisper/transcribe.py <audio file>

Environment:
    WHISPER_MODEL         model name or local path (default: large-v3)
    WHISPER_DEVICE        cpu, cuda or auto (default: auto)
    WHISPER_COMPUTE_TYPE  for example int8 on CPU or float16 on GPU (default: default)
"""

import json
import os
import sys

DEFAULT_MODEL = "large-v3"


def words_from_segments(segments):
    """Flatten faster-whisper segments into plain word records, skipping blank words."""
    words = []
    for segment in segments:
        for word in segment.words or []:
            text = (word.word or "").strip()
            if not text:
                continue
            words.append({
                "text": text,
                "start": round(float(word.start), 3),
                "end": round(float(word.end), 3),
                "probability": round(float(word.probability), 4),
            })
    return words


def transcribe_file(model, path):
    """Run one clip through a loaded model and return the result as a plain dict."""
    segments, info = model.transcribe(
        path,
        language="ar",
        task="transcribe",
        beam_size=5,
        word_timestamps=True,
        condition_on_previous_text=False,
        vad_filter=False,
    )
    words = words_from_segments(segments)  # faster-whisper decodes lazily, so consume it here
    return {
        "language": info.language,
        "duration": round(float(info.duration), 3),
        "words": words,
    }


def load_model():
    # Imported here so the tests and the harness do not need the GPU stack installed.
    from faster_whisper import WhisperModel

    return WhisperModel(
        os.environ.get("WHISPER_MODEL", DEFAULT_MODEL),
        device=os.environ.get("WHISPER_DEVICE", "auto"),
        compute_type=os.environ.get("WHISPER_COMPUTE_TYPE", "default"),
    )


def main(argv):
    if len(argv) != 2:
        print("usage: transcribe.py <audio file>", file=sys.stderr)
        return 2
    model = load_model()
    result = transcribe_file(model, argv[1])
    result["model"] = os.environ.get("WHISPER_MODEL", DEFAULT_MODEL)
    json.dump(result, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
