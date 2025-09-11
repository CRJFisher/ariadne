#!/bin/bash

# TypeScript type checking script
# Run this before tests to ensure type safety

echo "Running TypeScript type checking..."

# Check types in core package
npx tsc --noEmit

if [ $? -ne 0 ]; then
  echo "❌ TypeScript type checking failed!"
  echo "Fix the type errors before running tests."
  exit 1
fi

echo "✅ TypeScript type checking passed!"