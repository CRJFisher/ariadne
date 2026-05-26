#!/usr/bin/env tsx

/**
 * Chrome / Chromium discovery for the mermaid pre-render workflow.
 *
 * Probes (in order):
 *   1. CHROME_PATH env var
 *   2. macOS default install path
 *   3. Common Linux paths
 *
 * Returns the absolute path of the first executable found, or null. The
 * renderer and pre-commit hook both short-circuit (silent exit 0) when this
 * returns null, so contributors without a local Chrome are never blocked.
 */

import { accessSync, constants } from "fs";

const LINUX_CANDIDATES: readonly string[] = [
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

const MAC_CANDIDATE =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function is_executable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function detect_chrome(): string | null {
  const from_env = process.env.CHROME_PATH;
  if (from_env && is_executable(from_env)) {
    return from_env;
  }

  if (process.platform === "darwin" && is_executable(MAC_CANDIDATE)) {
    return MAC_CANDIDATE;
  }

  if (process.platform === "linux") {
    for (const candidate of LINUX_CANDIDATES) {
      if (is_executable(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

// Allow `node --import tsx scripts/detect-chrome.ts` to print the result for
// quick manual checks: prints the path on stdout, or "" if not found.
const is_main =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("detect-chrome.ts");

if (is_main) {
  const found = detect_chrome();
  if (found) {
    process.stdout.write(`${found}\n`);
  }
}
