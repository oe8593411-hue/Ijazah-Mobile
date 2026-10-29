import unittest

from train import metrics_from_probabilities, select_decision_threshold


class ClassifierThresholdSelectionTests(unittest.TestCase):
    def test_threshold_comes_from_validation_probabilities_and_meets_precision_target(self):
        result = select_decision_threshold(
            labels=[0, 1, 0, 1],
            probabilities=[0.2, 0.9, 0.8, 0.95],
            minimum_precision=0.9,
        )
        self.assertTrue(result["meets_minimum_precision"])
        self.assertGreaterEqual(result["metrics"]["precision"], 0.9)
        self.assertEqual(result["metrics"]["tp"], 2)
        self.assertEqual(result["metrics"]["fp"], 0)
        self.assertAlmostEqual(result["threshold"], 0.9)

    def test_unmet_precision_target_keeps_release_gate_closed(self):
        result = select_decision_threshold(
            labels=[0, 1],
            probabilities=[0.8, 0.7],
            minimum_precision=0.9,
        )
        self.assertFalse(result["meets_minimum_precision"])
        self.assertEqual(result["threshold"], 1.0)

    def test_metrics_reject_empty_or_invalid_inputs(self):
        with self.assertRaisesRegex(ValueError, "empty_or_mismatched"):
            metrics_from_probabilities([], [], 0.5)
        with self.assertRaisesRegex(ValueError, "invalid_decision_threshold"):
            metrics_from_probabilities([1], [0.8], 0)


if __name__ == "__main__":
    unittest.main()
