---
"@ariadnejs/types": major
---

Remove the pre-1.0 call-graph model and the helpers nothing in the pipeline uses.

No API of `@ariadnejs/core` accepts or returns any of these, so a consumer is
affected only if it imported one of the names directly. Delete the import; the
replacement, where there is one, is named.

- **Call-graph model:** `CodeGraph`, `CodeGraphMetadata`, `CodeGraphOptions`,
  `FileAnalysis`, `ClassHierarchy`, `ClassNode`, `MethodNode`, `PropertyNode`,
  `InheritanceEdge`, `VariableDeclaration`. The call graph a caller reads is
  `Project.get_call_graph()`, typed by `CallGraph` and its nodes.
- **Call records:** `CallInfo`, `FunctionCall`, `MethodCall`, `ConstructorCall`,
  `CallType`, `CallerContext`, `ModuleContext`, `MODULE_CONTEXT`. Calls are the
  `SymbolReference` variants on a `SemanticIndex`, each resolved or recorded as a
  `ResolutionFailure`.
- **Type-member shapes:** `TypeKind`, `ResolvedTypeKind`, `TypeMemberInfo`,
  `LocalMemberInfo`, `LocalParameterInfo`. A type's members are read from the
  registries that own them.
- **Errors:** `AnalysisError` and `AnalysisPhase`. Error reporting flows through
  `Result` (`ok`, `err`, `is_ok`, `is_err`) and the resolution-failure types.
- **Resolution helpers:** `resolve_high`, `resolve_medium`, `resolve_low`,
  `resolve_failed` and `QueryResolutionReason`. A resolution is a `Resolution`
  carrying a `ResolutionConfidence` and a `ResolutionReason`.
- **Identifier helpers and aliases:** `ReferenceId`, `reference_id`,
  `named_module_symbol`, `ReceiverName`, `TypeString`, `SourceCode`,
  `create_readonly_array` and `create_readonly_map`.
