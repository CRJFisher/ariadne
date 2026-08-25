/**
 * Digests for fingerprint components, computed one member at a time.
 *
 * A fingerprint component is a sorted list of member strings and its hash must
 * never be taken by concatenating that list: a full-corpus arm over roughly two
 * million call edges died inside `Array.prototype.join` at V8's maximum string
 * length, losing the run. Feeding the hash member by member bounds the largest
 * string the process holds at one member, whatever the corpus size.
 *
 * A member is fed as its UTF-8 byte length, a colon, then its bytes. That
 * encoding is injective: the byte stream can only be cut into members one way,
 * so no member content can make one member look like two and
 * `digest(["a\nb"])` differs from `digest(["a", "b"])`. A delimiter-only
 * encoding cannot say that, and the guard it needs instead can only fire once
 * the corpus has been walked and the CPU already spent.
 *
 * The digest is the leading 64 bits of SHA-256, rendered as 16 hex characters.
 * That width is short enough to quote in a report and wide enough that a
 * collision between two call graphs of this scale is not a practical concern.
 */

import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

/** Hex characters kept from the SHA-256 digest. 16 hex characters is 64 bits. */
const DIGEST_HEX_LENGTH = 16;

/**
 * Digest an already-ordered member list. Order is the caller's responsibility:
 * every fingerprint component sorts its members before hashing, so that two
 * runs that ingested the same corpus in different orders produce the same
 * digest whenever they produced the same set.
 *
 * The members are consumed as an iterable and never collected, so a caller may
 * hand over a generator and the process holds one member at a time.
 */
export function digest_members(members: Iterable<string>): string {
  const hash = createHash("sha256");
  for (const member of members) {
    hash.update(`${Buffer.byteLength(member, "utf8")}:`);
    hash.update(member);
  }
  return hash.digest("hex").slice(0, DIGEST_HEX_LENGTH);
}
