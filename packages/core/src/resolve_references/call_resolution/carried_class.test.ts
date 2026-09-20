/**
 * The index of classes call sites carry into a callable's parameters: what it
 * answers, what it refuses to answer, and how a file's sites leave it.
 */

import { describe, it, expect } from "vitest";
import type { FilePath, SymbolId } from "@ariadnejs/types";
import {
  callees_with_changed_carriers,
  carried_class,
  holds_any_file,
  record_class_argument,
  replace_files_in_class_arguments,
  without_files_in_class_arguments,
  type ClassArgumentsByCallee,
  type GatheredClassArguments,
} from "./carried_class";

const CALLER = "caller.py" as FilePath;
const OTHER = "other.py" as FilePath;
const BUILD = "function:lib.py:1:1:3:1:build" as SymbolId;
const MAKE = "function:lib.py:5:1:7:1:make" as SymbolId;
const DRAFT = "class:lib.py:9:1:10:1:Draft" as SymbolId;
const FINAL = "class:lib.py:12:1:13:1:Final" as SymbolId;

function gathered(
  ...sites: readonly [SymbolId, FilePath, number, SymbolId][]
): GatheredClassArguments {
  const index: GatheredClassArguments = new Map();
  for (const [callee_id, file_id, position, class_id] of sites) {
    record_class_argument(index, callee_id, { file_id, position, class_id });
  }
  return index;
}

describe("carried_class", () => {
  it("answers the class every site at one position names", () => {
    const index = gathered([BUILD, CALLER, 0, DRAFT], [BUILD, OTHER, 0, DRAFT]);

    expect(carried_class(index, BUILD, 0)).toBe(DRAFT);
  });

  it("answers nothing for a position two sites name different classes at", () => {
    const index = gathered([BUILD, CALLER, 0, DRAFT], [BUILD, OTHER, 0, FINAL]);

    expect(carried_class(index, BUILD, 0)).toBe(null);
  });

  it("keeps each position's answer apart", () => {
    const index = gathered([BUILD, CALLER, 0, DRAFT], [BUILD, CALLER, 1, FINAL]);

    expect({ first: carried_class(index, BUILD, 0), second: carried_class(index, BUILD, 1) }).toEqual({
      first: DRAFT,
      second: FINAL,
    });
  });

  it("answers nothing for a callee no site names and for a position none fills", () => {
    const index = gathered([BUILD, CALLER, 0, DRAFT]);

    expect({ absent: carried_class(index, MAKE, 0), unfilled: carried_class(index, BUILD, 1) }).toEqual({
      absent: null,
      unfilled: null,
    });
  });
});

describe("eviction", () => {
  it("drops the sites one file wrote and keeps the rest", () => {
    const index = gathered([BUILD, CALLER, 0, DRAFT], [BUILD, OTHER, 0, FINAL]);

    const kept = without_files_in_class_arguments(index, new Set([OTHER]));

    expect(carried_class(kept, BUILD, 0)).toBe(DRAFT);
  });

  it("drops a callee whose every site left with its file", () => {
    const index = gathered([BUILD, CALLER, 0, DRAFT]);

    expect([...without_files_in_class_arguments(index, new Set([CALLER])).keys()]).toEqual([]);
  });

  it("reports whether a file wrote any site", () => {
    const index = gathered([BUILD, CALLER, 0, DRAFT]);

    expect({
      written: holds_any_file(index, new Set([CALLER])),
      untouched: holds_any_file(index, new Set([OTHER])),
    }).toEqual({ written: true, untouched: false });
  });
});

describe("replace_files_in_class_arguments", () => {
  it("replaces what a re-resolved file contributed rather than merging it", () => {
    const held: ClassArgumentsByCallee = gathered([BUILD, CALLER, 0, DRAFT]);
    const answered: ClassArgumentsByCallee = gathered([BUILD, CALLER, 0, FINAL]);

    const merged = replace_files_in_class_arguments(held, answered, new Set([CALLER]));

    expect(carried_class(merged, BUILD, 0)).toBe(FINAL);
  });

  it("keeps the sites of files the pass did not answer for", () => {
    const held: ClassArgumentsByCallee = gathered([BUILD, OTHER, 0, DRAFT]);
    const answered: ClassArgumentsByCallee = gathered([MAKE, CALLER, 0, FINAL]);

    const merged = replace_files_in_class_arguments(held, answered, new Set([CALLER]));

    expect({ build: carried_class(merged, BUILD, 0), make: carried_class(merged, MAKE, 0) }).toEqual({
      build: DRAFT,
      make: FINAL,
    });
  });

  it("shares the held index when neither side moves", () => {
    const held: ClassArgumentsByCallee = gathered([BUILD, OTHER, 0, DRAFT]);

    expect(replace_files_in_class_arguments(held, new Map(), new Set([CALLER]))).toBe(held);
  });
});

describe("callees_with_changed_carriers", () => {
  it("names a callee whose carried class changed", () => {
    const before = gathered([BUILD, CALLER, 0, DRAFT]);
    const after = gathered([BUILD, CALLER, 0, FINAL]);

    expect([...callees_with_changed_carriers(before, after)]).toEqual([BUILD]);
  });

  it("names a callee that gained its first site and one that lost its last", () => {
    const before = gathered([BUILD, CALLER, 0, DRAFT]);
    const after = gathered([MAKE, CALLER, 0, DRAFT]);

    expect([...callees_with_changed_carriers(before, after)].sort()).toEqual([BUILD, MAKE].sort());
  });

  it("names no callee when the same class arrives from a different file", () => {
    const before = gathered([BUILD, CALLER, 0, DRAFT]);
    const after = gathered([BUILD, OTHER, 0, DRAFT]);

    expect([...callees_with_changed_carriers(before, after)]).toEqual([]);
  });
});
