# Merging Ariadne triage data from another machine

This bundle carries the **cohort 2** triage verdicts and the performance work on
indexing at vscode's scale.
Merging folds them into this machine's `~/.ariadne` as a union: anything this
machine already has stays exactly as it is, anything only the bundle has is
copied in, and a path both machines hold with different content is reported and
left untouched on both sides.

Everything you run lives in the Ariadne repository, at
`.claude/skills/triage/scripts/`. Check the repository out at the commit named in
`_transfer/MANIFEST.json` (`toolchain.git_commit`) or later, then run
`pnpm install` from the repository root.

## What the bundle holds

```text
_transfer/                        the bundle's record of itself
  MANIFEST.json                   every project and run the bundle claims
  store_health.json               each carried run's completion and publication state
  SHA256SUMS                      per-file checksums over the payload
triage-entrypoints/
  triage_state/<project>/runs/    per-run state and per-entry verdicts
  analysis_output/<project>/      entry-point dumps and published results
  project_configs/                pipeline configuration for the cohort's targets
perf-investigation-<date>/        probes and profiles from the indexing investigation
benchmark-runs/                   per-run reachability maps from the benchmark harness
```

`MANIFEST.json` names both sides of the selection: `selection.included` is every
project carried, `selection.omitted` every project left behind and the cohort it
belongs to.

Four things are deliberately absent. `triage-entrypoints/repos/` holds shallow
clones at pinned commits, which `detect_entrypoints` re-creates at the
`commit_hash` a project's newest run recorded, or at any run's via `--commit`
(step 5). `cache/` holds the derived per-corpus index in
directories named by a hash of the corpus's absolute path, so it is not even
addressable on a machine with a different home directory. `plan/` and
`skill-analysis/` are cohort 1 work and stay on the machine that produced them.

## Merge

Run these from the repository root. Every step is a dry run until you pass
`--apply`, and every step is safe to repeat.

```bash
SKILL=.claude/skills/triage
BUNDLE=/tmp/ariadne-bundle
```

### 1. Unpack

```bash
mkdir -p "$BUNDLE"
tar --extract --zstd -f ariadne-transfer-<host>-<stamp>.tar.zst -C "$BUNDLE"
```

Verify the payload against its checksums:

```bash
cd "$BUNDLE" && shasum -a 256 --check _transfer/SHA256SUMS --quiet
```

### 2. Put both stores on canonical project ids

A project id names `triage_state/<id>/` and `analysis_output/<id>/`, and it is
the key `targets.yaml` and the known-issues registry join on. The canonical id is
the owner-qualified slug — `nodejs--node`, `vuejs--core`. Migrate the bundle and
this machine's store to it _before_ merging, so runs of one project land in one
directory rather than two.

The bundle carries no plan store, so point `--plan-dir` inside the bundle and
nothing outside it is touched:

```bash
node --import tsx $SKILL/scripts/migrate_project_ids.ts \
  --store "$BUNDLE/triage-entrypoints" --plan-dir "$BUNDLE/plan"
node --import tsx $SKILL/scripts/migrate_project_ids.ts \
  --store "$BUNDLE/triage-entrypoints" --plan-dir "$BUNDLE/plan" --apply
```

Then this machine's store, where the plan store _is_ present and its project
attributions are rewritten alongside the runs:

```bash
node --import tsx $SKILL/scripts/migrate_project_ids.ts
node --import tsx $SKILL/scripts/migrate_project_ids.ts --apply --prune-empty
```

The migration reads each project's canonical id out of the corpus path its own
run artifacts recorded, so no id is guessed. It moves the run directories, the
published output and the project config, retargets the `project_name` and
`source_analysis_path` each run carries, and rewrites the plan store's project
attributions. `--prune-empty` deletes project directories that hold no manifest,
no state and no verdicts.

It rewrites the plan store in place, so back that up first if you want a way
back:

```bash
cp -R ~/.ariadne/plan ~/.ariadne/plan.backup
```

If the migration reports `BLOCKED — two ids resolve to one canonical id`, two
directories claim the same project. Decide which run history to keep before going
further; nothing is moved while that is unresolved.

### 3. Merge

```bash
node --import tsx $SKILL/scripts/merge_bundle.ts --bundle "$BUNDLE"
node --import tsx $SKILL/scripts/merge_bundle.ts --bundle "$BUNDLE" --apply
```

If the two machines keep their Ariadne data in different places, the merge stops
and prints the rewrite to add, because a store whose embedded paths resolve to
nothing fails later, inside a triage run. Add it and re-run:

```bash
node --import tsx $SKILL/scripts/merge_bundle.ts --bundle "$BUNDLE" \
  --rewrite /Users/other/.ariadne "$HOME/.ariadne" --apply
```

The rewrite applies to text artifacts on the way in; anything else is copied byte
for byte.

Two files at the same path are treated as the same artifact when their sizes
match, which holds because every path in the store is named after a run id or a
millisecond timestamp. Pass `--verify-hash` to compare content in full.

### 4. Verify

```bash
node --import tsx $SKILL/scripts/check_triage_store.ts
```

Every project should read `ok`. Cross-check against the manifest, which names
every run the bundle carried:

```bash
node -e '
const m = require(process.env.BUNDLE + "/_transfer/MANIFEST.json");
for (const p of m.store.inventory) {
  console.log(p.canonical_project_id ?? p.project_id, p.run_ids.join(" "));
}
'
```

### 5. Re-clone the corpora you want to work on

The clones are not in the bundle. Every verdict's file and line numbers point
into the clone at the commit its run recorded, so a clone is re-created at that
commit, not at upstream HEAD. For a target with a config
(`triage-entrypoints/project_configs/` carries the folder and exclusion settings
each large target needs):

```bash
node --import tsx $SKILL/scripts/detect_entrypoints.ts \
  --config ~/.ariadne/triage-entrypoints/project_configs/<project>.json
```

For any other target, `/triage <owner>/<repo>` or directly:

```bash
node --import tsx $SKILL/scripts/detect_entrypoints.ts --github <owner>/<repo>
```

Either form puts `repos/<project>/` at the commit of the project's newest run
(`triage_state/<project>/runs/<run-id>/manifest.json` → `commit_hash`), leaves a
clone already there untouched, and exits non-zero without writing a dump if the
commit cannot be fetched. To read an older run's verdicts against its own tree,
name that run's commit:

```bash
node --import tsx $SKILL/scripts/detect_entrypoints.ts \
  --github <owner>/<repo> --commit <commit_hash>
```

Detection re-indexes the corpus as part of this and writes a fresh
`detect_entrypoints/` dump at that commit.

## Reading the merged results

Each project's published verdicts are at
`~/.ariadne/triage-entrypoints/analysis_output/<project>/triage_results/<run-id>.json`.
Validate any of them against the current envelope schema with:

```bash
node --import tsx $SKILL/scripts/check_triage_results.ts --project <project>
```
