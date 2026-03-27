import { createHash } from "crypto";

/** Branded type for SHA-256 content hashes. */
export type ContentHash = string & { _brand: "ContentHash" };

/**
 * Compute SHA-256 hex digest of file content.
 * Deterministic: same content always produces the same hash.
 */
export function compute_content_hash(content: string): ContentHash {
  return createHash("sha256")
    .update(content, "utf-8")
    .digest("hex") as ContentHash;
}
