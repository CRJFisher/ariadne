"""
FeatureBench custom agent: Claude Code with Ariadne MCP integration.

Extends FeatureBench's ClaudeCodeAgent to include Ariadne's call graph tools
(list_entrypoints, show_call_graph_neighborhood) as an MCP server.

Usage with FeatureBench:
    fb infer --agent claude_code_ariadne --model claude-sonnet-4 --split lite --task-id <task>

Setup:
    1. Clone FeatureBench: git clone https://github.com/LiberCoders/FeatureBench.git
    2. Install: cd FeatureBench && uv sync
    3. Symlink or copy this file into FeatureBench's agent directory
    4. Ensure Ariadne is built: cd <ariadne_root> && npm run build
"""

import json
import os
import subprocess
from pathlib import Path

# FeatureBench agent base class — import fails outside FeatureBench environment
try:
    from featurebench.agents.claude_code import ClaudeCodeAgent
except ImportError:
    # Stub for development/testing outside FeatureBench
    class ClaudeCodeAgent:  # type: ignore[no-redef]
        ALLOWED_TOOLS: list[str] = []

        def __init__(self, **kwargs):
            self.model = kwargs.get("model", "claude-sonnet-4-5-20250929")

        def install_script(self) -> str:
            return ""

        def pre_run_setup(self, testbed_path: str) -> None:
            pass


# Path to Ariadne MCP server (adjust if using npm global install)
ARIADNE_SERVER_PATH = os.environ.get(
    "ARIADNE_SERVER_PATH",
    "/opt/ariadne/packages/mcp/dist/server.js",
)


class ClaudeCodeAriadneAgent(ClaudeCodeAgent):
    """Claude Code agent with Ariadne MCP tools for cross-file navigation."""

    ALLOWED_TOOLS = [
        *ClaudeCodeAgent.ALLOWED_TOOLS,
        "mcp__ariadne__list_entrypoints",
        "mcp__ariadne__show_call_graph_neighborhood",
    ]

    def install_script(self) -> str:
        """Install Ariadne MCP server inside the Docker container."""
        base = super().install_script()
        ariadne_install = """
# Install Ariadne MCP server
if [ ! -d /opt/ariadne ]; then
    cd /opt
    git clone --depth 1 https://github.com/CRJFisher/ariadne.git
    cd ariadne
    npm install
    npm run build
fi
"""
        return base + ariadne_install

    def pre_run_setup(self, testbed_path: str) -> None:
        """Write .mcp.json to testbed so Claude Code discovers Ariadne tools."""
        super().pre_run_setup(testbed_path)

        mcp_config = {
            "mcpServers": {
                "ariadne": {
                    "type": "stdio",
                    "command": "node",
                    "args": [
                        ARIADNE_SERVER_PATH,
                        "--project-path",
                        testbed_path,
                        "--no-watch",
                    ],
                    "env": {},
                }
            }
        }

        config_path = Path(testbed_path) / ".mcp.json"
        config_path.write_text(json.dumps(mcp_config, indent=2))

        # Fallback: also register via claude mcp add (in case .mcp.json isn't loaded)
        try:
            subprocess.run(
                [
                    "claude",
                    "mcp",
                    "add",
                    "ariadne",
                    "-s",
                    "project",
                    "--",
                    "node",
                    ARIADNE_SERVER_PATH,
                    "--project-path",
                    testbed_path,
                    "--no-watch",
                ],
                cwd=testbed_path,
                capture_output=True,
                timeout=30,
            )
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass  # .mcp.json should suffice
