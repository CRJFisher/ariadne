#!/usr/bin/env python3
"""
Ariadne MCP Benchmark Runner

Runs standardized benchmarks with and without Ariadne MCP to measure
accuracy lift and efficiency gains.

Execution modes:
- CLI mode: Uses `claude -p` subprocess (spikes, quick tests)
- SDK mode: Uses claude-code-sdk (full runs, better metrics, parallelism)

Usage:
    # Single spike task (CLI mode)
    python run_benchmark.py spike \
        --task-id django__django-16379 \
        --repo-path /path/to/django \
        --prompt "Fix the bug. Run tests to verify."

    # Full benchmark (SDK mode with manifest)
    python run_benchmark.py full \
        --manifest manifest.json \
        --runs-per-condition 3 \
        --max-concurrent 5 \
        --output results/full_run.json

    # Full benchmark (CLI fallback)
    python run_benchmark.py full \
        --manifest manifest.json \
        --runs-per-condition 3 \
        --mode cli \
        --output results/full_run.json
"""

import argparse
import asyncio
import json
import os
import random
import subprocess
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path


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


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class TaskResult:
    task_id: str
    condition: str  # "ariadne" or "baseline"
    run_number: int
    passed: bool | None  # None = not evaluated yet
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


@dataclass
class BenchmarkConfig:
    model: str = DEFAULT_MODEL
    max_turns: int = DEFAULT_MAX_TURNS
    max_budget_usd: float = DEFAULT_BUDGET_USD
    timeout_seconds: int = DEFAULT_TIMEOUT
    ariadne_commit: str | None = None
    ariadne_server_path: str = str(MCP_SERVER)


@dataclass
class RunScheduleEntry:
    task_id: str
    condition: str
    run_number: int
    repo_path: str
    prompt: str


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

    # Build command
    cmd = [
        "claude",
        "-p", entry.prompt,
        "--output-format", "stream-json",
        "--no-session-persistence",
        "--model", config.model,
        "--max-turns", str(config.max_turns),
    ]

    # Add MCP config for treatment condition
    mcp_config_path = None
    if entry.condition == "ariadne":
        mcp_config_path = results_dir / f"mcp-config-{entry.task_id}-{entry.run_number}.json"
        write_mcp_config(entry.repo_path, config.ariadne_server_path, mcp_config_path)
        cmd.extend(["--mcp-config", str(mcp_config_path)])
        cmd.extend([
            "--allowedTools",
            "mcp__ariadne__list_entrypoints",
            "mcp__ariadne__show_call_graph_neighborhood",
            "Read", "Glob", "Grep", "Bash", "Edit", "Write",
        ])

    # Save transcript
    transcript_path = (
        results_dir
        / f"{entry.task_id}_{entry.condition}_run{entry.run_number}.jsonl"
    )

    try:
        result = subprocess.run(
            cmd,
            cwd=entry.repo_path,
            capture_output=True,
            text=True,
            timeout=config.timeout_seconds,
        )

        # Save raw output as transcript
        transcript_path.write_text(result.stdout)

        # Parse stream-json output for metrics
        metrics = parse_stream_json(result.stdout)
        duration_ms = int(time.monotonic() * 1000) - start_ms

        return TaskResult(
            task_id=entry.task_id,
            condition=entry.condition,
            run_number=entry.run_number,
            passed=None,  # Evaluation done separately
            total_cost_usd=metrics.get("cost_usd"),
            input_tokens=metrics.get("input_tokens"),
            output_tokens=metrics.get("output_tokens"),
            cache_read_tokens=metrics.get("cache_read_tokens"),
            cache_creation_tokens=metrics.get("cache_creation_tokens"),
            num_turns=metrics.get("num_turns"),
            duration_ms=duration_ms,
            tool_calls=metrics.get("tool_calls"),
            model_id=config.model,
            error=result.stderr if result.returncode != 0 else None,
            timestamp=timestamp,
            ariadne_commit=config.ariadne_commit,
            transcript_path=str(transcript_path),
        )

    except subprocess.TimeoutExpired:
        duration_ms = int(time.monotonic() * 1000) - start_ms
        return TaskResult(
            task_id=entry.task_id,
            condition=entry.condition,
            run_number=entry.run_number,
            passed=False,
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
        )
    finally:
        # Clean up temp MCP config
        if mcp_config_path and mcp_config_path.exists():
            mcp_config_path.unlink()


def parse_stream_json(output: str) -> dict:
    """Parse claude --output-format stream-json output for metrics.

    Stream-json outputs one JSON object per line. The last 'result' message
    contains aggregate metrics. Individual messages contain token usage.
    """
    input_tokens = 0
    output_tokens = 0
    cache_read_tokens = 0
    cache_creation_tokens = 0
    num_turns = 0
    tool_calls = []
    cost_usd = None
    seen_message_ids: set[str] = set()

    for line in output.strip().splitlines():
        if not line.strip():
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue

        msg_type = obj.get("type", "")

        if msg_type == "result":
            # Final result message — may have aggregate stats
            cost_usd = obj.get("cost_usd") or obj.get("total_cost_usd")
            num_turns = obj.get("num_turns", num_turns)
            if "usage" in obj:
                usage = obj["usage"]
                input_tokens = usage.get("input_tokens", input_tokens)
                output_tokens = usage.get("output_tokens", output_tokens)

        elif msg_type == "assistant":
            # Deduplicate by message ID (streaming sends same ID multiple times)
            msg_id = obj.get("message", {}).get("id")
            if msg_id and msg_id in seen_message_ids:
                # Last occurrence wins — subtract previous and add new
                pass
            if msg_id:
                seen_message_ids.add(msg_id)

            usage = obj.get("message", {}).get("usage", {})
            if usage:
                input_tokens += usage.get("input_tokens", 0)
                output_tokens += usage.get("output_tokens", 0)
                cache_read_tokens += usage.get("cache_read_input_tokens", 0)
                cache_creation_tokens += usage.get("cache_creation_input_tokens", 0)
                num_turns += 1

        elif msg_type == "tool_use":
            tool_calls.append({
                "tool": obj.get("tool", obj.get("name", "unknown")),
                "timestamp": obj.get("timestamp"),
            })

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
        from claude_code_sdk import query, ClaudeCodeOptions
    except ImportError:
        raise ImportError(
            "claude-code-sdk not installed. "
            "Install with: pip install claude-code-sdk\n"
            "Or use --mode cli for subprocess execution."
        )

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

    allowed_tools = [
        "Read", "Glob", "Grep", "Bash", "Edit", "Write",
    ]
    if entry.condition == "ariadne":
        allowed_tools.extend([
            "mcp__ariadne__list_entrypoints",
            "mcp__ariadne__show_call_graph_neighborhood",
        ])

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
                return TaskResult(
                    task_id=entry.task_id,
                    condition=entry.condition,
                    run_number=entry.run_number,
                    passed=None,
                    total_cost_usd=getattr(message, "total_cost_usd", None),
                    input_tokens=getattr(message.usage, "input_tokens", None) if hasattr(message, "usage") else None,
                    output_tokens=getattr(message.usage, "output_tokens", None) if hasattr(message, "usage") else None,
                    cache_read_tokens=getattr(message.usage, "cache_read_input_tokens", None) if hasattr(message, "usage") else None,
                    cache_creation_tokens=getattr(message.usage, "cache_creation_input_tokens", None) if hasattr(message, "usage") else None,
                    num_turns=getattr(message, "num_turns", None),
                    duration_ms=getattr(message, "duration_ms", None),
                    tool_calls=None,
                    model_id=config.model,
                    error=None,
                    timestamp=timestamp,
                    ariadne_commit=config.ariadne_commit,
                    transcript_path=None,
                )
    except Exception as e:
        return TaskResult(
            task_id=entry.task_id,
            condition=entry.condition,
            run_number=entry.run_number,
            passed=False,
            total_cost_usd=None,
            input_tokens=None,
            output_tokens=None,
            cache_read_tokens=None,
            cache_creation_tokens=None,
            num_turns=None,
            duration_ms=None,
            tool_calls=None,
            model_id=config.model,
            error=str(e),
            timestamp=timestamp,
            ariadne_commit=config.ariadne_commit,
            transcript_path=None,
        )

    # Should not reach here, but handle gracefully
    return TaskResult(
        task_id=entry.task_id,
        condition=entry.condition,
        run_number=entry.run_number,
        passed=None,
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
    )


# ---------------------------------------------------------------------------
# Run schedule generation
# ---------------------------------------------------------------------------

def build_schedule(
    tasks: list[dict],
    runs_per_condition: int,
    conditions: list[str] | None = None,
    seed: int | None = None,
) -> list[RunScheduleEntry]:
    """Build an interleaved, shuffled run schedule.

    Interleaving ensures that infrastructure noise (API latency, model routing)
    is distributed evenly across conditions rather than confounding results.
    """
    if conditions is None:
        conditions = ["ariadne", "baseline"]

    entries = []
    for task in tasks:
        for condition in conditions:
            for run in range(1, runs_per_condition + 1):
                entries.append(RunScheduleEntry(
                    task_id=task["id"],
                    condition=condition,
                    run_number=run,
                    repo_path=task.get("repo_path", task.get("repo", "")),
                    prompt=task.get("prompt", ""),
                ))

    rng = random.Random(seed if seed is not None else 42)
    rng.shuffle(entries)
    return entries


# ---------------------------------------------------------------------------
# Orchestrators
# ---------------------------------------------------------------------------

def run_spike(args: argparse.Namespace) -> None:
    """Run a single spike task in both conditions."""
    config = BenchmarkConfig(
        model=args.model,
        ariadne_commit=get_ariadne_commit(),
        ariadne_server_path=args.server_path or str(MCP_SERVER),
    )

    results_dir = Path(args.output).parent if args.output else Path("results")
    results_dir.mkdir(parents=True, exist_ok=True)

    tasks = [{
        "id": args.task_id,
        "repo_path": args.repo_path,
        "prompt": args.prompt,
    }]

    schedule = build_schedule(tasks, runs_per_condition=1)

    print(f"Running spike: {len(schedule)} runs for task {args.task_id}")
    print(f"Model: {config.model}")
    print(f"Ariadne server: {config.ariadne_server_path}")
    print()

    results = []
    for i, entry in enumerate(schedule):
        print(f"[{i+1}/{len(schedule)}] {entry.task_id} | {entry.condition} | run {entry.run_number}")
        result = run_task_cli(entry, config, results_dir)
        results.append(result)

        status = "OK" if result.error is None else f"ERROR: {result.error[:80]}"
        print(f"  -> {status} ({result.duration_ms}ms, {result.input_tokens or '?'} in / {result.output_tokens or '?'} out tokens)")
        print()

    output_path = Path(args.output) if args.output else results_dir / "spike_results.json"
    save_results(results, config, output_path)
    print(f"Results saved to {output_path}")


def run_full(args: argparse.Namespace) -> None:
    """Run full benchmark from manifest."""
    manifest = json.loads(Path(args.manifest).read_text())

    env = manifest.get("environment", {})
    config = BenchmarkConfig(
        model=args.model or env.get("model", DEFAULT_MODEL),
        max_turns=env.get("max_turns", DEFAULT_MAX_TURNS),
        max_budget_usd=env.get("max_budget_usd", DEFAULT_BUDGET_USD),
        timeout_seconds=env.get("timeout_seconds", DEFAULT_TIMEOUT),
        ariadne_commit=get_ariadne_commit(),
        ariadne_server_path=args.server_path or str(MCP_SERVER),
    )

    tasks = manifest["tasks"]
    schedule = build_schedule(
        tasks,
        runs_per_condition=args.runs_per_condition,
        seed=args.seed,
    )

    results_dir = Path(args.output).parent if args.output else Path("results")
    results_dir.mkdir(parents=True, exist_ok=True)

    print(f"Full benchmark: {len(schedule)} runs across {len(tasks)} tasks")
    print(f"Runs per condition: {args.runs_per_condition}")
    print(f"Model: {config.model}")
    print(f"Mode: {args.mode}")
    print()

    if args.mode == "sdk":
        results = asyncio.run(run_full_sdk(schedule, config, args.max_concurrent))
    else:
        results = run_full_cli(schedule, config, results_dir)

    output_path = Path(args.output) if args.output else results_dir / "full_results.json"
    save_results(results, config, output_path)
    print(f"\nResults saved to {output_path}")


def run_full_cli(
    schedule: list[RunScheduleEntry],
    config: BenchmarkConfig,
    results_dir: Path,
) -> list[TaskResult]:
    """Execute full schedule sequentially using CLI mode."""
    results = []
    for i, entry in enumerate(schedule):
        print(f"[{i+1}/{len(schedule)}] {entry.task_id} | {entry.condition} | run {entry.run_number}")
        result = run_task_cli(entry, config, results_dir)
        results.append(result)

        status = "OK" if result.error is None else f"ERROR: {result.error[:80]}"
        tokens = f"{result.input_tokens or '?'}in/{result.output_tokens or '?'}out"
        print(f"  -> {status} ({result.duration_ms}ms, {tokens})")

    return results


async def run_full_sdk(
    schedule: list[RunScheduleEntry],
    config: BenchmarkConfig,
    max_concurrent: int,
) -> list[TaskResult]:
    """Execute full schedule with async parallelism using SDK mode."""
    semaphore = asyncio.Semaphore(max_concurrent)
    results: list[TaskResult] = []

    async def run_with_semaphore(entry: RunScheduleEntry) -> TaskResult:
        async with semaphore:
            print(f"  START {entry.task_id} | {entry.condition} | run {entry.run_number}")
            result = await run_task_sdk(entry, config)
            status = "OK" if result.error is None else f"ERROR"
            print(f"  DONE  {entry.task_id} | {entry.condition} | {status}")
            return result

    tasks = [run_with_semaphore(entry) for entry in schedule]
    results = await asyncio.gather(*tasks)
    return list(results)


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
) -> None:
    """Save results to JSON file."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "ariadne_commit": config.ariadne_commit,
            "model": config.model,
            "max_turns": config.max_turns,
            "max_budget_usd": config.max_budget_usd,
        },
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

    # Spike subcommand
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

    # Full subcommand
    full = subparsers.add_parser("full", help="Run full benchmark from manifest")
    full.add_argument("--manifest", required=True, help="Path to manifest.json")
    full.add_argument("--runs-per-condition", type=int, default=3, help="Runs per task per condition")
    full.add_argument("--max-concurrent", type=int, default=5, help="Max concurrent runs (SDK mode)")
    full.add_argument("--mode", choices=["cli", "sdk"], default="cli", help="Execution mode")
    full.add_argument("--model", default=None, help="Override manifest model")
    full.add_argument("--server-path", help="Path to Ariadne MCP server.js")
    full.add_argument("--seed", type=int, default=42, help="Random seed for schedule shuffling")
    full.add_argument("--output", help="Output JSON path")

    args = parser.parse_args()

    if args.command == "spike":
        run_spike(args)
    elif args.command == "full":
        run_full(args)


if __name__ == "__main__":
    main()
