#!/usr/bin/env python3
"""
Sandbox Configuration for Worktrees

Configures Claude Code's built-in sandbox via --settings CLI flag.
This replaces the previous Docker/sandbox-exec approach with near-zero overhead.

Key advantages:
- ~0 RAM overhead (vs ~6GB for Docker)
- Instant startup (vs seconds for Docker)
- Native Keychain access for OAuth tokens
- No external dependencies (built into Claude Code)
- No settings.json files to accidentally commit (sandbox via CLI flag)
"""
# /// script
# requires-python = ">=3.11"
# ///

import json
import shutil
from typing import Optional


def claude_available() -> bool:
    """Check if claude CLI is available."""
    return shutil.which("claude") is not None


def get_claude_command(task: Optional[str] = None, sandbox: bool = True) -> list[str]:
    """
    Get claude command for interactive session.

    If a task is provided, it's passed as a positional argument to Claude,
    which will execute it automatically while remaining interactive.

    Args:
        task: Optional task description to pass to Claude
        sandbox: Enable sandbox mode (default: True)

    Returns:
        Claude command as list of arguments
    """
    cmd = ["claude"]

    if sandbox:
        settings = {
            "sandbox": {
                "enabled": True,
                "autoAllowBashIfSandboxed": True
            }
        }
        cmd.extend(["--settings", json.dumps(settings)])

    cmd.append("--dangerously-skip-permissions")

    if task:
        cmd.append(task)

    return cmd


if __name__ == "__main__":
    print("Claude Code Sandbox Configuration for Worktrees")
    print("=" * 50)
    print(f"Claude CLI available: {claude_available()}")
    print(f"\nClaude command: {' '.join(get_claude_command())}")
