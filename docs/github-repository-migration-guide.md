# GitHub Repository Migration Guide: refscope → ast-climber

This guide walks you through migrating the GitHub repository from `refscope` to `ast-climber`.

## Prerequisites

- Admin access to the GitHub repository
- GitHub CLI (`gh`) installed and authenticated
- All pending pull requests merged or closed

## Step 1: Rename the Repository

1. Go to <https://github.com/CRJFisher/refscope>
2. Click on **Settings** (gear icon)
3. Under **General** settings, find the **Repository name** field
4. Change `refscope` to `ast-climber`
5. Click **Rename**

GitHub will:

- Automatically set up redirects from the old URL to the new URL
- Update all existing clones, forks, and links
- Preserve all issues, pull requests, stars, and watchers

## Step 2: Update Repository Description and Topics

While in Settings:

1. Update the **Description** if it mentions "refscope"
2. Go to the main repository page
3. Click the gear icon next to **About**
4. Update topics/tags if any mention "refscope"

## Step 3: Update Default Branch Protection Rules

If you have branch protection rules:

1. Go to **Settings** → **Branches**
2. Check if any rules reference "refscope" in their names or descriptions
3. Update as needed

## Step 4: Update GitHub Actions Secrets

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Check if any secrets reference "refscope" in their names
3. No need to change NPM_TOKEN or other generic secrets

## Step 5: Update GitHub Pages (if applicable)

If using GitHub Pages:

1. Go to **Settings** → **Pages**
2. The URL will automatically update to `crjfisher.github.io/ast-climber`

## Step 6: Update Release Descriptions

For existing releases that mention "refscope":

1. Go to **Releases**
2. For each release, click **Edit**
3. Update any mentions of "refscope" to "ast-climber"
4. Save changes

## Step 7: Verify Redirects

Test that old URLs redirect properly:

```bash
# These should all redirect to the new URL
curl -I https://github.com/CRJFisher/refscope
curl -I https://github.com/CRJFisher/refscope.git
```

## Step 8: Update Local Clones

For your local development environment:

```bash
# Check current remote
git remote -v

# Update the remote URL
git remote set-url origin https://github.com/CRJFisher/ast-climber.git

# Verify the change
git remote -v

# Fetch to ensure everything works
git fetch
```

## Step 9: Notify Collaborators

Send a message to any collaborators:

```
The repository has been renamed from 'refscope' to 'ast-climber'.

GitHub automatically handles redirects, but please update your local clone:
git remote set-url origin https://github.com/CRJFisher/ast-climber.git

All issues, PRs, and history are preserved.
```

## Step 10: Update External References

Update any external references to the repository:

- Documentation sites
- Blog posts (if you can)
- Social media profiles
- Package registry links (npm, etc.)

## Rollback (if needed)

If you need to revert the change:

1. Follow Step 1 again but rename back to `refscope`
2. GitHub redirects work both ways for a period of time

## Notes

- GitHub preserves redirects for renamed repositories indefinitely (unless you create a new repository with the old name)
- All Git history, issues, pull requests, and releases are preserved
- Forks will continue to work but should be updated to point to the new name
- The package name in npm is separate from the GitHub repository name
