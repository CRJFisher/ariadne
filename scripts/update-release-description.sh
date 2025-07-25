#!/bin/bash

# Update GitHub release description script for AST-Climber
# Usage: ./scripts/update-release-description.sh [options]
#
# Options:
#   -t, --tag <tag>           Release tag (e.g., v1.0.0) - required
#   -d, --description <desc>  Release description - required unless using -f
#   -f, --file <file>         Read description from file
#   -h, --help                Show this help message

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

# Function to show usage
show_usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -t, --tag <tag>           Release tag (e.g., v1.0.0) - required"
    echo "  -d, --description <desc>  Release description - required unless using -f"
    echo "  -f, --file <file>         Read description from file"
    echo "  -h, --help                Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -t v1.0.0 -d 'This release includes bug fixes and performance improvements'"
    echo "  $0 --tag v1.0.0 --file release-notes.md"
}

# Initialize variables
TAG=""
DESCRIPTION=""
DESCRIPTION_FILE=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--tag)
            TAG="$2"
            shift 2
            ;;
        -d|--description)
            DESCRIPTION="$2"
            shift 2
            ;;
        -f|--file)
            DESCRIPTION_FILE="$2"
            shift 2
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate required arguments
if [ -z "$TAG" ]; then
    print_error "Release tag is required"
    show_usage
    exit 1
fi

# Check if we have either description or file
if [ -z "$DESCRIPTION" ] && [ -z "$DESCRIPTION_FILE" ]; then
    print_error "Either description (-d) or description file (-f) is required"
    show_usage
    exit 1
fi

# Check if both description and file are provided
if [ -n "$DESCRIPTION" ] && [ -n "$DESCRIPTION_FILE" ]; then
    print_error "Cannot use both -d and -f options"
    show_usage
    exit 1
fi

# Read description from file if specified
if [ -n "$DESCRIPTION_FILE" ]; then
    if [ ! -f "$DESCRIPTION_FILE" ]; then
        print_error "Description file not found: $DESCRIPTION_FILE"
        exit 1
    fi
    print_info "Reading description from file: $DESCRIPTION_FILE"
    DESCRIPTION=$(cat "$DESCRIPTION_FILE")
fi

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    print_error "GitHub CLI (gh) is not installed"
    echo "Please install it from: https://cli.github.com/"
    exit 1
fi

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "Not in a git repository"
    exit 1
fi

# Check if authenticated with GitHub
if ! gh auth status &> /dev/null; then
    print_error "Not authenticated with GitHub"
    echo "Please run: gh auth login"
    exit 1
fi

# Get repository info
REPO=$(gh repo view --json owner,name -q '.owner.login + "/" + .name')
if [ -z "$REPO" ]; then
    print_error "Could not determine repository"
    exit 1
fi

print_info "Repository: $REPO"
print_info "Tag: $TAG"

# Check if release exists
if ! gh release view "$TAG" &> /dev/null; then
    print_error "Release $TAG not found"
    echo "Available releases:"
    gh release list --limit 10
    exit 1
fi

# Get current release info
print_info "Fetching current release information..."
CURRENT_INFO=$(gh release view "$TAG" --json name,tagName,isDraft,isPrerelease)
RELEASE_NAME=$(echo "$CURRENT_INFO" | jq -r '.name // .tagName')
IS_DRAFT=$(echo "$CURRENT_INFO" | jq -r '.isDraft')
IS_PRERELEASE=$(echo "$CURRENT_INFO" | jq -r '.isPrerelease')

print_info "Release name: $RELEASE_NAME"
print_info "Draft: $IS_DRAFT"
print_info "Pre-release: $IS_PRERELEASE"

# Show preview of description
echo ""
print_info "New description:"
echo "---"
echo "$DESCRIPTION"
echo "---"
echo ""

# Confirm with user
read -p "Update release $TAG with this description? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "Update cancelled"
    exit 0
fi

# Update the release
print_info "Updating release description..."
if gh release edit "$TAG" --notes "$DESCRIPTION"; then
    print_success "Successfully updated release $TAG!"
    echo ""
    print_info "View the release at: https://github.com/$REPO/releases/tag/$TAG"
else
    print_error "Failed to update release"
    exit 1
fi