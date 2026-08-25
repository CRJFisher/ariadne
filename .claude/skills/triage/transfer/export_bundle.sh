#!/usr/bin/env bash
#
# Package this machine's Ariadne data for transfer to another machine.
#
# The archive holds one cohort's triage verdicts and any perf investigation —
# what cost model time to produce and what nothing re-derives. It leaves behind
# the shallow clones and the index cache, which both re-create themselves.
# `build_transfer_manifest.ts` owns those decisions and prints the path list this
# script packs, so the archive can never disagree with its own manifest.
#
# Alongside the payload it writes a `_transfer/` directory: the manifest naming
# every project and run the bundle claims, a store health report narrowed to
# them, per-file checksums, and the merge instructions.
#
# Usage:
#   export_bundle.sh [--cohort <n>|all] [--out <dir>] [--ariadne-dir <dir>]
#                    [--name <basename>] [--level <1-19>] [--skip-checksums]
#                    [--dry-run]
#
# --cohort defaults to 2, the cohort this bundle exists to move. Repeat it to
# carry more than one, or pass `all` to carry every project in the store.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname -- "$SCRIPT_DIR")"

ARIADNE_DIR="${HOME}/.ariadne"
OUT_DIR="${HOME}"
NAME=""
LEVEL=10
SKIP_CHECKSUMS=0
DRY_RUN=0
COHORT_ARGS=()

usage() {
  sed -n '2,23p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --cohort) COHORT_ARGS+=(--cohort "$2"); shift 2 ;;
    --out) OUT_DIR="$2"; shift 2 ;;
    --ariadne-dir) ARIADNE_DIR="$2"; shift 2 ;;
    --name) NAME="$2"; shift 2 ;;
    --level) LEVEL="$2"; shift 2 ;;
    --skip-checksums) SKIP_CHECKSUMS=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage 0 ;;
    *) echo "Unknown argument: $1" >&2; usage 2 ;;
  esac
done

# The cohort this bundle exists to move, unless the operator names another.
[ "${#COHORT_ARGS[@]}" -gt 0 ] || COHORT_ARGS=(--cohort 2)

for tool in node tar zstd; do
  command -v "$tool" >/dev/null 2>&1 || { echo "Error: $tool is required but not installed." >&2; exit 2; }
done
[ -d "$ARIADNE_DIR" ] || { echo "Error: no Ariadne data at $ARIADNE_DIR" >&2; exit 2; }

if [ -z "$NAME" ]; then
  NAME="ariadne-transfer-$(hostname -s)-$(date -u +%Y%m%dT%H%M%SZ)"
fi
ARCHIVE="${OUT_DIR}/${NAME}.tar.zst"

STAGING="$(mktemp -d "${TMPDIR:-/tmp}/ariadne-transfer-XXXXXX")"
trap 'rm -rf "$STAGING"' EXIT
COMPANIONS="${STAGING}/_transfer"

echo "==> Building manifest"
node --import tsx "${SKILL_DIR}/scripts/build_transfer_manifest.ts" \
  --ariadne-dir "$ARIADNE_DIR" --out "$COMPANIONS" "${COHORT_ARGS[@]}"
cp "${SCRIPT_DIR}/README.md" "${COMPANIONS}/README.md"

# The same path list the manifest describes, so the two cannot drift apart.
PAYLOAD=()
while IFS= read -r tree; do
  [ -n "$tree" ] && PAYLOAD+=("$tree")
done < <(node --import tsx "${SKILL_DIR}/scripts/build_transfer_manifest.ts" \
           --ariadne-dir "$ARIADNE_DIR" --print-payload "${COHORT_ARGS[@]}")

[ "${#PAYLOAD[@]}" -gt 0 ] || { echo "Error: nothing to package under $ARIADNE_DIR" >&2; exit 2; }

echo "==> Payload"
for tree in "${PAYLOAD[@]}"; do
  printf '    %-48s %s\n' "$tree" "$(du -sh "${ARIADNE_DIR}/${tree}" | cut -f1)"
done

if [ "$SKIP_CHECKSUMS" -eq 0 ]; then
  echo "==> Checksumming payload (pass --skip-checksums to omit)"
  ( cd "$ARIADNE_DIR" && find "${PAYLOAD[@]}" -type f -print0 \
      | xargs -0 shasum -a 256 ) > "${COMPANIONS}/SHA256SUMS"
  echo "    $(wc -l < "${COMPANIONS}/SHA256SUMS" | tr -d ' ') file(s) checksummed"
else
  echo "checksums skipped at the operator's request" > "${COMPANIONS}/SHA256SUMS"
fi

if [ "$DRY_RUN" -eq 1 ]; then
  echo "==> Dry run — no archive written. Companions staged at ${COMPANIONS}"
  trap - EXIT
  exit 0
fi

echo "==> Compressing to ${ARCHIVE} (zstd -${LEVEL})"
mkdir -p "$OUT_DIR"
tar --create \
    -C "$STAGING" _transfer \
    -C "$ARIADNE_DIR" "${PAYLOAD[@]}" \
  | zstd "-${LEVEL}" -T0 --long=27 -o "$ARCHIVE" -f

echo "==> Done"
printf '    archive : %s\n' "$ARCHIVE"
printf '    size    : %s\n' "$(du -h "$ARCHIVE" | cut -f1)"
printf '    sha256  : %s\n' "$(shasum -a 256 "$ARCHIVE" | cut -d' ' -f1)"
echo
echo "Merge instructions travel inside the archive at _transfer/README.md."
