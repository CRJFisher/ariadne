#!/bin/bash

echo "=== EXTRACTING ALL CAPTURES FROM rust.scm ==="
echo ""

# Extract all @ captures
grep -o '@[a-zA-Z_.]*' /Users/chuck/workspace/ariadne/packages/core/src/index_single_file/query_code_tree/queries/rust.scm | \
  sort -u | \
  sed 's/@//' > /tmp/rust_captures.txt

echo "Total unique captures found: $(wc -l < /tmp/rust_captures.txt)"
echo ""
echo "Capture names:"
cat /tmp/rust_captures.txt
