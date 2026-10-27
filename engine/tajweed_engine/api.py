from __future__ import annotations
import hmac, json, os
from pathlib import Path
from typing import Any
import torch
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from .audio import decode_audio, log_mel
from .model import AcousticRuleClassifier

app = FastAPI(title='Ijazah Acoustic Tajweed Engine', version='0.1.0')
TOKEN = os.getenv('IJAZAH_TAJWEED_ENGINE_TOKEN', '')
MODEL_PATH = Path(os.getenv('IJAZAH_ENGINE_MODEL_DIR', '/models')) / 'qalqalah_classifier.pt'
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
model = None
metadata: dict[str, Any] = {}

def load_model():
    global model, metadata
    if not MODEL_PATH.is_file(): return
    try:
        checkpoint = torch.load(MODEL_PATH, map_location=DEVICE, weights_only=True)
        info = checkpoint.get('metadata', {})
        if info.get('task') != 'qalqalah_segment_v1' or info.get('teacher_reviewed') is not True: return
        candidate = AcousticRuleClassifier()
        candidate.load_state_dict(checkpoint['state_dict'], strict=True)
        candidate.to(DEVICE).eval()
        model, metadata = candidate, info
    except Exception:
        model, metadata = None, {}

@app.on_event('startup')
def startup(): load_model()

def authorize(value: str | None):
    if not TOKEN: raise HTTPException(status_code=503, detail='engine_secret_not_configured')
    supplied = (value or '').removeprefix('Bearer ').strip()
    if not hmac.compare_digest(supplied, TOKEN): raise HTTPException(status_code=401, detail='unauthorized')

@app.get('/health')
def health():
    return {'status': 'ready' if model is not None else 'model_not_trained', 'model_loaded': model is not None, 'device': str(DEVICE)}

@app.post('/v1/analyze')
async def analyze(file: UploadFile = File(...), surah: int = Form(...), ayah: int = Form(...), riwaya: str = Form(...), referenceText: str = Form(...), expectedRuleChecks: str = Form(...), authorization: str | None = Header(default=None)):
    authorize(authorization)
    if not (1 <= surah <= 114 and ayah >= 1) or riwaya != 'hafs': raise HTTPException(status_code=400, detail='invalid_reference')
    if not referenceText.strip(): raise HTTPException(status_code=400, detail='missing_reference_text')
    try: checks = json.loads(expectedRuleChecks)
    except json.JSONDecodeError as exc: raise HTTPException(status_code=400, detail='invalid_rule_checks') from exc
    if not isinstance(checks, list): raise HTTPException(status_code=400, detail='invalid_rule_checks')
    raw = await file.read(20 * 1024 * 1024 + 1)
    if len(raw) > 20 * 1024 * 1024: raise HTTPException(status_code=413, detail='audio_too_large')
    try: audio, quality = decode_audio(raw)
    except ValueError as exc: raise HTTPException(status_code=422, detail=str(exc)) from exc
    # Fail closed: this app contract currently lacks trusted word-level timestamps.
    if model is None:
        return {'status':'not_configured','rulesEvaluated':[],'findings':[],'message':'محرك إجازة الأولي يستقبل الصوت، لكن النموذج لم يُدرّب ويُراجع بعد. لم نصدر أحكام تجويد.','diagnostics':{'audioQuality':quality,'modelLoaded':False}}
    candidates = [c for c in checks if isinstance(c,dict) and isinstance(c.get('startMs'),(int,float)) and isinstance(c.get('endMs'),(int,float)) and c['startMs'] >= 0 and c['endMs'] > c['startMs'] and c['endMs'] <= quality['duration_seconds']*1000]
    if not candidates:
        return {'status':'not_configured','rulesEvaluated':[],'findings':[],'message':'نحتاج محاذاة زمنية موثوقة للكلمات قبل الحكم على قاعدة تجويد محددة.','diagnostics':{'audioQuality':quality,'modelLoaded':True,'timestampedCandidates':0}}
    findings, evaluated = [], []
    with torch.inference_mode():
        for c in candidates[:80]:
            if c.get('ruleId') != 'qalqalah': continue
            start, end = max(0,int(c['startMs']*16)), min(len(audio),int(c['endMs']*16))
            if end-start < 4000: continue
            probs = torch.softmax(model(log_mel(audio[start:end]).to(DEVICE)),dim=-1)[0]
            confidence, predicted = torch.max(probs,dim=0)
            evaluated.append('qalqalah')
            score = float(confidence.item())
            if int(predicted.item()) == 1 and score >= .90:
                findings.append({'ruleId':'qalqalah','wordIndex':int(c['wordIndex']),'context':c.get('context',''),'confidence':score,'evidence':f"Acoustic model candidate; version={metadata.get('model_version','unknown')}; not calibrated",'startMs':int(c['startMs']),'endMs':int(c['endMs'])})
    return {'status':'preliminary_findings' if findings else 'completed_no_confirmed_findings','rulesEvaluated':sorted(set(evaluated)),'findings':findings[:20],'confidence':min((x['confidence'] for x in findings),default=0.0),'message':'اقتراحات أولية تحتاج مراجعة معلّم التجويد؛ ليست حكمًا نهائيًا.'}
