#!/usr/bin/env python3
"""
WezTerm Tab Management for Worktrees

Manages WezTerm tabs for parallel worktree development.
Each project gets its own WezTerm window (workspace), with worktrees as tabs.

Features:
- Per-project workspace isolation
- Task submission via send-text after Claude boots
- Tab title management
"""
# /// script
# requires-python = ">=3.11"
# ///

import json
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional


def wezterm_available() -> bool:
    """
    Check if WezTerm CLI is available and a WezTerm instance is running.

    Returns True only if both conditions are met:
    1. wezterm CLI is in PATH
    2. A WezTerm GUI instance is running (can accept CLI commands)
    """
    if shutil.which("wezterm") is None:
        return False

    # Check if WezTerm is running by listing clients
    result = subprocess.run(
        ["wezterm", "cli", "list-clients"],
        capture_output=True,
        text=True,
    )
    return result.returncode == 0


def ensure_wezterm_running() -> bool:
    """
    Check if WezTerm is running, or if it can be started.

    Note: This only checks availability. Use start_wezterm_with_command() to
    start WezTerm with a specific command when it's not running.

    Returns:
        True if WezTerm is running or CLI is available, False otherwise
    """
    if shutil.which("wezterm") is None:
        return False
    return True


def start_wezterm_with_command(
    cwd: Optional[Path] = None,
    command: Optional[list[str]] = None,
    workspace: Optional[str] = None,
) -> tuple[bool, Optional[str], str]:
    """
    Start WezTerm with a specific command (when WezTerm is not running).

    Args:
        cwd: Working directory
        command: Command to run
        workspace: Workspace name

    Returns:
        (success, pane_id, message)
    """
    start_cmd = ["wezterm", "start"]

    if workspace:
        start_cmd.extend(["--workspace", workspace])

    if cwd:
        start_cmd.extend(["--cwd", str(cwd.resolve())])

    if command:
        start_cmd.append("--")
        start_cmd.extend(command)

    # Use Popen to start WezTerm without blocking (wezterm start waits for command to exit)
    subprocess.Popen(
        start_cmd,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    # Wait for WezTerm to be ready and get pane ID
    for _ in range(50):  # Wait up to 5 seconds
        time.sleep(0.1)
        list_result = subprocess.run(
            ["wezterm", "cli", "list", "--format", "json"],
            capture_output=True,
            text=True,
        )
        if list_result.returncode == 0:
            try:
                panes = json.loads(list_result.stdout)
                if panes:
                    # Return the first pane (the one we just created)
                    pane_id = str(panes[0].get("pane_id"))
                    return True, pane_id, f"Started WezTerm (pane {pane_id})"
            except (json.JSONDecodeError, ValueError):
                pass

    return True, None, "Started WezTerm but couldn't get pane ID"


def get_project_window_id(workspace_name: str) -> Optional[str]:
    """
    Get the window ID for a project's workspace, if it exists.

    Args:
        workspace_name: Name of the workspace (typically project name)

    Returns:
        Window ID as string if found, None otherwise
    """
    result = subprocess.run(
        ["wezterm", "cli", "list", "--format", "json"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return None

    try:
        panes = json.loads(result.stdout)
        for pane in panes:
            if pane.get("workspace") == workspace_name:
                return str(pane.get("window_id"))
    except (json.JSONDecodeError, ValueError):
        pass

    return None


def create_tab(
    title: str,
    cwd: Optional[Path] = None,
    command: Optional[list[str]] = None,
    workspace: Optional[str] = None,
) -> tuple[bool, Optional[str], str]:
    """
    Create a new WezTerm tab with optional command.

    If workspace is specified:
    - If a window exists for that workspace, adds a tab to it
    - If no window exists, creates a new window with that workspace name

    Args:
        title: Title for the tab (shown in tab bar)
        cwd: Working directory for the new tab
        command: Command to run in the tab as list of args
        workspace: Optional workspace name for per-project window grouping

    Returns:
        (success, pane_id, message)
        - pane_id is the WezTerm pane ID if successful, None otherwise
    """
    if not ensure_wezterm_running():
        return False, None, "Error: WezTerm CLI not available"

    # Check if WezTerm is actually running
    if not wezterm_available():
        # WezTerm not running - start it with our command directly
        success, pane_id, msg = start_wezterm_with_command(cwd, command, workspace)
        if success and pane_id:
            set_tab_title(pane_id, title)
        return success, pane_id, msg

    # WezTerm is running - spawn a new tab/window
    # If workspace specified, try to find existing window for this project
    window_id = None
    if workspace:
        window_id = get_project_window_id(workspace)

    spawn_cmd = ["wezterm", "cli", "spawn"]

    if window_id:
        # Add tab to existing project window
        spawn_cmd.extend(["--window-id", window_id])
    elif workspace:
        # Create new window for this project workspace
        spawn_cmd.extend(["--new-window", "--workspace", workspace])

    if cwd:
        spawn_cmd.extend(["--cwd", str(cwd.resolve())])

    # Add command if provided
    if command:
        spawn_cmd.append("--")
        spawn_cmd.extend(command)

    result = subprocess.run(spawn_cmd, capture_output=True, text=True)

    if result.returncode != 0:
        return False, None, f"Error creating tab: {result.stderr}"

    pane_id = result.stdout.strip()

    # Set the tab title
    if pane_id:
        set_tab_title(pane_id, title)

    return True, pane_id, f"Created tab '{title}' (pane {pane_id})"


def send_text_to_pane(
    pane_id: str,
    text: str,
    delay_seconds: float = 2.0,
) -> tuple[bool, str]:
    """
    Send text to a WezTerm pane and press Enter.

    Waits for a delay to allow Claude to boot before sending the text.
    The delay may need tuning based on system performance.

    Args:
        pane_id: WezTerm pane ID
        text: Text to send (task description)
        delay_seconds: Seconds to wait before sending (for Claude startup)

    Returns:
        (success, message)
    """
    # Wait for Claude to finish booting up
    # TODO: Could be smarter - poll pane output for ">" prompt
    if delay_seconds > 0:
        time.sleep(delay_seconds)

    # Include literal newline to submit the command
    result = subprocess.run(
        ["wezterm", "cli", "send-text", "--pane-id", pane_id, "--no-paste", text + "\n"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return False, f"Error sending text: {result.stderr}"
    return True, "Text sent"


def close_tab(pane_id: str) -> tuple[bool, str]:
    """
    Close a WezTerm tab/pane by its ID.

    Args:
        pane_id: The WezTerm pane ID to close

    Returns:
        (success, message)
    """
    if not wezterm_available():
        return False, "Error: WezTerm is not running or CLI not available"

    result = subprocess.run(
        ["wezterm", "cli", "kill-pane", "--pane-id", pane_id],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        # Check if pane already doesn't exist
        if "no pane" in result.stderr.lower() or "invalid" in result.stderr.lower():
            return True, f"Pane {pane_id} already closed"
        return False, f"Error closing tab: {result.stderr}"

    return True, f"Closed tab (pane {pane_id})"


def set_tab_title(pane_id: str, title: str) -> tuple[bool, str]:
    """
    Set the title of a WezTerm tab.

    Uses WezTerm's native set-tab-title command.

    Args:
        pane_id: The WezTerm pane ID
        title: New title for the tab

    Returns:
        (success, message)
    """
    if not wezterm_available():
        return False, "Error: WezTerm is not running or CLI not available"

    result = subprocess.run(
        ["wezterm", "cli", "set-tab-title", "--pane-id", pane_id, title],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        return False, f"Error setting title: {result.stderr}"

    return True, f"Set tab title to '{title}'"


def list_panes() -> list[dict]:
    """
    List all WezTerm panes.

    Returns:
        List of pane info dicts with 'pane_id', 'title', 'cwd', 'workspace' keys
    """
    if not wezterm_available():
        return []

    result = subprocess.run(
        ["wezterm", "cli", "list", "--format", "json"],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        return []

    try:
        return json.loads(result.stdout)
    except (json.JSONDecodeError, ValueError):
        return []


def pane_exists(pane_id: str) -> bool:
    """Check if a pane with the given ID exists."""
    panes = list_panes()
    return any(str(p.get("pane_id")) == str(pane_id) for p in panes)


if __name__ == "__main__":
    # Simple test/demo
    print("WezTerm Tab Management for Worktrees")
    print("=" * 40)

    if not wezterm_available():
        print("WezTerm is not available (not installed or not running)")
        sys.exit(1)

    print(f"WezTerm available: {wezterm_available()}")

    if len(sys.argv) > 1:
        cmd = sys.argv[1]

        if cmd == "create" and len(sys.argv) > 2:
            title = sys.argv[2]
            cwd = Path(sys.argv[3]) if len(sys.argv) > 3 else None
            workspace = sys.argv[4] if len(sys.argv) > 4 else None
            # Command args come after workspace
            command = sys.argv[5:] if len(sys.argv) > 5 else None
            success, pane_id, msg = create_tab(
                title, cwd, command if command else None, workspace
            )
            print(msg)
            if pane_id:
                print(f"Pane ID: {pane_id}")

        elif cmd == "send" and len(sys.argv) > 3:
            pane_id = sys.argv[2]
            text = sys.argv[3]
            delay = float(sys.argv[4]) if len(sys.argv) > 4 else 2.0
            success, msg = send_text_to_pane(pane_id, text, delay)
            print(msg)

        elif cmd == "close" and len(sys.argv) > 2:
            pane_id = sys.argv[2]
            success, msg = close_tab(pane_id)
            print(msg)

        elif cmd == "title" and len(sys.argv) > 3:
            pane_id = sys.argv[2]
            title = sys.argv[3]
            success, msg = set_tab_title(pane_id, title)
            print(msg)

        elif cmd == "list":
            panes = list_panes()
            print(f"Found {len(panes)} panes:")
            for p in panes:
                workspace = p.get("workspace", "default")
                print(f"  {p.get('pane_id')}: {p.get('title', 'untitled')} [{workspace}]")

        else:
            print("Usage:")
            print("  worktree_wezterm.py create <title> [cwd] [workspace] [command...]")
            print("  worktree_wezterm.py send <pane_id> <text> [delay_seconds]")
            print("  worktree_wezterm.py close <pane_id>")
            print("  worktree_wezterm.py title <pane_id> <title>")
            print("  worktree_wezterm.py list")
    else:
        print("\nRun with a command to test WezTerm integration")
        print("\nCurrent panes:")
        panes = list_panes()
        for p in panes:
            workspace = p.get("workspace", "default")
            print(f"  {p.get('pane_id')}: {p.get('title', 'untitled')} [{workspace}]")
