import unittest
import torch
from tajweed_engine.model import AcousticRuleClassifier

class ModelTests(unittest.TestCase):
    def test_forward_shape(self):
        model = AcousticRuleClassifier().eval()
        with torch.inference_mode():
            output = model(torch.zeros(2, 1, 80, 100))
        self.assertEqual(tuple(output.shape), (2, 2))

    def test_rejects_wrong_feature_shape(self):
        model = AcousticRuleClassifier()
        with self.assertRaises(ValueError):
            model(torch.zeros(1, 1, 64, 100))

if __name__ == '__main__':
    unittest.main()
