---
id: task-epic-11.100.0.5.19.14.3
title: Integrate extract_symbols with existing analysis pipeline
status: To Do
assignee: []
created_date: '2025-01-13'
labels: ['integration', 'pipeline', 'workflow']
dependencies: ['task-epic-11.100.0.5.19.14.1']
parent_task_id: task-epic-11.100.0.5.19.14
priority: medium
---

## Description

Wire the new `extract_symbols` function into the existing file analysis pipeline and update consumers to use the new SymbolDefinition-based approach.

## Current State

The `extract_symbols` function exists but is not called by the main analysis workflow. It needs to be integrated with:
- `FileAnalysis` processing
- `GlobalSymbolTable` building
- `SymbolRegistry` construction
- Cross-file symbol resolution

## Integration Points

1. **File Analyzer**: Update `file_analyzer.ts` to call `extract_symbols`
2. **Symbol Registry**: Modify symbol registry building to use SymbolDefinition[]
3. **Global Symbol Table**: Update to consume SymbolDefinition objects
4. **Resolution Pipeline**: Ensure symbol resolution uses new extracted symbols

## Required Changes

- [ ] Update `analyze_file` function to call `extract_symbols`
- [ ] Modify `build_symbol_registry` to handle SymbolDefinition[]
- [ ] Update `build_symbol_table` integration
- [ ] Add SymbolDefinition -> SymbolRegistry mapping
- [ ] Update tests to verify integration
- [ ] Benchmark performance impact

## Migration Strategy

1. **Phase 1**: Add parallel extraction (both old and new)
2. **Phase 2**: Validate output equivalence
3. **Phase 3**: Switch to new approach
4. **Phase 4**: Remove old extraction code

## Success Criteria

- extract_symbols called during file analysis
- SymbolDefinition objects flow through pipeline correctly
- No functionality regression
- Performance maintained or improved