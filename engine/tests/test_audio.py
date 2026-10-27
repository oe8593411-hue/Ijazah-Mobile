import io
import unittest
import numpy as np
import soundfile as sf
from tajweed_engine.audio import decode_audio, SAMPLE_RATE, log_mel

class AudioTests(unittest.TestCase):
    def wav(self, data, sr=16000):
        out=io.BytesIO(); sf.write(out,data,sr,format='WAV'); return out.getvalue()
    def test_decode_and_feature_shape(self):
        t=np.arange(16000,dtype=np.float32)/16000
        raw=self.wav(.1*np.sin(2*np.pi*220*t))
        audio,quality=decode_audio(raw)
        self.assertEqual(len(audio),SAMPLE_RATE)
        self.assertAlmostEqual(quality['duration_seconds'],1.0,places=2)
        features=log_mel(audio)
        self.assertEqual(tuple(features.shape[:3]),(1,1,80))
    def test_rejects_silence(self):
        with self.assertRaisesRegex(ValueError,'audio_silence'):
            decode_audio(self.wav(np.zeros(8000,dtype=np.float32)))
    def test_rejects_oversize(self):
        with self.assertRaisesRegex(ValueError,'invalid_audio_size'):
            decode_audio(b'x'*(20*1024*1024+1))

if __name__=='__main__': unittest.main()
