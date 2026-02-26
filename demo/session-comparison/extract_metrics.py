#!/usr/bin/env python3
"""
Extract session metrics from metadata.db, JSONL transcripts, and analytics.db.

4-pass pipeline:
  Pass 1: metadata.db  → tool call timeline, file paths, session boundaries
  Pass 2: JSONL        → token usage (deduped), cost calculation
  Pass 3: analytics.db → Ariadne MCP call durations (dual-path join)
  Pass 4: Derivation   → computed metrics from passes 1-3

Usage:
  python extract_metrics.py list-sessions [--ariadne] [--limit N]
  python extract_metrics.py probe <SESSION_ID>
"""

import argparse
import collections
import datetime
import json
import pathlib
import sqlite3
import sys

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

METADATA_DB_PATH = pathlib.Path.home() / ".claude" / "metadata.db"
ANALYTICS_DB_PATH = pathlib.Path.home() / ".ariadne" / "analytics.db"

PRICING = {
    "claude-opus-4-6-20250219": {
        "input_per_mtok": 15.0,
        "output_per_mtok": 75.0,
        "cache_read_per_mtok": 1.50,
        "cache_creation_per_mtok": 18.75,
    },
}

TOOL_CATEGORIES = {
    "Read": "read",
    "Grep": "search",
    "Glob": "search",
    "WebSearch": "search",
    "WebFetch": "search",
    "Edit": "edit",
    "Write": "edit",
    "MultiEdit": "edit",
    "NotebookEdit": "edit",
    "Bash": "bash",
    "mcp__ariadne__list_entrypoints": "mcp",
    "mcp__ariadne__show_call_graph_neighborhood": "mcp",
}


def categorize_tool(tool_name):
    return TOOL_CATEGORIES.get(tool_name, "other")


# ---------------------------------------------------------------------------
# Pass 1: metadata.db extraction
# ---------------------------------------------------------------------------

def resolve_session_id(prefix, conn):
    """Prefix-match a session ID. Error if 0 or >1 matches."""
    rows = conn.execute(
        "SELECT DISTINCT session_id FROM events WHERE session_id LIKE ? ORDER BY session_id",
        (prefix + "%",),
    ).fetchall()
    if len(rows) == 0:
        raise SystemExit(f"No sessions matching prefix '{prefix}'")
    if len(rows) > 1:
        ids = [r[0] for r in rows[:10]]
        raise SystemExit(
            f"Ambiguous prefix '{prefix}' matches {len(rows)} sessions: {ids}"
        )
    return rows[0][0]


def query_session_boundary(conn, session_id):
    """MIN/MAX timestamps, Stop event detection, event count, project_dir, transcript_path."""
    row = conn.execute(
        """
        SELECT
            MIN(timestamp_unix_ms),
            MAX(timestamp_unix_ms),
            COUNT(*),
            MAX(CASE WHEN hook_event = 'Stop' THEN 1 ELSE 0 END),
            -- pick the most common project_dir
            (SELECT project_dir FROM events
             WHERE session_id = ? GROUP BY project_dir ORDER BY COUNT(*) DESC LIMIT 1),
            -- pick first non-null transcript_path
            (SELECT transcript_path FROM events
             WHERE session_id = ? AND transcript_path IS NOT NULL LIMIT 1)
        FROM events
        WHERE session_id = ?
        """,
        (session_id, session_id, session_id),
    ).fetchone()

    return {
        "session_id": session_id,
        "start_ms": row[0],
        "end_ms": row[1],
        "event_count": row[2],
        "has_stop": bool(row[3]),
        "project_dir": row[4],
        "transcript_path": row[5],
    }


def query_tool_calls(conn, session_id):
    """All PostToolUse events ordered by timestamp, with parsed tool_input."""
    rows = conn.execute(
        """
        SELECT timestamp_unix_ms, tool_name, tool_use_id, tool_input_json, file_path
        FROM events
        WHERE session_id = ? AND hook_event = 'PostToolUse'
        ORDER BY timestamp_unix_ms
        """,
        (session_id,),
    ).fetchall()

    calls = []
    for ts_ms, tool_name, tool_use_id, input_json, file_path in rows:
        tool_input = {}
        if input_json:
            try:
                tool_input = json.loads(input_json)
            except json.JSONDecodeError:
                pass

        extracted_path = file_path or extract_file_path(tool_name, tool_input)
        calls.append({
            "timestamp_ms": ts_ms,
            "tool_name": tool_name,
            "tool_use_id": tool_use_id,
            "tool_input": tool_input,
            "file_path": extracted_path,
            "category": categorize_tool(tool_name),
        })
    return calls


def extract_file_path(tool_name, tool_input):
    """Per-tool file path extraction from tool_input."""
    if tool_name in ("Read", "Edit", "Write", "NotebookEdit"):
        return tool_input.get("file_path")
    if tool_name == "Grep":
        return tool_input.get("path")
    if tool_name == "Glob":
        return tool_input.get("path")
    if tool_name == "mcp__ariadne__show_call_graph_neighborhood":
        ref = tool_input.get("symbol_ref", "")
        if ":" in ref:
            return ref.split(":")[0]
        return None
    if tool_name == "mcp__ariadne__list_entrypoints":
        files = tool_input.get("files")
        if files:
            return files[0]
        folders = tool_input.get("folders")
        if folders:
            return folders[0]
        return None
    return None


def compute_mcp_durations(conn, session_id):
    """Self-join PreToolUse+PostToolUse on tool_use_id for mcp__ariadne__ tools."""
    rows = conn.execute(
        """
        SELECT
            post.tool_use_id,
            post.tool_name,
            post.timestamp_unix_ms - pre.timestamp_unix_ms AS duration_ms,
            post.timestamp_unix_ms
        FROM events post
        JOIN events pre
            ON pre.tool_use_id = post.tool_use_id
            AND pre.session_id = post.session_id
            AND pre.hook_event = 'PreToolUse'
        WHERE post.session_id = ?
          AND post.hook_event = 'PostToolUse'
          AND post.tool_name LIKE 'mcp__ariadne__%'
          AND post.tool_use_id IS NOT NULL
        ORDER BY post.timestamp_unix_ms
        """,
        (session_id,),
    ).fetchall()

    durations = []
    for tool_use_id, tool_name, duration_ms, ts_ms in rows:
        durations.append({
            "tool_use_id": tool_use_id,
            "tool_name": tool_name,
            "duration_ms": duration_ms,
            "timestamp_ms": ts_ms,
        })
    return durations


# ---------------------------------------------------------------------------
# Pass 2: JSONL token extraction
# ---------------------------------------------------------------------------

def find_jsonl_path(transcript_path, session_id):
    """Use transcript_path from metadata.db first; fallback: glob."""
    if transcript_path:
        p = pathlib.Path(transcript_path)
        if p.exists():
            return p

    base = pathlib.Path.home() / ".claude" / "projects"
    if not base.exists():
        return None

    for jsonl in base.rglob("*.jsonl"):
        if session_id in jsonl.name:
            return jsonl
    # try prefix match
    for jsonl in base.rglob("*.jsonl"):
        if session_id[:8] in jsonl.name:
            return jsonl
    return None


def parse_jsonl_tokens(jsonl_path):
    """Parse JSONL transcript, deduplicating by message.id (last occurrence wins)."""
    messages = {}  # message_id -> usage dict
    raw_line_count = 0
    lines_with_usage = 0

    with open(jsonl_path) as f:
        for line in f:
            raw_line_count += 1
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue

            msg = record.get("message")
            if not msg:
                # some records have top-level usage (non-message records)
                continue
            msg_id = msg.get("id")
            if not msg_id:
                continue

            usage = msg.get("usage")
            if usage:
                lines_with_usage += 1
                messages[msg_id] = {
                    "input_tokens": usage.get("input_tokens", 0),
                    "output_tokens": usage.get("output_tokens", 0),
                    "cache_read_input_tokens": usage.get("cache_read_input_tokens", 0),
                    "cache_creation_input_tokens": usage.get("cache_creation_input_tokens", 0),
                    "model": msg.get("model", "unknown"),
                }

    totals = {"input": 0, "output": 0, "cache_read": 0, "cache_creation": 0}
    models = collections.Counter()

    for usage in messages.values():
        totals["input"] += usage["input_tokens"]
        totals["output"] += usage["output_tokens"]
        totals["cache_read"] += usage["cache_read_input_tokens"]
        totals["cache_creation"] += usage["cache_creation_input_tokens"]
        models[usage["model"]] += 1

    primary_model = models.most_common(1)[0][0] if models else "unknown"

    return {
        "tokens": totals,
        "model": primary_model,
        "raw_line_count": raw_line_count,
        "lines_with_usage": lines_with_usage,
        "dedup_message_count": len(messages),
    }


def calculate_cost(tokens, model):
    """Calculate USD cost from token counts and model pricing."""
    # Try exact match first, then prefix match
    rates = PRICING.get(model)
    if not rates:
        for key in PRICING:
            if model and model.startswith(key.rsplit("-", 1)[0]):
                rates = PRICING[key]
                break
    if not rates:
        # Fall back to first available pricing
        rates = next(iter(PRICING.values()))

    input_usd = tokens["input"] * rates["input_per_mtok"] / 1_000_000
    output_usd = tokens["output"] * rates["output_per_mtok"] / 1_000_000
    cache_read_usd = tokens["cache_read"] * rates["cache_read_per_mtok"] / 1_000_000
    cache_creation_usd = tokens["cache_creation"] * rates["cache_creation_per_mtok"] / 1_000_000

    return {
        "input_usd": round(input_usd, 4),
        "output_usd": round(output_usd, 4),
        "cache_read_usd": round(cache_read_usd, 4),
        "cache_creation_usd": round(cache_creation_usd, 4),
        "total_usd": round(input_usd + output_usd + cache_read_usd + cache_creation_usd, 4),
        "pricing_model": model,
    }


# ---------------------------------------------------------------------------
# Pass 3: analytics.db join (optional enrichment)
# ---------------------------------------------------------------------------

def find_closest_by_timestamp(tool_name, target_ts_ms, candidates, tolerance_ms=3000):
    """Find the closest candidate by timestamp within tolerance."""
    # Convert target_ts_ms (unix ms) to ISO for comparison with called_at
    target_dt = datetime.datetime.fromtimestamp(target_ts_ms / 1000, tz=datetime.timezone.utc)

    best = None
    best_delta = tolerance_ms + 1

    for cand in candidates:
        # cand: (tool_name, called_at ISO, duration_ms, success)
        if cand[0] != tool_name:
            continue
        try:
            cand_dt = datetime.datetime.fromisoformat(cand[1].replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            continue
        delta_ms = abs((target_dt - cand_dt).total_seconds() * 1000)
        if delta_ms < best_delta:
            best_delta = delta_ms
            best = cand

    if best is not None:
        return {
            "tool_name": best[0],
            "called_at": best[1],
            "duration_ms": best[2],
            "success": bool(best[3]),
            "join_delta_ms": round(best_delta),
        }
    return None


def join_analytics_db(mcp_durations, tool_calls, analytics_db_path):
    """Dual-path join: tool_use_id (direct) then fuzzy timestamp+tool_name."""
    if not analytics_db_path.exists():
        return {
            "joined": [],
            "direct_count": 0,
            "fuzzy_count": 0,
            "unmatched_count": len(mcp_durations),
            "join_method": "none",
            "available": False,
        }

    conn = sqlite3.connect(str(analytics_db_path))

    # Path 1: direct tool_use_id match
    direct_rows = conn.execute(
        "SELECT tool_use_id, tool_name, duration_ms, success "
        "FROM tool_calls WHERE tool_use_id IS NOT NULL"
    ).fetchall()
    direct_by_id = {r[0]: r for r in direct_rows}

    # Path 2: fuzzy candidates (no tool_use_id)
    fuzzy_candidates = conn.execute(
        "SELECT tool_name, called_at, duration_ms, success "
        "FROM tool_calls WHERE tool_use_id IS NULL"
    ).fetchall()

    conn.close()

    joined = []
    direct_count = 0
    fuzzy_count = 0
    unmatched_count = 0
    used_fuzzy = set()  # track used candidates to avoid double-matching

    for mcp_ev in mcp_durations:
        tuid = mcp_ev.get("tool_use_id")
        result = dict(mcp_ev)

        if tuid and tuid in direct_by_id:
            match = direct_by_id[tuid]
            result["analytics_duration_ms"] = match[2]
            result["analytics_success"] = bool(match[3])
            result["join_method"] = "tool_use_id"
            direct_count += 1
        else:
            # Strip mcp__ariadne__ prefix for analytics.db tool_name matching
            short_name = mcp_ev["tool_name"].replace("mcp__ariadne__", "")
            fuzzy_match = find_closest_by_timestamp(
                short_name, mcp_ev["timestamp_ms"], fuzzy_candidates
            )
            if fuzzy_match and id(fuzzy_match) not in used_fuzzy:
                result["analytics_duration_ms"] = fuzzy_match["duration_ms"]
                result["analytics_success"] = fuzzy_match["success"]
                result["join_method"] = "fuzzy_timestamp"
                result["join_delta_ms"] = fuzzy_match["join_delta_ms"]
                fuzzy_count += 1
            else:
                result["join_method"] = "metadata_only"
                unmatched_count += 1

        joined.append(result)

    primary_method = "tool_use_id" if direct_count > fuzzy_count else (
        "fuzzy_timestamp" if fuzzy_count > 0 else "metadata_only"
    )

    return {
        "joined": joined,
        "direct_count": direct_count,
        "fuzzy_count": fuzzy_count,
        "unmatched_count": unmatched_count,
        "join_method": primary_method,
        "available": True,
    }


# ---------------------------------------------------------------------------
# Pass 4: Derived metrics
# ---------------------------------------------------------------------------

def compute_file_activity(tool_calls):
    """Compute file read/edit sets from tool call timeline."""
    read_paths = []
    edited_paths = set()

    for call in tool_calls:
        fp = call.get("file_path")
        if not fp:
            continue
        if call["category"] == "read":
            read_paths.append(fp)
        elif call["category"] == "edit":
            edited_paths.add(fp)
        elif call["category"] == "search":
            # search tools report a base path, not a file read
            pass

    unique_read = set(read_paths)
    read_then_edited = unique_read & edited_paths
    read_not_edited = unique_read - edited_paths

    return {
        "read_paths": sorted(unique_read),
        "edited_paths": sorted(edited_paths),
        "read_then_edited": sorted(read_then_edited),
        "read_not_edited": sorted(read_not_edited),
        "total_unique": len(unique_read | edited_paths),
        "read_path_timeline": read_paths,  # ordered, with duplicates
    }


def compute_derived_metrics(session_boundary, tool_calls, file_activity):
    """Compute M1, M4, M8, M9, M10 derived metrics."""
    read_paths = file_activity["read_paths"]
    read_not_edited = file_activity["read_not_edited"]
    read_then_edited = file_activity["read_then_edited"]
    read_timeline = file_activity["read_path_timeline"]

    # M1: navigation_waste_ratio
    navigation_waste_ratio = (
        len(read_not_edited) / len(read_paths) if read_paths else 0.0
    )

    # M4: time_to_first_edit_ms
    first_edit_ts = None
    for call in tool_calls:
        if call["category"] == "edit":
            first_edit_ts = call["timestamp_ms"]
            break
    time_to_first_edit_ms = (
        first_edit_ts - session_boundary["start_ms"]
        if first_edit_ts and session_boundary["start_ms"]
        else None
    )

    # M8: exploration_efficiency
    exploration_efficiency = (
        len(read_then_edited) / len(read_paths) if read_paths else 0.0
    )

    # M9: duplicate_read_count — files read more than once
    read_counts = collections.Counter(read_timeline)
    duplicate_read_count = sum(1 for count in read_counts.values() if count > 1)

    # M10: backtracking_count — re-reads after reading other files
    backtracking_count = 0
    seen_order = []  # ordered list of distinct files as first encountered
    seen_set = set()
    for fp in read_timeline:
        if fp in seen_set:
            # This is a re-read. It's backtracking if we've read something else since
            last_idx = None
            for i in range(len(seen_order) - 1, -1, -1):
                if seen_order[i] == fp:
                    last_idx = i
                    break
            if last_idx is not None and last_idx < len(seen_order) - 1:
                backtracking_count += 1
        else:
            seen_set.add(fp)
        seen_order.append(fp)

    return {
        "navigation_waste_ratio": round(navigation_waste_ratio, 4),
        "time_to_first_edit_ms": time_to_first_edit_ms,
        "exploration_efficiency": round(exploration_efficiency, 4),
        "duplicate_read_count": duplicate_read_count,
        "backtracking_count": backtracking_count,
    }


# ---------------------------------------------------------------------------
# Probe orchestrator + data quality report
# ---------------------------------------------------------------------------

def ms_to_iso(ms):
    if ms is None:
        return None
    return datetime.datetime.fromtimestamp(
        ms / 1000, tz=datetime.timezone.utc
    ).isoformat()


def probe_session(session_id):
    """Run all 4 passes, assemble ProbeResult dict."""
    conn = sqlite3.connect(str(METADATA_DB_PATH))
    warnings = []
    errors = []

    # --- Pass 1: metadata.db ---
    full_session_id = resolve_session_id(session_id, conn)
    boundary = query_session_boundary(conn, full_session_id)
    tool_calls = query_tool_calls(conn, full_session_id)
    mcp_durations = compute_mcp_durations(conn, full_session_id)

    if not boundary["has_stop"]:
        warnings.append("No Stop event found — using last event as session end")

    # Tool call counts
    by_tool = collections.Counter(c["tool_name"] for c in tool_calls)
    by_category = collections.Counter(c["category"] for c in tool_calls)

    # MCP summary from Pre-Post durations
    mcp_by_tool = {}
    for d in mcp_durations:
        short = d["tool_name"].replace("mcp__ariadne__", "")
        if short not in mcp_by_tool:
            mcp_by_tool[short] = {"count": 0, "total_duration_ms": 0, "durations": []}
        mcp_by_tool[short]["count"] += 1
        mcp_by_tool[short]["total_duration_ms"] += d["duration_ms"]
        mcp_by_tool[short]["durations"].append(d["duration_ms"])

    for tool_data in mcp_by_tool.values():
        tool_data["avg_duration_ms"] = round(
            tool_data["total_duration_ms"] / tool_data["count"]
        )
        del tool_data["durations"]

    conn.close()

    # --- Pass 2: JSONL ---
    jsonl_path = find_jsonl_path(boundary["transcript_path"], full_session_id)
    jsonl_result = None
    cost = None
    if jsonl_path:
        jsonl_result = parse_jsonl_tokens(jsonl_path)
        cost = calculate_cost(jsonl_result["tokens"], jsonl_result["model"])
    else:
        warnings.append("JSONL transcript not found — token/cost data unavailable")

    # --- Pass 3: analytics.db ---
    analytics_result = join_analytics_db(mcp_durations, tool_calls, ANALYTICS_DB_PATH)
    if not analytics_result["available"]:
        warnings.append("analytics.db not found — MCP enrichment unavailable")

    # --- Pass 4: Derived metrics ---
    file_activity = compute_file_activity(tool_calls)
    derived = compute_derived_metrics(boundary, tool_calls, file_activity)

    # --- Assemble result ---
    wall_clock_ms = (
        boundary["end_ms"] - boundary["start_ms"]
        if boundary["start_ms"] and boundary["end_ms"]
        else None
    )

    result = {
        "schema_version": "0.1.0-spike",
        "session": {
            "session_id": full_session_id,
            "condition": "ariadne" if by_category.get("mcp", 0) > 0 else "baseline",
            "start_time": ms_to_iso(boundary["start_ms"]),
            "end_time": ms_to_iso(boundary["end_ms"]),
            "wall_clock_ms": wall_clock_ms,
            "model": jsonl_result["model"] if jsonl_result else "unknown",
            "project_dir": boundary["project_dir"],
            "has_stop": boundary["has_stop"],
        },
        "tokens": jsonl_result["tokens"] if jsonl_result else None,
        "cost": cost,
        "tool_calls": {
            "total": len(tool_calls),
            "by_category": dict(by_category),
            "by_tool": dict(by_tool),
        },
        "files": {
            "total_unique": file_activity["total_unique"],
            "read": file_activity["read_paths"],
            "edited": file_activity["edited_paths"],
            "read_then_edited": file_activity["read_then_edited"],
            "read_not_edited": file_activity["read_not_edited"],
        },
        "mcp_calls": {
            "total": len(mcp_durations),
            "by_tool": mcp_by_tool,
            "join_method": analytics_result["join_method"],
        },
        "derived": derived,
        "data_quality": {
            "warnings": warnings,
            "errors": errors,
            "metadata_events_count": boundary["event_count"],
            "tool_calls_count": len(tool_calls),
            "jsonl_raw_line_count": jsonl_result["raw_line_count"] if jsonl_result else 0,
            "jsonl_lines_with_usage": jsonl_result["lines_with_usage"] if jsonl_result else 0,
            "jsonl_dedup_message_count": jsonl_result["dedup_message_count"] if jsonl_result else 0,
            "analytics_direct_joins": analytics_result["direct_count"],
            "analytics_fuzzy_joins": analytics_result["fuzzy_count"],
            "analytics_unmatched": analytics_result["unmatched_count"],
        },
    }

    return result


def print_data_quality_report(result, file=sys.stderr):
    """Human-readable data quality report with PASS/WARN/FAIL indicators."""
    dq = result["data_quality"]
    session = result["session"]

    def status(ok, warn_cond=False):
        if not ok:
            return "FAIL"
        if warn_cond:
            return "WARN"
        return "PASS"

    print("\n" + "=" * 60, file=file)
    print("  DATA QUALITY REPORT", file=file)
    print("=" * 60, file=file)

    print(f"\nSession: {session['session_id'][:12]}...", file=file)
    print(f"Condition: {session['condition']}", file=file)
    print(f"Project: {session.get('project_dir', 'unknown')}", file=file)

    # Section 1: Session boundary
    has_stop = session["has_stop"]
    wall_ms = session.get("wall_clock_ms")
    wall_str = f"{wall_ms / 1000:.1f}s" if wall_ms else "N/A"
    print(f"\n[{status(True, not has_stop)}] Session Boundary", file=file)
    print(f"  Events: {dq['metadata_events_count']}", file=file)
    print(f"  Tool calls: {dq['tool_calls_count']}", file=file)
    print(f"  Has Stop: {has_stop}", file=file)
    print(f"  Wall clock: {wall_str}", file=file)

    # Section 2: Tool call timeline
    tc = result["tool_calls"]
    print(f"\n[{status(tc['total'] > 0)}] Tool Call Timeline", file=file)
    print(f"  Total: {tc['total']}", file=file)
    for cat in ["read", "search", "edit", "bash", "mcp", "other"]:
        count = tc["by_category"].get(cat, 0)
        if count:
            print(f"    {cat}: {count}", file=file)

    # Section 3: JSONL tokens
    has_jsonl = result["tokens"] is not None
    print(f"\n[{status(has_jsonl)}] JSONL Token Extraction", file=file)
    if has_jsonl:
        t = result["tokens"]
        total_tok = t["input"] + t["output"] + t["cache_read"] + t["cache_creation"]
        dedup_ratio = (
            dq["jsonl_lines_with_usage"] / dq["jsonl_dedup_message_count"]
            if dq["jsonl_dedup_message_count"] > 0
            else 0
        )
        print(f"  Raw lines: {dq['jsonl_raw_line_count']}", file=file)
        print(f"  Lines with usage: {dq['jsonl_lines_with_usage']}", file=file)
        print(f"  Deduped messages: {dq['jsonl_dedup_message_count']}", file=file)
        print(f"  Dedup ratio: {dedup_ratio:.1f}x", file=file)
        print(f"  Total tokens: {total_tok:,}", file=file)
        print(f"  Model: {result['session']['model']}", file=file)
        if result["cost"]:
            print(f"  Cost: ${result['cost']['total_usd']:.4f}", file=file)
    else:
        print("  JSONL not found", file=file)

    # Section 4: MCP calls
    mcp = result["mcp_calls"]
    has_mcp = mcp["total"] > 0
    print(f"\n[{status(True, not has_mcp)}] MCP Call Durations", file=file)
    print(f"  Total MCP calls: {mcp['total']}", file=file)
    if has_mcp:
        for tool_name, stats in mcp["by_tool"].items():
            print(
                f"    {tool_name}: {stats['count']} calls, "
                f"avg {stats['avg_duration_ms']}ms, "
                f"total {stats['total_duration_ms']}ms",
                file=file,
            )
        print(f"  Analytics join method: {mcp['join_method']}", file=file)
        print(
            f"  Direct: {dq['analytics_direct_joins']}, "
            f"Fuzzy: {dq['analytics_fuzzy_joins']}, "
            f"Unmatched: {dq['analytics_unmatched']}",
            file=file,
        )

    # Section 5: File activity
    files = result["files"]
    print(f"\n[{status(files['total_unique'] > 0)}] File Activity", file=file)
    print(f"  Unique files: {files['total_unique']}", file=file)
    print(f"  Read: {len(files['read'])}", file=file)
    print(f"  Edited: {len(files['edited'])}", file=file)
    print(f"  Read→Edited: {len(files['read_then_edited'])}", file=file)
    print(f"  Read, not edited: {len(files['read_not_edited'])}", file=file)

    # Section 6: Derived metrics
    d = result["derived"]
    print(f"\n[PASS] Derived Metrics", file=file)
    print(f"  Navigation waste: {d['navigation_waste_ratio']:.1%}", file=file)
    ttfe = d["time_to_first_edit_ms"]
    if ttfe is not None:
        print(f"  Time to first edit: {ttfe / 1000:.1f}s", file=file)
    else:
        print(f"  Time to first edit: N/A (no edits)", file=file)
    print(f"  Exploration efficiency: {d['exploration_efficiency']:.1%}", file=file)
    print(f"  Duplicate reads: {d['duplicate_read_count']}", file=file)
    print(f"  Backtracking: {d['backtracking_count']}", file=file)

    # Warnings & errors
    if dq["warnings"]:
        print(f"\nWarnings:", file=file)
        for w in dq["warnings"]:
            print(f"  ⚠ {w}", file=file)
    if dq["errors"]:
        print(f"\nErrors:", file=file)
        for e in dq["errors"]:
            print(f"  ✗ {e}", file=file)

    print("\n" + "=" * 60, file=file)


# ---------------------------------------------------------------------------
# list-sessions command
# ---------------------------------------------------------------------------

def list_sessions(ariadne_only=False, limit=20):
    """List recent sessions from metadata.db."""
    conn = sqlite3.connect(str(METADATA_DB_PATH))

    if ariadne_only:
        # Sessions that have at least one mcp__ariadne__ tool call
        rows = conn.execute(
            """
            SELECT
                e.session_id,
                MIN(e.timestamp_unix_ms) AS start_ms,
                COUNT(*) AS event_count,
                SUM(CASE WHEN e.hook_event = 'PostToolUse' THEN 1 ELSE 0 END) AS tool_count,
                MAX(CASE WHEN e.hook_event = 'Stop' THEN 1 ELSE 0 END) AS has_stop,
                SUM(CASE WHEN e.tool_name LIKE 'mcp__ariadne__%' THEN 1 ELSE 0 END) AS mcp_count,
                (SELECT project_dir FROM events
                 WHERE session_id = e.session_id
                 GROUP BY project_dir ORDER BY COUNT(*) DESC LIMIT 1) AS project_dir
            FROM events e
            WHERE e.session_id IS NOT NULL
            GROUP BY e.session_id
            HAVING mcp_count > 0
            ORDER BY start_ms DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    else:
        rows = conn.execute(
            """
            SELECT
                e.session_id,
                MIN(e.timestamp_unix_ms) AS start_ms,
                COUNT(*) AS event_count,
                SUM(CASE WHEN e.hook_event = 'PostToolUse' THEN 1 ELSE 0 END) AS tool_count,
                MAX(CASE WHEN e.hook_event = 'Stop' THEN 1 ELSE 0 END) AS has_stop,
                SUM(CASE WHEN e.tool_name LIKE 'mcp__ariadne__%' THEN 1 ELSE 0 END) AS mcp_count,
                (SELECT project_dir FROM events
                 WHERE session_id = e.session_id
                 GROUP BY project_dir ORDER BY COUNT(*) DESC LIMIT 1) AS project_dir
            FROM events e
            WHERE e.session_id IS NOT NULL
            GROUP BY e.session_id
            ORDER BY start_ms DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    conn.close()

    if not rows:
        print("No sessions found.", file=sys.stderr)
        return

    # Header
    print(
        f"{'SESSION_ID':>12}  {'START_TIME':>19}  {'EVENTS':>6}  "
        f"{'TOOLS':>5}  {'STOP':>4}  {'MCP':>3}  PROJECT",
        file=sys.stderr,
    )
    print("-" * 100, file=sys.stderr)

    for session_id, start_ms, event_count, tool_count, has_stop, mcp_count, project_dir in rows:
        start_str = (
            datetime.datetime.fromtimestamp(start_ms / 1000, tz=datetime.timezone.utc)
            .strftime("%Y-%m-%d %H:%M:%S")
            if start_ms
            else "N/A"
        )
        short_id = (session_id or "")[:12]
        proj = (project_dir or "")
        # Shorten project path for display
        home = str(pathlib.Path.home())
        if proj.startswith(home):
            proj = "~" + proj[len(home):]

        print(
            f"{short_id:>12}  {start_str:>19}  {event_count:>6}  "
            f"{tool_count:>5}  {'Y' if has_stop else 'N':>4}  {mcp_count:>3}  {proj}",
            file=sys.stderr,
        )

    print(f"\nTotal: {len(rows)} sessions", file=sys.stderr)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Extract session metrics from Claude Code data sources"
    )
    sub = parser.add_subparsers(dest="command")

    # list-sessions
    ls_parser = sub.add_parser("list-sessions", help="List recent sessions")
    ls_parser.add_argument(
        "--ariadne", action="store_true", help="Only show sessions with MCP calls"
    )
    ls_parser.add_argument(
        "--limit", type=int, default=20, help="Max sessions to show (default: 20)"
    )

    # probe
    probe_parser = sub.add_parser("probe", help="Probe a session and report data quality")
    probe_parser.add_argument(
        "session_id", help="Session ID (prefix match supported)"
    )

    args = parser.parse_args()

    if not METADATA_DB_PATH.exists():
        print(f"metadata.db not found at {METADATA_DB_PATH}", file=sys.stderr)
        sys.exit(1)

    if args.command == "list-sessions":
        list_sessions(ariadne_only=args.ariadne, limit=args.limit)

    elif args.command == "probe":
        result = probe_session(args.session_id)
        print_data_quality_report(result, file=sys.stderr)
        json.dump(result, sys.stdout, indent=2)
        print()  # trailing newline

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
