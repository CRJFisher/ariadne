# Task: Fix or Rewrite MCP Package Tests

**Status**: To Do
**Epic**: epic-11 - Codebase Restructuring (or separate MCP epic)
**Created**: 2025-10-08
**Priority**: High
**Estimated Effort**: 4-8 hours (depends on scope)

## Problem

All 12 tests in the `@ariadnejs/mcp` package are broken, leaving the MCP (Model Context Protocol) server completely untested. The tests fail because they reference the removed `Project` class.

### Failing Tests

**File**: `packages/mcp/tests/get_symbol_context.test.ts` (10 failures)
**File**: `packages/mcp/tests/get_file_metadata.test.ts` (1 failure)
**File**: `packages/mcp/tests/get_source_code.test.ts` (1 failure)

### Error Message
```
ReferenceError: Project is not defined
  at packages/mcp/tests/get_symbol_context.test.ts:9:5
  at packages/mcp/tests/get_file_metadata.test.ts:12:5
  at packages/mcp/tests/get_source_code.test.ts:12:5
```

### Root Cause

The `Project` class was removed in commit `31ed69b` (2025-09-25):
```
commit 31ed69b14abb312d966d4541172d9c42fc64e3fb
Date:   Thu Sep 25 23:00:46 2025 +0100

refactor: Remove deprecated modules and test infrastructure
- Deprecated project.ts module
```

**MCP tests were never updated** after this architectural change.

### Current Test Pattern (Broken)

```typescript
// packages/mcp/tests/get_symbol_context.test.ts
import { getSymbolContext } from "../src/tools/get_symbol_context";
import * as path from "path";
import * as fs from "fs/promises";

describe("get_symbol_context", () => {
  let project: Project;  // ❌ Type error - Project not defined

  beforeEach(() => {
    project = new Project();  // ❌ ReferenceError - Project is not defined
  });

  it("should find a function definition by name", async () => {
    const code = `...`;
    project.add_or_update_file("payment.ts", code);  // ❌ Cannot call

    const result = await getSymbolContext(project, {...});  // ❌ Invalid arg
    // ...
  });
});
```

## Impact

### Current State
- **@ariadnejs/mcp**: 7.7% tests passing (1/13 non-broken tests)
- **Test coverage**: Effectively ZERO for MCP tools
- **Confidence level**: Cannot verify MCP server works

### Consequences
- MCP server may be completely broken (we don't know)
- Cannot safely refactor MCP code
- Cannot validate MCP tool functionality
- No regression detection for MCP package

### Why This Is High Priority
1. **Package health**: MCP package has no test coverage
2. **Production risk**: MCP server may not work at all
3. **Quick fix potential**: Once we understand the architecture, fix is straightforward
4. **Blocking regression testing**: Cannot validate any changes to MCP

## Investigation Phase

### Questions to Answer

1. **What replaced `Project` class?**
   - Is there a new API for managing code in the system?
   - What's the entry point for semantic analysis now?

2. **Do MCP tools still work?**
   - Manual testing needed
   - Check if MCP server can actually analyze code

3. **What's the correct test architecture?**
   - How should tests initialize the system?
   - What dependencies do MCP tools have?

4. **Are these tests still relevant?**
   - Do the test scenarios match current MCP functionality?
   - Should we rewrite from scratch or update?

### Investigation Steps

#### Step 1: Understand Current Architecture (60 min)

**Check what exports exist now:**
```bash
# Find current public API
cat packages/core/src/index.ts

# Check if there's a Project replacement
grep -r "export.*class" packages/core/src/ --include="*.ts" | grep -v test

# Look for entry point functions
grep -r "export function" packages/core/src/index.ts
```

**Read architecture docs:**
- Review any docs about the Project removal
- Check if there's migration guidance
- Understand the new API design

#### Step 2: Check MCP Tool Implementation (30 min)

**Review MCP tool source:**
```typescript
// packages/mcp/src/tools/get_symbol_context.ts
// How does it currently work?
// What dependencies does it have?
```

**Questions:**
- Do MCP tools import anything from `@ariadnejs/core`?
- What's the actual function signature of `getSymbolContext`?
- Does it still expect a `Project` argument?

#### Step 3: Manual Testing (30 min)

**Try running MCP server:**
```bash
cd packages/mcp
npm run start
# Does it start? Does it work?
```

**Test MCP tool manually:**
- Use MCP client to call `get_symbol_context`
- Does it return valid results?
- Or does it error immediately?

#### Step 4: Review Test Requirements (30 min)

**Determine what tests should verify:**
- Symbol resolution works
- File metadata extraction works
- Source code retrieval works
- Error handling works

**Assess current test quality:**
- Are test scenarios realistic?
- Do they cover important use cases?
- Or are they outdated?

## Solution Options

### Option A: Update Tests to New API ✅ (Recommended if API exists)

**Effort**: 3-4 hours
**When to choose**: If there's a clear Project replacement

**Steps**:
1. Identify the new API entry point
2. Update test initialization code
3. Fix function calls to match new signatures
4. Verify all tests pass

**Example fix:**
```typescript
// OLD (broken):
import { getSymbolContext } from "../src/tools/get_symbol_context";

describe("get_symbol_context", () => {
  let project: Project;
  beforeEach(() => {
    project = new Project();
  });

  it("test", async () => {
    project.add_or_update_file("file.ts", code);
    const result = await getSymbolContext(project, {...});
  });
});

// NEW (fixed):
import { getSymbolContext } from "../src/tools/get_symbol_context";
import { create_semantic_index } from "@ariadnejs/core";

describe("get_symbol_context", () => {
  it("test", async () => {
    const index = create_semantic_index("file.ts", code);
    const result = await getSymbolContext(index, {...});
  });
});
```

### Option B: Rewrite Tests from Scratch 🔄 (If architecture changed significantly)

**Effort**: 6-8 hours
**When to choose**: If old tests are obsolete or API is fundamentally different

**Steps**:
1. Delete old test files
2. Understand current MCP tool functionality
3. Write new integration tests
4. Focus on realistic use cases
5. Ensure good coverage

**New test structure:**
```typescript
// packages/mcp/tests/mcp_tools.test.ts
import { get_symbol_context, get_file_metadata } from "../src/tools";

describe("MCP Tools Integration", () => {
  describe("get_symbol_context", () => {
    it("should resolve function definitions", async () => {
      // Test with realistic code sample
      const code = `export function myFunc() { ... }`;
      const result = await get_symbol_context({
        symbol: "myFunc",
        code: code,
        file_path: "test.ts"
      });

      expect(result.symbol.kind).toBe("function");
      expect(result.definition).toBeDefined();
    });

    // More tests...
  });
});
```

### Option C: Mark as Obsolete and Delete ⚠️ (If MCP is deprecated)

**Effort**: 30 minutes
**When to choose**: If MCP package is no longer maintained

**Steps**:
1. Verify MCP is not used
2. Mark tests as skipped with explanation
3. Or delete test files entirely
4. Document decision in task notes

**Not recommended unless confirmed that MCP is dead.**

## Recommended Implementation Plan

### Phase 1: Investigation (2 hours)
- [ ] Understand current architecture (what replaced Project?)
- [ ] Review MCP tool implementation
- [ ] Manual test MCP server
- [ ] Determine which solution option to pursue

### Phase 2: Implementation (2-6 hours, depends on option)

**If Option A (Update tests):**
- [ ] Update test imports
- [ ] Fix test initialization code
- [ ] Update function calls
- [ ] Verify all 12 tests pass

**If Option B (Rewrite tests):**
- [ ] Delete old test files
- [ ] Create new test structure
- [ ] Write integration tests
- [ ] Achieve good coverage

**If Option C (Delete):**
- [ ] Confirm MCP is obsolete
- [ ] Delete or skip tests
- [ ] Document decision

### Phase 3: Validation (30 min)
- [ ] All MCP tests pass (or are explicitly skipped)
- [ ] MCP server verified to work
- [ ] Test coverage documented
- [ ] CI/CD updated if needed

## Files Involved

### Test Files (Broken)
- `packages/mcp/tests/get_symbol_context.test.ts` - 10 failures
- `packages/mcp/tests/get_file_metadata.test.ts` - 1 failure
- `packages/mcp/tests/get_source_code.test.ts` - 1 failure

### MCP Tool Implementation
- `packages/mcp/src/tools/get_symbol_context.ts`
- `packages/mcp/src/tools/get_file_metadata.ts`
- `packages/mcp/src/tools/get_source_code.ts`
- `packages/mcp/src/server.ts`

### Core API (To Investigate)
- `packages/core/src/index.ts` - Public API exports
- Look for Project replacement or equivalent

## Acceptance Criteria

### Must Have
- [ ] Investigation phase complete with clear decision on solution option
- [ ] All MCP test failures resolved (tests pass, skipped, or deleted)
- [ ] MCP server verified to work (manual testing)
- [ ] Test coverage documented

### Should Have
- [ ] Tests cover realistic MCP use cases
- [ ] Tests are maintainable (won't break again)
- [ ] Tests run in CI/CD
- [ ] Good test documentation

### Nice to Have
- [ ] Additional test coverage for edge cases
- [ ] Performance benchmarks for MCP tools
- [ ] Integration tests with actual MCP client

## Success Metrics

**Before**:
- @ariadnejs/mcp: 1/13 tests passing (12 broken)
- Test coverage: ~0%
- Confidence: Cannot verify MCP works

**After**:
- @ariadnejs/mcp: All tests passing or explicitly skipped
- Test coverage: >80% for MCP tools
- Confidence: High - MCP functionality verified

## Priority Justification

**High Priority** because:
- **Package health critical**: MCP has 0% effective test coverage
- **Production risk**: Cannot verify MCP server works
- **Blocking other work**: Cannot safely change MCP code
- **Quick potential fix**: Once architecture is understood, fix may be fast

**Why not Critical**:
- MCP may still work despite broken tests
- Not blocking core functionality
- May be able to defer if MCP usage is low

## Risks and Mitigation

### Risk 1: Architecture Changed Drastically
**Mitigation**: Start with investigation phase, don't commit to solution until we understand the problem

### Risk 2: MCP Tools Don't Actually Work
**Mitigation**: Manual test MCP server first, identify if tool implementation also needs fixes

### Risk 3: Tests Are Too Outdated to Save
**Mitigation**: Be willing to rewrite from scratch (Option B) if updating is too painful

### Risk 4: Time Sink (Investigation takes too long)
**Mitigation**: Time-box investigation to 2 hours, escalate if unclear

## Related Tasks

- **task-31ed69b**: Commit that removed Project class
- **epic-11**: Part of broader codebase restructuring effort

## Estimated Effort

**Investigation**: 2 hours
**Implementation**:
- Option A (update): 3-4 hours
- Option B (rewrite): 6-8 hours
- Option C (delete): 30 minutes

**Total**: 4-10 hours (depends on findings and chosen option)

## Notes

- **Start with investigation** - don't assume solution
- **Manual test MCP first** - verify tools actually work
- **Be pragmatic** - if tests are too broken, rewrite them
- **Document decision** - explain why we chose our approach
- **Consider MCP usage** - if nobody uses MCP, consider deprecating instead of fixing

## Next Steps

1. **Read this task thoroughly**
2. **Start investigation phase** (2 hour time box)
3. **Document findings** in task notes
4. **Choose solution option** based on findings
5. **Implement chosen solution**
6. **Verify MCP server works**
