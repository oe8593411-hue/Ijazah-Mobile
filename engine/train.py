from __future__ import annotations
import argparse, json, math
from pathlib import Path
import numpy as np
import soundfile as sf
import librosa
import torch
from torch import nn
from torch.utils.data import Dataset, DataLoader
from tajweed_engine.audio import SAMPLE_RATE, log_mel
from tajweed_engine.model import AcousticRuleClassifier
from tajweed_engine.dataset import validate_label_provenance, validate_segment_timestamps

class Segments(Dataset):
    def __init__(self, rows, root):
        self.rows, self.root = rows, root
    def __len__(self):
        return len(self.rows)
    def __getitem__(self, i):
        r = self.rows[i]
        path = Path(r["audio_path"])
        if not path.is_absolute():
            path = self.root / path
        a, sr = sf.read(path, dtype="float32", always_2d=True)
        a = librosa.resample(a.mean(axis=1), orig_sr=sr, target_sr=SAMPLE_RATE)
        start = int(r["start_ms"] * SAMPLE_RATE / 1000)
        end = int(r["end_ms"] * SAMPLE_RATE / 1000)
        segment = a[start:end]
        # Use a fixed four-second window so default DataLoader batching works.
        max_samples = SAMPLE_RATE * 4
        segment = segment[:max_samples]
        if len(segment) < max_samples:
            segment = np.pad(segment, (0, max_samples - len(segment)))
        return log_mel(segment).squeeze(0), torch.tensor(int(r["label"]), dtype=torch.long)

def predict_probabilities(model, loader, device):
    """Collect model probabilities and labels without making threshold decisions."""
    model.eval()
    labels, probabilities = [], []
    with torch.inference_mode():
        for x, y in loader:
            logits = model(x.to(device))
            if logits.ndim != 2 or logits.shape[1] != 2 or not torch.isfinite(logits).all():
                raise ValueError("classifier_output_invalid")
            prob = torch.softmax(logits.float(), dim=-1)[:, 1].cpu().tolist()
            probabilities.extend(float(value) for value in prob)
            labels.extend(int(value) for value in y.tolist())
    return labels, probabilities


def metrics_from_probabilities(labels, probabilities, threshold):
    if len(labels) != len(probabilities) or not labels:
        raise ValueError("empty_or_mismatched_probability_data")
    if (
        isinstance(threshold, bool) or not isinstance(threshold, (int, float))
        or not math.isfinite(threshold) or not 0 < threshold <= 1
    ):
        raise ValueError("invalid_decision_threshold")
    predictions = [int(value >= threshold) for value in probabilities]
    tp = sum(pred == 1 and actual == 1 for pred, actual in zip(predictions, labels))
    fp = sum(pred == 1 and actual == 0 for pred, actual in zip(predictions, labels))
    fn = sum(pred == 0 and actual == 1 for pred, actual in zip(predictions, labels))
    precision = tp / max(1, tp + fp)
    recall = tp / max(1, tp + fn)
    f1 = 2 * precision * recall / max(1e-9, precision + recall)
    return {"precision": precision, "recall": recall, "f1": f1, "tp": tp, "fp": fp, "fn": fn}


def select_decision_threshold(labels, probabilities, minimum_precision=0.90):
    """Select an operating threshold on validation data only; never inspect test labels."""
    if (
        isinstance(minimum_precision, bool) or not isinstance(minimum_precision, (int, float))
        or not math.isfinite(minimum_precision) or not 0.5 <= minimum_precision <= 1
    ):
        raise ValueError("minimum_precision_must_be_between_0_5_and_1")
    if len(labels) != len(probabilities) or not labels:
        raise ValueError("empty_or_mismatched_probability_data")
    if any(not math.isfinite(float(p)) or not 0 <= float(p) <= 1 for p in probabilities):
        raise ValueError("invalid_probability")

    # A fixed grid avoids quadratic work on large validation sets.
    thresholds = [step / 1000 for step in range(1, 1001)]
    candidates = []
    for threshold in thresholds:
        metrics = metrics_from_probabilities(labels, probabilities, threshold)
        if metrics["tp"] > 0 and metrics["precision"] >= minimum_precision:
            candidates.append((threshold, metrics))
    if not candidates:
        safe_threshold = 1.0
        return {
            "threshold": safe_threshold,
            "metrics": metrics_from_probabilities(labels, probabilities, safe_threshold),
            "meets_minimum_precision": False,
            "minimum_precision": float(minimum_precision),
        }
    threshold, metrics = max(
        candidates,
        key=lambda item: (item[1]["f1"], item[1]["recall"], item[0]),
    )
    return {
        "threshold": threshold,
        "metrics": metrics,
        "meets_minimum_precision": True,
        "minimum_precision": float(minimum_precision),
    }


def score(model, loader, device, threshold=0.5):
    labels, probabilities = predict_probabilities(model, loader, device)
    return metrics_from_probabilities(labels, probabilities, threshold)

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--manifest", required=True); p.add_argument("--data-root", default=".")
    p.add_argument("--output", default="models/qalqalah_classifier.pt")
    p.add_argument("--epochs", type=int, default=20); p.add_argument("--batch-size", type=int, default=16)
    p.add_argument("--minimum-validation-precision", type=float, default=0.90)
    p.add_argument("--validate-only", action="store_true", help="validate the full manifest and report split counts without training")
    a=p.parse_args()
    if a.epochs < 1 or a.batch_size < 1:
        raise SystemExit("epochs and batch-size must be positive")
    if not 0.5 <= a.minimum_validation_precision <= 1:
        raise SystemExit("minimum-validation-precision must be between 0.5 and 1")
    torch.manual_seed(42)
    root=Path(a.data_root).resolve()
    rows=[json.loads(x) for x in Path(a.manifest).read_text(encoding="utf-8").splitlines() if x.strip()]
    required={"audio_path","start_ms","end_ms","label","rule_id","split","teacher_reviewed","reciter_id","recording_id","rights","reviewers"}
    if not rows or any(not isinstance(r,dict) or not required.issubset(r) for r in rows):
        raise SystemExit("Manifest missing required fields.")
    for line_number, r in enumerate(rows, 1):
        try:
            validate_label_provenance(r)
        except ValueError as exc:
            raise SystemExit(f"Invalid rights/review provenance at manifest line {line_number}: {exc}") from exc
        r["recording_id"] = r["recording_id"].strip()
        if r["rule_id"]!="qalqalah" or r["teacher_reviewed"] is not True or r["label"] not in (0,1):
            raise SystemExit("Only teacher-reviewed qalqalah labels 0/1 are accepted.")
        if r["split"] not in ("train","validation","test"):
            raise SystemExit("Each row needs split=train/validation/test.")
        if not isinstance(r["reciter_id"], str) or not r["reciter_id"].strip():
            raise SystemExit("Each row needs a non-empty pseudonymous reciter_id.")
        r["reciter_id"] = r["reciter_id"].strip()
        if not isinstance(r["audio_path"], str) or not r["audio_path"].strip():
            raise SystemExit("Each row needs a non-empty audio_path string.")
        path=(root / r["audio_path"]).resolve()
        if not path.is_file() or (path != root and root not in path.parents):
            raise SystemExit(f"Missing or unsafe audio_path: {r['audio_path']}")
        try:
            info=sf.info(str(path))
        except Exception as exc:
            raise SystemExit(f"Unreadable audio file: {r['audio_path']}") from exc
        try:
            validate_segment_timestamps(r["start_ms"], r["end_ms"], info.duration * 1000)
        except ValueError as exc:
            raise SystemExit(f"Invalid segment timestamps at manifest line {line_number}: {exc}") from exc
        r["audio_path"]=str(path)
    groups={s:[r for r in rows if r["split"]==s] for s in ("train","validation","test")}
    if any(not groups[s] for s in groups):
        raise SystemExit("Need separate train, validation, and held-out test examples.")
    reciters=[{r["reciter_id"] for r in groups[s]} for s in ("train","validation","test")]
    if reciters[0]&reciters[1] or reciters[0]&reciters[2] or reciters[1]&reciters[2]:
        raise SystemExit("Data leakage: reciters must be disjoint across train/validation/test.")
    recordings=[{r["recording_id"] for r in groups[s]} for s in ("train","validation","test")]
    if recordings[0]&recordings[1] or recordings[0]&recordings[2] or recordings[1]&recordings[2]:
        raise SystemExit("Data leakage: recording IDs must be disjoint across train/validation/test.")
    if any({r["label"] for r in groups[s]}!={0,1} for s in groups):
        raise SystemExit("Both classes must exist in every split.")
    if a.validate_only:
        summary = {
            "valid": True,
            "manifest_rows": len(rows),
            "splits": {
                split: {
                    "segments": len(groups[split]),
                    "reciters": len({row["reciter_id"] for row in groups[split]}),
                    "labels": {
                        "acceptable": sum(row["label"] == 0 for row in groups[split]),
                        "review_candidate": sum(row["label"] == 1 for row in groups[split]),
                    },
                }
                for split in ("train", "validation", "test")
            },
        }
        print(json.dumps(summary, sort_keys=True))
        return
    tl=DataLoader(Segments(groups["train"],root),batch_size=a.batch_size,shuffle=True)
    vl=DataLoader(Segments(groups["validation"],root),batch_size=a.batch_size)
    testl=DataLoader(Segments(groups["test"],root),batch_size=a.batch_size)
    device=torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model=AcousticRuleClassifier().to(device)
    opt=torch.optim.AdamW(model.parameters(),lr=2e-4,weight_decay=1e-3)
    loss_fn=nn.CrossEntropyLoss(); best=-1; best_state=None
    for epoch in range(a.epochs):
        model.train()
        for x,y in tl:
            x,y=x.to(device),y.to(device); opt.zero_grad(set_to_none=True)
            loss=loss_fn(model(x),y); loss.backward(); opt.step()
        model.eval(); result=score(model,vl,device)
        print(json.dumps({"epoch":epoch+1,"validation":result}))
        if result["f1"]>best:
            best=result["f1"]
            best_state={k:v.detach().cpu().clone() for k,v in model.state_dict().items()}
    # Select the operating threshold using validation only, then measure the held-out test once.
    model.load_state_dict(best_state); model.eval()
    validation_labels, validation_probabilities = predict_probabilities(model, vl, device)
    calibration = select_decision_threshold(
        validation_labels, validation_probabilities, a.minimum_validation_precision
    )
    threshold = calibration["threshold"]
    validation_at_threshold = calibration["metrics"]
    test_labels, test_probabilities = predict_probabilities(model, testl, device)
    heldout = metrics_from_probabilities(test_labels, test_probabilities, threshold)
    print(json.dumps({
        "validation_threshold": threshold,
        "validation_at_threshold": validation_at_threshold,
        "minimum_validation_precision": a.minimum_validation_precision,
        "threshold_target_met": calibration["meets_minimum_precision"],
    }, sort_keys=True))
    print(json.dumps({"heldout_test": heldout, "decision_threshold": threshold}, sort_keys=True))
    out=Path(a.output); out.parent.mkdir(parents=True,exist_ok=True)
    torch.save({"state_dict":best_state,"metadata":{
        "task":"qalqalah_segment_v1","model_version":"ijazah-qalqalah-cnn-v0.3",
        "teacher_reviewed":False,"calibrated":False,
        "decision_threshold":threshold,
        "minimum_validation_precision":a.minimum_validation_precision,
        "validation_threshold_meets_minimum_precision":calibration["meets_minimum_precision"],
        "validation_f1_at_0_5":best,
        "validation_at_threshold":validation_at_threshold,
        "heldout_test":heldout,
        "note":"Research checkpoint only; independent review and probability calibration still required."
    }},out)
    print(f"Saved research checkpoint to {out}; release gates remain closed pending independent review and calibration.")
if __name__=="__main__":
    main()
