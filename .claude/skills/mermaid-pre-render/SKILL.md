---
name: mermaid-pre-render
description: Convert a mermaid fence (or insert a new diagram) into the pre-render pattern — author `.mmd`, commit rendered `.svg`, reference SVG from markdown. Invoke with free-text describing the target, e.g. `/mermaid-pre-render the flow chart in the README` or `/mermaid-pre-render add a new sequence diagram for the auth handshake to docs/auth.md`.
allowed-tools: Bash(pnpm render-mermaid-diagrams, pnpm check-mermaid-diagrams, git add *, git status, grep *, ls *), Read, Write, Edit
---

# Mermaid pre-render

Complex mermaid diagrams are pre-rendered to SVG at author time so every reader (GitHub, Cursor, IDE preview) sees identical output. Markdown references the static SVG; the `.mmd` source lives next to it.

## What this skill does

Given a target — either named in free text (*"the flow chart in the README"*, *"the second diagram in `backlog/tasks/task-190.18`"*, *"add a new diagram showing the auth handshake to `docs/auth.md`"*) or already obvious from the prior conversation (a diagram you just authored, a fence the user was just discussing, a file just edited) — perform the conversion (or insertion) end-to-end:

1. **Locate the target.** If prior conversation context already pins down the file + diagram, use it directly. Otherwise resolve the free-text: if the file is ambiguous use `grep -rn '```mermaid'` to find candidates; if the diagram within a file is ambiguous, list them and pick the best match or ask.
2. **Pick a slug.** Choose a short kebab-case slug describing the diagram (`pipeline`, `per-step`, `auth-handshake`, `main`). If the markdown already has a single diagram, `main` is fine. Filenames are `<doc>.<slug>.mmd` + `<doc>.<slug>.svg` next to `<doc>.md`.
3. **Write the `.mmd`.** For a conversion, extract the contents of the existing ```` ```mermaid ```` fence verbatim into `<doc>.<slug>.mmd`. For a new insertion, author the mermaid source from the user's description.
4. **Edit the markdown.** Replace the fence (or insert at the requested location) with a pointer comment + image link. Do **not** keep a second copy of the source in the markdown.
   ```markdown
   <!-- mermaid source: <doc>.<slug>.mmd -->
   ![<title>](<doc>.<slug>.svg)
   ```
   URL-encode spaces in the path (e.g. `task-190.18%20-%20....main.svg`). Use the same basename the user already used in any nearby image links, or fall back to a one-line description of the diagram.
5. **Render.** Run `pnpm render-mermaid-diagrams`. This produces the SHA256-stamped `.svg` next to the `.mmd`. If the user lacks Chrome, the renderer no-ops — surface that and stop with instructions to install Chrome (or commit and let CI fail with the missing-SVG signal).
6. **Verify.** Run `pnpm check-mermaid-diagrams` to confirm the stamp matches.
7. **Stage.** `git add` the `.mmd`, the `.svg`, and the modified `.md`. Do not commit unless the user asked.

## When NOT to convert

Trivial diagrams (a handful of nodes, no risk of renderer drift) can stay as inline mermaid fences. If the user's request targets such a diagram, surface the judgment and ask before proceeding.

## Reference

- Renderer: `scripts/render-mermaid-diagrams.ts`
- Verifier: `scripts/check-mermaid-diagrams.ts`
- Stamp contract: `scripts/svg_hash_stamp.ts`
- Existing examples: `.claude/skills/triage-entrypoints/README.pipeline.{mmd,svg}`, `README.per-step.{mmd,svg}`, `backlog/completed/task-190.18*.main.{mmd,svg}`
