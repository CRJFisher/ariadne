# Task 11.161.4: Implement Hook Enforcement

## Status: Completed

## Parent: Task 11.161

## Goal

Implement Claude Code hooks to prevent creation of prohibited files and audit for violations.

## Subtasks

### 11.161.4.1: Create PreToolUse File Naming Validator

Create `.claude/hooks/file_naming_validator.cjs`:

```javascript
#!/usr/bin/env node
/**
 * PreToolUse hook: Validate file paths before Write/Edit operations
 */

const path = require("path");
const { create_logger, parse_stdin } = require("./utils.cjs");

const log = create_logger("file-naming");

const BLOCKED_ROOT_PATTERNS = [
  /^debug_.*\.(ts|js)$/,
  /^test_.*\.(ts|js)$/,
  /^verify_.*\.ts$/,
  /^.*\.py$/,
  /^.*\.sed$/,
  /^fix_.*\.sh$/,
  /^.*_report\.md$/,
  /^.*_analysis\.md$/,
  /^.*\.log$/,
];

const ALLOWED_ROOT_FILES = new Set([
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "tsconfig.tsbuildinfo",
  "eslint.config.js",
  ".gitignore",
  ".npmrc",
  ".npmignore",
  "LICENSE",
  "README.md",
  "CONTRIBUTING.md",
  "CLAUDE.md",
  "AGENTS.md",
  ".cursorrules",
]);

function validate_root_file(filename) {
  if (ALLOWED_ROOT_FILES.has(filename)) return null;

  for (const pattern of BLOCKED_ROOT_PATTERNS) {
    if (pattern.test(filename)) {
      return `Blocked: '${filename}' matches prohibited pattern ${pattern}`;
    }
  }

  return `Warning: '${filename}' not in root whitelist`;
}

function validate_package_file(relative_path, parts) {
  // Block .js files in package roots (except config files)
  if (parts.length === 2 && parts[1].endsWith(".js")) {
    if (!parts[1].startsWith("eslint")) {
      return `Blocked: Stray .js file in ${parts[0]}/${parts[1]}`;
    }
  }
  return null;
}

function main() {
  const input = parse_stdin();
  if (!input) return;

  const { tool_name, tool_input } = input;
  if (!["Write", "Edit"].includes(tool_name)) return;

  const file_path = tool_input?.file_path;
  if (!file_path) return;

  const project_dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const relative = path.relative(project_dir, file_path);
  const parts = relative.split(path.sep);

  let error = null;

  if (parts.length === 1 && !parts[0].startsWith(".")) {
    error = validate_root_file(parts[0]);
  } else if (parts[0] === "packages") {
    error = validate_package_file(relative, parts);
  }

  if (error && error.startsWith("Blocked")) {
    log(`Blocking: ${error}`);
    console.log(JSON.stringify({
      decision: "block",
      reason: error
    }));
  } else if (error) {
    log(`Warning: ${error}`);
  }
}

main();
```

### 11.161.4.2: Create Stop Hook File Auditor

Create `.claude/hooks/file_naming_validator_stop.cjs`:

```javascript
#!/usr/bin/env node
/**
 * Stop hook: Audit for prohibited files before task completion
 */

const fs = require("fs");
const path = require("path");
const { create_logger, parse_stdin } = require("./utils.cjs");

const log = create_logger("file-audit");

const PROHIBITED_ROOT_PATTERNS = [
  /^debug_.*\.(ts|js)$/,
  /^test_.*\.(ts|js)$/,
  /^verify_.*\.ts$/,
  /^.*\.py$/,
  /^.*\.sed$/,
  /^fix_.*\.sh$/,
  /^.*_report\.md$/,
  /^.*_analysis\.md$/,
  /^.*\.log$/,
];

function is_prohibited_root_file(filename) {
  for (const pattern of PROHIBITED_ROOT_PATTERNS) {
    if (pattern.test(filename)) return true;
  }
  return false;
}

function audit_prohibited_files(project_dir) {
  const violations = [];

  // Check root for prohibited files
  try {
    const root_files = fs.readdirSync(project_dir);
    for (const file of root_files) {
      const stat = fs.statSync(path.join(project_dir, file));
      if (stat.isFile() && is_prohibited_root_file(file)) {
        violations.push(`Prohibited file in root: ${file}`);
      }
    }
  } catch (e) {
    log(`Error reading root: ${e.message}`);
  }

  // Check package directories for stray .js files
  const packages = ["packages/core", "packages/types", "packages/mcp"];
  for (const pkg of packages) {
    const pkg_root = path.join(project_dir, pkg);
    try {
      if (fs.existsSync(pkg_root)) {
        const files = fs.readdirSync(pkg_root);
        for (const file of files) {
          if (file.endsWith(".js") && !file.startsWith("eslint")) {
            violations.push(`Stray JS file in ${pkg}: ${file}`);
          }
        }
      }
    } catch (e) {
      log(`Error reading ${pkg}: ${e.message}`);
    }
  }

  return violations;
}

function main() {
  log("File audit started");
  parse_stdin(); // Consume stdin

  const project_dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const violations = audit_prohibited_files(project_dir);

  if (violations.length > 0) {
    log(`Found ${violations.length} violation(s)`);
    console.log(JSON.stringify({
      decision: "block",
      reason: `File naming violations found:\n\n${violations.join("\n")}\n\nPlease remove these files.`
    }));
  } else {
    log("No violations found");
  }
}

main();
```

### 11.161.4.3: Wire Hooks into Settings

Update `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "command": "node .claude/hooks/file_naming_validator.cjs"
      }
    ],
    "Stop": [
      {
        "command": "node .claude/hooks/file_naming_validator_stop.cjs"
      }
    ]
  }
}
```

### 11.161.4.4: Test Hook Behavior

Manual tests:

1. Try creating `debug_test.ts` in root - should block
2. Try creating `test_foo.js` in root - should block
3. Try creating legitimate file - should allow
4. Run stop with violations present - should block
5. Run stop with clean state - should pass

## Dependencies

- Existing hook infrastructure (`.claude/hooks/utils.cjs`)
- Task 11.161.3 should be completed first (no violations to detect)

## Success Criteria

1. PreToolUse hook blocks prohibited file creation
2. Stop hook detects existing violations
3. Legitimate files allowed
4. Clear error messages for violations
