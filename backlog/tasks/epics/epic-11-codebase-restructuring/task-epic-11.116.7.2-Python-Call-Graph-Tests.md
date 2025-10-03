# Task epic-11.116.7.2: CREATE Python call_graph Integration Tests

**Status:** Not Started
**Parent:** task-epic-11.116.7
**Depends On:** 116.7.0
**Language:** Python
**Priority:** High
**Estimated Effort:** 2 hours

## Objective

CREATE NEW integration test file for Python call graph detection.

## New Test File

**Location:** `packages/core/src/trace_call_graph/detect_call_graph.python.test.ts`

## Test Coverage

- [ ] Function calls
- [ ] Method calls (self.method())
- [ ] @staticmethod calls
- [ ] @classmethod calls
- [ ] Decorator chains
- [ ] Generator functions
- [ ] Entry point detection (if __name__ == "__main__")

## Deliverables

- [ ] NEW test file created
- [ ] Python-specific call patterns tested
- [ ] All tests passing
