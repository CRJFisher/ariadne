import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { MemberSymbol } from "@ariadnejs/skill-protocol";

import {
  JsonMembershipOverrideStore,
  audit_overrides,
  member_identity_token,
  override_key,
  type MembershipExclusion,
  type MembershipOverride,
  type OverrideAudit,
} from "./membership_override.js";

let plan_dir: string;
let saved_override: string | undefined;

beforeEach(async () => {
  saved_override = process.env.ARIADNE_PLAN_DIR_OVERRIDE;
  plan_dir = await fs.mkdtemp(path.join(os.tmpdir(), "plan-override-"));
  process.env.ARIADNE_PLAN_DIR_OVERRIDE = plan_dir;
});

afterEach(async () => {
  if (saved_override === undefined) delete process.env.ARIADNE_PLAN_DIR_OVERRIDE;
  else process.env.ARIADNE_PLAN_DIR_OVERRIDE = saved_override;
  await fs.rm(plan_dir, { recursive: true, force: true });
});

const MEMBER: MemberSymbol = { file_path: "src/router.ts", name: "route", kind: "function", start_line: 12 };

function exclusion(overrides: Partial<MembershipExclusion> = {}): MembershipExclusion {
  return {
    fault_area: overrides.fault_area ?? "name_resolution",
    member: overrides.member ?? MEMBER,
    reason: overrides.reason ?? "actually an import miss",
    suggested_area: overrides.suggested_area ?? "import_resolution",
  };
}

describe("member_identity_token", () => {
  it("is stable over all four fields in MemberSymbol declaration order, newline-delimited", () => {
    expect(member_identity_token(MEMBER)).toEqual("src/router.ts\nroute\nfunction\n12");
  });

  it("distinguishes same-named members by file, kind, and start_line", () => {
    const base = member_identity_token(MEMBER);
    expect(member_identity_token({ ...MEMBER, start_line: 13 })).not.toEqual(base);
    expect(member_identity_token({ ...MEMBER, kind: "method" })).not.toEqual(base);
    expect(member_identity_token({ ...MEMBER, file_path: "src/other.ts" })).not.toEqual(base);
  });
});

describe("override_key", () => {
  it("composes the fault_area with the member identity token", () => {
    expect(override_key("name_resolution", MEMBER)).toEqual(`name_resolution\n${member_identity_token(MEMBER)}`);
  });

  it("keys the same member separately per fault_area", () => {
    expect(override_key("name_resolution", MEMBER)).not.toEqual(override_key("import_resolution", MEMBER));
  });
});

describe("JsonMembershipOverrideStore", () => {
  it("reads an empty list when the file does not exist", async () => {
    expect(await new JsonMembershipOverrideStore().read()).toEqual([]);
  });

  it("upserts new exclusions and round-trips them, stamping first/last sweep", async () => {
    const store = new JsonMembershipOverrideStore();
    await store.upsert_many([exclusion()], "sweep-1");

    const expected: MembershipOverride[] = [
      {
        fault_area: "name_resolution",
        member: MEMBER,
        reason: "actually an import miss",
        suggested_area: "import_resolution",
        first_excluded_in_sweep: "sweep-1",
        last_excluded_in_sweep: "sweep-1",
      },
    ];
    expect(await store.read()).toEqual(expected);
  });

  it("preserves first_excluded_in_sweep and refreshes the verdict on a later sweep", async () => {
    const store = new JsonMembershipOverrideStore();
    await store.upsert_many([exclusion({ reason: "first call", suggested_area: null })], "sweep-1");
    await store.upsert_many([exclusion({ reason: "now I can route it", suggested_area: "import_resolution" })], "sweep-2");

    const records = await store.read();
    expect(records).toHaveLength(1);
    expect(records[0]).toEqual({
      fault_area: "name_resolution",
      member: MEMBER,
      reason: "now I can route it",
      suggested_area: "import_resolution",
      first_excluded_in_sweep: "sweep-1",
      last_excluded_in_sweep: "sweep-2",
    });
  });

  it("keeps overrides for the same member under different fault_areas as distinct records", async () => {
    const store = new JsonMembershipOverrideStore();
    await store.upsert_many(
      [
        exclusion({ fault_area: "name_resolution" }),
        exclusion({ fault_area: "method_lookup", suggested_area: null }),
      ],
      "sweep-1",
    );
    const records = await store.read();
    expect(records.map((r) => r.fault_area).sort()).toEqual(["method_lookup", "name_resolution"]);
  });

  it("is a no-op when given no exclusions (writes no file)", async () => {
    const store = new JsonMembershipOverrideStore();
    await store.upsert_many([], "sweep-1");
    expect(await store.read()).toEqual([]);
  });
});

describe("audit_overrides", () => {
  function override(over: Partial<MembershipOverride>): MembershipOverride {
    return {
      fault_area: "name_resolution",
      member: MEMBER,
      reason: "actually an import miss",
      suggested_area: "import_resolution",
      first_excluded_in_sweep: "sweep-1",
      last_excluded_in_sweep: "sweep-1",
      ...over,
    };
  }

  it("flags an override recorded once and never re-confirmed", () => {
    const expected: OverrideAudit[] = [
      {
        fault_area: "name_resolution",
        member: MEMBER,
        reason: "actually an import miss",
        suggested_area: "import_resolution",
        first_excluded_in_sweep: "sweep-1",
        last_excluded_in_sweep: "sweep-1",
        never_re_confirmed: true,
      },
    ];
    expect(audit_overrides([override({})])).toEqual(expected);
  });

  it("does not flag an override re-confirmed in a later sweep", () => {
    const expected: OverrideAudit[] = [
      {
        fault_area: "name_resolution",
        member: MEMBER,
        reason: "actually an import miss",
        suggested_area: "import_resolution",
        first_excluded_in_sweep: "sweep-1",
        last_excluded_in_sweep: "sweep-4",
        never_re_confirmed: false,
      },
    ];
    expect(
      audit_overrides([override({ first_excluded_in_sweep: "sweep-1", last_excluded_in_sweep: "sweep-4" })]),
    ).toEqual(expected);
  });
});
