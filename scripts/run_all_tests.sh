#!/bin/sh
#
# Pre-commit test runner: discovers all test roots and runs full suites.
#
# A test root is a directory (not the project root) containing vitest.config.*
# or a package.json alongside *.test.ts files.
#
# Exits non-zero if any test suite fails.

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Discover test roots with vitest configs
VITEST_ROOTS=$(find "$PROJECT_DIR" \
  -name node_modules -prune -o \
  -name .worktrees -prune -o \
  -name .git -prune -o \
  -name dist -prune -o \
  \( -name 'vitest.config.mjs' -o -name 'vitest.config.ts' -o -name 'vitest.config.js' \) -print \
  | while read -r config; do dirname "$config"; done \
  | sort -u)

# Discover package.json roots that contain *.test.ts files
PKG_ROOTS=$(find "$PROJECT_DIR" \
  -name node_modules -prune -o \
  -name .worktrees -prune -o \
  -name .git -prune -o \
  -name dist -prune -o \
  -name 'package.json' -print \
  | while read -r pkg; do
    dir=$(dirname "$pkg")
    # Skip project root
    [ "$dir" = "$PROJECT_DIR" ] && continue
    # Skip if already covered by a vitest config
    echo "$VITEST_ROOTS" | grep -qx "$dir" && continue
    # Include only if test files exist
    if find "$dir" -name node_modules -prune -o -name '*.test.ts' -print -quit | grep -q .; then
      echo "$dir"
    fi
  done | sort -u)

# Combine and deduplicate
ALL_ROOTS=$(printf '%s\n%s\n' "$VITEST_ROOTS" "$PKG_ROOTS" | grep -v '^$' | sort -u)

if [ -z "$ALL_ROOTS" ]; then
  echo "No test roots found."
  exit 0
fi

COUNT=$(echo "$ALL_ROOTS" | wc -l | tr -d ' ')
NAMES=$(echo "$ALL_ROOTS" | while read -r root; do
  echo "$root" | sed "s|^$PROJECT_DIR/||"
done | paste -sd ', ' -)
echo "Discovered $COUNT test root(s): $NAMES"

echo "$ALL_ROOTS" | while read -r root; do
  REL=$(echo "$root" | sed "s|^$PROJECT_DIR/||")
  echo ""
  echo "Running tests in $REL..."
  if ! (cd "$root" && npx vitest run); then
    echo "FAILED:$REL" >> "$PROJECT_DIR/.test_failures_$$"
  fi
done

if [ -f "$PROJECT_DIR/.test_failures_$$" ]; then
  FAILED=$(cut -d: -f2 "$PROJECT_DIR/.test_failures_$$" | paste -sd ', ' -)
  rm -f "$PROJECT_DIR/.test_failures_$$"
  echo ""
  echo "Tests failed in: $FAILED"
  exit 1
fi

echo ""
echo "All test suites passed."
