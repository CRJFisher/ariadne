---
id: task-100.20
title: Create dedicated ImportResolver service
status: Done
assignee: []
created_date: '2025-08-05 21:16'
updated_date: '2025-08-05 21:28'
labels: []
dependencies: []
parent_task_id: task-100
---

## Description

Extract all import resolution logic into a dedicated service to clarify ownership and eliminate circular dependencies. Currently import resolution logic is scattered across QueryService and NavigationService, leading to unclear responsibilities and potential circular dependencies between services.

## Acceptance Criteria

- [ ] New ImportResolver service created with clear interface
- [ ] All import resolution logic moved from QueryService/NavigationService to ImportResolver
- [ ] Clear interface with methods: resolveImport()
- [ ] getImportsWithDefinitions()
- [ ] resolveModulePath()
- [ ] No circular dependencies between services after refactoring
- [ ] ImportResolver service properly injected into dependent services

## Implementation Plan

1. Create new ImportResolver service file with clear interface
2. Extract getImportsWithDefinitions logic from QueryService
3. Extract module resolution logic from ModuleResolver usage
4. Create resolveImport method for single import resolution
5. Update NavigationService to use ImportResolver
6. Update QueryService to use ImportResolver
7. Update Project class to inject ImportResolver
8. Ensure no circular dependencies
9. Add unit tests for ImportResolver

## Implementation Notes

## Implementation Summary

Successfully created a dedicated ImportResolver service that centralizes all import resolution logic.

## Key Changes

1. **Created ImportResolver Service** (import_resolver.ts)
   - Clear interface with resolveImport(), getImportsWithDefinitions(), resolveModulePath()
   - Extracted all import resolution logic from QueryService
   - Consolidated module path resolution for all languages

2. **Updated Services to Use ImportResolver**
   - NavigationService: Now delegates to ImportResolver instead of broken graph.getImportInfo()
   - QueryService: Replaced complex import logic with ImportResolver delegation
   - Project: Creates ImportResolver and injects it into dependent services

3. **Eliminated Circular Dependencies**
   - ImportResolver is a leaf service with no dependencies on other services
   - NavigationService and QueryService both depend on ImportResolver
   - No circular dependency chains exist

## Architecture Improvements

- **Clear Ownership**: ImportResolver owns all import resolution logic
- **Single Source of Truth**: No duplicate import resolution code
- **Better Testability**: Import resolution can be tested in isolation
- **Simplified Services**: NavigationService and QueryService are now cleaner

## Files Modified
- Created: packages/core/src/project/import_resolver.ts
- Modified: packages/core/src/project/navigation_service.ts
- Modified: packages/core/src/project/query_service.ts
- Modified: packages/core/src/project/project.ts
- Created: packages/core/tests/import_resolver.test.ts

## Next Steps
- Continue with task-100.19 (Add error handling for unimplemented methods)
- Then proceed with task-100.25 (Standardize import patterns across codebase)
