/**
 * SHA256-stamp contract for pre-rendered SVGs.
 *
 * The renderer (`render-mermaid-diagrams.ts`) prepends a single
 * `<!-- source-sha256: <hex> -->` comment as the SVG's first child. The
 * checker (`check-mermaid-diagrams.ts`) reads that comment and compares the
 * stamped hash to the SHA256 of the sibling `.mmd` source. Both ends live here
 * so the comment format is a single source of truth.
 *
 * The regex only matches inside the first 512 bytes so a future diagram that
 * *describes* this stamp format in a node label cannot accidentally satisfy
 * the check.
 */

import { createHash } from "crypto";

const HASH_COMMENT_PREFIX = "<!-- source-sha256:";
const HASH_COMMENT_RE = /<!--\s*source-sha256:\s*([0-9a-f]{64})\s*-->/;
const HEAD_SCAN_BYTES = 512;

export function sha256_of(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function inject_hash_comment(svg: string, source_hash: string): string {
  const comment = `${HASH_COMMENT_PREFIX} ${source_hash} -->`;
  if (svg.startsWith("<?xml")) {
    const end = svg.indexOf("?>");
    if (end === -1) {
      throw new Error("malformed SVG: missing ?> after <?xml");
    }
    const head = svg.slice(0, end + 2);
    const tail = svg.slice(end + 2);
    return `${head}\n${comment}${tail}`;
  }
  return `${comment}\n${svg}`;
}

export function extract_stamped_hash(svg: string): string | null {
  const head = svg.slice(0, HEAD_SCAN_BYTES);
  const match = head.match(HASH_COMMENT_RE);
  return match ? match[1] : null;
}

export function has_stamp(svg: string): boolean {
  return extract_stamped_hash(svg) !== null;
}
