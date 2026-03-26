#!/usr/bin/env python3
"""
Fetch SWE-bench task metadata from HuggingFace and prepare local repo checkout.

Pulls instance metadata from SWE-bench Lite, clones the target repo at the
specified base_commit, and generates a manifest entry for run_benchmark.py.

Usage:
    python fetch_swebench_tasks.py --instance-id django__django-16379 --output-dir /tmp/swebench
    python fetch_swebench_tasks.py --instance-id django__django-16379 --output-dir /tmp/swebench --update-manifest manifest.json
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

from datasets import load_dataset

BENCHMARKS_DIR = Path(__file__).resolve().parent
DATASET_NAME = "SWE-bench/SWE-bench_Lite"


def fetch_instance(instance_id: str, split: str = "test") -> dict:
    """Load a single SWE-bench instance from HuggingFace."""
    dataset = load_dataset(DATASET_NAME, split=split)
    for row in dataset:
        if row["instance_id"] == instance_id:
            return dict(row)
    print(f"Error: instance_id '{instance_id}' not found in {DATASET_NAME} ({split} split)", file=sys.stderr)
    sys.exit(1)


def clone_repo_at_commit(repo: str, base_commit: str, instance_id: str, output_dir: Path) -> Path:
    """Clone the repo at base_commit using a blobless partial clone."""
    repo_url = f"https://github.com/{repo}.git"
    repo_dir = output_dir / instance_id

    if repo_dir.exists():
        print(f"  Repo dir exists, resetting to {base_commit[:12]}...")
        subprocess.run(
            ["git", "checkout", base_commit],
            cwd=repo_dir, check=True, capture_output=True,
        )
        subprocess.run(
            ["git", "clean", "-fdx"],
            cwd=repo_dir, check=True, capture_output=True,
        )
        return repo_dir

    print(f"  Cloning {repo_url} (blobless)...")
    subprocess.run(
        ["git", "clone", "--filter=blob:none", repo_url, str(repo_dir)],
        check=True,
    )
    subprocess.run(
        ["git", "checkout", base_commit],
        cwd=repo_dir, check=True, capture_output=True,
    )
    return repo_dir


def save_task_metadata(instance: dict, output_dir: Path) -> Path:
    """Save task metadata JSON for reference and evaluator use."""
    metadata_path = output_dir / f"{instance['instance_id']}.json"
    metadata = {
        "instance_id": instance["instance_id"],
        "repo": instance["repo"],
        "base_commit": instance["base_commit"],
        "problem_statement": instance["problem_statement"],
        "test_patch": instance["test_patch"],
        "FAIL_TO_PASS": _parse_json_field(instance["FAIL_TO_PASS"]),
        "PASS_TO_PASS": _parse_json_field(instance["PASS_TO_PASS"]),
        "version": instance.get("version", ""),
        "environment_setup_commit": instance.get("environment_setup_commit", ""),
    }
    metadata_path.write_text(json.dumps(metadata, indent=2))
    return metadata_path


def _parse_json_field(value: str | list) -> list:
    """Parse a field that may be a JSON string or already a list."""
    if isinstance(value, str):
        return json.loads(value)
    return value


def generate_manifest_entry(instance: dict, repo_dir: Path) -> dict:
    """Generate a manifest.json task entry for this SWE-bench instance."""
    return {
        "id": instance["instance_id"],
        "benchmark": "swe-bench-lite",
        "repo_path": str(repo_dir),
        "prompt": instance["problem_statement"],
        "evaluation": {
            "type": "command_json",
            "command": "{python} {benchmarks_dir}/evaluators/swebench_eval.py --instance-id {task_id} --repo-path {repo_path}",
            "timeout_seconds": 300,
        },
    }


def update_manifest(manifest_path: Path, entry: dict) -> None:
    """Replace or add a task entry in the manifest file."""
    manifest = json.loads(manifest_path.read_text())
    tasks = manifest.get("tasks", [])

    # Replace existing entry with same id, or append
    replaced = False
    for i, task in enumerate(tasks):
        if task["id"] == entry["id"]:
            tasks[i] = entry
            replaced = True
            break
    if not replaced:
        tasks.append(entry)

    manifest["tasks"] = tasks
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")


def main():
    parser = argparse.ArgumentParser(description="Fetch SWE-bench task and prepare local repo")
    parser.add_argument("--instance-id", required=True, help="SWE-bench instance ID (e.g., django__django-16379)")
    parser.add_argument("--output-dir", required=True, help="Directory for repo checkouts and metadata")
    parser.add_argument("--split", default="test", help="Dataset split (default: test)")
    parser.add_argument("--update-manifest", metavar="PATH", help="Path to manifest.json to update with generated entry")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Fetching {args.instance_id} from {DATASET_NAME}...")
    instance = fetch_instance(args.instance_id, split=args.split)

    print(f"Cloning {instance['repo']} at {instance['base_commit'][:12]}...")
    repo_dir = clone_repo_at_commit(
        instance["repo"], instance["base_commit"], args.instance_id, output_dir,
    )
    print(f"  Repo ready at: {repo_dir}")

    print("Saving task metadata...")
    metadata_path = save_task_metadata(instance, output_dir)
    print(f"  Metadata: {metadata_path}")

    entry = generate_manifest_entry(instance, repo_dir)
    entry_path = output_dir / f"{args.instance_id}.manifest_entry.json"
    entry_path.write_text(json.dumps(entry, indent=2) + "\n")
    print(f"  Manifest entry: {entry_path}")

    if args.update_manifest:
        manifest_path = Path(args.update_manifest)
        update_manifest(manifest_path, entry)
        print(f"  Updated manifest: {manifest_path}")

    print("\nManifest entry:")
    print(json.dumps(entry, indent=2))


if __name__ == "__main__":
    main()
