#!/usr/bin/env python3
"""
Generate deterministic test fixtures for extract_metrics_test.py.

Creates sqlite3 databases and JSONL files with known data so tests
can verify extraction logic without live session dependencies.

Fixture sessions:
  baseline-test-session-001  -- No MCP calls, has backtracking
  ariadne-test-session-002   -- MCP calls, efficient navigation
"""

import json
import pathlib
import sqlite3

# ---------------------------------------------------------------------------
# Constants (importable by tests)
# ---------------------------------------------------------------------------

BASELINE_SESSION_ID = "baseline-test-session-001"
ARIADNE_SESSION_ID = "ariadne-test-session-002"

METADATA_SCHEMA = """
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    timestamp_unix_ms INTEGER,
    hook_event TEXT,
    tool_name TEXT,
    tool_use_id TEXT,
    tool_input_json TEXT,
    file_path TEXT,
    project_dir TEXT,
    transcript_path TEXT
);
"""

ANALYTICS_SCHEMA = """
CREATE TABLE IF NOT EXISTS tool_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tool_use_id TEXT,
    tool_name TEXT,
    called_at TEXT,
    duration_ms INTEGER,
    success INTEGER
);
"""


def create_test_metadata_db(db_path):
    """Create metadata.db with both baseline and ariadne sessions."""
    conn = sqlite3.connect(str(db_path))
    conn.executescript(METADATA_SCHEMA)

    project_dir = "/test/project"

    # --- Baseline session ---
    baseline_events = [
        # (timestamp_ms, hook_event, tool_name, tool_use_id, tool_input_json, file_path)
        (1000, "Start", None, None, None, None),
        (2000, "PostToolUse", "Read", "tu-b-001", '{"file_path": "src/a.ts"}', "src/a.ts"),
        (3000, "PostToolUse", "Read", "tu-b-002", '{"file_path": "src/b.ts"}', "src/b.ts"),
        (4000, "PostToolUse", "Grep", "tu-b-003", '{"path": "src/", "pattern": "foo"}', None),
        (5000, "PostToolUse", "Read", "tu-b-004", '{"file_path": "src/c.ts"}', "src/c.ts"),
        (6000, "PostToolUse", "Read", "tu-b-005", '{"file_path": "src/a.ts"}', "src/a.ts"),
        (7000, "PostToolUse", "Edit", "tu-b-006", '{"file_path": "src/a.ts"}', "src/a.ts"),
        (8000, "PostToolUse", "Read", "tu-b-007", '{"file_path": "src/d.ts"}', "src/d.ts"),
        (9000, "PostToolUse", "Edit", "tu-b-008", '{"file_path": "src/b.ts"}', "src/b.ts"),
        (10000, "PostToolUse", "Bash", "tu-b-009", '{"command": "npm test"}', None),
        (11000, "PostToolUse", "Read", "tu-b-010", '{"file_path": "src/e.ts"}', "src/e.ts"),
        (12000, "PostToolUse", "Glob", "tu-b-011", '{"path": "src/", "pattern": "*.ts"}', None),
        (13000, "Stop", None, None, None, None),
    ]

    for ts, hook, tool, tuid, tinput, fpath in baseline_events:
        conn.execute(
            "INSERT INTO events (session_id, timestamp_unix_ms, hook_event, "
            "tool_name, tool_use_id, tool_input_json, file_path, project_dir) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (BASELINE_SESSION_ID, ts, hook, tool, tuid, tinput, fpath, project_dir),
        )

    # --- Ariadne session ---
    ariadne_events = [
        (1000, "Start", None, None, None, None),
        (1500, "PreToolUse", "mcp__ariadne__list_entrypoints", "tu-a-001", None, None),
        (2000, "PostToolUse", "mcp__ariadne__list_entrypoints", "tu-a-001",
         '{"folders": ["src/"]}', None),
        (3000, "PostToolUse", "Read", "tu-a-002", '{"file_path": "src/a.ts"}', "src/a.ts"),
        (3500, "PreToolUse", "mcp__ariadne__show_call_graph_neighborhood", "tu-a-003",
         None, None),
        (4000, "PostToolUse", "mcp__ariadne__show_call_graph_neighborhood", "tu-a-003",
         '{"symbol_ref": "src/a.ts:10#main"}', None),
        (5000, "PostToolUse", "Read", "tu-a-004", '{"file_path": "src/b.ts"}', "src/b.ts"),
        (6000, "PostToolUse", "Edit", "tu-a-005", '{"file_path": "src/a.ts"}', "src/a.ts"),
        (7000, "PostToolUse", "Edit", "tu-a-006", '{"file_path": "src/b.ts"}', "src/b.ts"),
        (8000, "PostToolUse", "Read", "tu-a-007", '{"file_path": "src/c.ts"}', "src/c.ts"),
        (9000, "PostToolUse", "Bash", "tu-a-008", '{"command": "npm test"}', None),
        (10000, "Stop", None, None, None, None),
    ]

    for ts, hook, tool, tuid, tinput, fpath in ariadne_events:
        conn.execute(
            "INSERT INTO events (session_id, timestamp_unix_ms, hook_event, "
            "tool_name, tool_use_id, tool_input_json, file_path, project_dir) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (ARIADNE_SESSION_ID, ts, hook, tool, tuid, tinput, fpath, project_dir),
        )

    conn.commit()
    conn.close()


def create_test_analytics_db(db_path):
    """Create analytics.db with MCP tool call records for the ariadne session."""
    conn = sqlite3.connect(str(db_path))
    conn.executescript(ANALYTICS_SCHEMA)

    # Direct match by tool_use_id for one call
    conn.execute(
        "INSERT INTO tool_calls (tool_use_id, tool_name, called_at, duration_ms, success) "
        "VALUES (?, ?, ?, ?, ?)",
        ("tu-a-001", "list_entrypoints", "2000-01-01T00:00:02Z", 480, 1),
    )

    # Fuzzy-only candidate (no tool_use_id)
    conn.execute(
        "INSERT INTO tool_calls (tool_use_id, tool_name, called_at, duration_ms, success) "
        "VALUES (?, ?, ?, ?, ?)",
        (None, "show_call_graph_neighborhood", "2000-01-01T00:00:04Z", 490, 1),
    )

    conn.commit()
    conn.close()


def _make_jsonl_message(msg_id, model, input_tok, output_tok, cache_read, cache_creation):
    return json.dumps({
        "message": {
            "id": msg_id,
            "model": model,
            "usage": {
                "input_tokens": input_tok,
                "output_tokens": output_tok,
                "cache_read_input_tokens": cache_read,
                "cache_creation_input_tokens": cache_creation,
            },
        }
    })


MODEL = "claude-opus-4-6-20250219"


def create_baseline_jsonl(jsonl_path):
    """Baseline JSONL with duplicate message IDs (last-wins dedup scenario).

    msg-b-001 appears twice: first with lower tokens, then higher (last wins).
    msg-b-002 appears once.

    After dedup:
      input=5000, output=1000, cache_read=2500, cache_creation=500
      total=9000
    """
    lines = [
        _make_jsonl_message("msg-b-001", MODEL, 1000, 200, 500, 100),
        _make_jsonl_message("msg-b-001", MODEL, 2000, 400, 1000, 200),
        _make_jsonl_message("msg-b-002", MODEL, 3000, 600, 1500, 300),
    ]
    pathlib.Path(jsonl_path).write_text("\n".join(lines) + "\n")


def create_ariadne_jsonl(jsonl_path):
    """Ariadne JSONL with no duplicates.

    After dedup:
      input=2300, output=550, cache_read=1000, cache_creation=200
      total=4050
    """
    lines = [
        _make_jsonl_message("msg-a-001", MODEL, 800, 150, 400, 80),
        _make_jsonl_message("msg-a-002", MODEL, 1500, 400, 600, 120),
    ]
    pathlib.Path(jsonl_path).write_text("\n".join(lines) + "\n")


def create_malformed_jsonl(jsonl_path):
    """JSONL with malformed lines, empty lines, and records without message key.

    Only msg-m-001 should survive extraction.
    After dedup: input=100, output=50, cache_read=25, cache_creation=10
    """
    lines = [
        _make_jsonl_message("msg-m-001", MODEL, 100, 50, 25, 10),
        "{this is not valid json}",
        "",
        '{"no_message_key": true}',
        '{"message": {"no_id_field": true}}',
    ]
    pathlib.Path(jsonl_path).write_text("\n".join(lines) + "\n")


# ---------------------------------------------------------------------------
# Expected values for test assertions
# ---------------------------------------------------------------------------

BASELINE_EXPECTED = {
    "event_count": 13,
    "tool_call_count": 11,
    "has_stop": True,
    "start_ms": 1000,
    "end_ms": 13000,
    "wall_clock_ms": 12000,
    "condition": "baseline",
    "by_category": {"read": 5, "search": 2, "edit": 2, "bash": 1, "mcp": 0, "other": 0},
    "files_read": ["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts", "src/e.ts"],
    "files_edited": ["src/a.ts", "src/b.ts"],
    "read_then_edited": ["src/a.ts", "src/b.ts"],
    "read_not_edited": ["src/c.ts", "src/d.ts", "src/e.ts"],
    "total_unique_files": 5,
    "navigation_waste_ratio": 0.6,
    "exploration_efficiency": 0.4,
    "time_to_first_edit_ms": 6000,
    "duplicate_read_count": 1,
    "backtracking_count": 1,
    "tokens": {"input": 5000, "output": 1000, "cache_read": 2500, "cache_creation": 500, "total": 9000},
    "jsonl_raw_line_count": 4,
    "jsonl_lines_with_usage": 3,
    "jsonl_dedup_message_count": 2,
}

ARIADNE_EXPECTED = {
    "event_count": 12,
    "tool_call_count": 8,
    "has_stop": True,
    "start_ms": 1000,
    "end_ms": 10000,
    "wall_clock_ms": 9000,
    "condition": "ariadne",
    "by_category": {"read": 3, "search": 0, "edit": 2, "bash": 1, "mcp": 2, "other": 0},
    "files_read": ["src/a.ts", "src/b.ts", "src/c.ts"],
    "files_edited": ["src/a.ts", "src/b.ts"],
    "read_then_edited": ["src/a.ts", "src/b.ts"],
    "read_not_edited": ["src/c.ts"],
    "total_unique_files": 3,
    "navigation_waste_ratio": 0.3333,
    "exploration_efficiency": 0.6667,
    "time_to_first_edit_ms": 5000,
    "duplicate_read_count": 0,
    "backtracking_count": 0,
    "mcp_total": 2,
    "mcp_durations": {
        "list_entrypoints": {"count": 1, "total_duration_ms": 500, "avg_duration_ms": 500},
        "show_call_graph_neighborhood": {"count": 1, "total_duration_ms": 500, "avg_duration_ms": 500},
    },
    "tokens": {"input": 2300, "output": 550, "cache_read": 1000, "cache_creation": 200, "total": 4050},
    "jsonl_raw_line_count": 3,
    "jsonl_lines_with_usage": 2,
    "jsonl_dedup_message_count": 2,
}


def generate_all(output_dir):
    """Generate all fixture files into output_dir."""
    output_dir = pathlib.Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    create_test_metadata_db(output_dir / "metadata.db")
    create_test_analytics_db(output_dir / "analytics.db")
    create_baseline_jsonl(output_dir / "baseline.jsonl")
    create_ariadne_jsonl(output_dir / "ariadne.jsonl")
    create_malformed_jsonl(output_dir / "malformed.jsonl")

    print(f"Generated fixtures in {output_dir}")


if __name__ == "__main__":
    generate_all(pathlib.Path(__file__).resolve().parent)
