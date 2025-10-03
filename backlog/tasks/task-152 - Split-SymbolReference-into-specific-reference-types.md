---
id: task-152
title: Split SymbolReference into specific reference types
status: To Do
assignee: []
created_date: '2025-10-03 11:32'
labels: []
dependencies: []
priority: medium
---

## Description

Split SymbolReference (in packages/types/src/symbol_references.ts) into separate types for each reference kind (MethodCallReference, FunctionCallReference, VariableReference, etc.). This would allow making many optional fields required on specific types. For example, context.receiver_location should always be set for method calls, call_type should always be set for calls, etc. This will improve type safety and make it clearer what data is available for each reference type.
