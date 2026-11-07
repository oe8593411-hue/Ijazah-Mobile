import io
import unittest
from unittest.mock import patch
import subprocess
import numpy as np
import tajweed_engine.audio as audio_module
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
    def test_mobile_container_falls_back_to_bounded_ffmpeg_decode(self):
        t = np.arange(16000, dtype=np.float32) / 16000
        decoded_samples = (.1 * np.sin(2 * np.pi * 220 * t)).astype("<f4").tobytes()
        probe_result = subprocess.CompletedProcess([], 0, stdout=b"1.0\n", stderr=b"")
        decode_result = subprocess.CompletedProcess([], 0, stdout=decoded_samples, stderr=b"")
        with patch.object(audio_module.sf, "read", side_effect=RuntimeError("container unsupported")), \
             patch.object(audio_module.shutil, "which", side_effect=lambda name: "/usr/bin/" + name), \
             patch.object(audio_module.subprocess, "run", side_effect=[probe_result, decode_result]) as run:
            decoded, quality = decode_audio(b"mobile-container-audio")
        self.assertEqual(len(decoded), SAMPLE_RATE)
        self.assertEqual(quality["decoder"], "ffmpeg")
        self.assertAlmostEqual(quality["duration_seconds"], 1.0, places=2)
        self.assertEqual(run.call_count, 2)
        self.assertIn("-show_entries", run.call_args_list[0].args[0])
        self.assertIn("-t", run.call_args_list[1].args[0])

    def test_ffmpeg_fallback_rejects_overlong_media_before_decode(self):
        probe_result = subprocess.CompletedProcess([], 0, stdout=b"21.0\n", stderr=b"")
        with patch.object(audio_module.sf, "read", side_effect=RuntimeError("container unsupported")), \
             patch.object(audio_module.shutil, "which", side_effect=lambda name: "/usr/bin/" + name), \
             patch.object(audio_module.subprocess, "run", return_value=probe_result) as run:
            with self.assertRaisesRegex(ValueError, "audio_segment_too_long"):
                decode_audio(b"mobile-container-audio")
        self.assertEqual(run.call_count, 1)

    def test_ffmpeg_fallback_fails_closed_when_ffmpeg_is_unavailable(self):
        with patch.object(audio_module.sf, "read", side_effect=RuntimeError("container unsupported")), \
             patch.object(audio_module.shutil, "which", return_value=None):
            with self.assertRaisesRegex(ValueError, "unsupported_or_corrupt_audio"):
                decode_audio(b"mobile-container-audio")

    def test_rejects_silence(self):
        with self.assertRaisesRegex(ValueError,'audio_silence'):
            decode_audio(self.wav(np.zeros(8000,dtype=np.float32)))
    def test_rejects_oversize(self):
        with self.assertRaisesRegex(ValueError,'invalid_audio_size'):
            decode_audio(b'x'*(20*1024*1024+1))

if __name__=='__main__': unittest.main()
