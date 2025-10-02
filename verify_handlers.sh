#!/bin/bash

echo "=== VERIFYING HANDLERS FOR DEFINITION.* CAPTURES ==="
echo ""

RUST_BUILDER="/Users/chuck/workspace/ariadne/packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder.ts"

# Get all definition.* captures
grep '@definition\.' /tmp/rust_captures.txt > /tmp/definition_captures.txt

echo "Total definition captures: $(wc -l < /tmp/definition_captures.txt)"
echo ""

echo "Checking which have handlers..."
echo ""
echo "FORMAT: [STATUS] capture_name"
echo "  ✅ = Handler exists"
echo "  ❌ = Handler MISSING"
echo ""

while read capture; do
  if grep -q "\"$capture\"" "$RUST_BUILDER"; then
    echo "✅ $capture"
  else
    echo "❌ $capture"
  fi
done < /tmp/definition_captures.txt

echo ""
echo "=== MISSING HANDLERS ==="
while read capture; do
  if ! grep -q "\"$capture\"" "$RUST_BUILDER"; then
    echo "  - $capture"
  fi
done < /tmp/definition_captures.txt
