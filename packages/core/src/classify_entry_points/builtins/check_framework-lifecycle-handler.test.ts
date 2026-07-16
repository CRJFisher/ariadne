import { describe, it, expect } from "vitest";

import type { EnrichedEntryPoint, FilePath } from "@ariadnejs/types";
import { check_framework_lifecycle_handler } from "./check_framework-lifecycle-handler";

const EMPTY_READER = (_: string) => [] as readonly string[];

function make_entry(overrides: {
  name?: string;
  file_path?: FilePath;
  start_line?: number;
  kind?: EnrichedEntryPoint["kind"];
} = {}): EnrichedEntryPoint {
  return {
    name: overrides.name ?? "handler",
    file_path: overrides.file_path ?? ("/repo/src/commands/UserCommand.ts" as FilePath),
    start_line: overrides.start_line ?? 10,
    kind: overrides.kind ?? "method",
    tree_size: 0,
    is_exported: false,
    definition_features: {
      definition_is_object_literal_method: false,
      accessor_kind: null,
    },
    diagnostics: {
      grep_call_sites: [],
      grep_call_sites_unindexed_tests: [],
      ariadne_call_refs: [],
      diagnosis: "no-textual-callers",
      has_uncaptured_indexed_grep_hit: false,
      callers_only_in_unindexed_tests: false,
    },
  };
}

// A reader whose `start_line` (1-based) definition is preceded by `decorators`.
function reader_with_decorators(start_line: number, decorators: string[]): (path: string) => readonly string[] {
  const lines: string[] = [];
  for (let i = 0; i < start_line - 1 - decorators.length; i++) lines.push("");
  for (const d of decorators) lines.push(d);
  lines.push("methodBody() {");
  return (_: string) => lines;
}

describe("check_framework_lifecycle_handler", () => {
  it("matches a yargs CommandModule handler method under commands/<Name>Command.ts", () => {
    const entry = make_entry({ name: "handler", file_path: "/repo/src/commands/UserCommand.ts" as FilePath });
    expect(check_framework_lifecycle_handler(entry, EMPTY_READER, "typescript")).toBe(true);
  });

  it("matches the Angular ngOnInit lifecycle hook by name", () => {
    const entry = make_entry({ name: "ngOnInit", file_path: "/repo/src/form_group.directive.ts" as FilePath });
    expect(check_framework_lifecycle_handler(entry, EMPTY_READER, "typescript")).toBe(true);
  });

  it("matches the Angular ngOnDestroy lifecycle hook by name", () => {
    const entry = make_entry({ name: "ngOnDestroy", file_path: "/repo/src/form_group.directive.ts" as FilePath });
    expect(check_framework_lifecycle_handler(entry, EMPTY_READER, "typescript")).toBe(true);
  });

  it("matches a TypeORM @BeforeInsert entity listener via its decorator regardless of method name", () => {
    const entry = make_entry({ name: "setCreatedAt", file_path: "/repo/entity/user-month.ts" as FilePath, start_line: 33 });
    const reader = reader_with_decorators(33, ["  @BeforeInsert()"]);
    expect(check_framework_lifecycle_handler(entry, reader, "typescript")).toBe(true);
  });

  it("matches a TypeORM @AfterLoad listener stacked below an unrelated decorator", () => {
    const entry = make_entry({ name: "computeName", file_path: "/repo/entity/user.ts" as FilePath, start_line: 20 });
    const reader = reader_with_decorators(20, ["  @Index()", "  @AfterLoad()"]);
    expect(check_framework_lifecycle_handler(entry, reader, "typescript")).toBe(true);
  });

  it("does not match an ordinary uncalled method whose name is not a lifecycle hook and carries no lifecycle decorator", () => {
    const entry = make_entry({ name: "computeTotals", file_path: "/repo/src/billing/invoice.ts" as FilePath, start_line: 20 });
    const reader = reader_with_decorators(20, []);
    expect(check_framework_lifecycle_handler(entry, reader, "typescript")).toBe(false);
  });

  // A NestJS request handler is a distinct routing-dispatch limitation owned by
  // `framework-lifecycle-dispatch`; this predicate must not stretch to suppress it.
  it("does not match a NestJS @Get route handler (owned by framework-lifecycle-dispatch)", () => {
    const entry = make_entry({ name: "overrideV2", file_path: "/repo/src/app.controller.ts" as FilePath, start_line: 15 });
    const reader = reader_with_decorators(15, ["  @Version('2')", "  @Get('/override')"]);
    expect(check_framework_lifecycle_handler(entry, reader, "typescript")).toBe(false);
  });

  it("does not match a NestJS @Query GraphQL resolver (distinct pattern, not a lifecycle hook)", () => {
    const entry = make_entry({ name: "getCats", file_path: "/repo/src/cats.resolver.ts" as FilePath, start_line: 15 });
    const reader = reader_with_decorators(15, ["  @Query()", "  @UseGuards(CatsGuard)"]);
    expect(check_framework_lifecycle_handler(entry, reader, "typescript")).toBe(false);
  });

  it("does not match a method named handler outside a commands/<Name>Command.ts file", () => {
    const entry = make_entry({ name: "handler", file_path: "/repo/src/util/handler.ts" as FilePath });
    expect(check_framework_lifecycle_handler(entry, EMPTY_READER, "typescript")).toBe(false);
  });

  it("does not match an Angular lifecycle hook name on a non-typescript entry", () => {
    const entry = make_entry({ name: "ngOnInit", file_path: "/repo/src/form_group.directive.ts" as FilePath });
    expect(check_framework_lifecycle_handler(entry, EMPTY_READER, "python")).toBe(false);
  });
});
