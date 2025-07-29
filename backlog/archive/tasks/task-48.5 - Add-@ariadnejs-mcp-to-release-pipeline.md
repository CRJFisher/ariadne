---
id: task-48.5
title: Add @ariadnejs/mcp to release pipeline
status: Done
assignee:
  - '@claude'
created_date: '2025-07-29'
updated_date: '2025-07-29'
labels: []
dependencies: []
parent_task_id: task-48
---

## Description

Configure the @ariadnejs/mcp package to be included in the automated release pipeline so it gets published to npm along with the other packages. This will enable testing and distribution of the MCP server.

## Acceptance Criteria

- [x] @ariadnejs/mcp included in changeset configuration
- [x] Package included in monorepo build pipeline
- [x] Release workflow publishes @ariadnejs/mcp to npm
- [x] Package versioning synchronized with other packages
- [x] Documentation updated for release process

## Implementation Plan

1. Check current changeset and release configuration
2. Add @ariadnejs/mcp to linked packages in changeset config
3. Verify package.json has proper npm publishing configuration
4. Update package versions to match current monorepo versions
5. Ensure build script makes server.js executable
6. Create changeset for the new package

## Implementation Notes

Successfully configured @ariadnejs/mcp for the release pipeline. Updated changeset config to link all three packages together, ensured proper package.json configuration with executable bin file, updated dependency versions to match current releases, and created a changeset for the new package. The package will now be published to npm with the next release.
