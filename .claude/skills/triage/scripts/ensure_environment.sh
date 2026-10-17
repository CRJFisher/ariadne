#!/usr/bin/env bash
#
# Bring the checkout this skill lives in to a state where its scripts run the
# checkout's own Ariadne: dependencies installed, and every workspace package the
# skill imports built from the source beside it.
#
# A fresh git worktree has neither — `node_modules` and `dist/` are gitignored — so
# the first `node --import tsx` call fails before anything is detected. A checkout
# whose source moved since its last build is the quieter failure: triage measures
# whatever `dist/` was compiled last, not the code the run is meant to judge.
#
# A ready checkout is left untouched, so the script is safe to run before every
# triage. It is plain bash because `tsx` is one of the things it may be installing.
#
# Usage:
#   ensure_environment.sh
#
# Prints one line naming what it did. Exits non-zero, naming the command, when
# `pnpm` is missing or an install or build fails.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname -- "$SCRIPT_DIR")"
ROOT="$(cd -- "$SKILL_DIR/../../.." && pwd)"

# The skill's own workspace dependencies, read from its package.json so the list
# cannot drift from what the scripts import. `@ariadnejs/<name>` lives at
# `packages/<name>`.
WORKSPACE_PACKAGES=()
while IFS= read -r name; do
  WORKSPACE_PACKAGES+=("$name")
done < <(sed -n 's/.*"@ariadnejs\/\([a-z0-9-]*\)": "workspace:.*/\1/p' "$SKILL_DIR/package.json")

needs_install() {
  [[ ! -e "$ROOT/node_modules/.bin/tsx" ]] && return 0
  local name
  for name in "${WORKSPACE_PACKAGES[@]}"; do
    [[ ! -e "$SKILL_DIR/node_modules/@ariadnejs/$name" ]] && return 0
  done
  return 1
}

# A package is stale when it has no build, or when any of its source is newer
# than the build's entry point.
needs_build() {
  local name dist
  for name in "${WORKSPACE_PACKAGES[@]}"; do
    dist="$ROOT/packages/$name/dist/index.js"
    [[ ! -e "$dist" ]] && return 0
    [[ -n "$(find "$ROOT/packages/$name/src" -newer "$dist" -print -quit)" ]] && return 0
  done
  return 1
}

if ! needs_install && ! needs_build; then
  echo "environment: ready"
  exit 0
fi

command -v pnpm >/dev/null || {
  echo "environment: pnpm is not on PATH; install it to hydrate $ROOT" >&2
  exit 1
}

# Two triages started in one checkout would otherwise install and build into the
# same tree at once. The lock lives in the checkout's own git dir, so worktrees of
# one repository never wait on each other. A lock whose holder has died is taken
# over rather than waited out.
LOCK="$(git -C "$ROOT" rev-parse --absolute-git-dir)/triage-environment.lock"
until mkdir "$LOCK" 2>/dev/null; do
  holder="$(cat "$LOCK/pid" 2>/dev/null || true)"
  if [[ -n "$holder" ]] && ! kill -0 "$holder" 2>/dev/null; then
    rm -rf "$LOCK"
    continue
  fi
  sleep 1
done
echo "$$" >"$LOCK/pid"
trap 'rm -rf "$LOCK"' EXIT

# Re-read under the lock: the holder we waited on may have done the work.
done_steps=()
if needs_install; then
  # Not `--offline`: the repository pins pnpm's own version, and a pinned version
  # missing from the store is fetched even when every dependency is already there.
  (cd "$ROOT" && pnpm install --prefer-offline --frozen-lockfile) >&2
  done_steps+=("installed dependencies")
fi
if needs_build; then
  (cd "$ROOT" && pnpm --filter "$(sed -n 's/^  "name": "\(.*\)",$/\1/p' "$SKILL_DIR/package.json")^..." run build) >&2
  done_steps+=("built ${WORKSPACE_PACKAGES[*]}")
fi

if [[ ${#done_steps[@]} -eq 0 ]]; then
  echo "environment: ready"
else
  joined="$(IFS=';'; echo "${done_steps[*]}")"
  echo "environment: ${joined//;/; }"
fi
