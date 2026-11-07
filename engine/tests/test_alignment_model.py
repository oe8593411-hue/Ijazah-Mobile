import unittest

import torch

from tajweed_engine.alignment_model import QuranCTCAcousticModel


class QuranCTCAcousticModelTests(unittest.TestCase):
    def test_output_is_framewise_with_expected_class_count(self):
        model = QuranCTCAcousticModel(num_classes=17).eval()
        sample = torch.randn(2, 1, 80, 31)
        with torch.inference_mode():
            output = model(sample)
        self.assertEqual(tuple(output.shape), (2, 31, 17))

    def test_torchscript_export_preserves_dynamic_frame_length(self):
        model = QuranCTCAcousticModel(num_classes=9).eval()
        scripted = torch.jit.script(model)
        with torch.inference_mode():
            output = scripted(torch.randn(1, 1, 80, 45))
        self.assertEqual(tuple(output.shape), (1, 45, 9))

    def test_wrong_input_shape_is_rejected(self):
        model = QuranCTCAcousticModel(num_classes=3)
        with self.assertRaisesRegex(ValueError, "log-mel"):
            model(torch.randn(1, 1, 64, 40))


if __name__ == "__main__":
    unittest.main()
