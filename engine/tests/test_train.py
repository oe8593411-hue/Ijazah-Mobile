import unittest

from train import metrics_from_probabilities, select_decision_threshold


class ClassifierThresholdSelectionTests(unittest.TestCase):
    def test_threshold_comes_from_validation_probabilities_and_meets_precision_target(self):
        result = select_decision_threshold(
            labels=[0, 1, 0, 1],
            probabilities=[0.2, 0.9, 0.8, 0.95],
            minimum_precision=0.9,
            minimum_positive_predictions=2,
        )
        self.assertTrue(result["meets_minimum_precision"])
        self.assertTrue(result["meets_minimum_positive_predictions"])
        self.assertEqual(result["positive_predictions"], 2)
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

    def test_high_precision_on_too_few_predictions_does_not_pass_gate(self):
        result = select_decision_threshold(
            labels=[0, 1],
            probabilities=[0.1, 0.99],
            minimum_precision=0.9,
            minimum_positive_predictions=20,
        )
        self.assertFalse(result["meets_minimum_precision"])
        self.assertFalse(result["meets_minimum_positive_predictions"])
        self.assertEqual(result["minimum_positive_predictions"], 20)

    def test_metrics_reject_empty_or_invalid_inputs(self):
        with self.assertRaisesRegex(ValueError, "empty_or_mismatched"):
            metrics_from_probabilities([], [], 0.5)
        with self.assertRaisesRegex(ValueError, "invalid_decision_threshold"):
            metrics_from_probabilities([1], [0.8], 0)


if __name__ == "__main__":
    unittest.main()


class ClassifierTemperatureScalingTests(unittest.TestCase):
    def test_temperature_fit_returns_finite_bounded_value_and_nll(self):
        from train import fit_temperature

        logits = [[0.0, 4.0], [4.0, 0.0], [0.0, 2.0], [2.0, 0.0]]
        labels = [1, 0, 0, 1]
        result = fit_temperature(labels, logits)
        self.assertTrue(result["temperature_fitted_on_validation"])
        self.assertGreaterEqual(result["temperature"], 0.05)
        self.assertLessEqual(result["temperature"], 20.0)
        self.assertLess(result["validation_nll_after"], result["validation_nll_before"])

    def test_temperature_scaling_preserves_probability_bounds(self):
        from train import probabilities_from_logits

        probabilities = probabilities_from_logits([[0.0, 4.0], [4.0, 0.0]], 2.0)
        self.assertEqual(len(probabilities), 2)
        self.assertTrue(all(0 <= p <= 1 for p in probabilities))
        self.assertGreater(probabilities[0], probabilities[1])

    def test_invalid_temperature_is_rejected(self):
        from train import probabilities_from_logits

        for temperature in (0, float("nan"), float("inf"), True):
            with self.subTest(temperature=temperature), self.assertRaises(ValueError):
                probabilities_from_logits([[0.0, 1.0]], temperature)
