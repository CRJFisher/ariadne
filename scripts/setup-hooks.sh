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
EOF

chmod +x .git/hooks/pre-commit
echo "✅ Git hooks installed successfully"