"""Regression: infeasible exact budgets must not contaminate feasible budgets."""
import unittest
import precompute_all_parameters as export


class ExactBudgetCacheTest(unittest.TestCase):
    def test_feasible_and_infeasible_budgets_in_both_orders(self):
        for order in ((3, 2), (2, 3)):
            with self.subTest(order=order):
                export.optimizer_cache.clear()
                for count in order:
                    diagnostics = {}
                    selected, status = export.optimizer(
                        {"a": ["x"], "b": ["y"]}, post_count=count,
                        factor_scores={}, demand_weights={"x": 1, "y": 1},
                        exact_post_count=True, optimization_diagnostics=diagnostics,
                    )
                    if count == 3:
                        self.assertEqual(selected, [])
                        self.assertEqual(status, "infeasible")
                        self.assertEqual(diagnostics["reason"], "candidate_count_below_required")
                    else:
                        self.assertEqual(set(selected), {"a", "b"})
                        self.assertNotEqual(status, "infeasible")


if __name__ == "__main__":
    unittest.main()
