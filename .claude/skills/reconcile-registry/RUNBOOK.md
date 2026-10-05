# Reconcile-Registry Runbook

Operational recovery procedures for the classifier registry write path. The write-boundary contract itself lives in `.claude/rules/classifier-lifecycle.md`; this runbook holds the "something went wrong at the lock" procedures.

## Stale-lock recovery

`atomic_update_registry` retries lock acquisition 100 times at 50ms (≈5s budget) before throwing `could not acquire <path>.lock after 5000ms — stale lock?`. Two recovery paths:

- **Honest contention**: a slow mutator legitimately exceeded the budget. Increase the budget at the call site, or split the mutation into smaller transactions. A read-mutate-write pass over a registry of several hundred rules runs sub-second, so a real bump would be evidence of a runaway loop.
- **Crashed writer**: a previous writer was killed (SIGKILL, OOM, kernel panic, `pkill -9`) after acquiring the lock and before `finally` ran. The sidecar persists indefinitely. Manual cleanup is `rm <registry-path>.lock`; verify no live writer process holds the file (`lsof <registry-path>.lock`) before deleting. We do not auto-break stale locks based on mtime because the cure is worse than the disease: a false positive (legitimate slow writer) would interleave two mutators on the same registry, which is exactly the race the lock exists to prevent.
