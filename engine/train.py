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
    def __init__(self, rows, root): self.rows, self.root = rows, root
    def __len__(self): return len(self.rows)
    def __getitem__(self, i):
        r = self.rows[i]
        a, sr = sf.read(self.root / r['audio_path'], dtype='float32', always_2d=True)
        a = librosa.resample(a.mean(axis=1), orig_sr=sr, target_sr=SAMPLE_RATE)
        segment = a[int(r['start_ms']*16):int(r['end_ms']*16)]
        if len(segment) < 4000: segment = np.pad(segment, (0, 4000-len(segment)))
        segment = segment[:SAMPLE_RATE*4]
        return log_mel(segment).squeeze(0), torch.tensor(int(r['label']), dtype=torch.long)

def main():
    p=argparse.ArgumentParser(); p.add_argument('--manifest',required=True); p.add_argument('--data-root',default='.'); p.add_argument('--output',default='models/qalqalah_classifier.pt'); p.add_argument('--epochs',type=int,default=20); p.add_argument('--batch-size',type=int,default=16); a=p.parse_args()
    torch.manual_seed(42); rows=[json.loads(x) for x in Path(a.manifest).read_text(encoding='utf-8').splitlines() if x.strip()]
    required={'audio_path','start_ms','end_ms','label','rule_id','split','teacher_reviewed','reciter_id'}
    if not rows or any(not required.issubset(r) for r in rows): raise SystemExit('Manifest missing required fields.')
    if any(r['rule_id']!='qalqalah' or r['teacher_reviewed'] is not True or r['label'] not in (0,1) or r['end_ms']<=r['start_ms'] for r in rows): raise SystemExit('Only teacher-reviewed, valid qalqalah labels 0/1 are accepted.')
    train=[r for r in rows if r['split']=='train']; val=[r for r in rows if r['split']=='validation']
    if not train or not val: raise SystemExit('Need train and validation examples.')
    if {r['reciter_id'] for r in train} & {r['reciter_id'] for r in val}: raise SystemExit('Data leakage: same reciter in train and validation.')
    if any({r['label'] for r in group}!={0,1} for group in (train,val)): raise SystemExit('Both classes must exist in each split.')
    device=torch.device('cuda' if torch.cuda.is_available() else 'cpu'); tl=DataLoader(Segments(train,Path(a.data_root)),batch_size=a.batch_size,shuffle=True); vl=DataLoader(Segments(val,Path(a.data_root)),batch_size=a.batch_size)
    model=AcousticRuleClassifier().to(device); opt=torch.optim.AdamW(model.parameters(),lr=2e-4,weight_decay=1e-3); loss_fn=nn.CrossEntropyLoss(); best=-1; best_state=None
    for epoch in range(a.epochs):
        model.train()
        for x,y in tl:
            x,y=x.to(device),y.to(device); opt.zero_grad(set_to_none=True); loss=loss_fn(model(x),y); loss.backward(); opt.step()
        model.eval(); ys=[]; ps=[]
        with torch.inference_mode():
            for x,y in vl: ps += (torch.softmax(model(x.to(device)),dim=-1)[:,1].cpu()>=.5).int().tolist(); ys += y.tolist()
        tp=sum(p==1 and y==1 for p,y in zip(ps,ys)); fp=sum(p==1 and y==0 for p,y in zip(ps,ys)); fn=sum(p==0 and y==1 for p,y in zip(ps,ys)); precision=tp/max(1,tp+fp); recall=tp/max(1,tp+fn); f1=2*precision*recall/max(1e-9,precision+recall)
        print(json.dumps({'epoch':epoch+1,'val_precision':precision,'val_recall':recall,'val_f1':f1}))
        if f1>best: best=f1; best_state={k:v.detach().cpu().clone() for k,v in model.state_dict().items()}
    out=Path(a.output); out.parent.mkdir(parents=True,exist_ok=True)
    torch.save({'state_dict':best_state,'metadata':{'task':'qalqalah_segment_v1','model_version':'ijazah-qalqalah-cnn-v0.1','teacher_reviewed':False,'validation_f1':best,'note':'Draft only; production loader intentionally refuses this checkpoint until independent teacher audit and calibration.'}},out)
    print(f'Saved draft checkpoint to {out}; not production-loadable until independent teacher audit and calibration.')
if __name__=='__main__': main()
