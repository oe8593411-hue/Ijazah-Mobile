from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
from typing import Any

import librosa
import numpy as np
import soundfile as sf
import torch
from torch import nn
from torch.utils.data import DataLoader, Dataset

from tajweed_engine.alignment_model import QuranCTCAcousticModel
from tajweed_engine.audio import MAX_SECONDS, SAMPLE_RATE, log_mel
from tajweed_engine.dataset import validate_segment_timestamps, validate_transcript_provenance
from tajweed_engine.reference import get_corpus, normalize_reference


def build_vocabulary(corpus: dict[tuple[int, int], str]) -> dict[str, int]:
    """Build a stable, dense character vocabulary from the complete verified corpus."""
    characters = {
        character
        for text in corpus.values()
        for character in normalize_reference(text)
        if not character.isspace()
    }
    if not characters:
        raise ValueError("verified_corpus_has_no_characters")
    return {character: index + 1 for index, character in enumerate(sorted(characters))}


def transcript_for_row(row: dict[str, Any], corpus: dict[tuple[int, int], str]) -> str:
    """Use only exact verses from the trusted corpus, never transcript text from a manifest."""
    surah, start, end = row.get("surah"), row.get("ayah_start"), row.get("ayah_end")
    if any(isinstance(value, bool) or not isinstance(value, int) for value in (surah, start, end)):
        raise ValueError("invalid_transcript_reference")
    if not 1 <= surah <= 114 or start < 1 or end < start or end - start > 29:
        raise ValueError("invalid_transcript_reference")
    verses: list[str] = []
    for ayah in range(start, end + 1):
        text = corpus.get((surah, ayah))
        if not isinstance(text, str) or not text.strip():
            raise ValueError("transcript_reference_not_in_verified_corpus")
        verses.append(text)
    result = normalize_reference(" ".join(verses))
    if not result:
        raise ValueError("transcript_reference_empty")
    return result


def minimum_ctc_frames(token_ids: list[int]) -> int:
    """One frame per token plus one blank between identical adjacent tokens."""
    if not token_ids:
        raise ValueError("transcript_has_no_tokens")
    repeated_neighbors = sum(
        token_ids[index] == token_ids[index - 1] for index in range(1, len(token_ids))
    )
    return len(token_ids) + repeated_neighbors


def validate_split_isolation(rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    splits = {name: [row for row in rows if row["split"] == name]
              for name in ("train", "validation", "test")}
    if any(not splits[name] for name in splits):
        raise ValueError("need_nonempty_train_validation_test_splits")
    recording_ids = [row["recording_id"].strip() for row in rows]
    if len(set(recording_ids)) != len(recording_ids):
        raise ValueError("recording_ids_must_be_unique")
    reciters = [{row["reciter_id"].strip() for row in splits[name]}
                for name in ("train", "validation", "test")]
    if reciters[0] & reciters[1] or reciters[0] & reciters[2] or reciters[1] & reciters[2]:
        raise ValueError("reciters_must_be_disjoint_across_splits")
    recordings = [{row["recording_id"].strip() for row in splits[name]}
                  for name in ("train", "validation", "test")}
    if recordings[0] & recordings[1] or recordings[0] & recordings[2] or recordings[1] & recordings[2]:
        raise ValueError("recordings_must_be_disjoint_across_splits")
    return splits


def validate_manifest(
    rows: list[dict[str, Any]],
    data_root: Path,
    corpus: dict[tuple[int, int], str],
    vocabulary: dict[str, int],
) -> dict[str, list[dict[str, Any]]]:
    if not rows:
        raise ValueError("manifest_empty")
    root = data_root.resolve()
    prepared: list[dict[str, Any]] = []
    for line_number, original in enumerate(rows, 1):
        if not isinstance(original, dict):
            raise ValueError(f"manifest_row_not_object:{line_number}")
        row = dict(original)
        try:
            validate_transcript_provenance(row)
            transcript = transcript_for_row(row, corpus)
        except ValueError as exc:
            raise ValueError(f"invalid_manifest_row:{line_number}:{exc}") from exc

        audio_path = row.get("audio_path")
        if not isinstance(audio_path, str) or not audio_path.strip():
            raise ValueError(f"audio_path_required:{line_number}")
        path = (root / audio_path).resolve()
        if path == root or root not in path.parents or not path.is_file():
            raise ValueError(f"missing_or_unsafe_audio_path:{line_number}")
        try:
            info = sf.info(str(path))
        except Exception as exc:
            raise ValueError(f"unreadable_audio:{line_number}") from exc
        if not math.isfinite(info.duration) or info.duration > MAX_SECONDS:
            raise ValueError(f"audio_duration_exceeds_limit:{line_number}")
        try:
            validate_segment_timestamps(0, info.duration * 1000, info.duration * 1000)
        except ValueError as exc:
            raise ValueError(f"invalid_audio_duration:{line_number}:{exc}") from exc

        target_ids = [vocabulary[char] for char in transcript if not char.isspace()]
        available_frames = int(math.floor(info.duration * SAMPLE_RATE / 160)) + 1
        if minimum_ctc_frames(target_ids) > available_frames:
            raise ValueError(f"transcript_too_long_for_audio:{line_number}")
        row["audio_path"] = str(path)
        row["_transcript"] = transcript
        prepared.append(row)
    return validate_split_isolation(prepared)


class QuranTranscriptDataset(Dataset):
    def __init__(self, rows: list[dict[str, Any]], vocabulary: dict[str, int]):
        self.rows = rows
        self.vocabulary = vocabulary

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, index: int):
        row = self.rows[index]
        audio, sample_rate = sf.read(row["audio_path"], dtype="float32", always_2d=True)
        if sample_rate <= 0 or audio.size == 0 or not np.isfinite(audio).all():
            raise ValueError("invalid_training_audio")
        audio = audio.mean(axis=1)
        if sample_rate != SAMPLE_RATE:
            audio = librosa.resample(audio, orig_sr=sample_rate, target_sr=SAMPLE_RATE).astype(np.float32)
        if len(audio) < int(0.25 * SAMPLE_RATE) or len(audio) > int(MAX_SECONDS * SAMPLE_RATE):
            raise ValueError("training_audio_duration_invalid")
        if float(np.max(np.abs(audio))) < 1e-4:
            raise ValueError("training_audio_is_silent")
        features = log_mel(audio).squeeze(0).squeeze(0)
        target = torch.tensor(
            [self.vocabulary[ch] for ch in row["_transcript"] if not ch.isspace()],
            dtype=torch.long,
        )
        return features, target


def collate_transcripts(batch):
    features, targets = zip(*batch)
    lengths = torch.tensor([item.shape[-1] for item in features], dtype=torch.long)
    max_frames = int(lengths.max())
    feature_batch = torch.zeros((len(features), 1, 80, max_frames), dtype=torch.float32)
    for index, item in enumerate(features):
        feature_batch[index, 0, :, :item.shape[-1]] = item
    target_lengths = torch.tensor([len(item) for item in targets], dtype=torch.long)
    return feature_batch, torch.cat(targets), lengths, target_lengths


def run_epoch(model, loader, optimizer, criterion, device, training: bool) -> float:
    model.train(training)
    total_loss, total_items = 0.0, 0
    for features, targets, input_lengths, target_lengths in loader:
        features, targets = features.to(device), targets.to(device)
        input_lengths, target_lengths = input_lengths.to(device), target_lengths.to(device)
        if training:
            optimizer.zero_grad(set_to_none=True)
        with torch.set_grad_enabled(training):
            logits = model(features)
            log_probs = torch.log_softmax(logits.float(), dim=-1).transpose(0, 1)
            loss = criterion(log_probs, targets, input_lengths, target_lengths)
            if not torch.isfinite(loss):
                raise ValueError("ctc_training_loss_non_finite")
            if training:
                loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), 5.0)
                optimizer.step()
        count = int(features.shape[0])
        total_loss += float(loss.detach().item()) * count
        total_items += count
    if total_items == 0:
        raise ValueError("empty_training_split")
    return total_loss / total_items


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"invalid_jsonl_line:{line_number}") from exc
        if not isinstance(value, dict):
            raise ValueError(f"manifest_row_not_object:{line_number}")
        rows.append(value)
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Train Ijazah's local Quran CTC character aligner.")
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--data-root", default=".")
    parser.add_argument("--output-dir", default="models")
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--batch-size", type=int, default=2)
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()
    if args.epochs < 1 or args.batch_size < 1 or args.batch_size > 16:
        raise SystemExit("epochs must be positive and batch-size must be between 1 and 16")

    torch.manual_seed(42)
    np.random.seed(42)
    corpus = get_corpus()
    vocabulary = build_vocabulary(corpus)
    try:
        rows = load_jsonl(Path(args.manifest))
        splits = validate_manifest(rows, Path(args.data_root), corpus, vocabulary)
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc
    if args.validate_only:
        print(json.dumps({
            "valid": True,
            "manifest_rows": len(rows),
            "vocabulary_characters": len(vocabulary),
            "splits": {
                name: {
                    "segments": len(splits[name]),
                    "reciters": len({row["reciter_id"] for row in splits[name]}),
                    "recordings": len({row["recording_id"] for row in splits[name]}),
                }
                for name in ("train", "validation", "test")
            },
        }, sort_keys=True))
        return

    datasets = {name: QuranTranscriptDataset(splits[name], vocabulary)
                for name in ("train", "validation", "test")}
    loaders = {
        name: DataLoader(datasets[name], batch_size=args.batch_size,
                         shuffle=(name == "train"), collate_fn=collate_transcripts)
        for name in ("train", "validation", "test")
    }
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    network = QuranCTCAcousticModel(num_classes=len(vocabulary) + 1).to(device)
    optimizer = torch.optim.AdamW(network.parameters(), lr=2e-4, weight_decay=1e-3)
    criterion = nn.CTCLoss(blank=0, zero_infinity=True)
    best_validation, best_state = math.inf, None
    for epoch in range(args.epochs):
        train_loss = run_epoch(network, loaders["train"], optimizer, criterion, device, True)
        validation_loss = run_epoch(network, loaders["validation"], optimizer, criterion, device, False)
        print(json.dumps({
            "epoch": epoch + 1,
            "train_ctc_loss": round(train_loss, 6),
            "validation_ctc_loss": round(validation_loss, 6),
        }, sort_keys=True))
        if validation_loss < best_validation:
            best_validation = validation_loss
            best_state = {key: value.detach().cpu().clone()
                          for key, value in network.state_dict().items()}
    if best_state is None:
        raise SystemExit("no_valid_checkpoint_selected")
    network.load_state_dict(best_state)
    network.cpu().eval()
    heldout_loss = run_epoch(network, loaders["test"], optimizer, criterion, torch.device("cpu"), False)

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    model_path = output_dir / "quran_ctc_aligner.pt"
    metadata_path = output_dir / "quran_ctc_aligner.json"
    torch.jit.script(network).save(str(model_path))
    digest = hashlib.sha256()
    with model_path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    artifact_metadata = {
        "task": "quran_ctc_character_alignment_v1",
        "teacher_reviewed": False,
        "calibrated": False,
        "alignment_quality_passed": False,
        "sample_rate": SAMPLE_RATE,
        "frame_hop_samples": 160,
        "blank_id": 0,
        "vocabulary": vocabulary,
        "minimum_mean_character_confidence": 0.75,
        "model_sha256": digest.hexdigest(),
        "model_version": "ijazah-quran-ctc-v0.1",
        "best_validation_ctc_loss": best_validation,
        "heldout_test_ctc_loss": heldout_loss,
        "note": "Research artifact only; release flags remain false pending independent review and calibration.",
    }
    metadata_path.write_text(
        json.dumps(artifact_metadata, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "model_path": str(model_path),
        "metadata_path": str(metadata_path),
        "best_validation_ctc_loss": round(best_validation, 6),
        "heldout_test_ctc_loss": round(heldout_loss, 6),
        "release_gates_passed": False,
    }, sort_keys=True))


if __name__ == "__main__":
    main()
