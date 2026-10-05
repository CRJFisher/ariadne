---
id: TASK-357
title: Index `.mdx` files so components used only in MDX are reachable
status: Done
assignee: []
created_date: "2026-06-30 00:00"
labels:
  - bug
  - indexer
  - coverage
dependencies: []
references:
  - packages/core/src/project/file_loading.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

`SUPPORTED_EXTENSIONS` in `file_loading.ts` includes `.ts/.tsx/.js/.jsx` but not
`.mdx`, so MDX files are neither greped nor parsed. A component whose only callers
live in `.mdx` files is therefore mislabeled as having no textual callers and
surfaces as an unreachable entry point.

Surfaced by TASK-190.30.1's registry audit, which removed the
`jsx-mdx-component-usage` suppressor classifier as a fixable coverage gap rather
than a permanent limitation. Closing this requires extending extension coverage so
MDX component usages register as references.

### Origin (deleted classifier row this tracks)

`jsx-mdx-component-usage` (builtin, observed in typeorm).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] `.mdx` files are indexed (component usages in MDX register as references), so a
      component referenced only from MDX is not flagged as an unreachable entry point.
- [x] Regression test covers an MDX-only component usage.

<!-- AC:END -->

## Implementation Notes

## High-level summary

`.mdx` files are a first-class part of the indexed source set. MDX is Markdown
carrying embedded ESM imports and JSX, so a component used only as a JSX element
in an `.mdx` file now registers as a resolved reference — the component gains an
incoming call edge and is no longer reported as an unreachable entry point.

Four coordinated changes make this work:

- **Discovery** — `SUPPORTED_EXTENSIONS` (`project/file_loading.ts`) includes
  `mdx`, so `find_source_files` discovers `.mdx` files and the watcher re-indexes
  them on change.
- **Language routing** — `detect_language` maps `.mdx` to `javascript`. The
  JavaScript tree-sitter grammar is the only wired grammar that captures JSX
  element usages (`jsx_opening_element` / `jsx_self_closing_element`) as
  references; the TypeScript grammar variant in use does not parse JSX. Because
  MDX collapses to an existing `Language`, every per-language switch handles it
  with no new arm.
- **Frontmatter handling** — `project/blank_mdx_frontmatter.ts` blanks a leading
  YAML frontmatter block (replacing every non-newline, non-carriage-return
  character with a space) before the JavaScript grammar parses the file.
  `parse_file` applies it to `.mdx` content only. Blanking preserves line and
  column positions, so reference and definition locations stay accurate; without
  it, the grammar's error recovery merges the frontmatter with the import that
  follows and drops that import from the index.
- **Cross-language resolution** — the JavaScript relative-import resolver
  (`import_resolution.javascript.ts`) probes `.ts`/`.tsx` targets after the
  JavaScript family. A component defined in a `.tsx` module (the typeorm origin
  case) resolves from an `.mdx` (or `.js`) importer; a JavaScript target still
  wins when both exist, mirroring the symmetry the TypeScript resolver already
  has.

### Reachability chain

A JSX usage `<Button/>` in an `.mdx` file is captured as a function-call
reference to `Button`. Name resolution binds `Button` through the MDX file's
`import` to the exported definition; call resolution records the resolved target;
`get_all_referenced_symbols` includes it, so `detect_entry_points` no longer
lists `Button`. Resolution requires the import to be indexed, which is why
frontmatter blanking (protecting the first import) is load-bearing.

### Tests

- `project/blank_mdx_frontmatter.test.ts` — unit coverage for the blanking
  transform: block present/absent, CRLF, end-of-file without a trailing newline,
  a leading-line-only `---` left untouched, and exact length/position
  preservation.
- `project/load_project.test.ts` (`MDX component reachability`) — end-to-end
  through `load_project` on a temp directory (the harness that populates the
  import-resolution file tree): an unused exported component is an entry point
  (control), a component used only via a JSX element in an `.mdx` file is not
  (named import, `.jsx` and `.tsx` definitions, default export), and a component
  used only in a plain `.md` file remains an entry point (guarding the `.mdx`/`.md`
  boundary). Mutation testing confirmed each implementation change is pinned by a
  test that fails on its reversion.

### Known limitation

A namespace-imported component used as a member expression tag
(`import * as UI` then `<UI.Button/>`) is not resolved: the JSX query captures
only a bare identifier tag name, not a member expression. This is a pre-existing
JSX-capture limitation independent of MDX and is out of scope here.
