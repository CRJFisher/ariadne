import importlib.util
import json
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "run_benchmark.py"
SPEC = importlib.util.spec_from_file_location("run_benchmark", MODULE_PATH)
assert SPEC and SPEC.loader
RUN_BENCHMARK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RUN_BENCHMARK)

ANALYZE_PATH = Path(__file__).resolve().parents[1] / "analyze_results.py"
ANALYZE_SPEC = importlib.util.spec_from_file_location("analyze_results", ANALYZE_PATH)
assert ANALYZE_SPEC and ANALYZE_SPEC.loader
ANALYZE_RESULTS = importlib.util.module_from_spec(ANALYZE_SPEC)
ANALYZE_SPEC.loader.exec_module(ANALYZE_RESULTS)


class ParseStreamJsonTests(unittest.TestCase):
    def test_last_wins_dedup_by_message_id(self) -> None:
        stream = "\n".join(
            [
                json.dumps(
                    {
                        "type": "assistant",
                        "message": {
                            "id": "msg-1",
                            "usage": {
                                "input_tokens": 10,
                                "output_tokens": 2,
                                "cache_read_input_tokens": 1,
                                "cache_creation_input_tokens": 3,
                            },
                        },
                    }
                ),
                json.dumps(
                    {
                        "type": "assistant",
                        "message": {
                            "id": "msg-1",
                            "usage": {
                                "input_tokens": 12,
                                "output_tokens": 4,
                                "cache_read_input_tokens": 5,
                                "cache_creation_input_tokens": 6,
                            },
                        },
                    }
                ),
                json.dumps(
                    {
                        "type": "assistant",
                        "message": {
                            "id": "msg-2",
                            "usage": {
                                "input_tokens": 7,
                                "output_tokens": 3,
                                "cache_read_input_tokens": 0,
                                "cache_creation_input_tokens": 1,
                            },
                        },
                    }
                ),
                json.dumps(
                    {
                        "type": "result",
                        "usage": {
                            "input_tokens": 999,
                            "output_tokens": 999,
                            "cache_read_input_tokens": 999,
                            "cache_creation_input_tokens": 999,
                        },
                        "num_turns": 99,
                    }
                ),
            ]
        )

        parsed = RUN_BENCHMARK.parse_stream_json(stream)

        self.assertEqual(parsed["input_tokens"], 19)
        self.assertEqual(parsed["output_tokens"], 7)
        self.assertEqual(parsed["cache_read_tokens"], 5)
        self.assertEqual(parsed["cache_creation_tokens"], 7)
        self.assertEqual(parsed["num_turns"], 2)

    def test_fallback_to_result_usage_when_assistant_usage_missing(self) -> None:
        stream = json.dumps(
            {
                "type": "result",
                "usage": {
                    "input_tokens": 30,
                    "output_tokens": 9,
                    "cache_read_input_tokens": 2,
                    "cache_creation_input_tokens": 4,
                },
                "num_turns": 3,
            }
        )

        parsed = RUN_BENCHMARK.parse_stream_json(stream)

        self.assertEqual(parsed["input_tokens"], 30)
        self.assertEqual(parsed["output_tokens"], 9)
        self.assertEqual(parsed["cache_read_tokens"], 2)
        self.assertEqual(parsed["cache_creation_tokens"], 4)
        self.assertEqual(parsed["num_turns"], 3)


class ScheduleTests(unittest.TestCase):
    def test_blocked_pairs_are_adjacent(self) -> None:
        tasks = [
            {
                "id": "t1",
                "repo_path": "/tmp/repo",
                "prompt": "p1",
                "benchmark": "featurebench",
                "harness": "custom",
                "evaluation_config": None,
            },
            {
                "id": "t2",
                "repo_path": "/tmp/repo",
                "prompt": "p2",
                "benchmark": "swe-bench-pro",
                "harness": "mcpbr",
                "evaluation_config": None,
            },
        ]

        schedule = RUN_BENCHMARK.build_schedule(tasks, runs_per_condition=2, seed=7)
        pair_positions: dict[str, list[int]] = {}
        pair_conditions: dict[str, set[str]] = {}
        for idx, entry in enumerate(schedule):
            pair_positions.setdefault(entry.pair_id, []).append(idx)
            pair_conditions.setdefault(entry.pair_id, set()).add(entry.condition)

        for pair_id, positions in pair_positions.items():
            self.assertEqual(len(positions), 2, pair_id)
            self.assertEqual(positions[1] - positions[0], 1, pair_id)
            self.assertEqual(pair_conditions[pair_id], {"ariadne", "baseline"}, pair_id)

    def test_schedule_is_deterministic_by_seed(self) -> None:
        tasks = [
            {
                "id": "task",
                "repo_path": "/tmp/repo",
                "prompt": "p",
                "benchmark": None,
                "harness": None,
                "evaluation_config": None,
            }
        ]

        schedule_a = RUN_BENCHMARK.build_schedule(tasks, runs_per_condition=3, seed=11)
        schedule_b = RUN_BENCHMARK.build_schedule(tasks, runs_per_condition=3, seed=11)

        key_a = [(e.pair_id, e.condition) for e in schedule_a]
        key_b = [(e.pair_id, e.condition) for e in schedule_b]
        self.assertEqual(key_a, key_b)


class GuardrailTests(unittest.TestCase):
    def test_budget_stop_rule_uses_90_percent_threshold(self) -> None:
        self.assertFalse(RUN_BENCHMARK.should_stop_for_budget(89.9, 100.0))
        self.assertTrue(RUN_BENCHMARK.should_stop_for_budget(90.0, 100.0))
        self.assertFalse(RUN_BENCHMARK.should_stop_for_budget(1000.0, None))


class AnalyzeValidationTests(unittest.TestCase):
    def test_validate_accuracy_completeness_rejects_unevaluated(self) -> None:
        with self.assertRaises(ValueError):
            ANALYZE_RESULTS.validate_accuracy_evaluation_completeness(
                [
                    {
                        "task_id": "t1",
                        "condition": "ariadne",
                        "run_number": 1,
                        "passed": None,
                        "evaluation_status": "unevaluated",
                    }
                ]
            )

    def test_aggregate_rejects_none_passed(self) -> None:
        original_np = ANALYZE_RESULTS.np
        ANALYZE_RESULTS.np = object()
        try:
            with self.assertRaises(ValueError):
                ANALYZE_RESULTS.aggregate_by_task(
                    [
                        {
                            "task_id": "t1",
                            "condition": "ariadne",
                            "passed": None,
                            "input_tokens": 1,
                            "output_tokens": 1,
                            "cache_read_tokens": 0,
                            "cache_creation_tokens": 0,
                            "total_cost_usd": 0.1,
                        }
                    ]
                )
        finally:
            ANALYZE_RESULTS.np = original_np


if __name__ == "__main__":
    unittest.main()
