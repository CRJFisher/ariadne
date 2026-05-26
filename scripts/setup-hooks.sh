#!/bin/sh

# Setup git hooks for the project

cat > .git/hooks/pre-commit << 'EOF'
#!/bin/sh

# Pre-commit hook to check file sizes of staged files only
# Only check if TypeScript or JavaScript files are being committed

# Get list of staged TS/JS files in packages directory only, excluding test files
STAGED_FILES=$(git diff --cached --name-only | grep -E '^packages/.*\.(ts|js|tsx|jsx)$' | grep -v '\.test\.' | grep -v '\.spec\.')

if [ -n "$STAGED_FILES" ]; then
  echo "📏 Checking file sizes for staged TypeScript/JavaScript files..."
  
  # Check each staged file individually
  HAS_LARGE_FILES=0
  
  for file in $STAGED_FILES; do
    if [ -f "$file" ]; then
      # Get file size in bytes
      SIZE=$(wc -c < "$file" | tr -d ' ')
      SIZE_KB=$((SIZE / 1024))
      
      if [ $SIZE -gt 32768 ]; then
        echo "❌ ERROR: $file is ${SIZE_KB}KB (exceeds 32KB limit)"
        HAS_LARGE_FILES=1
      elif [ $SIZE -gt 28672 ]; then
        echo "⚠️  WARNING: $file is ${SIZE_KB}KB (approaching 32KB limit)"
      fi
    fi
  done
  
  if [ $HAS_LARGE_FILES -eq 1 ]; then
    echo ""
    echo "❌ Commit aborted: Some staged files exceed the 32KB limit."
    echo "   Please refactor large files before committing."
    exit 1
  fi
  
  echo "✅ All staged files are within size limits!"
else
  echo "📏 No TypeScript/JavaScript files staged for commit"
fi

# Run full test suites if any TS/JS files are staged
if git diff --cached --name-only | grep -qE '\.(ts|tsx|js|jsx)$'; then
  echo "🧪 Running full test suites..."
  scripts/run_all_tests.sh
fi

# Mermaid pre-render: regenerate sibling SVGs for any staged .mmd sources.
# Silent no-op when Chrome is not detected so contributors without Chrome
# remain unblocked. Exits non-zero only on mmdc syntax errors.
if git diff --cached --name-only --diff-filter=ACMR | grep -q '\.mmd$'; then
  PROJECT_DIR="$(git rev-parse --show-toplevel)"
  node --import tsx "$PROJECT_DIR/scripts/render-mermaid-diagrams.ts" --staged
fi
EOF

chmod +x .git/hooks/pre-commit

cat > .git/hooks/commit-msg << 'EOF'
#!/bin/sh

# commit-msg hook: validates the commit convention documented at
# .claude/rules/commit-convention.md. Permissive — only intervenes when the
# subject's scope looks like a task id (`190.16.42`, `343`, `190.17.12-14`).
# Named scopes and unscoped commits pass through.

MSG_FILE="$1"
PROJECT_DIR="$(git rev-parse --show-toplevel)"

if [ ! -f "$PROJECT_DIR/scripts/check-commit-message.ts" ]; then
  # Validator missing — skip silently rather than block commits.
  exit 0
fi

node --import tsx "$PROJECT_DIR/scripts/check-commit-message.ts" "$MSG_FILE"
EOF

chmod +x .git/hooks/commit-msg
echo "✅ Git hooks installed successfully"