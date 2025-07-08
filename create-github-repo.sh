#!/bin/bash

# Script to create and push ts-tree-sitter to GitHub

echo "Creating GitHub repository..."

# Create public repository
# Replace 'your-username' with your actual GitHub username
gh repo create refscope \
  --public \
  --description "Find references and definitions in your codebase using tree-sitter" \
  --source=. \
  --remote=origin \
  --push

# Add topics to the repository
gh repo edit \
  --add-topic "tree-sitter" \
  --add-topic "typescript" \
  --add-topic "code-intelligence" \
  --add-topic "ast" \
  --add-topic "parser"

echo "Repository created and pushed successfully!"
echo "View your repository at: https://github.com/$(gh api user --jq .login)/refscope"