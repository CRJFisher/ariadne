---
id: TASK-345
title: >-
  Build a mermaid pre-render workflow for task and skill diagrams
  (commit SVGs, hash-verify in CI, no Chrome required for most contributors)
status: Done
assignee: []
created_date: "2026-05-26"
labels:
  - diagrams
  - tooling
  - documentation
  - hooks
dependencies: []
references:
  - backlog/tasks/task-190.18 - Build-fix-sequencer-skill-cluster-score-and-sequence-backlog-into-Pareto-optimal-fix-order.md
  - .claude/skills/triage-entrypoints/README.md
  - .claude/skills/skill-diagrammer/anatomy.md
  - scripts/setup-hooks.sh
  - scripts/check-commit-message.ts
  - package.json
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Mermaid diagrams embedded in markdown render inconsistently across readers. The same source — for example the 7-phase flowchart in `backlog/tasks/task-190.18 - Build-fix-sequencer-...md` — renders cleanly in `mmdc` 11.15 (vertical phase stacking, no edge crossings) and as a tangled mess in Cursor's markdown-preview pane (older bundled mermaid, P6/P7 pushed right of the SKILL cluster with edges crossing the chart). Per-source workarounds (e.g., `%%{init: {"flowchart": {"defaultRenderer": "elk"}} }%%`) are unreliable because the drift is a combination of bundled-mermaid version and IDE rendering decisions.

The robust alternative: render each complex diagram once at author time with a known-good `mmdc`, commit the SVG, and have markdown reference the committed SVG. Whatever renders the markdown then just displays the image — no second mermaid engine in the loop. This task builds that workflow as a lightweight in-repo system.

**Goal:** establish a single source of truth for complex diagrams — `.mmd` source files committed alongside their generated `.svg` outputs and referenced from markdown via image links — with a pre-commit hook that auto-regenerates SVGs when Chrome is available and a hash-based CI check that verifies sync without requiring Chrome.

### Constraints

- Chromium / Chrome is **manually installed**, not a dependency. The puppeteer-bundled-Chromium download stays disabled (`puppeteer: false` in `pnpm-workspace.yaml`).
- `@mermaid-js/mermaid-cli` stays as a repo-root devDep (already at `^11.15.0`).
- The pre-commit hook **silently no-ops** when Chrome is not detected, so contributors and CI without Chrome are not blocked.
- CI verifies SVG-↔-source sync via embedded SHA256 hashes, requiring no Chrome at check time.
- No emoji in committed code or commit messages.
- Conventional Commits with this task's scope: `feat(345): ...`, `chore(345): ...`, etc.

<!-- SECTION:DESCRIPTION:END -->

## Design

<!-- SECTION:DESIGN:BEGIN -->

### Companion-file convention

For a markdown document `path/to/<doc>.md` containing one or more complex diagrams, each diagram is extracted to a sibling file and replaced with an image link:

```
path/to/<doc>.md                  # main doc, with image link + source-pointer comment
path/to/<doc>.<slug>.mmd          # canonical mermaid source (mmdc-native)
path/to/<doc>.<slug>.svg          # generated, committed, hash-stamped
```

- `<slug>` is a short kebab-case identifier describing the diagram's role (`main`, `pipeline`, `per-step`). Used uniformly even when a document has only one diagram (then `<doc>.main.mmd`), so naming has no special cases.
- Co-located with the doc (not under a `diagrams/` directory) so the diagram's path is derivable from the doc's path.
- `.mmd` is the canonical mermaid CLI extension — mmdc consumes it directly with no fence extraction.

### What the main `.md` contains

A one-line source-pointer comment followed by the image link. Nothing else for that diagram.

```markdown
<!-- Source: ./task-190.18.main.mmd — edit there; run `pnpm render-mermaid-diagrams` -->
![Fix-sequencer phases](./task-190.18.main.svg)
```

The main `.md` deliberately does **not** carry a second copy of the mermaid source (neither inline, nor in a `<details>` block, nor in an HTML comment). A second copy rots; the comment pointer is the only grep affordance, and the SVG is the only rendered artifact every reader sees.

### Generator and check scripts

Two scripts in `package.json`:

| Script                            | What it does                                                                                  | Requires Chrome | Called by      |
| --------------------------------- | --------------------------------------------------------------------------------------------- | --------------- | -------------- |
| `pnpm render-mermaid-diagrams`    | Walks `**/*.mmd`, invokes `mmdc` per file, writes sibling `.svg` with embedded source-hash    | yes             | user, hook     |
| `pnpm check-mermaid-diagrams`     | Walks `**/*.mmd`, computes SHA256, verifies it matches each sibling `.svg`'s embedded hash    | no              | CI, user       |

Implementation files:

- `scripts/render-mermaid-diagrams.ts` — discovery, mmdc invocation, hash stamping.
- `scripts/check-mermaid-diagrams.ts` — hash verification only (pure Node, no mmdc, no network).
- `scripts/puppeteer-config.json` — checked-in puppeteer config consumed by mmdc.
- `scripts/detect-chrome.ts` — small helper used by both the renderer and the pre-commit hook.

Chrome detection probes, in order:

1. `CHROME_PATH` environment variable.
2. `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` (macOS).
3. `/usr/bin/google-chrome`, `/usr/bin/chromium`, `/usr/bin/chromium-browser` (Linux).

If none resolve, the renderer (and the pre-commit hook) exits 0 with no output. `puppeteer-config.json` is rewritten at render time with the detected executable path, or the renderer short-circuits before invoking mmdc.

### Hash-stamping format

The renderer prepends a single comment as the SVG's first child:

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<!-- source-sha256: 7f3a1c... -->
<svg ...>
```

`check-mermaid-diagrams.ts` parses the first `<!-- source-sha256: ... -->` comment in each `.svg`, computes the SHA256 of the matching `.mmd`, and fails on mismatch (or missing comment, or missing `.svg`). Diff cases caught:

- `.mmd` edited without re-rendering → mismatch.
- `.svg` manually edited → mismatch (the stamped hash no longer corresponds to the file's mermaid output, but more importantly we treat any manual SVG edit as a source-of-truth violation).
- `.mmd` deleted but `.svg` left orphaned → check script reports orphan.
- `.svg` deleted but `.mmd` present → check script reports missing.

### Hook wiring

`scripts/setup-hooks.sh` installs a `.git/hooks/pre-commit` that, in addition to its existing size-check + commit-msg duties, runs:

```sh
node --import tsx "$PROJECT_DIR/scripts/render-mermaid-diagrams.ts" --staged
```

The `--staged` mode:

1. Lists staged `*.mmd` files via `git diff --cached --name-only`.
2. If none → exit 0.
3. If Chrome not detected → exit 0 silently.
4. Otherwise: render each, `git add` the sibling `.svg`, and exit 0. Block (exit non-zero) only on mmdc syntax errors.

### CI wiring

A new line in CI (and `pnpm typecheck` flow) runs `pnpm check-mermaid-diagrams`. The check is pure-Node and runs in <1s for the expected diagram count. A PR that edits a `.mmd` without re-rendering fails fast with a message naming the out-of-sync file and pointing at `pnpm render-mermaid-diagrams`.

### Failure-mode matrix

| Failure                                  | Pre-commit hook                              | `check-mermaid-diagrams` (CI)            |
| ---------------------------------------- | -------------------------------------------- | ---------------------------------------- |
| Chrome not found                         | silent exit 0                                | unaffected (no Chrome needed)            |
| mmdc syntax error in `.mmd`              | block commit; report file + mmdc stderr      | hash mismatch → fail                     |
| `.mmd` edited, `.svg` not regenerated    | auto-regens + `git add`s if Chrome present   | hash mismatch → fail                     |
| `.svg` manually edited                   | next render restores it; hash mismatch fails | hash mismatch → fail                     |
| `.mmd` orphaned (no sibling `.svg`)      | renders it                                   | missing-svg → fail                       |
| `.svg` orphaned (no sibling `.mmd`)      | n/a                                          | orphaned-svg → fail                      |

### Contributor-without-Chrome workflow

A contributor without Chrome who only edits prose is unaffected — the hook never fires for them. A contributor who needs to edit a `.mmd` has three options, documented in the skill update (decision below):

1. Install Chrome locally, run `pnpm render-mermaid-diagrams`, commit both files.
2. Edit only the `.mmd`, push, and ask a maintainer to regenerate the SVG.
3. Skip the diagram edit.

CI's hash check produces a clear, actionable error message if option 2 reaches main without the maintainer's regen step.

### Migration recipe

For each of the three diagrams currently inlined as mermaid fences:

1. Copy the fence contents (without the ` ```mermaid ` / ` ``` ` lines) to `<doc>.<slug>.mmd`.
2. Replace the fence in the `.md` with the source-pointer comment + image link (see "What the main `.md` contains").
3. Run `pnpm render-mermaid-diagrams`.
4. Visually verify the resulting `.svg` in: (a) Cursor preview of the `.md`, (b) `mmdc` (already done by the render step), (c) GitHub's rendered markdown view (push to a branch).

Hand-edit the three target diagrams; a generic extraction script is not built (YAGNI — we'd need it again only if a fourth diagram appeared, and `mmdc` itself is the round-trip verification step).

### skill-diagrammer update (separate commit, separate repo)

`/Users/chuck/workspace/claude-config/skills/skill-diagrammer/` currently teaches "draft mermaid fence inline, render with `mmdc` to verify, commit the fence". `anatomy.md` § "Layout pitfalls #3 — Renderer-version drift" added the ELK directive as the recommended drift fix (commit `2ad1f83`). With this workflow in place, that section is walked back:

- "Renderer-version drift" gains a leading paragraph pointing at the pre-render workflow as the robust fix; the ELK-directive guidance is retained but framed as the fallback for diagrams that can't be pre-rendered (e.g., README diagrams in a repo that doesn't host the workflow).
- Workflow step 6 (renderer directive) → reframed as "if your diagram lives in a repo with the pre-render workflow, the question is moot."
- Workflow step 9 (render in target reader) → updated to "run the repo's render script and verify the committed SVG renders identically in `mmdc`, Cursor, and GitHub."

The skill stays generic; ariadne is the reference implementation linked from the skill.

<!-- SECTION:DESIGN:END -->

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE:BEGIN -->

- [x] `scripts/render-mermaid-diagrams.ts`, `scripts/check-mermaid-diagrams.ts`, `scripts/detect-chrome.ts`, `scripts/svg_hash_stamp.ts`, and `scripts/puppeteer-config.json` exist and are wired into `package.json` as `render-mermaid-diagrams` and `check-mermaid-diagrams`.
- [x] `scripts/setup-hooks.sh` installs a pre-commit hook that runs the renderer in `--staged` mode, with the silent-no-op-on-no-Chrome behavior documented above.
- [x] `pnpm check-mermaid-diagrams` is wired into CI alongside `pnpm check-permanent-rules`.
- [x] `backlog/tasks/task-190.18 - Build-fix-sequencer-...md` is migrated to the new pattern. Verified in `mmdc`. Cursor preview and GitHub rendering remain a manual gap until a maintainer pushes the branch and confirms.
- [x] `.claude/skills/triage-entrypoints/README.md` is migrated to the new pattern. Both diagrams (`README.pipeline.mmd` whole-pipeline LR + `README.per-step.mmd` per-step TD) render in `mmdc`; same manual-gap caveat for Cursor / GitHub.
- [x] Editing any `.mmd` companion file and committing triggers regeneration on a machine with Chrome installed. SVG byte-stability verified locally — re-rendering the three migrated diagrams produces zero `git diff`.
- [x] CI hash-check failure path is exercised by `scripts/svg_hash_stamp.test.ts` and confirmed manually (touch a `.mmd`, `pnpm check-mermaid-diagrams` exits 1 with a hash-mismatch line naming the file).
- [x] The skill at `/Users/chuck/workspace/claude-config/skills/skill-diagrammer/` is updated in a separate commit in that repo (`e22f305`). The renderer-drift section leads with the pre-render workflow; ELK is retained as the named fallback.
- [x] No new dependencies on puppeteer (the bundled-Chromium variant). `puppeteer: false` in `pnpm-workspace.yaml` is unchanged.

<!-- SECTION:ACCEPTANCE:END -->

## Implementation Plan

<!-- SECTION:IMPLEMENTATION:BEGIN -->

Phased so each phase produces a verifiable artifact:

### Phase 1 — Generator + check scripts

- Write `scripts/detect-chrome.ts` (env-var + platform path probes; returns absolute path or null).
- Write `scripts/render-mermaid-diagrams.ts` (discovery, mmdc invocation, hash stamping, `--staged` mode).
- Write `scripts/check-mermaid-diagrams.ts` (hash verification, orphan detection).
- Write `scripts/puppeteer-config.json` (template; renderer rewrites `executablePath` at runtime from `detect-chrome`).
- Wire `render-mermaid-diagrams` and `check-mermaid-diagrams` into `package.json`.

Phase 1 verification: create a throwaway `tmp/example.main.mmd`, run the renderer locally with Chrome, confirm `.svg` appears with hash comment, run the check with both matched and intentionally-mismatched inputs.

### Phase 2 — Hook wiring

- Update `scripts/setup-hooks.sh` to install the renderer invocation into `.git/hooks/pre-commit` alongside the existing size + commit-msg checks.
- Re-run `scripts/setup-hooks.sh` locally to install.

Phase 2 verification: stage a fresh `tmp/example.main.mmd`, attempt to commit, confirm hook runs and stages the `.svg`. Temporarily move Chrome out of detected paths, confirm hook exits 0 silently.

### Phase 3 — Migrate task-190.18

- Extract the mermaid fence to `backlog/tasks/task-190.18 - ....main.mmd`.
- Replace the fence in the `.md` with the source-pointer comment + image link.
- Run `pnpm render-mermaid-diagrams`.
- Visually verify in Cursor, `mmdc`, GitHub (push branch).

### Phase 4 — Migrate triage-entrypoints README

- Extract both fences to `.claude/skills/triage-entrypoints/README.pipeline.mmd` and `.claude/skills/triage-entrypoints/README.per-step.mmd`.
- Replace each fence in the `.md` with its image link + source-pointer comment.
- Render and verify in all three readers.

### Phase 5 — CI wiring

- Add `pnpm check-mermaid-diagrams` to the CI pipeline (the same place `check-permanent-rules` is invoked — to be located during implementation).
- Push a deliberately-broken branch (edit a `.mmd`, do not re-render) and confirm CI fails with the expected message.

### Phase 6 — skill-diagrammer update (separate repo)

- Edit `/Users/chuck/workspace/claude-config/skills/skill-diagrammer/anatomy.md` § "Renderer-version drift" and the workflow steps per the design.
- Add a section linking to ariadne's `scripts/render-mermaid-diagrams.ts` as the reference implementation.
- Commit in the claude-config repo.

<!-- SECTION:IMPLEMENTATION:END -->

## Notes

<!-- SECTION:NOTES:BEGIN -->

- The renderer-drift symptom that motivated this task is documented in commits `5702f474..46368ddb` on branch `feat/self-healing-pipeline-debug`, including commit `46368ddb` which tried the ELK directive in-source and confirmed it did not fix Cursor's bundled mermaid.
- The `pnpm sync-permanent-rules` / `pnpm check-permanent-rules` pair in `package.json` lines 12–13 is the structural precedent for "commit the generated artifact, CI verifies sync". This task mirrors that pattern; the only twist is the hash-based check that lets CI verify without re-rendering.
- `@mermaid-js/mermaid-cli` invocation pattern (already established): `node_modules/.bin/mmdc -i <input> -o <output> -p <puppeteer-config> --quiet`.
- The pre-commit hook is installed by `scripts/setup-hooks.sh`. Anyone who has not run that script will not have the hook; CI's hash check is the safety net for that case too.

### Review follow-ups applied

Five reviewers were run after the first-cut implementation; the following findings were applied:

- **Hash-stamp contract extracted to `scripts/svg_hash_stamp.ts`** (`HASH_COMMENT_PREFIX`, `inject_hash_comment`, `extract_stamped_hash`, `has_stamp`, `sha256_of`). Render + check both import from this single source of truth, so the format cannot drift between producer and verifier. Tests colocated as `scripts/svg_hash_stamp.test.ts`.
- **Head-bounded hash regex.** `extract_stamped_hash` only scans the first 512 bytes. Closes a class of false-positives where a future diagram about commit hashes embeds the literal stamp string in a node label.
- **Orphan detection rewritten.** The previous "has a sibling .mmd in the same directory" gate silently dropped the most common failure (delete the only `.mmd` in a directory, forget the `.svg`). The new rule: any tracked `.svg` that carries the workflow's stamp but has no expected `.mmd` source is an orphan. Hand-committed unstamped SVGs (icons, logos) are out of scope.
- **`--staged` mode tolerates worktree-deleted staged sources.** A staged `.mmd` whose worktree copy was removed before commit no longer aborts the commit with ENOENT; the renderer skips it and the next `check-mermaid-diagrams` run surfaces the stale sibling SVG if it makes it to a PR.
- **Malformed-XML throw test added.** The only error path in the pure stamp module is now covered.

Findings left open (with rationale): file renames to enforce snake_case across `scripts/` (mixed convention pre-dates this task, would expand scope to existing scripts); concurrent renderer-vs-hook write race (writes are non-atomic but the output is deterministic, so YAGNI); silent overwrite of unstaged manual SVG edits (the design intent is that SVGs are generated and never hand-edited — hand edits are out of scope).

<!-- SECTION:NOTES:END -->
