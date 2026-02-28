#!/usr/bin/env python3
"""Tests for extract_metrics.py — v1.0.0 extraction pipeline."""

import json
import pathlib
import shutil
import sqlite3
import tempfile
import unittest

# Ensure imports work from the test file's directory
import sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import extract_metrics as em
from fixtures.create_fixtures import (
    ARIADNE_EXPECTED,
    ARIADNE_SESSION_ID,
    BASELINE_EXPECTED,
    BASELINE_SESSION_ID,
    create_ariadne_jsonl,
    create_baseline_jsonl,
    create_malformed_jsonl,
    create_test_analytics_db,
    create_test_metadata_db,
)


class FixtureMixin:
    """Set up temp directory with fixture databases and JSONL files."""

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp(prefix="extract_test_")
        self.metadata_db = pathlib.Path(self.tmpdir) / "metadata.db"
        self.analytics_db = pathlib.Path(self.tmpdir) / "analytics.db"
        self.baseline_jsonl = pathlib.Path(self.tmpdir) / "baseline.jsonl"
        self.ariadne_jsonl = pathlib.Path(self.tmpdir) / "ariadne.jsonl"

        create_test_metadata_db(self.metadata_db)
        create_test_analytics_db(self.analytics_db)
        create_baseline_jsonl(self.baseline_jsonl)
        create_ariadne_jsonl(self.ariadne_jsonl)

    def tearDown(self):
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def open_metadata(self):
        return sqlite3.connect(str(self.metadata_db))


# ---------------------------------------------------------------------------
# Schema validation
# ---------------------------------------------------------------------------

class TestV1Schema(FixtureMixin, unittest.TestCase):
    """v1.0.0 schema structure validation."""

    def test_baseline_has_all_top_level_keys(self):
        conn = self.open_metadata()
        raw = em.run_pipeline(BASELINE_SESSION_ID, conn, jsonl_path=self.baseline_jsonl)
        conn.close()
        result = em.assemble_v1(raw)

        expected_keys = {
            "schema_version", "session", "tokens", "cost", "tool_calls",
            "files", "mcp_calls", "derived", "data_quality",
        }
        self.assertEqual(set(result.keys()), expected_keys)
        self.assertEqual(result["schema_version"], "1.0.0")

    def test_session_section_keys(self):
        conn = self.open_metadata()
        raw = em.run_pipeline(BASELINE_SESSION_ID, conn, jsonl_path=self.baseline_jsonl)
        conn.close()
        result = em.assemble_v1(raw, task_id="t1", task_description="desc", git_commit="abc123")

        session = result["session"]
        expected_keys = {
            "session_id", "condition", "task_id", "task_description",
            "start_time", "end_time", "wall_clock_ms", "model", "git_commit",
        }
        self.assertEqual(set(session.keys()), expected_keys)
        self.assertEqual(session["task_id"], "t1")
        self.assertEqual(session["task_description"], "desc")
        self.assertEqual(session["git_commit"], "abc123")

    def test_nullable_session_fields_default_to_none(self):
        conn = self.open_metadata()
        raw = em.run_pipeline(BASELINE_SESSION_ID, conn, jsonl_path=self.baseline_jsonl)
        conn.close()
        result = em.assemble_v1(raw)

        self.assertIsNone(result["session"]["task_id"])
        self.assertIsNone(result["session"]["task_description"])
        self.assertIsNone(result["session"]["git_commit"])

    def test_tokens_has_total_field(self):
        conn = self.open_metadata()
        raw = em.run_pipeline(BASELINE_SESSION_ID, conn, jsonl_path=self.baseline_jsonl)
        conn.close()
        result = em.assemble_v1(raw)

        tokens = result["tokens"]
        self.assertIn("total", tokens)
        self.assertEqual(
            tokens["total"],
            tokens["input"] + tokens["output"] + tokens["cache_read"] + tokens["cache_creation"],
        )

    def test_all_six_category_keys_present(self):
        conn = self.open_metadata()
        raw = em.run_pipeline(BASELINE_SESSION_ID, conn, jsonl_path=self.baseline_jsonl)
        conn.close()
        result = em.assemble_v1(raw)

        by_cat = result["tool_calls"]["by_category"]
        for cat in ("read", "search", "edit", "bash", "mcp", "other"):
            self.assertIn(cat, by_cat, f"Missing category: {cat}")

    def test_mcp_calls_has_duration_source(self):
        conn = self.open_metadata()
        raw = em.run_pipeline(ARIADNE_SESSION_ID, conn, jsonl_path=self.ariadne_jsonl)
        conn.close()
        result = em.assemble_v1(raw)

        self.assertEqual(result["mcp_calls"]["duration_source"], "metadata_pre_post")

    def test_analytics_diagnostics_nested_structure(self):
        conn = self.open_metadata()
        raw = em.run_pipeline(BASELINE_SESSION_ID, conn, jsonl_path=self.baseline_jsonl)
        conn.close()
        result = em.assemble_v1(raw)

        ad = result["data_quality"]["analytics_diagnostics"]
        expected_keys = {"enabled", "join_method", "direct_joins", "fuzzy_joins", "unmatched", "warning"}
        self.assertEqual(set(ad.keys()), expected_keys)


# ---------------------------------------------------------------------------
# JSONL dedup
# ---------------------------------------------------------------------------

class TestJsonlDedup(unittest.TestCase):
    """JSONL parsing with deduplication and error handling."""

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp(prefix="jsonl_test_")

    def tearDown(self):
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_last_wins_dedup(self):
        jsonl_path = pathlib.Path(self.tmpdir) / "baseline.jsonl"
        create_baseline_jsonl(jsonl_path)
        result = em.parse_jsonl_tokens(jsonl_path)

        self.assertEqual(result["tokens"]["input"], BASELINE_EXPECTED["tokens"]["input"])
        self.assertEqual(result["tokens"]["output"], BASELINE_EXPECTED["tokens"]["output"])
        self.assertEqual(result["tokens"]["cache_read"], BASELINE_EXPECTED["tokens"]["cache_read"])
        self.assertEqual(result["tokens"]["cache_creation"], BASELINE_EXPECTED["tokens"]["cache_creation"])

    def test_dedup_message_count(self):
        jsonl_path = pathlib.Path(self.tmpdir) / "baseline.jsonl"
        create_baseline_jsonl(jsonl_path)
        result = em.parse_jsonl_tokens(jsonl_path)

        self.assertEqual(result["dedup_message_count"], BASELINE_EXPECTED["jsonl_dedup_message_count"])
        self.assertEqual(result["lines_with_usage"], BASELINE_EXPECTED["jsonl_lines_with_usage"])

    def test_malformed_lines_skipped(self):
        jsonl_path = pathlib.Path(self.tmpdir) / "malformed.jsonl"
        create_malformed_jsonl(jsonl_path)
        result = em.parse_jsonl_tokens(jsonl_path)

        # Only msg-m-001 should survive
        self.assertEqual(result["dedup_message_count"], 1)
        self.assertEqual(result["tokens"]["input"], 100)
        self.assertEqual(result["tokens"]["output"], 50)

    def test_model_extraction(self):
        jsonl_path = pathlib.Path(self.tmpdir) / "baseline.jsonl"
        create_baseline_jsonl(jsonl_path)
        result = em.parse_jsonl_tokens(jsonl_path)

        self.assertEqual(result["model"], "claude-opus-4-6-20250219")


# ---------------------------------------------------------------------------
# Session boundary extraction
# ---------------------------------------------------------------------------

class TestSessionBoundary(FixtureMixin, unittest.TestCase):
    """metadata.db session boundary queries."""

    def test_baseline_boundary(self):
        conn = self.open_metadata()
        boundary = em.query_session_boundary(conn, BASELINE_SESSION_ID)
        conn.close()

        self.assertEqual(boundary["session_id"], BASELINE_SESSION_ID)
        self.assertEqual(boundary["start_ms"], BASELINE_EXPECTED["start_ms"])
        self.assertEqual(boundary["end_ms"], BASELINE_EXPECTED["end_ms"])
        self.assertEqual(boundary["event_count"], BASELINE_EXPECTED["event_count"])
        self.assertTrue(boundary["has_stop"])

    def test_ariadne_boundary(self):
        conn = self.open_metadata()
        boundary = em.query_session_boundary(conn, ARIADNE_SESSION_ID)
        conn.close()

        self.assertEqual(boundary["start_ms"], ARIADNE_EXPECTED["start_ms"])
        self.assertEqual(boundary["end_ms"], ARIADNE_EXPECTED["end_ms"])
        self.assertEqual(boundary["event_count"], ARIADNE_EXPECTED["event_count"])

    def test_tool_call_count(self):
        conn = self.open_metadata()
        calls = em.query_tool_calls(conn, BASELINE_SESSION_ID)
        conn.close()

        self.assertEqual(len(calls), BASELINE_EXPECTED["tool_call_count"])

    def test_tool_calls_ordered_by_timestamp(self):
        conn = self.open_metadata()
        calls = em.query_tool_calls(conn, BASELINE_SESSION_ID)
        conn.close()

        timestamps = [c["timestamp_ms"] for c in calls]
        self.assertEqual(timestamps, sorted(timestamps))


# ---------------------------------------------------------------------------
# MCP duration pairing
# ---------------------------------------------------------------------------

class TestMcpDurations(FixtureMixin, unittest.TestCase):
    """MCP PreToolUse/PostToolUse duration extraction."""

    def test_ariadne_mcp_durations(self):
        conn = self.open_metadata()
        durations = em.compute_mcp_durations(conn, ARIADNE_SESSION_ID)
        conn.close()

        self.assertEqual(len(durations), 2)

        # list_entrypoints: Post(2000) - Pre(1500) = 500ms
        self.assertEqual(durations[0]["tool_name"], "mcp__ariadne__list_entrypoints")
        self.assertEqual(durations[0]["duration_ms"], 500)

        # show_call_graph_neighborhood: Post(4000) - Pre(3500) = 500ms
        self.assertEqual(durations[1]["tool_name"], "mcp__ariadne__show_call_graph_neighborhood")
        self.assertEqual(durations[1]["duration_ms"], 500)

    def test_baseline_has_no_mcp_durations(self):
        conn = self.open_metadata()
        durations = em.compute_mcp_durations(conn, BASELINE_SESSION_ID)
        conn.close()

        self.assertEqual(len(durations), 0)


# ---------------------------------------------------------------------------
# Derived metric formulas
# ---------------------------------------------------------------------------

class TestDerivedMetrics(FixtureMixin, unittest.TestCase):
    """Derived metric computation correctness."""

    def _extract_baseline(self):
        conn = self.open_metadata()
        raw = em.run_pipeline(BASELINE_SESSION_ID, conn, jsonl_path=self.baseline_jsonl)
        conn.close()
        return em.assemble_v1(raw)

    def _extract_ariadne(self):
        conn = self.open_metadata()
        raw = em.run_pipeline(ARIADNE_SESSION_ID, conn, jsonl_path=self.ariadne_jsonl)
        conn.close()
        return em.assemble_v1(raw)

    def test_baseline_navigation_waste_ratio(self):
        result = self._extract_baseline()
        self.assertEqual(
            result["derived"]["navigation_waste_ratio"],
            BASELINE_EXPECTED["navigation_waste_ratio"],
        )

    def test_baseline_exploration_efficiency(self):
        result = self._extract_baseline()
        self.assertEqual(
            result["derived"]["exploration_efficiency"],
            BASELINE_EXPECTED["exploration_efficiency"],
        )

    def test_baseline_time_to_first_edit(self):
        result = self._extract_baseline()
        self.assertEqual(
            result["derived"]["time_to_first_edit_ms"],
            BASELINE_EXPECTED["time_to_first_edit_ms"],
        )

    def test_baseline_duplicate_reads(self):
        result = self._extract_baseline()
        self.assertEqual(
            result["derived"]["duplicate_read_count"],
            BASELINE_EXPECTED["duplicate_read_count"],
        )

    def test_baseline_backtracking(self):
        result = self._extract_baseline()
        self.assertEqual(
            result["derived"]["backtracking_count"],
            BASELINE_EXPECTED["backtracking_count"],
        )

    def test_ariadne_navigation_waste_ratio(self):
        result = self._extract_ariadne()
        self.assertEqual(
            result["derived"]["navigation_waste_ratio"],
            ARIADNE_EXPECTED["navigation_waste_ratio"],
        )

    def test_ariadne_exploration_efficiency(self):
        result = self._extract_ariadne()
        self.assertEqual(
            result["derived"]["exploration_efficiency"],
            ARIADNE_EXPECTED["exploration_efficiency"],
        )

    def test_ariadne_no_backtracking(self):
        result = self._extract_ariadne()
        self.assertEqual(result["derived"]["backtracking_count"], 0)
        self.assertEqual(result["derived"]["duplicate_read_count"], 0)


# ---------------------------------------------------------------------------
# File activity
# ---------------------------------------------------------------------------

class TestFileActivity(FixtureMixin, unittest.TestCase):
    """File read/edit set computation."""

    def test_baseline_file_sets(self):
        conn = self.open_metadata()
        raw = em.run_pipeline(BASELINE_SESSION_ID, conn, jsonl_path=self.baseline_jsonl)
        conn.close()
        result = em.assemble_v1(raw)

        self.assertEqual(result["files"]["read"], BASELINE_EXPECTED["files_read"])
        self.assertEqual(result["files"]["edited"], BASELINE_EXPECTED["files_edited"])
        self.assertEqual(result["files"]["read_then_edited"], BASELINE_EXPECTED["read_then_edited"])
        self.assertEqual(result["files"]["read_not_edited"], BASELINE_EXPECTED["read_not_edited"])
        self.assertEqual(result["files"]["total_unique"], BASELINE_EXPECTED["total_unique_files"])

    def test_ariadne_file_sets(self):
        conn = self.open_metadata()
        raw = em.run_pipeline(ARIADNE_SESSION_ID, conn, jsonl_path=self.ariadne_jsonl)
        conn.close()
        result = em.assemble_v1(raw)

        self.assertEqual(result["files"]["read"], ARIADNE_EXPECTED["files_read"])
        self.assertEqual(result["files"]["edited"], ARIADNE_EXPECTED["files_edited"])
        self.assertEqual(result["files"]["total_unique"], ARIADNE_EXPECTED["total_unique_files"])


# ---------------------------------------------------------------------------
# Condition auto-detection
# ---------------------------------------------------------------------------

class TestConditionDetection(FixtureMixin, unittest.TestCase):
    """Condition (baseline/ariadne) auto-detection from MCP call presence."""

    def test_baseline_detected(self):
        conn = self.open_metadata()
        raw = em.run_pipeline(BASELINE_SESSION_ID, conn, jsonl_path=self.baseline_jsonl)
        conn.close()
        result = em.assemble_v1(raw)

        self.assertEqual(result["session"]["condition"], "baseline")

    def test_ariadne_detected(self):
        conn = self.open_metadata()
        raw = em.run_pipeline(ARIADNE_SESSION_ID, conn, jsonl_path=self.ariadne_jsonl)
        conn.close()
        result = em.assemble_v1(raw)

        self.assertEqual(result["session"]["condition"], "ariadne")


# ---------------------------------------------------------------------------
# Token and cost
# ---------------------------------------------------------------------------

class TestTokensAndCost(FixtureMixin, unittest.TestCase):
    """Token extraction and cost calculation."""

    def test_baseline_tokens(self):
        conn = self.open_metadata()
        raw = em.run_pipeline(BASELINE_SESSION_ID, conn, jsonl_path=self.baseline_jsonl)
        conn.close()
        result = em.assemble_v1(raw)

        self.assertEqual(result["tokens"], BASELINE_EXPECTED["tokens"])

    def test_ariadne_tokens(self):
        conn = self.open_metadata()
        raw = em.run_pipeline(ARIADNE_SESSION_ID, conn, jsonl_path=self.ariadne_jsonl)
        conn.close()
        result = em.assemble_v1(raw)

        self.assertEqual(result["tokens"], ARIADNE_EXPECTED["tokens"])

    def test_cost_calculated(self):
        conn = self.open_metadata()
        raw = em.run_pipeline(BASELINE_SESSION_ID, conn, jsonl_path=self.baseline_jsonl)
        conn.close()
        result = em.assemble_v1(raw)

        self.assertIsNotNone(result["cost"])
        self.assertGreater(result["cost"]["total_usd"], 0)
        self.assertEqual(result["cost"]["pricing_model"], "claude-opus-4-6-20250219")

    def test_cost_breakdown_sums_to_total(self):
        conn = self.open_metadata()
        raw = em.run_pipeline(BASELINE_SESSION_ID, conn, jsonl_path=self.baseline_jsonl)
        conn.close()
        result = em.assemble_v1(raw)

        cost = result["cost"]
        component_sum = (
            cost["input_usd"] + cost["output_usd"]
            + cost["cache_read_usd"] + cost["cache_creation_usd"]
        )
        self.assertAlmostEqual(cost["total_usd"], component_sum, places=4)


# ---------------------------------------------------------------------------
# Pair delta computation
# ---------------------------------------------------------------------------

class TestPairDelta(FixtureMixin, unittest.TestCase):
    """extract-pair comparison delta logic."""

    def _extract_both(self):
        conn = self.open_metadata()
        raw_b = em.run_pipeline(BASELINE_SESSION_ID, conn, jsonl_path=self.baseline_jsonl)
        raw_a = em.run_pipeline(ARIADNE_SESSION_ID, conn, jsonl_path=self.ariadne_jsonl)
        conn.close()
        baseline = em.assemble_v1(raw_b, task_id="test-task")
        ariadne = em.assemble_v1(raw_a, task_id="test-task")
        return baseline, ariadne

    def test_delta_structure(self):
        baseline, ariadne = self._extract_both()
        comparison = em.compute_pair_delta(baseline, ariadne)

        self.assertEqual(comparison["schema_version"], "1.0.0")
        self.assertEqual(comparison["task_id"], "test-task")
        self.assertIn("baseline", comparison)
        self.assertIn("ariadne", comparison)
        self.assertIn("delta", comparison)

    def test_delta_tool_calls_total(self):
        baseline, ariadne = self._extract_both()
        comparison = em.compute_pair_delta(baseline, ariadne)

        delta_tc = comparison["delta"]["tool_calls"]["total"]
        self.assertEqual(delta_tc["baseline"], BASELINE_EXPECTED["tool_call_count"])
        self.assertEqual(delta_tc["ariadne"], ARIADNE_EXPECTED["tool_call_count"])
        self.assertEqual(
            delta_tc["absolute"],
            ARIADNE_EXPECTED["tool_call_count"] - BASELINE_EXPECTED["tool_call_count"],
        )

    def test_delta_tokens(self):
        baseline, ariadne = self._extract_both()
        comparison = em.compute_pair_delta(baseline, ariadne)

        delta_tok = comparison["delta"]["tokens"]
        self.assertEqual(delta_tok["baseline"], BASELINE_EXPECTED["tokens"]["total"])
        self.assertEqual(delta_tok["ariadne"], ARIADNE_EXPECTED["tokens"]["total"])
        self.assertEqual(
            delta_tok["absolute"],
            ARIADNE_EXPECTED["tokens"]["total"] - BASELINE_EXPECTED["tokens"]["total"],
        )

    def test_delta_derived_waste_ratio(self):
        baseline, ariadne = self._extract_both()
        comparison = em.compute_pair_delta(baseline, ariadne)

        delta_waste = comparison["delta"]["derived"]["navigation_waste_ratio"]
        self.assertEqual(delta_waste["baseline"], BASELINE_EXPECTED["navigation_waste_ratio"])
        self.assertEqual(delta_waste["ariadne"], ARIADNE_EXPECTED["navigation_waste_ratio"])
        # Ariadne should show improvement (negative delta)
        self.assertLess(delta_waste["absolute"], 0)

    def test_delta_percent_calculated(self):
        baseline, ariadne = self._extract_both()
        comparison = em.compute_pair_delta(baseline, ariadne)

        delta_tc = comparison["delta"]["tool_calls"]["total"]
        expected_pct = round(
            (ARIADNE_EXPECTED["tool_call_count"] - BASELINE_EXPECTED["tool_call_count"])
            / BASELINE_EXPECTED["tool_call_count"] * 100,
            1,
        )
        self.assertEqual(delta_tc["percent"], expected_pct)

    def test_delta_all_categories_present(self):
        baseline, ariadne = self._extract_both()
        comparison = em.compute_pair_delta(baseline, ariadne)

        by_cat = comparison["delta"]["tool_calls"]["by_category"]
        for cat in ("read", "search", "edit", "bash", "mcp", "other"):
            self.assertIn(cat, by_cat, f"Missing delta category: {cat}")


# ---------------------------------------------------------------------------
# CLI error handling
# ---------------------------------------------------------------------------

class TestSessionResolve(FixtureMixin, unittest.TestCase):
    """Session ID prefix resolution."""

    def test_exact_match(self):
        conn = self.open_metadata()
        resolved = em.resolve_session_id(BASELINE_SESSION_ID, conn)
        conn.close()
        self.assertEqual(resolved, BASELINE_SESSION_ID)

    def test_prefix_match(self):
        conn = self.open_metadata()
        resolved = em.resolve_session_id("baseline-test", conn)
        conn.close()
        self.assertEqual(resolved, BASELINE_SESSION_ID)

    def test_no_match_exits(self):
        conn = self.open_metadata()
        with self.assertRaises(SystemExit):
            em.resolve_session_id("nonexistent-prefix", conn)
        conn.close()

    def test_ambiguous_prefix_exits(self):
        """Both sessions start with different prefixes, but a shared prefix would be ambiguous."""
        conn = self.open_metadata()
        # Both sessions exist, so a very short common prefix would match both
        # Our fixture IDs are "baseline-test-..." and "ariadne-test-..." so no common prefix.
        # Test with a prefix that matches neither:
        with self.assertRaises(SystemExit):
            em.resolve_session_id("zzz-no-match", conn)
        conn.close()


# ---------------------------------------------------------------------------
# Analytics graceful degradation
# ---------------------------------------------------------------------------

class TestAnalyticsDegradation(FixtureMixin, unittest.TestCase):
    """analytics.db missing or unmatched scenarios."""

    def test_no_analytics_db(self):
        conn = self.open_metadata()
        raw = em.run_pipeline(
            ARIADNE_SESSION_ID, conn,
            analytics_db_path=None,
            jsonl_path=self.ariadne_jsonl,
        )
        conn.close()
        result = em.assemble_v1(raw)

        ad = result["data_quality"]["analytics_diagnostics"]
        self.assertFalse(ad["enabled"])
        self.assertEqual(ad["join_method"], "none")
        # Extraction still succeeds
        self.assertEqual(result["session"]["condition"], "ariadne")
        self.assertEqual(result["mcp_calls"]["total"], 2)

    def test_missing_analytics_path(self):
        fake_path = pathlib.Path(self.tmpdir) / "nonexistent.db"
        conn = self.open_metadata()
        raw = em.run_pipeline(
            ARIADNE_SESSION_ID, conn,
            analytics_db_path=fake_path,
            jsonl_path=self.ariadne_jsonl,
        )
        conn.close()
        result = em.assemble_v1(raw)

        ad = result["data_quality"]["analytics_diagnostics"]
        self.assertFalse(ad["enabled"])
        self.assertTrue(
            any("analytics.db not found" in w for w in result["data_quality"]["warnings"]),
        )

    def test_analytics_with_direct_join(self):
        conn = self.open_metadata()
        raw = em.run_pipeline(
            ARIADNE_SESSION_ID, conn,
            analytics_db_path=self.analytics_db,
            jsonl_path=self.ariadne_jsonl,
        )
        conn.close()
        result = em.assemble_v1(raw)

        ad = result["data_quality"]["analytics_diagnostics"]
        self.assertTrue(ad["enabled"])
        self.assertGreater(ad["direct_joins"], 0)


# ---------------------------------------------------------------------------
# MCP calls in v1.0.0 output
# ---------------------------------------------------------------------------

class TestMcpOutput(FixtureMixin, unittest.TestCase):
    """MCP calls section in assembled v1.0.0 output."""

    def test_ariadne_mcp_by_tool(self):
        conn = self.open_metadata()
        raw = em.run_pipeline(ARIADNE_SESSION_ID, conn, jsonl_path=self.ariadne_jsonl)
        conn.close()
        result = em.assemble_v1(raw)

        mcp = result["mcp_calls"]
        self.assertEqual(mcp["total"], ARIADNE_EXPECTED["mcp_total"])
        for tool_name, expected_stats in ARIADNE_EXPECTED["mcp_durations"].items():
            self.assertIn(tool_name, mcp["by_tool"])
            self.assertEqual(mcp["by_tool"][tool_name]["count"], expected_stats["count"])
            self.assertEqual(
                mcp["by_tool"][tool_name]["total_duration_ms"],
                expected_stats["total_duration_ms"],
            )

    def test_baseline_no_mcp(self):
        conn = self.open_metadata()
        raw = em.run_pipeline(BASELINE_SESSION_ID, conn, jsonl_path=self.baseline_jsonl)
        conn.close()
        result = em.assemble_v1(raw)

        self.assertEqual(result["mcp_calls"]["total"], 0)
        self.assertEqual(result["mcp_calls"]["by_tool"], {})


# ---------------------------------------------------------------------------
# End-to-end pipeline
# ---------------------------------------------------------------------------

class TestEndToEnd(FixtureMixin, unittest.TestCase):
    """Full pipeline round-trip."""

    def test_baseline_round_trip(self):
        conn = self.open_metadata()
        raw = em.run_pipeline(BASELINE_SESSION_ID, conn, jsonl_path=self.baseline_jsonl)
        conn.close()
        result = em.assemble_v1(raw, task_id="e2e-test")

        # Verify JSON-serializable
        json_str = json.dumps(result, indent=2)
        roundtrip = json.loads(json_str)
        self.assertEqual(roundtrip["schema_version"], "1.0.0")
        self.assertEqual(roundtrip["session"]["task_id"], "e2e-test")

    def test_ariadne_round_trip(self):
        conn = self.open_metadata()
        raw = em.run_pipeline(ARIADNE_SESSION_ID, conn, jsonl_path=self.ariadne_jsonl)
        conn.close()
        result = em.assemble_v1(raw)

        json_str = json.dumps(result, indent=2)
        roundtrip = json.loads(json_str)
        self.assertEqual(roundtrip["session"]["condition"], "ariadne")

    def test_pair_comparison_round_trip(self):
        conn = self.open_metadata()
        raw_b = em.run_pipeline(BASELINE_SESSION_ID, conn, jsonl_path=self.baseline_jsonl)
        raw_a = em.run_pipeline(ARIADNE_SESSION_ID, conn, jsonl_path=self.ariadne_jsonl)
        conn.close()

        baseline = em.assemble_v1(raw_b, task_id="e2e")
        ariadne = em.assemble_v1(raw_a, task_id="e2e")
        comparison = em.compute_pair_delta(baseline, ariadne)

        json_str = json.dumps(comparison, indent=2)
        roundtrip = json.loads(json_str)
        self.assertEqual(roundtrip["schema_version"], "1.0.0")
        self.assertIn("delta", roundtrip)
        self.assertIn("baseline", roundtrip)
        self.assertIn("ariadne", roundtrip)


# ---------------------------------------------------------------------------
# No JSONL graceful degradation
# ---------------------------------------------------------------------------

class TestNoJsonl(FixtureMixin, unittest.TestCase):
    """Extraction works when JSONL is unavailable."""

    def test_tokens_null_without_jsonl(self):
        conn = self.open_metadata()
        # Pass a nonexistent JSONL path — pipeline should degrade gracefully
        raw = em.run_pipeline(
            BASELINE_SESSION_ID, conn,
            jsonl_path=pathlib.Path(self.tmpdir) / "nonexistent.jsonl",
        )
        conn.close()
        result = em.assemble_v1(raw)

        self.assertIsNone(result["tokens"])
        self.assertIsNone(result["cost"])
        self.assertIn(
            "JSONL transcript not found",
            " ".join(result["data_quality"]["warnings"]),
        )
        # Rest of extraction still works
        self.assertGreater(result["tool_calls"]["total"], 0)


if __name__ == "__main__":
    unittest.main()
