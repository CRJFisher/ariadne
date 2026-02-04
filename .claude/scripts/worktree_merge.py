#!/usr/bin/env python3
"""
Worktree Merge with Cleanup

Merges worktree changes back to the target branch and handles cleanup
of WezTerm tabs. Sandbox processes exit automatically when the shell closes.
"""
# /// script
# requires-python = ">=3.11"
# ///

import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

# Import sibling modules
from worktree_state import load_state, remove_worktree, get_state_file_path
from worktree_wezterm import wezterm_available, close_tab, pane_exists


@dataclass
class MergeResult:
    """Result of a merge operation."""
    success: bool
    message: str
    warnings: list[str]

    def __str__(self) -> str:
        output = self.message
        if self.warnings:
            output += "\n\nWarnings:"
            for w in self.warnings:
                output += f"\n  - {w}"
        return output


def get_git_root() -> Optional[Path]:
    """Get the root of the current git repository."""
    result = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        return Path(result.stdout.strip())
    return None


def get_current_branch() -> Optional[str]:
    """Get the current git branch name."""
    result = subprocess.run(
        ["git", "branch", "--show-current"],
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        return result.stdout.strip()
    return None


def has_uncommitted_changes(worktree_path: Path) -> tuple[bool, str]:
    """Check if a worktree has uncommitted changes."""
    result = subprocess.run(
        ["git", "status", "--porcelain"],
        capture_output=True,
        text=True,
        cwd=worktree_path,
    )
    if result.returncode != 0:
        return True, "Error checking git status"

    if result.stdout.strip():
        return True, result.stdout.strip()
    return False, ""


def get_worktree_info(worktree_path: Path) -> Optional[tuple[str, str]]:
    """Get (worktree_path, branch) from git worktree list."""
    result = subprocess.run(
        ["git", "worktree", "list", "--porcelain"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return None

    current_worktree = None
    current_branch = None

    for line in result.stdout.split("\n"):
        if line.startswith("worktree "):
            path = line[9:]
            if Path(path).resolve() == worktree_path.resolve():
                current_worktree = path
        elif line.startswith("branch ") and current_worktree:
            current_branch = line[7:]
            return current_worktree, current_branch

    return None


def merge_worktree(
    worktree_name: str,
    target_branch: str = "main",
    strategy: str = "merge",  # "merge", "squash", or "rebase"
    delete_branch: bool = True,
    project_path: Optional[Path] = None,
) -> MergeResult:
    """
    Merge a worktree back to the target branch with full cleanup.

    Args:
        worktree_name: Name of the worktree to merge
        target_branch: Branch to merge into (default: main)
        strategy: Merge strategy - "merge", "squash", or "rebase"
        delete_branch: Whether to delete the branch after merge
        project_path: Path to the main repository (auto-detected if not provided)

    Returns:
        MergeResult with success status, message, and any warnings
    """
    warnings = []

    # Get project root
    if project_path is None:
        project_path = get_git_root()
        if project_path is None:
            return MergeResult(False, "Error: Not in a git repository", [])

    worktree_path = project_path / ".worktrees" / worktree_name
    branch_name = f"worktree/{worktree_name}"

    # Step 1: Validate worktree exists
    if not worktree_path.exists():
        return MergeResult(
            False,
            f"Error: Worktree '{worktree_name}' not found at {worktree_path}",
            [],
        )

    # Step 2: Close WezTerm tab (if pane_id exists in state)
    # Note: Sandbox processes exit automatically when the tab closes
    state = load_state(project_path)
    entry = state.find(worktree_name)
    if entry and entry.pane_id and wezterm_available():
        if pane_exists(entry.pane_id):
            success, msg = close_tab(entry.pane_id)
            if not success:
                warnings.append(msg)

    # Step 3: Check for uncommitted changes
    has_changes, status = has_uncommitted_changes(worktree_path)
    if has_changes:
        return MergeResult(
            False,
            f"Error: Worktree has uncommitted changes. Commit or stash first:\n{status}",
            warnings,
        )

    # Step 4: Checkout target branch in main repo
    current_branch = get_current_branch()
    result = subprocess.run(
        ["git", "checkout", target_branch],
        capture_output=True,
        text=True,
        cwd=project_path,
    )
    if result.returncode != 0:
        return MergeResult(
            False,
            f"Error: Could not checkout '{target_branch}': {result.stderr.strip()}",
            warnings,
        )

    # Step 5: Perform merge based on strategy
    if strategy == "merge":
        result = subprocess.run(
            ["git", "merge", "--no-ff", "-m", f"Merge worktree: {worktree_name}", branch_name],
            capture_output=True,
            text=True,
            cwd=project_path,
        )
    elif strategy == "squash":
        result = subprocess.run(
            ["git", "merge", "--squash", branch_name],
            capture_output=True,
            text=True,
            cwd=project_path,
        )
        if result.returncode == 0:
            result = subprocess.run(
                ["git", "commit", "-m", f"Complete: {worktree_name}"],
                capture_output=True,
                text=True,
                cwd=project_path,
            )
    elif strategy == "rebase":
        # For rebase, we need to rebase the worktree first, then fast-forward merge
        result = subprocess.run(
            ["git", "rebase", target_branch],
            capture_output=True,
            text=True,
            cwd=worktree_path,
        )
        if result.returncode == 0:
            result = subprocess.run(
                ["git", "merge", "--ff-only", branch_name],
                capture_output=True,
                text=True,
                cwd=project_path,
            )
    else:
        return MergeResult(False, f"Error: Unknown merge strategy '{strategy}'", warnings)

    if result.returncode != 0:
        # Check for merge conflict
        if "CONFLICT" in result.stdout or "conflict" in result.stderr.lower():
            # Get conflicting files
            conflict_result = subprocess.run(
                ["git", "diff", "--name-only", "--diff-filter=U"],
                capture_output=True,
                text=True,
                cwd=project_path,
            )
            conflict_files = conflict_result.stdout.strip()
            return MergeResult(
                False,
                f"Error: Merge conflict. Resolve manually:\n{conflict_files}\nThen run: git merge --continue",
                warnings,
            )
        return MergeResult(
            False,
            f"Error: Merge failed: {result.stderr.strip()}",
            warnings,
        )

    # Step 6: Remove worktree
    result = subprocess.run(
        ["git", "worktree", "remove", str(worktree_path)],
        capture_output=True,
        text=True,
        cwd=project_path,
    )
    if result.returncode != 0:
        # Try force removal
        result = subprocess.run(
            ["git", "worktree", "remove", "--force", str(worktree_path)],
            capture_output=True,
            text=True,
            cwd=project_path,
        )
        if result.returncode != 0:
            warnings.append(f"Could not remove worktree directory: {result.stderr.strip()}")

    # Step 7: Delete branch
    # Use -D (force) for squash/rebase since original commits aren't in target history
    if delete_branch:
        delete_flag = "-D" if strategy in ("squash", "rebase") else "-d"
        result = subprocess.run(
            ["git", "branch", delete_flag, branch_name],
            capture_output=True,
            text=True,
            cwd=project_path,
        )
        if result.returncode != 0:
            # Branch might be checked out elsewhere or have unmerged changes
            warnings.append(f"Could not delete branch '{branch_name}': {result.stderr.strip()}")

    # Step 8: Update state file
    found, _ = remove_worktree(project_path, worktree_name)
    if not found:
        # Not an error, state file might not exist or entry already removed
        pass

    return MergeResult(
        True,
        f"Successfully merged '{worktree_name}' into '{target_branch}' using {strategy} strategy",
        warnings,
    )


def main():
    """CLI interface for worktree merge."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Merge a worktree and clean up WezTerm tab"
    )
    parser.add_argument("worktree_name", help="Name of the worktree to merge")
    parser.add_argument(
        "-t", "--target",
        default="main",
        help="Target branch to merge into (default: main)",
    )
    parser.add_argument(
        "-s", "--strategy",
        choices=["merge", "squash", "rebase"],
        default="merge",
        help="Merge strategy (default: merge)",
    )
    parser.add_argument(
        "--keep-branch",
        action="store_true",
        help="Don't delete the worktree branch after merge",
    )
    parser.add_argument(
        "-p", "--project",
        type=Path,
        help="Path to the main repository (auto-detected if not provided)",
    )

    args = parser.parse_args()

    result = merge_worktree(
        worktree_name=args.worktree_name,
        target_branch=args.target,
        strategy=args.strategy,
        delete_branch=not args.keep_branch,
        project_path=args.project,
    )

    print(result)
    sys.exit(0 if result.success else 1)


if __name__ == "__main__":
    main()
