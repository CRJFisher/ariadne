#!/usr/bin/env python3
"""
SWE-bench evaluator adapter for Ariadne benchmark runner.

Wraps SWE-bench's Docker-based evaluation in the command_json contract
expected by run_benchmark.py. Extracts the agent's patch from the repo,
runs Docker-based evaluation via the swebench harness, and emits a JSON
verdict on stdout.

Usage (called by run_benchmark.py via manifest command template):
    python swebench_eval.py --instance-id django__django-16379 --repo-path /tmp/swebench/django__django-16379

Direct usage with pre-generated predictions:
    python swebench_eval.py --instance-id django__django-16379 --repo-path /tmp/swebench/django__django-16379 --predictions-path preds.jsonl
"""

import argparse
import glob
import json
import subprocess
import sys
import tempfile
from pathlib import Path

DATASET_NAME = "SWE-bench/SWE-bench_Lite"
MODEL_NAME = "ariadne-benchmark"


def extract_patch(repo_path: Path) -> str:
    """Extract all agent changes (tracked + untracked) as a unified diff."""
    # Stage everything so new files are included in the diff
    subprocess.run(
        ["git", "add", "-A"],
        cwd=repo_path, capture_output=True,
    )
    result = subprocess.run(
        ["git", "diff", "--cached", "HEAD"],
        cwd=repo_path, capture_output=True, text=True,
    )
    return result.stdout


def write_predictions(instance_id: str, patch: str, output_path: Path) -> None:
    """Write predictions in SWE-bench JSONL format."""
    prediction = {
        "instance_id": instance_id,
        "model_name_or_path": MODEL_NAME,
        "model_patch": patch,
    }
    output_path.write_text(json.dumps(prediction) + "\n")


def _resolve_docker_host() -> dict[str, str]:
    """Detect the Docker socket and return env vars to pass to subprocesses."""
    import os
    env = os.environ.copy()
    if "DOCKER_HOST" not in env:
        # macOS Docker Desktop uses a non-standard socket path
        user_sock = Path.home() / ".docker" / "run" / "docker.sock"
        if user_sock.exists():
            env["DOCKER_HOST"] = f"unix://{user_sock}"
    return env


def run_swebench_evaluation(
    instance_id: str,
    predictions_path: Path,
    run_id: str,
    report_dir: Path,
) -> subprocess.CompletedProcess:
    """Run SWE-bench Docker-based evaluation via CLI."""
    cmd = [
        sys.executable, "-m", "swebench.harness.run_evaluation",
        "--dataset_name", DATASET_NAME,
        "--split", "test",
        "--instance_ids", instance_id,
        "--predictions_path", str(predictions_path),
        "--max_workers", "1",
        "--run_id", run_id,
        "--cache_level", "instance",
        "--report_dir", str(report_dir),
        "--timeout", "300",
    ]
    return subprocess.run(
        cmd, capture_output=True, text=True, timeout=600,
        env=_resolve_docker_host(),
        cwd=str(report_dir),
    )


def find_report(run_id: str, report_dir: Path) -> dict | None:
    """Locate and parse the SWE-bench aggregate report JSON."""
    # SWE-bench writes report as {cwd}/{model_name}.{run_id}.json
    candidates = [
        report_dir / f"{MODEL_NAME}.{run_id}.json",
        report_dir / f"{MODEL_NAME}__{run_id}.json",
    ]
    for candidate in candidates:
        if candidate.exists():
            try:
                return json.loads(candidate.read_text())
            except (json.JSONDecodeError, OSError):
                continue

    # Fallback: glob for any report matching run_id
    for path in glob.glob(str(report_dir / f"*{run_id}*.json")):
        try:
            return json.loads(Path(path).read_text())
        except (json.JSONDecodeError, OSError):
            continue

    return None


def check_resolved(report: dict, instance_id: str) -> bool:
    """Check whether the instance was resolved in the report."""
    resolved = report.get("resolved_ids", report.get("resolved", []))
    return instance_id in resolved


def emit(payload: dict) -> None:
    """Print JSON verdict to stdout (command_json contract)."""
    print(json.dumps(payload))


def main():
    parser = argparse.ArgumentParser(description="SWE-bench evaluator adapter")
    parser.add_argument("--instance-id", required=True)
    parser.add_argument("--repo-path", required=True)
    parser.add_argument("--predictions-path", help="Path to pre-generated predictions JSONL (optional)")
    args = parser.parse_args()

    repo_path = Path(args.repo_path)
    instance_id = args.instance_id
    run_id = f"ariadne_eval_{instance_id}"

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)

        # Prepare predictions
        if args.predictions_path:
            predictions_path = Path(args.predictions_path)
        else:
            patch = extract_patch(repo_path)
            if not patch.strip():
                emit({"status": "ok", "passed": False, "error": "No changes detected in repo"})
                return
            predictions_path = tmpdir_path / "predictions.jsonl"
            write_predictions(instance_id, patch, predictions_path)

        report_dir = tmpdir_path / "reports"
        report_dir.mkdir()

        # Run Docker-based evaluation
        proc = run_swebench_evaluation(instance_id, predictions_path, run_id, report_dir)

        if proc.returncode != 0:
            emit({
                "status": "error",
                "passed": False,
                "error": f"swebench harness exited {proc.returncode}: {proc.stderr[-2000:]}",
            })
            return

        # Parse results
        report = find_report(run_id, report_dir)
        if report is None:
            emit({
                "status": "error",
                "passed": False,
                "error": "Could not locate SWE-bench evaluation report",
            })
            return

        passed = check_resolved(report, instance_id)

        # Save full report for artifact reference
        details_path = str(report_dir / f"{instance_id}_details.json")
        Path(details_path).write_text(json.dumps(report, indent=2))

        emit({
            "status": "ok",
            "passed": passed,
            "details_path": details_path,
        })


if __name__ == "__main__":
    main()
