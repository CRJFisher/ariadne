import { createHash } from "crypto";

/** Branded so an arbitrary string cannot stand in where a verified hash is required. */
export type ContentHash = string & { _brand: "ContentHash" };

export function compute_content_hash(content: string): ContentHash {
  return createHash("sha256")
    .update(content, "utf-8")
    .digest("hex") as ContentHash;
}
