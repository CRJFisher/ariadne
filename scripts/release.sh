#!/bin/bash

# Release script for RefScope
# Usage: ./scripts/release.sh [major|minor|patch]
# Defaults to patch (bug fix) if no argument provided

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_error() {
    echo -e "${RED}Error: $1${NC}" >&2
}

print_success() {
    echo -e "${GREEN}$1${NC}"
}

print_info() {
    echo -e "${YELLOW}$1${NC}"
}

# Check if we're in the git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "Not in a git repository"
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    print_error "You have uncommitted changes. Please commit or stash them before releasing."
    exit 1
fi

# Check if we're on main branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
    print_error "You must be on the main branch to create a release. Current branch: $CURRENT_BRANCH"
    exit 1
fi

# Make sure we're up to date with remote
print_info "Fetching latest changes from remote..."
git fetch origin main

# Check if local is behind remote
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse "@{u}")
if [ "$LOCAL" != "$REMOTE" ]; then
    print_error "Your local branch is not up to date with remote. Please pull the latest changes."
    exit 1
fi

# Get the version bump type (default to patch)
BUMP_TYPE=${1:-patch}

# Validate bump type
if [[ ! "$BUMP_TYPE" =~ ^(major|minor|patch)$ ]]; then
    print_error "Invalid version bump type: $BUMP_TYPE"
    echo "Usage: $0 [major|minor|patch]"
    echo "  major: Breaking changes (1.0.0 -> 2.0.0)"
    echo "  minor: New features (1.0.0 -> 1.1.0)"
    echo "  patch: Bug fixes (1.0.0 -> 1.0.1)"
    exit 1
fi

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")

# Check if any version tags exist
if ! git tag -l 'v*' | grep -q .; then
    print_info "No version tags found in repository"
    # If package.json has a version, use it; otherwise default to 0.1.0
    if [ -z "$CURRENT_VERSION" ] || [ "$CURRENT_VERSION" = "undefined" ]; then
        CURRENT_VERSION="0.1.0"
        print_info "No version found in package.json, defaulting to: $CURRENT_VERSION"
    else
        print_info "Using version from package.json: $CURRENT_VERSION"
    fi
else
    # Verify that the package.json version matches the latest tag
    LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    if [ -n "$LATEST_TAG" ]; then
        TAG_VERSION="${LATEST_TAG#v}"
        if [ "$TAG_VERSION" != "$CURRENT_VERSION" ]; then
            print_error "Version mismatch: package.json has $CURRENT_VERSION but latest tag is $LATEST_TAG"
            print_info "This might happen if a release was made without updating package.json"
            read -p "Use version from latest tag? (Y/n) " -n 1 -r
            echo ""
            if [[ $REPLY =~ ^[Nn]$ ]]; then
                print_info "Using package.json version: $CURRENT_VERSION"
            else
                CURRENT_VERSION="$TAG_VERSION"
                print_info "Using tag version: $CURRENT_VERSION"
            fi
        fi
    fi
fi

print_info "Current version: $CURRENT_VERSION"

# Validate version format
if ! [[ "$CURRENT_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    print_error "Invalid version format: $CURRENT_VERSION"
    print_info "Version must be in format: MAJOR.MINOR.PATCH (e.g., 1.2.3)"
    exit 1
fi

# Parse version components
IFS='.' read -r -a VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR="${VERSION_PARTS[0]}"
MINOR="${VERSION_PARTS[1]}"
PATCH="${VERSION_PARTS[2]}"

# Bump the appropriate version component
case "$BUMP_TYPE" in
    major)
        MAJOR=$((MAJOR + 1))
        MINOR=0
        PATCH=0
        ;;
    minor)
        MINOR=$((MINOR + 1))
        PATCH=0
        ;;
    patch)
        PATCH=$((PATCH + 1))
        ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"
print_info "New version: $NEW_VERSION"

# Confirm with user
echo ""
read -p "Are you sure you want to release v$NEW_VERSION? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "Release cancelled"
    exit 0
fi

# Update package.json version
print_info "Updating package.json version..."
npm version "$NEW_VERSION" --no-git-tag-version

# Update refscope-types package version if it exists
if [ -f "packages/refscope-types/package.json" ]; then
    print_info "Updating refscope-types package version..."
    cd packages/refscope-types
    npm version "$NEW_VERSION" --no-git-tag-version
    cd ../..
fi

# Commit the version change
print_info "Committing version bump..."
git add package.json package-lock.json
# Also add refscope-types package files if they were updated
if [ -f "packages/refscope-types/package.json" ]; then
    git add packages/refscope-types/package.json packages/refscope-types/package-lock.json
fi
git commit -m "chore: bump version to $NEW_VERSION"

# Create and push the tag
TAG="v$NEW_VERSION"
print_info "Creating tag $TAG..."
git tag -a "$TAG" -m "Release $TAG"

# Push the commit and tag
print_info "Pushing changes to remote..."
git push origin main
git push origin "$TAG"

print_success "Successfully released version $NEW_VERSION!"
print_info ""
print_info "Next steps:"
print_info "1. The 'Release and Publish' workflow will automatically run for tag $TAG"
print_info "2. Check the GitHub Actions tab to monitor the progress"
print_info "3. The workflow will:"
print_info "   - Build prebuilt binaries for all platforms"
print_info "   - Create a GitHub release with the binaries"
print_info "   - Publish the package to npm"
print_info "4. Use the 'scripts/update-release-description.sh' script to update the release description"
print_info ""
print_info "Note: Make sure NPM_TOKEN secret is configured in your repository settings"