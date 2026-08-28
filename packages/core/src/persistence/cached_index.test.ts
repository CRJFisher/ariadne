import { describe, it, expect } from "vitest";
import type { FilePath } from "@ariadnejs/types";
import type { ContentHash } from "./content_hash";
import type { CachedIndex } from "./cached_index";
import {
  CURRENT_SCHEMA_VERSION,
  serialize_cached_index,
  deserialize_cached_index,
} from "./cached_index";
import { INDEXER_VERSION } from "./indexer_version";
import { parse_file } from "../project/parse_file";
import { build_index_single_file } from "../index_single_file/index_single_file";

const file = "/src/a.ts" as FilePath;

const SOURCE = `
export class Greeter {
  private greeting = "hi";
  greet(name: string) {
    return this.format(name);
  }
  format(name: string) {
    return \`\${this.greeting} \${name}\`;
  }
}
export function make(name: string) {
  const greeter = new Greeter();
  return greeter.greet(name);
}
`;

function build(source_path: FilePath, content: string) {
  const parsed = parse_file(source_path, content, 1024 * 1024);
  return build_index_single_file(parsed, parsed.tree, parsed.lang);
}

function cached(overrides: Partial<CachedIndex> = {}): CachedIndex {
  return {
    schema_version: CURRENT_SCHEMA_VERSION,
    indexer_version: INDEXER_VERSION,
    source_path: file,
    content_hash: "abc123" as ContentHash,
    git_blob_hash: "0".repeat(40),
    index: build(file, SOURCE),
    ...overrides,
  };
}

describe("cached_index", () => {
  it("round-trips the stamp and the index it validates", () => {
    const restored = deserialize_cached_index(
      serialize_cached_index(cached()),
      file,
    );
    expect(restored?.schema_version).toEqual(CURRENT_SCHEMA_VERSION);
    expect(restored?.indexer_version).toEqual(INDEXER_VERSION);
    expect(restored?.source_path).toEqual(file);
    expect(restored?.content_hash).toEqual("abc123");
    expect(restored?.git_blob_hash).toEqual("0".repeat(40));
    expect(restored?.index.file_path).toEqual(file);
  });

  // The blob keeps one copy of the source path, so a restored reference record
  // is only equal to the one that was written if putting it back is exact.
  it("restores every reference record unchanged", () => {
    const index = build(file, SOURCE);
    const restored = deserialize_cached_index(
      serialize_cached_index(cached({ index })),
      file,
    );
    expect([...(restored?.index.references ?? [])]).toEqual([
      ...index.references,
    ]);
    expect(restored?.index.scopes).toEqual(index.scopes);
    expect(restored?.index.functions).toEqual(index.functions);
    expect(restored?.index.classes).toEqual(index.classes);
  });

  // The blob header holds the path; the records that repeat it hold none.
  it("names the source path nowhere in the stored reference records", () => {
    const index = build(file, SOURCE);
    const blob = serialize_cached_index(cached({ index }));
    const stored_references = JSON.stringify(JSON.parse(blob).index.references);

    expect(index.references.length).toBeGreaterThan(10);
    expect(stored_references.split(file).length - 1).toEqual(0);
    expect(JSON.parse(blob).source_path).toEqual(file);
  });

  it("round-trips an entry with no git blob hash", () => {
    const restored = deserialize_cached_index(
      serialize_cached_index(cached({ git_blob_hash: undefined })),
      file,
    );
    expect(restored?.git_blob_hash).toEqual(undefined);
  });

  // Every rejection below is a cache miss: the file is re-indexed, never served
  // from a blob whose stamp does not vouch for it.
  it("rejects a blob written by a different schema version", () => {
    const json = serialize_cached_index(
      cached({ schema_version: CURRENT_SCHEMA_VERSION - 1 }),
    );
    expect(deserialize_cached_index(json, file)).toEqual(null);
  });

  // The two axes are independent: a format this build can read still holds an
  // index a different build of the indexer produced.
  it("rejects a blob written by a different indexer version", () => {
    const json = serialize_cached_index(
      cached({ indexer_version: `${INDEXER_VERSION}-other` }),
    );
    expect(deserialize_cached_index(json, file)).toEqual(null);
  });

  it("rejects a bare index carrying no stamp at all", () => {
    const json = JSON.stringify({ file_path: file, language: "typescript" });
    expect(deserialize_cached_index(json, file)).toEqual(null);
  });

  // Cache filenames are hashes of the source path, so the stored path is the
  // only thing that proves the reader opened the blob it asked for.
  it("rejects a blob describing a different source file", () => {
    const json = serialize_cached_index(cached());
    expect(deserialize_cached_index(json, "/src/b.ts" as FilePath)).toEqual(
      null,
    );
  });

  it("rejects truncated JSON", () => {
    const json = serialize_cached_index(cached());
    expect(deserialize_cached_index(json.slice(0, 40), file)).toEqual(null);
  });

  it("rejects a blob whose index is not index-shaped", () => {
    const json = JSON.stringify({
      schema_version: CURRENT_SCHEMA_VERSION,
      indexer_version: INDEXER_VERSION,
      source_path: file,
      content_hash: "abc123",
      index: { file_path: file },
    });
    expect(deserialize_cached_index(json, file)).toEqual(null);
  });

  // The shape gate checks that the collections are arrays, not what is in them,
  // so a payload that passes it can still make deserialization throw.
  it("rejects an index-shaped blob whose collections hold junk", () => {
    const json = JSON.stringify({
      schema_version: CURRENT_SCHEMA_VERSION,
      indexer_version: INDEXER_VERSION,
      source_path: file,
      content_hash: "abc123",
      index: {
        file_path: file,
        language: "typescript",
        root_scope_id: "global:/src/a.ts:0:0:0:0",
        scopes: [1, 2, 3],
        functions: [],
        classes: [],
        variables: [],
        interfaces: [],
        enums: [],
        namespaces: [],
        types: [],
        imported_symbols: [],
        references: [],
      },
    });
    expect(deserialize_cached_index(json, file)).toEqual(null);
  });
});
