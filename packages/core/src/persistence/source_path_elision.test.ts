import { describe, it, expect } from "vitest";
import type { Location, ScopeId, SymbolName, SymbolReference } from "@ariadnejs/types";
import { elide_source_path, restore_source_path } from "./source_path_elision";

const SOURCE_PATH = "/repo/src/a.ts";

function location(file_path: string, line: number): Location {
  return {
    file_path,
    start_line: line,
    start_column: 0,
    end_line: line,
    end_column: 8,
  } as Location;
}

function method_call(): SymbolReference {
  return {
    kind: "method_call",
    name: "greet" as SymbolName,
    location: location(SOURCE_PATH, 4),
    receiver_location: location(SOURCE_PATH, 4),
    scope_id: `method:${SOURCE_PATH}:3:2:6:3` as ScopeId,
    property_chain: ["greeter", "greet"] as SymbolName[],
    is_optional_chain: false,
  };
}

describe("source_path_elision", () => {
  it("removes the path from every location and from the scope id", () => {
    const [elided] = elide_source_path([method_call()], SOURCE_PATH);

    expect(elided.location).toEqual({
      start_line: 4,
      start_column: 0,
      end_line: 4,
      end_column: 8,
    });
    expect(elided.receiver_location).toEqual({
      start_line: 4,
      start_column: 0,
      end_line: 4,
      end_column: 8,
    });
    expect(elided.scope_id).toEqual("method::3:2:6:3");
  });

  it("restores exactly what was elided", () => {
    const original = method_call();
    const [restored] = restore_source_path(
      elide_source_path([original], SOURCE_PATH),
      SOURCE_PATH,
    );
    expect(restored).toEqual(original);
  });

  // A reference can name a location in another file, and that path is not the
  // one the blob header carries, so eliding it would lose it.
  it("keeps a location that names a different file", () => {
    const reference = {
      ...method_call(),
      receiver_location: location("/repo/src/b.ts", 9),
    };
    const [elided] = elide_source_path([reference], SOURCE_PATH);
    expect(elided.receiver_location).toEqual(location("/repo/src/b.ts", 9));

    const [restored] = restore_source_path([elided], SOURCE_PATH);
    expect(restored).toEqual(reference);
  });

  it("keeps a scope id that names a different file", () => {
    const reference = {
      ...method_call(),
      scope_id: "method:/repo/src/b.ts:3:2:6:3" as ScopeId,
    };
    const [elided] = elide_source_path([reference], SOURCE_PATH);
    expect(elided.scope_id).toEqual("method:/repo/src/b.ts:3:2:6:3");

    const [restored] = restore_source_path([elided], SOURCE_PATH);
    expect(restored).toEqual(reference);
  });

  it("leaves an absent optional location absent", () => {
    const [elided] = elide_source_path([method_call()], SOURCE_PATH);
    expect("construct_target" in elided).toEqual(false);

    const [restored] = restore_source_path([elided], SOURCE_PATH);
    expect("construct_target" in restored).toEqual(false);
  });
});
