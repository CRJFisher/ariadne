# Task 11.161.5: Update Documentation

## Status: Planning

## Parent: Task 11.161

## Goal

Update documentation to reflect the new file naming conventions and hook enforcement.

## Subtasks

### 11.161.5.1: Finalize file-naming-conventions.md

Update `backlog/docs/file-naming-conventions.md` with:

1. **Final Directory Structure**

   - `capture_handlers/` - Named handler functions
   - `metadata_extractors/` - AST extraction
   - `symbol_factories/` - SymbolId creation

2. **Naming Patterns**

   | Pattern | Use Case | Example |
   |---------|----------|---------|
   | `{module}.ts` | Core implementation | `semantic_index.ts` |
   | `{module}.test.ts` | Unit tests | `semantic_index.test.ts` |
   | `{module}.{lang}.ts` | Language variant | `import_resolver.python.ts` |
   | `{module}.{lang}.test.ts` | Language tests | `semantic_index.typescript.test.ts` |
   | `{module}.integration.test.ts` | Integration | `project.integration.test.ts` |
   | `{lang}_{module}.ts` | Distinct impl (in designated dirs) | `extractors/python_scope_boundary_extractor.ts` |

3. **Exception Directories**

   - `scopes/extractors/` - Uses prefix pattern for distinct implementations
   - `.claude/hooks/` - Uses `.cjs` extension for CommonJS

4. **Root Directory Whitelist**

   ```
   package.json, package-lock.json, tsconfig.json, eslint.config.js
   .gitignore, .npmrc, .npmignore, LICENSE
   README.md, CONTRIBUTING.md, CLAUDE.md, AGENTS.md, .cursorrules
   ```

5. **Prohibited Patterns**

   ```
   debug_*.ts, test_*.ts, verify_*.ts
   *.py, *.sed, fix_*.sh
   *_report.md, *_analysis.md, *.log
   ```

6. **Hook Enforcement**

   - PreToolUse: Blocks prohibited file creation
   - Stop: Audits for violations before task completion

### 11.161.5.2: Update CLAUDE.md

Add section to CLAUDE.md:

```markdown
## File Naming Conventions

See `backlog/docs/file-naming-conventions.md` for complete documentation.

### Quick Reference

- Source files: `snake_case.ts`
- Test files: `{module}.test.ts` or `{module}.{language}.test.ts`
- Language variants: `{module}.{language}.ts` (with base module)
- Distinct implementations: `{language}_{module}.ts` (in designated directories)

### Root Directory

Only whitelisted files allowed. Debug scripts, reports, and logs are prohibited.

### Enforcement

Hook scripts validate file naming on Write/Edit and audit on task completion.
```

## Files to Update

- `backlog/docs/file-naming-conventions.md` - Complete rewrite
- `CLAUDE.md` - Add new section

## Success Criteria

1. Documentation reflects current state (not history)
2. All naming patterns documented with examples
3. Exception directories clearly listed
4. Hook behavior documented
5. CLAUDE.md references full documentation
