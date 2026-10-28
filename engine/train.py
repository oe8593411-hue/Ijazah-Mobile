from __future__ import annotations
import argparse, json
from pathlib import Path
import numpy as np
import soundfile as sf
import librosa
import torch
from torch import nn
from torch.utils.data import Dataset, DataLoader
from tajweed_engine.audio import SAMPLE_RATE, log_mel
from tajweed_engine.model import AcousticRuleClassifier

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
        if len(segment) < 4000:
            segment = np.pad(segment, (0, 4000-len(segment)))
        segment = segment[:SAMPLE_RATE*4]
        return log_mel(segment).squeeze(0), torch.tensor(int(r["label"]), dtype=torch.long)

def score(model, loader, device, threshold=0.5):
    ys, ps = [], []
    with torch.inference_mode():
        for x, y in loader:
            prob = torch.softmax(model(x.to(device)), dim=-1)[:, 1].cpu()
            ps.extend((prob >= threshold).int().tolist())
            ys.extend(y.tolist())
    tp=sum(p==1 and y==1 for p,y in zip(ps,ys))
    fp=sum(p==1 and y==0 for p,y in zip(ps,ys))
    fn=sum(p==0 and y==1 for p,y in zip(ps,ys))
    precision=tp/max(1,tp+fp); recall=tp/max(1,tp+fn)
    f1=2*precision*recall/max(1e-9,precision+recall)
    return {"precision":precision,"recall":recall,"f1":f1,"tp":tp,"fp":fp,"fn":fn}

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--manifest", required=True); p.add_argument("--data-root", default=".")
    p.add_argument("--output", default="models/qalqalah_classifier.pt")
    p.add_argument("--epochs", type=int, default=20); p.add_argument("--batch-size", type=int, default=16)
    a=p.parse_args()
    if a.epochs < 1 or a.batch_size < 1:
        raise SystemExit("epochs and batch-size must be positive")
    torch.manual_seed(42)
    root=Path(a.data_root).resolve()
    rows=[json.loads(x) for x in Path(a.manifest).read_text(encoding="utf-8").splitlines() if x.strip()]
    required={"audio_path","start_ms","end_ms","label","rule_id","split","teacher_reviewed","reciter_id"}
    if not rows or any(not isinstance(r,dict) or not required.issubset(r) for r in rows):
        raise SystemExit("Manifest missing required fields.")
    for r in rows:
        if r["rule_id"]!="qalqalah" or r["teacher_reviewed"] is not True or r["label"] not in (0,1):
            raise SystemExit("Only teacher-reviewed qalqalah labels 0/1 are accepted.")
        if r["split"] not in ("train","validation","test") or not str(r["reciter_id"]).strip():
            raise SystemExit("Each row needs split=train/validation/test and a reciter_id.")
        if (not isinstance(r["start_ms"],(int,float)) or isinstance(r["start_ms"],bool)
            or not isinstance(r["end_ms"],(int,float)) or isinstance(r["end_ms"],bool)
            or r["start_ms"] < 0 or r["end_ms"] <= r["start_ms"]):
            raise SystemExit("Invalid segment timestamps.")
        path=(root / r["audio_path"]).resolve()
        if not path.is_file() or (path != root and root not in path.parents):
            raise SystemExit(f"Missing or unsafe audio_path: {r['audio_path']}")
        try:
            info=sf.info(str(path))
        except Exception as exc:
            raise SystemExit(f"Unreadable audio file: {r['audio_path']}") from exc
        if r["end_ms"] > info.duration*1000 or r["end_ms"]-r["start_ms"] < 250:
            raise SystemExit(f"Segment timestamps outside audio or too short: {r['audio_path']}")
        r["audio_path"]=str(path)
    groups={s:[r for r in rows if r["split"]==s] for s in ("train","validation","test")}
    if any(not groups[s] for s in groups):
        raise SystemExit("Need separate train, validation, and held-out test examples.")
    reciters=[{r["reciter_id"] for r in groups[s]} for s in ("train","validation","test")]
    if reciters[0]&reciters[1] or reciters[0]&reciters[2] or reciters[1]&reciters[2]:
        raise SystemExit("Data leakage: reciters must be disjoint across train/validation/test.")
    if any({r["label"] for r in groups[s]}!={0,1} for s in groups):
        raise SystemExit("Both classes must exist in every split.")
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
    # Held-out test is measured only after checkpoint selection using validation.
    model.load_state_dict(best_state); model.eval()
    heldout=score(model,testl,device)
    print(json.dumps({"heldout_test":heldout}))
    out=Path(a.output); out.parent.mkdir(parents=True,exist_ok=True)
    torch.save({"state_dict":best_state,"metadata":{
        "task":"qalqalah_segment_v1","model_version":"ijazah-qalqalah-cnn-v0.2",
        "teacher_reviewed":False,"calibrated":False,
        "validation_f1":best,"heldout_test":heldout,
        "note":"Research checkpoint only; loader refuses it until independent audit and calibration."
    }},out)
    print(f"Saved research checkpoint to {out}; not production-loadable until independent audit and calibration.")
if __name__=="__main__":
    main()
