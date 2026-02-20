# Claude Code Hooks

Hooks are automated triggers that execute shell commands or LLM-based evaluations at specific points in the Claude Code lifecycle. They enable validation, automation, and control over Claude's tool usage.

## Configuration

Hooks are configured in JSON settings files at three levels (in order of precedence):

| File | Scope | Committed |
|------|-------|-----------|
| `.claude/settings.json` | Project-wide | Yes |
| `.claude/settings.local.json` | Local overrides | No (gitignored) |
| `~/.claude/settings.json` | User-wide | N/A |

Basic structure:

```json
{
  "hooks": {
    "EventName": [
      {
        "matcher": "ToolPattern",
        "hooks": [
          {
            "type": "command",
            "command": "your-script.js"
          }
        ]
      }
    ]
  }
}
```

## Hook Events

| Event | When It Fires | Supports Matcher | Use Case |
|-------|---------------|------------------|----------|
| `PreToolUse` | Before tool executes | Yes | Validate/block tool calls |
| `PostToolUse` | After tool completes | Yes | Lint, validate output |
| `PermissionRequest` | User permission dialog | Yes | Auto-allow/deny |
| `UserPromptSubmit` | Before processing prompt | No | Validate input, add context |
| `Stop` | Main agent finished | No | Final validation before completion |
| `SubagentStop` | Subagent (Task) finished | No | Validate subagent work |
| `SessionStart` | Session begins | No | Environment setup |
| `SessionEnd` | Session ends | No | Cleanup |
| `Notification` | System notification | Yes | Filter notifications |
| `PreCompact` | Before context compression | Yes (`manual`/`auto`) | Custom compaction |

## Matchers

Matchers filter which tools trigger hooks (only for PreToolUse, PostToolUse, PermissionRequest):

- **Exact**: `"Write"` matches Write tool only
- **Regex**: `"Write|Edit"` matches either
- **Wildcard**: `"*"` matches all tools
- **MCP tools**: `"mcp__servername__toolname"`

Matchers are case-sensitive.

## Hook Input (stdin)

All hooks receive JSON via stdin:

```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/conversation.jsonl",
  "cwd": "/current/working/directory",
  "permission_mode": "default|plan|acceptEdits|bypassPermissions",
  "hook_event_name": "PostToolUse",
  "tool_name": "Edit",
  "tool_input": {
    "file_path": "/path/to/file.ts",
    "old_string": "...",
    "new_string": "..."
  },
  "tool_response": "File edited successfully"
}
```

Fields vary by event type. Tool-related events include `tool_name`, `tool_input`, and (for PostToolUse) `tool_response`.

## Exit Codes

| Exit Code | Behavior |
|-----------|----------|
| `0` | Success. stdout shown in verbose mode (or added as context for some events) |
| `2` | **Blocking error**. stderr is fed back to Claude as feedback |
| Other | Non-blocking error. stderr shown in verbose mode |

**Key insight**: Exit code 2 blocks the operation and provides feedback to Claude, allowing it to fix the issue.

## JSON Output (stdout)

For exit code 0, hooks can return JSON for fine-grained control:

```json
{
  "decision": "block",
  "reason": "ESLint errors found. Please fix.",
  "additionalContext": "Optional extra info for Claude"
}
```

### Event-Specific Decisions

**PreToolUse**:
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow|deny|ask",
    "updatedInput": { "file_path": "/modified/path" }
  }
}
```

**PostToolUse**:
```json
{
  "decision": "block",
  "reason": "Lint errors found",
  "additionalContext": "file.ts:10 - missing semicolon"
}
```

**Stop/SubagentStop**:
```json
{
  "decision": "block",
  "reason": "Project has lint errors. Fix before completing."
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CLAUDE_PROJECT_DIR` | Project root directory |
| `CLAUDE_CODE_REMOTE` | `"true"` if running remotely |
| `CLAUDE_ENV_FILE` | (SessionStart only) File to persist env vars |

## Example: ESLint Hook

This project uses hooks to run ESLint after each file edit and before task completion.

### PostToolUse Hook (per-file lint)

`.claude/hooks/eslint_post_edit.js`:

```javascript
#!/usr/bin/env node
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const TS_JS_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

function main() {
  const input = JSON.parse(fs.readFileSync(0, "utf8"));
  const file_path = input.tool_input?.file_path || "";

  // Skip non-TS/JS files
  const ext = path.extname(file_path).toLowerCase();
  if (!TS_JS_EXTENSIONS.includes(ext)) {
    process.exit(0);
  }

  // Skip if file doesn't exist
  if (!fs.existsSync(file_path)) {
    process.exit(0);
  }

  try {
    const project_dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    execSync(`npx eslint "${file_path}" --format stylish`, {
      cwd: project_dir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"]
    });
    process.exit(0);  // No errors
  } catch (error) {
    const output = error.stdout || error.stderr || "ESLint errors found";
    console.log(JSON.stringify({
      decision: "block",
      reason: `ESLint errors in ${file_path}:\n${output}\n\nPlease fix these lint errors.`
    }));
    process.exit(0);  // Return JSON, not exit code 2
  }
}

main();
```

### Stop Hook (project-wide lint)

`.claude/hooks/eslint_stop.js`:

```javascript
#!/usr/bin/env node
const { execSync } = require("child_process");
const fs = require("fs");

function main() {
  try {
    JSON.parse(fs.readFileSync(0, "utf8"));
  } catch (e) {}

  const project_dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  try {
    execSync("npm run lint", {
      cwd: project_dir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"]
    });
    process.exit(0);  // No errors
  } catch (error) {
    const output = error.stdout || error.stderr || "ESLint errors found";
    console.log(JSON.stringify({
      decision: "block",
      reason: `Project has ESLint errors:\n\n${output}\n\nPlease fix all lint errors before finishing.`
    }));
    process.exit(0);
  }
}

main();
```

### Hook Configuration

`.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/eslint_post_edit.js"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/eslint_stop.js"
          }
        ]
      }
    ]
  }
}
```

## Blocking vs Non-Blocking

Two ways to block Claude and provide feedback:

1. **Exit code 2 + stderr**: Simple, stderr becomes Claude's feedback
   ```javascript
   console.error("Error message for Claude");
   process.exit(2);
   ```

2. **Exit code 0 + JSON**: More control, structured response
   ```javascript
   console.log(JSON.stringify({
     decision: "block",
     reason: "Error message for Claude"
   }));
   process.exit(0);
   ```

The JSON approach is preferred for PostToolUse and Stop hooks as it provides cleaner integration.

## Debugging

- Run `claude --debug` to see hook execution details
- Use verbose mode (`ctrl+o`) to see hook output during sessions
- Hook changes don't apply mid-session; restart Claude Code after modifying hooks
- Use `/hooks` menu to review registered hooks

## Security Considerations

Hooks execute arbitrary shell commands. Best practices:

- Always quote shell variables: `"$VAR"` not `$VAR`
- Validate and sanitize input from stdin
- Check for path traversal (`..` in paths)
- Use `$CLAUDE_PROJECT_DIR` for project-relative paths
- Skip sensitive files (`.env`, `.git/`, credentials)
- Test hooks thoroughly before committing

## Prompt-Based Hooks

For Stop and SubagentStop events, you can use LLM-based evaluation instead of shell commands:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Review the changes and ensure all tests pass. $ARGUMENTS"
          }
        ]
      }
    ]
  }
}
```

The `$ARGUMENTS` placeholder receives the hook input JSON. Claude Haiku evaluates the prompt and returns a decision.

## References

- [Official Documentation](https://code.claude.com/docs/en/hooks)
- [Hooks Reference](https://code.claude.com/docs/en/reference/hooks)
