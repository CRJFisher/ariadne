#!/usr/bin/env python3
"""
Ariadne MCP Benchmark Runner

Runs standardized benchmarks with and without Ariadne MCP to measure
accuracy lift and efficiency gains.

Execution modes:
- CLI mode: Uses `claude -p` subprocess
- SDK mode: Uses claude-code-sdk (async, sequential for deterministic budget/eval control)
"""

import argparse
import asyncio
import json
import random
import subprocess
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

ARIADNE_ROOT = Path(__file__).resolve().parents[2]  # repo root
MCP_SERVER = ARIADNE_ROOT / "packages" / "mcp" / "dist" / "server.js"

PRICING = {
    "claude-sonnet-4-5-20250929": {
        "input_per_mtok": 3.0,
        "output_per_mtok": 15.0,
        "cache_read_per_mtok": 0.30,
        "cache_creation_per_mtok": 3.75,
    },
    "claude-sonnet-4-6-20250514": {
        "input_per_mtok": 3.0,
        "output_per_mtok": 15.0,
        "cache_read_per_mtok": 0.30,
        "cache_creation_per_mtok": 3.75,
    },
    "claude-opus-4-6-20250219": {
        "input_per_mtok": 15.0,
        "output_per_mtok": 75.0,
        "cache_read_per_mtok": 1.50,
        "cache_creation_per_mtok": 18.75,
    },
}

DEFAULT_MODEL = "claude-sonnet-4-5-20250929"
DEFAULT_MAX_TURNS = 15
DEFAULT_BUDGET_USD = 2.00
DEFAULT_TIMEOUT = 600
DEFAULT_SCHEDULE_SEED = 42
BUDGET_STOP_RATIO = 0.90


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------


@dataclass
class TaskResult:
    task_id: str
    condition: str  # "ariadne" or "baseline"
    run_number: int
    passed: bool | None
    evaluation_status: str  # pass|fail|error|unevaluated
    evaluation_source: str | None
    evaluation_artifact_path: str | None
    evaluation_error: str | None
    total_cost_usd: float | None
    input_tokens: int | None
    output_tokens: int | None
    cache_read_tokens: int | None
    cache_creation_tokens: int | None
    num_turns: int | None
    duration_ms: int | None
    tool_calls: list[dict] | None
    model_id: str
    error: str | None
    timestamp: str
    ariadne_commit: str | None
    transcript_path: str | None
    benchmark: str | None
    harness: str | None
    schedule_seed: int | None
    pair_id: str | None


@dataclass
class BenchmarkConfig:
    model: str = DEFAULT_MODEL
    max_turns: int = DEFAULT_MAX_TURNS
    max_budget_usd: float = DEFAULT_BUDGET_USD
    timeout_seconds: int = DEFAULT_TIMEOUT
    ariadne_commit: str | None = None
    ariadne_server_path: str = str(MCP_SERVER)
    phase_budget_usd: float | None = None
    schedule_seed: int = DEFAULT_SCHEDULE_SEED
    fail_fast_evaluation: bool = True


@dataclass
class RunScheduleEntry:
    task_id: str
    condition: str
    run_number: int
    repo_path: str
    prompt: str
    benchmark: str | None
    harness: str | None
    evaluation_config: dict[str, Any] | None
    pair_id: str
    schedule_seed: int


# ---------------------------------------------------------------------------
# MCP config generation
# ---------------------------------------------------------------------------


def make_mcp_config(repo_path: str, server_path: str) -> dict:
    """Generate MCP config dict for Ariadne treatment condition."""
    return {
        "mcpServers": {
            "ariadne": {
                "type": "stdio",
                "command": "node",
                "args": [server_path, "--project-path", repo_path, "--no-watch"],
                "env": {},
            }
        }
    }


def write_mcp_config(repo_path: str, server_path: str, output_path: Path) -> Path:
    """Write MCP config JSON to a file and return its path."""
    config = make_mcp_config(repo_path, server_path)
    output_path.write_text(json.dumps(config, indent=2))
    return output_path


# ---------------------------------------------------------------------------
# Manifest helpers
# ---------------------------------------------------------------------------


def parse_evaluation_config(task: dict[str, Any]) -> dict[str, Any] | None:
    """Parse evaluation config from manifest.

    Supported schema (v2):
      "evaluation": {
        "type": "command_json",
        "command": "python evaluator.py --task {task_id}",
        "timeout_seconds": 300
      }

    Legacy string evaluation fields are treated as unevaluated for backward compatibility.
    """
    evaluation = task.get("evaluation")
    if not isinstance(evaluation, dict):
        return None

    eval_type = evaluation.get("type")
    command = evaluation.get("command")
    if eval_type != "command_json" or not isinstance(command, str) or not command.strip():
        return None

    timeout_seconds = evaluation.get("timeout_seconds", 300)
    try:
        timeout = int(timeout_seconds)
    except (TypeError, ValueError):
        timeout = 300

    return {
        "type": "command_json",
        "command": command,
        "timeout_seconds": timeout,
    }


def normalize_task(task: dict[str, Any]) -> dict[str, Any]:
    repo_path = task.get("repo_path") or task.get("repo")
    if not isinstance(repo_path, str) or not repo_path:
        raise ValueError(f"Task {task.get('id', '<unknown>')} missing repo_path/repo")

    task_id = task.get("id")
    if not isinstance(task_id, str) or not task_id:
        raise ValueError("Task missing non-empty id")

    prompt = task.get("prompt")
    if not isinstance(prompt, str) or not prompt:
        raise ValueError(f"Task {task_id} missing non-empty prompt")

    return {
        "id": task_id,
        "repo_path": repo_path,
        "prompt": prompt,
        "benchmark": task.get("benchmark"),
        "harness": task.get("harness"),
        "evaluation_config": parse_evaluation_config(task),
    }


# ---------------------------------------------------------------------------
# Evaluation helpers
# ---------------------------------------------------------------------------


def parse_json_line_payload(stdout: str) -> dict[str, Any] | None:
    """Parse JSON payload from stdout, tolerating extra log lines."""
    lines = [line.strip() for line in stdout.splitlines() if line.strip()]
    if not lines:
        return None

    for candidate in reversed(lines):
        try:
            payload = json.loads(candidate)
            if isinstance(payload, dict):
                return payload
        except json.JSONDecodeError:
            continue
    return None


def evaluate_result(
    entry: RunScheduleEntry,
    result: TaskResult,
) -> tuple[bool | None, str, str | None, str | None, str | None]:
    """Evaluate run result using manifest-configured evaluator.

    Returns:
      passed, evaluation_status, evaluation_source, artifact_path, evaluation_error
    """
    evaluation = entry.evaluation_config
    if evaluation is None:
        return (result.passed, "unevaluated", None, None, None)

    command_template = evaluation["command"]
    template_values = {
        "task_id": entry.task_id,
        "condition": entry.condition,
        "run_number": entry.run_number,
        "repo_path": entry.repo_path,
        "prompt": entry.prompt,
        "transcript_path": result.transcript_path or "",
        "model_id": result.model_id,
    }

    try:
        command = command_template.format(**template_values)
    except Exception:
        command = command_template

    timeout_seconds = int(evaluation.get("timeout_seconds", 300))
    try:
        proc = subprocess.run(
            command,
            cwd=entry.repo_path,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            shell=True,
        )
    except subprocess.TimeoutExpired:
        return (False, "error", "command_json", None, f"Evaluator timed out after {timeout_seconds}s")
    except Exception as exc:
        return (False, "error", "command_json", None, f"Evaluator failed to start: {exc}")

    if proc.returncode != 0:
        stderr = proc.stderr.strip()
        return (
            False,
            "error",
            "command_json",
            None,
            f"Evaluator exited {proc.returncode}: {stderr[:200]}",
        )

    payload = parse_json_line_payload(proc.stdout)
    if payload is None:
        return (False, "error", "command_json", None, "Evaluator did not emit JSON payload")

    raw_status = payload.get("status")
    raw_passed = payload.get("passed")
    artifact_path = payload.get("details_path") or payload.get("evaluation_artifact_path")

    if raw_status == "error":
        error_message = payload.get("error") or "Evaluator reported status=error"
        return (False, "error", "command_json", str(artifact_path) if artifact_path else None, str(error_message))

    if isinstance(raw_passed, bool):
        return (
            raw_passed,
            "pass" if raw_passed else "fail",
            "command_json",
            str(artifact_path) if artifact_path else None,
            None,
        )

    return (False, "error", "command_json", str(artifact_path) if artifact_path else None, "Evaluator payload missing boolean 'passed'")


# ---------------------------------------------------------------------------
# Cost helpers
# ---------------------------------------------------------------------------


def compute_cost_from_tokens(
    model_id: str,
    input_tokens: int | None,
    output_tokens: int | None,
    cache_read_tokens: int | None,
    cache_creation_tokens: int | None,
) -> float | None:
    pricing = PRICING.get(model_id)
    if pricing is None:
        return None

    inp = (input_tokens or 0) / 1_000_000
    out = (output_tokens or 0) / 1_000_000
    cache_r = (cache_read_tokens or 0) / 1_000_000
    cache_c = (cache_creation_tokens or 0) / 1_000_000

    return (
        inp * pricing["input_per_mtok"]
        + out * pricing["output_per_mtok"]
        + cache_r * pricing["cache_read_per_mtok"]
        + cache_c * pricing["cache_creation_per_mtok"]
    )


def result_cost_usd(result: TaskResult) -> float | None:
    if result.total_cost_usd is not None:
        return result.total_cost_usd
    return compute_cost_from_tokens(
        result.model_id,
        result.input_tokens,
        result.output_tokens,
        result.cache_read_tokens,
        result.cache_creation_tokens,
    )


def percentile(values: list[float], pct: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]

    rank = (len(ordered) - 1) * pct
    low = int(rank)
    high = min(low + 1, len(ordered) - 1)
    weight = rank - low
    return ordered[low] * (1 - weight) + ordered[high] * weight


def summarize_budget(
    results: list[TaskResult],
    planned_runs: int,
    phase_budget_usd: float | None,
    stopped_early: bool,
    stop_reason: str | None,
) -> dict[str, Any]:
    costs = [c for c in (result_cost_usd(r) for r in results) if c is not None]
    total_spend = float(sum(costs))
    median_cost = percentile(costs, 0.5)
    p90_cost = percentile(costs, 0.9)
    projected_full = None
    if median_cost is not None:
        projected_full = float(median_cost * planned_runs)

    threshold = None
    if phase_budget_usd is not None:
        threshold = float(phase_budget_usd * BUDGET_STOP_RATIO)

    return {
        "planned_runs": planned_runs,
        "completed_runs": len(results),
        "stopped_early": stopped_early,
        "stop_reason": stop_reason,
        "phase_budget_usd": phase_budget_usd,
        "stop_threshold_usd": threshold,
        "spend_total_usd": total_spend,
        "spend_p50_per_run_usd": median_cost,
        "spend_p90_per_run_usd": p90_cost,
        "projected_full_run_usd": projected_full,
    }


def should_stop_for_budget(spend_usd: float, phase_budget_usd: float | None) -> bool:
    if phase_budget_usd is None:
        return False
    return spend_usd >= (phase_budget_usd * BUDGET_STOP_RATIO)


# ---------------------------------------------------------------------------
# CLI execution mode (subprocess, claude -p)
# ---------------------------------------------------------------------------


def run_task_cli(
    entry: RunScheduleEntry,
    config: BenchmarkConfig,
    results_dir: Path,
) -> TaskResult:
    """Run a single task using claude -p subprocess."""
    timestamp = datetime.now(timezone.utc).isoformat()
    start_ms = int(time.monotonic() * 1000)

    cmd = [
        "claude",
        "-p",
        entry.prompt,
        "--output-format",
        "stream-json",
        "--no-session-persistence",
        "--model",
        config.model,
        "--max-turns",
        str(config.max_turns),
    ]

    mcp_config_path = None
    if entry.condition == "ariadne":
        mcp_config_path = results_dir / f"mcp-config-{entry.task_id}-{entry.run_number}.json"
        write_mcp_config(entry.repo_path, config.ariadne_server_path, mcp_config_path)
        cmd.extend(["--mcp-config", str(mcp_config_path)])
        cmd.extend(
            [
                "--allowedTools",
                "mcp__ariadne__list_entrypoints",
                "mcp__ariadne__show_call_graph_neighborhood",
                "Read",
                "Glob",
                "Grep",
                "Bash",
                "Edit",
                "Write",
            ]
        )

    transcript_path = (
        results_dir / f"{entry.task_id}_{entry.condition}_run{entry.run_number}.jsonl"
    )

    try:
        proc = subprocess.run(
            cmd,
            cwd=entry.repo_path,
            capture_output=True,
            text=True,
            timeout=config.timeout_seconds,
        )

        transcript_path.write_text(proc.stdout)
        metrics = parse_stream_json(proc.stdout)
        duration_ms = int(time.monotonic() * 1000) - start_ms

        task_result = TaskResult(
            task_id=entry.task_id,
            condition=entry.condition,
            run_number=entry.run_number,
            passed=None,
            evaluation_status="unevaluated",
            evaluation_source=None,
            evaluation_artifact_path=None,
            evaluation_error=None,
            total_cost_usd=metrics.get("cost_usd"),
            input_tokens=metrics.get("input_tokens"),
            output_tokens=metrics.get("output_tokens"),
            cache_read_tokens=metrics.get("cache_read_tokens"),
            cache_creation_tokens=metrics.get("cache_creation_tokens"),
            num_turns=metrics.get("num_turns"),
            duration_ms=duration_ms,
            tool_calls=metrics.get("tool_calls"),
            model_id=config.model,
            error=proc.stderr if proc.returncode != 0 else None,
            timestamp=timestamp,
            ariadne_commit=config.ariadne_commit,
            transcript_path=str(transcript_path),
            benchmark=entry.benchmark,
            harness=entry.harness,
            schedule_seed=entry.schedule_seed,
            pair_id=entry.pair_id,
        )

        passed, eval_status, eval_source, eval_artifact, eval_error = evaluate_result(entry, task_result)
        task_result.passed = passed
        task_result.evaluation_status = eval_status
        task_result.evaluation_source = eval_source
        task_result.evaluation_artifact_path = eval_artifact
        task_result.evaluation_error = eval_error

        return task_result

    except subprocess.TimeoutExpired:
        duration_ms = int(time.monotonic() * 1000) - start_ms
        return TaskResult(
            task_id=entry.task_id,
            condition=entry.condition,
            run_number=entry.run_number,
            passed=False,
            evaluation_status="error",
            evaluation_source=None,
            evaluation_artifact_path=None,
            evaluation_error=f"Run timeout after {config.timeout_seconds}s",
            total_cost_usd=None,
            input_tokens=None,
            output_tokens=None,
            cache_read_tokens=None,
            cache_creation_tokens=None,
            num_turns=None,
            duration_ms=duration_ms,
            tool_calls=None,
            model_id=config.model,
            error=f"Timeout after {config.timeout_seconds}s",
            timestamp=timestamp,
            ariadne_commit=config.ariadne_commit,
            transcript_path=None,
            benchmark=entry.benchmark,
            harness=entry.harness,
            schedule_seed=entry.schedule_seed,
            pair_id=entry.pair_id,
        )
    finally:
        if mcp_config_path and mcp_config_path.exists():
            mcp_config_path.unlink()


def parse_stream_json(output: str) -> dict[str, Any]:
    """Parse stream-json output for metrics with strict last-wins dedup by message.id."""
    result_usage: dict[str, int] | None = None
    result_num_turns: int | None = None

    assistant_usage_by_id: dict[str, dict[str, int]] = {}
    assistant_usage_without_id: list[dict[str, int]] = []

    tool_calls: list[dict[str, Any]] = []
    cost_usd = None

    for line in output.strip().splitlines():
        if not line.strip():
            continue

        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue

        msg_type = obj.get("type", "")

        if msg_type == "result":
            cost_usd = obj.get("cost_usd") or obj.get("total_cost_usd")
            if isinstance(obj.get("num_turns"), int):
                result_num_turns = int(obj["num_turns"])

            usage = obj.get("usage")
            if isinstance(usage, dict):
                result_usage = {
                    "input_tokens": int(usage.get("input_tokens", 0) or 0),
                    "output_tokens": int(usage.get("output_tokens", 0) or 0),
                    "cache_read_tokens": int(usage.get("cache_read_input_tokens", 0) or 0),
                    "cache_creation_tokens": int(usage.get("cache_creation_input_tokens", 0) or 0),
                }

        elif msg_type == "assistant":
            message = obj.get("message") or {}
            usage = message.get("usage") or {}
            if not usage:
                continue

            usage_record = {
                "input_tokens": int(usage.get("input_tokens", 0) or 0),
                "output_tokens": int(usage.get("output_tokens", 0) or 0),
                "cache_read_tokens": int(usage.get("cache_read_input_tokens", 0) or 0),
                "cache_creation_tokens": int(usage.get("cache_creation_input_tokens", 0) or 0),
            }

            msg_id = message.get("id")
            if isinstance(msg_id, str) and msg_id:
                # Last occurrence wins for streaming chunks.
                assistant_usage_by_id[msg_id] = usage_record
            else:
                assistant_usage_without_id.append(usage_record)

        elif msg_type == "tool_use":
            tool_calls.append(
                {
                    "tool": obj.get("tool", obj.get("name", "unknown")),
                    "timestamp": obj.get("timestamp"),
                }
            )

    deduped_usage_values = list(assistant_usage_by_id.values()) + assistant_usage_without_id

    if deduped_usage_values:
        input_tokens = sum(item["input_tokens"] for item in deduped_usage_values)
        output_tokens = sum(item["output_tokens"] for item in deduped_usage_values)
        cache_read_tokens = sum(item["cache_read_tokens"] for item in deduped_usage_values)
        cache_creation_tokens = sum(item["cache_creation_tokens"] for item in deduped_usage_values)
        num_turns = len(deduped_usage_values)
    elif result_usage is not None:
        input_tokens = result_usage["input_tokens"]
        output_tokens = result_usage["output_tokens"]
        cache_read_tokens = result_usage["cache_read_tokens"]
        cache_creation_tokens = result_usage["cache_creation_tokens"]
        num_turns = result_num_turns if result_num_turns is not None else 0
    else:
        input_tokens = 0
        output_tokens = 0
        cache_read_tokens = 0
        cache_creation_tokens = 0
        num_turns = result_num_turns if result_num_turns is not None else 0

    return {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cache_read_tokens": cache_read_tokens,
        "cache_creation_tokens": cache_creation_tokens,
        "num_turns": num_turns,
        "tool_calls": tool_calls,
        "cost_usd": cost_usd,
    }


# ---------------------------------------------------------------------------
# SDK execution mode (claude-code-sdk, async)
# ---------------------------------------------------------------------------


async def run_task_sdk(
    entry: RunScheduleEntry,
    config: BenchmarkConfig,
) -> TaskResult:
    """Run a single task using claude-code-sdk (async)."""
    try:
        from claude_code_sdk import ClaudeCodeOptions, query
    except ImportError as exc:
        raise ImportError(
            "claude-code-sdk not installed. "
            "Install with: pip install claude-code-sdk\n"
            "Or use --mode cli for subprocess execution."
        ) from exc

    timestamp = datetime.now(timezone.utc).isoformat()

    mcp_servers = {}
    if entry.condition == "ariadne":
        mcp_servers["ariadne"] = {
            "type": "stdio",
            "command": "node",
            "args": [
                config.ariadne_server_path,
                "--project-path",
                entry.repo_path,
                "--no-watch",
            ],
        }

    allowed_tools = ["Read", "Glob", "Grep", "Bash", "Edit", "Write"]
    if entry.condition == "ariadne":
        allowed_tools.extend(
            [
                "mcp__ariadne__list_entrypoints",
                "mcp__ariadne__show_call_graph_neighborhood",
            ]
        )

    options = ClaudeCodeOptions(
        allowed_tools=allowed_tools,
        max_turns=config.max_turns,
        max_budget_usd=config.max_budget_usd,
        cwd=entry.repo_path,
        mcp_servers=mcp_servers,
        model=config.model,
    )

    try:
        async for message in query(prompt=entry.prompt, options=options):
            if message.type == "result":
                task_result = TaskResult(
                    task_id=entry.task_id,
                    condition=entry.condition,
                    run_number=entry.run_number,
                    passed=None,
                    evaluation_status="unevaluated",
                    evaluation_source=None,
                    evaluation_artifact_path=None,
                    evaluation_error=None,
                    total_cost_usd=getattr(message, "total_cost_usd", None),
                    input_tokens=getattr(message.usage, "input_tokens", None)
                    if hasattr(message, "usage")
                    else None,
                    output_tokens=getattr(message.usage, "output_tokens", None)
                    if hasattr(message, "usage")
                    else None,
                    cache_read_tokens=getattr(message.usage, "cache_read_input_tokens", None)
                    if hasattr(message, "usage")
                    else None,
                    cache_creation_tokens=getattr(message.usage, "cache_creation_input_tokens", None)
                    if hasattr(message, "usage")
                    else None,
                    num_turns=getattr(message, "num_turns", None),
                    duration_ms=getattr(message, "duration_ms", None),
                    tool_calls=None,
                    model_id=config.model,
                    error=None,
                    timestamp=timestamp,
                    ariadne_commit=config.ariadne_commit,
                    transcript_path=None,
                    benchmark=entry.benchmark,
                    harness=entry.harness,
                    schedule_seed=entry.schedule_seed,
                    pair_id=entry.pair_id,
                )

                passed, eval_status, eval_source, eval_artifact, eval_error = evaluate_result(entry, task_result)
                task_result.passed = passed
                task_result.evaluation_status = eval_status
                task_result.evaluation_source = eval_source
                task_result.evaluation_artifact_path = eval_artifact
                task_result.evaluation_error = eval_error
                return task_result
    except Exception as exc:
        return TaskResult(
            task_id=entry.task_id,
            condition=entry.condition,
            run_number=entry.run_number,
            passed=False,
            evaluation_status="error",
            evaluation_source=None,
            evaluation_artifact_path=None,
            evaluation_error=f"SDK run failed: {exc}",
            total_cost_usd=None,
            input_tokens=None,
            output_tokens=None,
            cache_read_tokens=None,
            cache_creation_tokens=None,
            num_turns=None,
            duration_ms=None,
            tool_calls=None,
            model_id=config.model,
            error=str(exc),
            timestamp=timestamp,
            ariadne_commit=config.ariadne_commit,
            transcript_path=None,
            benchmark=entry.benchmark,
            harness=entry.harness,
            schedule_seed=entry.schedule_seed,
            pair_id=entry.pair_id,
        )

    return TaskResult(
        task_id=entry.task_id,
        condition=entry.condition,
        run_number=entry.run_number,
        passed=False,
        evaluation_status="error",
        evaluation_source=None,
        evaluation_artifact_path=None,
        evaluation_error="No result message received",
        total_cost_usd=None,
        input_tokens=None,
        output_tokens=None,
        cache_read_tokens=None,
        cache_creation_tokens=None,
        num_turns=None,
        duration_ms=None,
        tool_calls=None,
        model_id=config.model,
        error="No result message received",
        timestamp=timestamp,
        ariadne_commit=config.ariadne_commit,
        transcript_path=None,
        benchmark=entry.benchmark,
        harness=entry.harness,
        schedule_seed=entry.schedule_seed,
        pair_id=entry.pair_id,
    )


# ---------------------------------------------------------------------------
# Run schedule generation
# ---------------------------------------------------------------------------


def build_schedule(
    tasks: list[dict[str, Any]],
    runs_per_condition: int,
    conditions: list[str] | None = None,
    seed: int | None = None,
) -> list[RunScheduleEntry]:
    """Build blocked paired schedule.

    Randomization unit is task+run pair. Each pair contains exactly two adjacent
    entries (ariadne/baseline) with randomized internal order.
    """
    if conditions is None:
        conditions = ["ariadne", "baseline"]

    if len(conditions) != 2:
        raise ValueError("Phase 0 schedule requires exactly two conditions")

    rng = random.Random(seed if seed is not None else DEFAULT_SCHEDULE_SEED)
    pair_blocks: list[list[RunScheduleEntry]] = []

    for task in tasks:
        for run_number in range(1, runs_per_condition + 1):
            pair_id = f"{task['id']}:run{run_number}"
            condition_order = list(conditions)
            rng.shuffle(condition_order)

            pair_entries: list[RunScheduleEntry] = []
            for condition in condition_order:
                pair_entries.append(
                    RunScheduleEntry(
                        task_id=task["id"],
                        condition=condition,
                        run_number=run_number,
                        repo_path=task["repo_path"],
                        prompt=task["prompt"],
                        benchmark=task.get("benchmark"),
                        harness=task.get("harness"),
                        evaluation_config=task.get("evaluation_config"),
                        pair_id=pair_id,
                        schedule_seed=seed if seed is not None else DEFAULT_SCHEDULE_SEED,
                    )
                )
            pair_blocks.append(pair_entries)

    rng.shuffle(pair_blocks)

    flattened: list[RunScheduleEntry] = []
    for pair_entries in pair_blocks:
        flattened.extend(pair_entries)
    return flattened


# ---------------------------------------------------------------------------
# Orchestrators
# ---------------------------------------------------------------------------


def should_fail_fast_on_evaluation(entry: RunScheduleEntry, result: TaskResult, config: BenchmarkConfig) -> bool:
    return (
        config.fail_fast_evaluation
        and entry.evaluation_config is not None
        and result.evaluation_status == "error"
    )


def run_spike(args: argparse.Namespace) -> None:
    """Run a single spike task in both conditions."""
    config = BenchmarkConfig(
        model=args.model,
        ariadne_commit=get_ariadne_commit(),
        ariadne_server_path=args.server_path or str(MCP_SERVER),
        fail_fast_evaluation=True,
    )

    results_dir = Path(args.output).parent if args.output else Path("results")
    results_dir.mkdir(parents=True, exist_ok=True)

    tasks = [
        normalize_task(
            {
                "id": args.task_id,
                "repo_path": args.repo_path,
                "prompt": args.prompt,
            }
        )
    ]

    schedule = build_schedule(tasks, runs_per_condition=1, seed=DEFAULT_SCHEDULE_SEED)

    print(f"Running spike: {len(schedule)} runs for task {args.task_id}")
    print(f"Model: {config.model}")
    print(f"Ariadne server: {config.ariadne_server_path}")
    print()

    results: list[TaskResult] = []
    for i, entry in enumerate(schedule):
        print(f"[{i+1}/{len(schedule)}] {entry.task_id} | {entry.condition} | run {entry.run_number}")
        result = run_task_cli(entry, config, results_dir)
        results.append(result)

        status = "OK" if result.error is None else f"ERROR: {result.error[:80]}"
        eval_status = result.evaluation_status
        print(
            f"  -> {status} ({result.duration_ms}ms, {result.input_tokens or '?'} in / "
            f"{result.output_tokens or '?'} out tokens, eval={eval_status})"
        )
        print()

    output_path = Path(args.output) if args.output else results_dir / "spike_results.json"
    budget_summary = summarize_budget(results, planned_runs=len(schedule), phase_budget_usd=None, stopped_early=False, stop_reason=None)
    save_results(results, config, output_path, budget_summary, {"schedule_strategy": "blocked_paired"})
    print(f"Results saved to {output_path}")


def run_full(args: argparse.Namespace) -> None:
    """Run full benchmark from manifest."""
    manifest = json.loads(Path(args.manifest).read_text())

    env = manifest.get("environment", {})
    seed = args.seed if args.seed is not None else int(env.get("seed", DEFAULT_SCHEDULE_SEED))
    phase_budget_usd = args.phase_budget_usd
    if phase_budget_usd is None and isinstance(env.get("phase_budget_usd"), (int, float)):
        phase_budget_usd = float(env["phase_budget_usd"])

    config = BenchmarkConfig(
        model=args.model or env.get("model", DEFAULT_MODEL),
        max_turns=int(env.get("max_turns", DEFAULT_MAX_TURNS)),
        max_budget_usd=float(env.get("max_budget_usd", DEFAULT_BUDGET_USD)),
        timeout_seconds=int(env.get("timeout_seconds", DEFAULT_TIMEOUT)),
        ariadne_commit=get_ariadne_commit(),
        ariadne_server_path=args.server_path or str(MCP_SERVER),
        phase_budget_usd=phase_budget_usd,
        schedule_seed=seed,
        fail_fast_evaluation=bool(env.get("fail_fast_evaluation", args.fail_fast_eval)),
    )

    tasks = [normalize_task(task) for task in manifest["tasks"]]
    schedule = build_schedule(
        tasks,
        runs_per_condition=args.runs_per_condition,
        seed=seed,
    )

    planned_runs = len(schedule)

    results_dir = Path(args.output).parent if args.output else Path("results")
    results_dir.mkdir(parents=True, exist_ok=True)

    print(f"Full benchmark: {planned_runs} runs across {len(tasks)} tasks")
    print(f"Runs per condition: {args.runs_per_condition}")
    print(f"Model: {config.model}")
    print(f"Mode: {args.mode}")
    print(f"Schedule: blocked paired (seed={config.schedule_seed})")
    if config.phase_budget_usd is not None:
        print(
            f"Phase budget cap: ${config.phase_budget_usd:.2f} "
            f"(stop threshold ${config.phase_budget_usd * BUDGET_STOP_RATIO:.2f})"
        )
    print()

    if args.mode == "sdk":
        results, stopped_early, stop_reason = asyncio.run(
            run_full_sdk(schedule, config)
        )
    else:
        results, stopped_early, stop_reason = run_full_cli(schedule, config, results_dir)

    output_path = Path(args.output) if args.output else results_dir / "full_results.json"
    budget_summary = summarize_budget(
        results,
        planned_runs=planned_runs,
        phase_budget_usd=config.phase_budget_usd,
        stopped_early=stopped_early,
        stop_reason=stop_reason,
    )
    save_results(
        results,
        config,
        output_path,
        budget_summary,
        {
            "schedule_strategy": "blocked_paired",
            "stopped_early": stopped_early,
            "stop_reason": stop_reason,
        },
    )
    print(f"\nResults saved to {output_path}")


def run_full_cli(
    schedule: list[RunScheduleEntry],
    config: BenchmarkConfig,
    results_dir: Path,
) -> tuple[list[TaskResult], bool, str | None]:
    """Execute full schedule sequentially using CLI mode with budget/eval guardrails."""
    results: list[TaskResult] = []
    spend_usd = 0.0

    for i, entry in enumerate(schedule):
        if should_stop_for_budget(spend_usd, config.phase_budget_usd):
            reason = f"Budget stop threshold reached at ${spend_usd:.2f}"
            print(f"STOP: {reason}")
            return results, True, reason

        print(
            f"[{i+1}/{len(schedule)}] {entry.task_id} | {entry.condition} | run {entry.run_number} "
            f"| pair {entry.pair_id}"
        )
        result = run_task_cli(entry, config, results_dir)
        results.append(result)

        cost = result_cost_usd(result)
        if cost is not None:
            spend_usd += cost

        status = "OK" if result.error is None else "ERROR"
        eval_status = result.evaluation_status
        tokens = f"{result.input_tokens or '?'}in/{result.output_tokens or '?'}out"
        cost_str = f"${cost:.3f}" if cost is not None else "cost=?"
        print(f"  -> {status} ({result.duration_ms}ms, {tokens}, {cost_str}, eval={eval_status})")

        if should_fail_fast_on_evaluation(entry, result, config):
            reason = f"Fail-fast evaluator error on {entry.task_id} run {entry.run_number}"
            print(f"STOP: {reason}")
            return results, True, reason

    return results, False, None


async def run_full_sdk(
    schedule: list[RunScheduleEntry],
    config: BenchmarkConfig,
) -> tuple[list[TaskResult], bool, str | None]:
    """Execute full schedule using SDK mode.

    Kept sequential in Phase 0 so budget/evaluation guardrails are deterministic.
    """
    results: list[TaskResult] = []
    spend_usd = 0.0

    for i, entry in enumerate(schedule):
        if should_stop_for_budget(spend_usd, config.phase_budget_usd):
            reason = f"Budget stop threshold reached at ${spend_usd:.2f}"
            print(f"STOP: {reason}")
            return results, True, reason

        print(
            f"[{i+1}/{len(schedule)}] {entry.task_id} | {entry.condition} | run {entry.run_number} "
            f"| pair {entry.pair_id}"
        )
        result = await run_task_sdk(entry, config)
        results.append(result)

        cost = result_cost_usd(result)
        if cost is not None:
            spend_usd += cost

        status = "OK" if result.error is None else "ERROR"
        eval_status = result.evaluation_status
        cost_str = f"${cost:.3f}" if cost is not None else "cost=?"
        print(f"  -> {status} ({cost_str}, eval={eval_status})")

        if should_fail_fast_on_evaluation(entry, result, config):
            reason = f"Fail-fast evaluator error on {entry.task_id} run {entry.run_number}"
            print(f"STOP: {reason}")
            return results, True, reason

    return results, False, None


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------


def get_ariadne_commit() -> str | None:
    """Get current Ariadne git commit hash."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=str(ARIADNE_ROOT),
            capture_output=True,
            text=True,
            timeout=5,
        )
        return result.stdout.strip() if result.returncode == 0 else None
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return None


def save_results(
    results: list[TaskResult],
    config: BenchmarkConfig,
    output_path: Path,
    budget_summary: dict[str, Any],
    extra_metadata: dict[str, Any] | None = None,
) -> None:
    """Save results to JSON file."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    metadata: dict[str, Any] = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "ariadne_commit": config.ariadne_commit,
        "model": config.model,
        "max_turns": config.max_turns,
        "max_budget_usd": config.max_budget_usd,
        "schedule_seed": config.schedule_seed,
        "phase_budget_usd": config.phase_budget_usd,
        "budget_summary": budget_summary,
    }
    if extra_metadata:
        metadata.update(extra_metadata)

    data = {
        "metadata": metadata,
        "results": [asdict(r) for r in results],
    }
    output_path.write_text(json.dumps(data, indent=2))


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Ariadne MCP Benchmark Runner",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    spike = subparsers.add_parser("spike", help="Run a single spike task")
    spike.add_argument("--task-id", required=True, help="Task identifier")
    spike.add_argument("--repo-path", required=True, help="Path to target repository")
    spike.add_argument(
        "--prompt",
        default="Fix the bug described in the issue. Run the relevant tests to verify your fix.",
        help="Prompt for Claude",
    )
    spike.add_argument("--model", default=DEFAULT_MODEL, help="Model to use")
    spike.add_argument("--server-path", help="Path to Ariadne MCP server.js")
    spike.add_argument("--output", help="Output JSON path")

    full = subparsers.add_parser("full", help="Run full benchmark from manifest")
    full.add_argument("--manifest", required=True, help="Path to manifest.json")
    full.add_argument("--runs-per-condition", type=int, default=3, help="Runs per task per condition")
    full.add_argument("--max-concurrent", type=int, default=5, help="Unused in Phase 0 SDK mode (kept for compatibility)")
    full.add_argument("--mode", choices=["cli", "sdk"], default="cli", help="Execution mode")
    full.add_argument("--model", default=None, help="Override manifest model")
    full.add_argument("--server-path", help="Path to Ariadne MCP server.js")
    full.add_argument("--seed", type=int, default=None, help="Random seed for blocked paired scheduling")
    full.add_argument("--phase-budget-usd", type=float, default=None, help="Optional phase-level budget cap")
    full.add_argument(
        "--fail-fast-eval",
        dest="fail_fast_eval",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Stop run on evaluator output errors",
    )
    full.add_argument("--output", help="Output JSON path")

    args = parser.parse_args()

    if args.command == "spike":
        run_spike(args)
    elif args.command == "full":
        run_full(args)


if __name__ == "__main__":
    main()
