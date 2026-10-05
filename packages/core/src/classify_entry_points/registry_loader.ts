/**
 * Loader for the bundled permanent-rule slice of the known-issues registry.
 *
 * The full registry (with `wip` and `proposed` rules) lives at
 * `.claude/skills/triage/known_issues/registry.json`. Core ships only the
 * permanent slice as `registry_permanent_data.ts`, regenerated from the source
 * registry. Because the slice is a `.ts` module, tsc emits it into `dist/` as
 * part of the normal build — no separate copy step is needed.
 *
 * On first call we shallow-clone the bundled slice so an HMR reload (or a test
 * that swaps the slice) cannot leak a mutation back into the exported module
 * constant.
 */

import type {
  KnownIssue,
  KnownIssuesRegistry,
} from "@ariadnejs/types";
import { KNOWN_ISSUES_REGISTRY_SCHEMA_VERSION } from "@ariadnejs/types";
import { PERMANENT_REGISTRY_FILE } from "./registry_permanent_data";

let permanent_registry_cache: KnownIssuesRegistry | null = null;

/**
 * Loader error surfaced when the bundled slice is corrupt or out of date.
 * Fails loud rather than silently degrading classification: a slice that
 * carries a non-permanent rule indicates the slice regeneration regressed
 * and the next user of the library would mis-classify.
 */
export class PermanentRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentRegistryError";
  }
}

export function load_permanent_registry(): KnownIssuesRegistry {
  if (permanent_registry_cache !== null) {
    return permanent_registry_cache;
  }
  validate_permanent_slice(PERMANENT_REGISTRY_FILE.rules);
  permanent_registry_cache = PERMANENT_REGISTRY_FILE.rules.map((issue) => ({ ...issue }));
  return permanent_registry_cache;
}

/**
 * Cross-check the slice against the published schema version and reject
 * non-permanent rules. Pure — no caching or mutation — so tests can call it
 * directly against a synthetic slice.
 */
export function validate_permanent_slice(rules: readonly KnownIssue[]): void {
  if (PERMANENT_REGISTRY_FILE.schema_version !== KNOWN_ISSUES_REGISTRY_SCHEMA_VERSION) {
    throw new PermanentRegistryError(
      `bundled permanent slice schema_version ${PERMANENT_REGISTRY_FILE.schema_version} ` +
        `does not match @ariadnejs/types ${KNOWN_ISSUES_REGISTRY_SCHEMA_VERSION} — ` +
        "the permanent slice must be regenerated from the source registry",
    );
  }
  for (const issue of rules) {
    assert_permanent(issue);
  }
}

function assert_permanent(issue: KnownIssue): void {
  if (issue.status !== "permanent") {
    throw new PermanentRegistryError(
      `bundled slice contains non-permanent rule "${issue.group_id}" (status="${issue.status}") — ` +
        "the slice must filter on status === \"permanent\"",
    );
  }
}

/**
 * Reset the registry cache. Used by tests that swap the slice at runtime;
 * do not call from production code.
 */
export function reset_permanent_registry_cache_for_tests(): void {
  permanent_registry_cache = null;
}
