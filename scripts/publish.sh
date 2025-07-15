#!/bin/bash

# RefScope NPM Publishing Script

set -e

echo "🚀 Starting RefScope NPM publishing process..."

# Check if user is logged in to NPM
if ! npm whoami &> /dev/null; then
    echo "❌ You are not logged in to NPM. Please run 'npm login' first."
    exit 1
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/

# Build the project
echo "🔨 Building project..."
npm run build

# Run tests
echo "🧪 Running tests..."
npm test

# Show what will be published
echo "📦 Package contents:"
npm pack --dry-run

# Ask for confirmation
read -p "Do you want to publish this package to NPM? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Publishing cancelled."
    exit 1
fi

# Publish to NPM
echo "📤 Publishing to NPM..."
npm publish

echo "✅ Successfully published RefScope to NPM!"
echo "📝 Don't forget to:"
echo "   - Create a git tag for this release"
echo "   - Update the changelog"
echo "   - Announce the release"