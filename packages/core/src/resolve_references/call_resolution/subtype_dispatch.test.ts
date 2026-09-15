import { describe, it, expect } from "vitest";
import type { FilePath, SymbolId } from "@ariadnejs/types";
import { record_subtype_dispatch, type SubtypeDispatchFiles } from "./subtype_dispatch";

const SHAPE = "interface:shape.ts:1:17:1:21:Shape" as SymbolId;
const WIDGET = "class:widget.ts:1:13:1:18:Widget" as SymbolId;
const FILE_A = "a.ts" as FilePath;
const FILE_B = "b.ts" as FilePath;

describe("record_subtype_dispatch", () => {
  it("gathers every file under the type its lookup dispatched through, once each", () => {
    const dispatches: SubtypeDispatchFiles = new Map();

    record_subtype_dispatch(dispatches, SHAPE, FILE_A);
    record_subtype_dispatch(dispatches, SHAPE, FILE_B);
    record_subtype_dispatch(dispatches, SHAPE, FILE_A);
    record_subtype_dispatch(dispatches, WIDGET, FILE_B);

    expect(dispatches).toEqual(
      new Map([
        [SHAPE, new Set([FILE_A, FILE_B])],
        [WIDGET, new Set([FILE_B])],
      ])
    );
  });
});
