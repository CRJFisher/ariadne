/**
 * Digests for fingerprint components, computed one member at a time.
 *
 * A fingerprint component is a sorted list of member strings and its hash must
 * never be taken by concatenating that list: a full-corpus arm over roughly two
 * million call edges died inside `Array.prototype.join` at V8's maximum string
 * length, losing the run. Feeding the hash member by member bounds the largest
 * string the process holds at one member, whatever the corpus size.
 *
 * The digest is the leading 64 bits of SHA-256, rendered as 16 hex characters.
 * That width is short enough to quote in a task acceptance criterion and wide
 * enough that a collision between two call graphs of this scale is not a
 * practical concern.
 */

import { createHash } from "crypto";

/** Hex characters kept from the SHA-256 digest. 16 hex characters is 64 bits. */
const DIGEST_HEX_LENGTH = 16;

interface StreamingDigest {
  /**
   * Fold one member into the digest. The member is terminated with a newline
   * so that `["ab", "c"]` and `["a", "bc"]` do not collide; members are symbol
   * ids, location keys and relative file paths, none of which contain one.
   */
  update(member: string): void;
  /** The finished digest. Calling `update` afterwards throws. */
  digest(): string;
}

function open_streaming_digest(): StreamingDigest {
  const hash = createHash("sha256");
  let finished = false;

  return {
    update(member: string): void {
      if (member.includes("\n")) {
        throw new Error(
          `A fingerprint member may not contain a newline: ${JSON.stringify(member.slice(0, 60))}. ` +
            "Members are newline-delimited into the digest, so such a member collides with the two members it looks like — digest([\"a\\nb\"]) and digest([\"a\", \"b\"]) are the same value.",
        );
      }
      if (finished) {
        throw new Error(
          "Streaming digest already finished — open a new digest rather than extending a published fingerprint component",
        );
      }
      hash.update(member);
      hash.update("\n");
    },
    digest(): string {
      finished = true;
      return hash.digest("hex").slice(0, DIGEST_HEX_LENGTH);
    },
  };
}

/**
 * Digest an already-ordered member list. Order is the caller's responsibility:
 * every fingerprint component sorts its members before hashing, so that two
 * runs that ingested the same corpus in different orders produce the same
 * digest whenever they produced the same set.
 */
export function digest_members(members: Iterable<string>): string {
  const digest = open_streaming_digest();
  for (const member of members) {
    digest.update(member);
  }
  return digest.digest();
}
