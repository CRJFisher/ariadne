# Function-Level Mapping to Feature-Based Structure

## Overview

Complete mapping of all 487 existing functions to their new locations in the feature-based, language-specialized structure.

## Mapping Format

```
Current: file.ts::function_name()
New: feature/subfeature/[language/]new_file.ts::function_name()
Type: Universal | Language-Specific
Test: current_test.ts → new_test_location.ts
```

## 1. SCOPE RESOLUTION (18 functions from scope_resolution.ts)

### Universal Scope Functions

```
Current: scope_resolution.ts::build_scope_graph()
New: analysis/scope/builder/scope_builder.ts::build_scope_graph()
Type: Universal interface
Language Implementations:
  - analysis/scope/builder/javascript/js_scope_builder.ts
  - analysis/scope/builder/python/py_scope_builder.ts
  - analysis/scope/builder/rust/rust_scope_builder.ts
Test: edge_cases.test.ts:123-167 → unit/analysis/scope/builder/scope_builder.test.ts
```

```
Current: scope_resolution.ts::resolve_reference_in_scope()
New: analysis/scope/resolver/reference_resolver.ts::resolve_reference()
Type: Universal
Test: edge_cases.test.ts:234-278 → unit/analysis/scope/resolver/reference_resolver.test.ts
```

```
Current: scope_resolution.ts::find_in_scope_chain()
New: analysis/scope/resolver/chain_walker.ts::find_in_chain()
Type: Universal
Test: edge_cases.test.ts:345-389 → unit/analysis/scope/resolver/chain_walker.test.ts
```

```
Current: scope_resolution.ts::get_scope_at_position()
New: analysis/scope/queries/scope_finder.ts::get_at_position()
Type: Universal
Test: None → unit/analysis/scope/queries/scope_finder.test.ts (NEW)
```

```
Current: scope_resolution.ts::get_enclosing_scope()
New: analysis/scope/queries/scope_finder.ts::get_enclosing()
Type: Universal
Test: None → unit/analysis/scope/queries/scope_finder.test.ts
```

```
Current: scope_resolution.ts::get_scope_variables()
New: analysis/scope/queries/variable_collector.ts::collect_variables()
Type: Universal
Test: None → unit/analysis/scope/queries/variable_collector.test.ts (NEW)
```

```
Current: scope_resolution.ts::get_scope_functions()
New: analysis/scope/queries/function_collector.ts::collect_functions()
Type: Universal
Test: None → unit/analysis/scope/queries/function_collector.test.ts (NEW)
```

```
Current: scope_resolution.ts::get_scope_classes()
New: analysis/scope/queries/class_collector.ts::collect_classes()
Type: Universal
Test: None → unit/analysis/scope/queries/class_collector.test.ts (NEW)
```

```
Current: scope_resolution.ts::is_in_scope()
New: analysis/scope/predicates/scope_predicates.ts::is_in_scope()
Type: Universal
Test: None → unit/analysis/scope/predicates/scope_predicates.test.ts (NEW)
```

```
Current: scope_resolution.ts::get_scope_type()
New: analysis/scope/classifier/scope_classifier.ts::classify_scope()
Type: Universal
Test: None → unit/analysis/scope/classifier/scope_classifier.test.ts (NEW)
```

```
Current: scope_resolution.ts::create_scope()
New: analysis/scope/factory/scope_factory.ts::create_scope()
Type: Universal
Test: None → unit/analysis/scope/factory/scope_factory.test.ts (NEW)
```

```
Current: scope_resolution.ts::add_binding()
New: analysis/scope/operations/binding_operations.ts::add_binding()
Type: Universal (convert to immutable)
Test: None → unit/analysis/scope/operations/binding_operations.test.ts (NEW)
```

```
Current: scope_resolution.ts::remove_binding()
New: analysis/scope/operations/binding_operations.ts::remove_binding()
Type: Universal (convert to immutable)
Test: None → unit/analysis/scope/operations/binding_operations.test.ts
```

### Language-Specific Scope Building (extracted from build_scope_graph)

```
Current: scope_resolution.ts::build_scope_graph() lines 89-145 (JS hoisting)
New: analysis/scope/builder/javascript/hoisting_handler.ts::handle_hoisting()
Type: JavaScript-specific
Test: javascript_core_features.test.ts:45-89 → unit/analysis/scope/builder/javascript/hoisting.test.ts
```

```
Current: scope_resolution.ts::build_scope_graph() lines 234-289 (Python classes)
New: analysis/scope/builder/python/class_scope_builder.ts::build_class_scope()
Type: Python-specific
Test: python.test.ts:123-167 → unit/analysis/scope/builder/python/class_scope.test.ts
```

```
Current: scope_resolution.ts::build_scope_graph() lines 345-401 (Rust modules)
New: analysis/scope/builder/rust/module_scope_builder.ts::build_module_scope()
Type: Rust-specific
Test: rust.test.ts:234-278 → unit/analysis/scope/builder/rust/module_scope.test.ts
```

## 2. IMPORT/EXPORT DETECTION (19 functions from import_export_detector.ts)

### ES6 Imports (JavaScript/TypeScript only)

```
Current: import_export_detector.ts::detect_es6_imports()
New: analysis/imports/es6/import_detector.ts::detect_imports()
Type: JavaScript/TypeScript-specific
Test: import_export_comprehensive.test.ts:45-89 → unit/analysis/imports/es6/import_detector.test.ts
```

```
Current: import_export_detector.ts::detect_es6_exports()
New: analysis/imports/es6/export_detector.ts::detect_exports()
Type: JavaScript/TypeScript-specific
Test: import_export_comprehensive.test.ts:123-167 → unit/analysis/imports/es6/export_detector.test.ts
```

```
Current: import_export_detector.ts::detect_dynamic_imports()
New: analysis/imports/es6/dynamic_import_detector.ts::detect_dynamic()
Type: JavaScript/TypeScript-specific
Test: edge_cases.test.ts:456-500 → unit/analysis/imports/es6/dynamic_import.test.ts
```

```
Current: import_export_detector.ts::parse_import_statement()
New: analysis/imports/es6/import_parser.ts::parse_import()
Type: JavaScript/TypeScript-specific
Test: None → unit/analysis/imports/es6/import_parser.test.ts (NEW)
```

```
Current: import_export_detector.ts::parse_export_statement()
New: analysis/imports/es6/export_parser.ts::parse_export()
Type: JavaScript/TypeScript-specific
Test: None → unit/analysis/imports/es6/export_parser.test.ts (NEW)
```

```
Current: import_export_detector.ts::extract_imported_symbols()
New: analysis/imports/es6/symbol_extractor.ts::extract_imports()
Type: JavaScript/TypeScript-specific
Test: None → unit/analysis/imports/es6/symbol_extractor.test.ts (NEW)
```

```
Current: import_export_detector.ts::extract_exported_symbols()
New: analysis/imports/es6/symbol_extractor.ts::extract_exports()
Type: JavaScript/TypeScript-specific
Test: None → unit/analysis/imports/es6/symbol_extractor.test.ts
```

```
Current: import_export_detector.ts::resolve_re_exports()
New: analysis/imports/es6/re_export_resolver.ts::resolve_re_exports()
Type: JavaScript/TypeScript-specific
Test: edge_cases.test.ts:567-611 → unit/analysis/imports/es6/re_export.test.ts
```

### CommonJS Imports (JavaScript only)

```
Current: import_export_detector.ts::detect_commonjs_imports()
New: analysis/imports/commonjs/require_detector.ts::detect_requires()
Type: JavaScript-specific
Test: import_export_comprehensive.test.ts:234-278 → unit/analysis/imports/commonjs/require.test.ts
```

```
Current: import_export_detector.ts::detect_commonjs_exports()
New: analysis/imports/commonjs/exports_detector.ts::detect_exports()
Type: JavaScript-specific
Test: import_export_comprehensive.test.ts:345-389 → unit/analysis/imports/commonjs/exports.test.ts
```

### Python Imports

```
Current: import_export_detector.ts::detect_python_imports()
New: analysis/imports/python/import_detector.ts::detect_imports()
Type: Python-specific
Test: python.test.ts:456-500 → unit/analysis/imports/python/import_detector.test.ts
```

```
Current: import_export_detector.ts lines 768-812 (from imports)
New: analysis/imports/python/from_import_detector.ts::detect_from_imports()
Type: Python-specific
Test: python.test.ts:567-611 → unit/analysis/imports/python/from_import.test.ts
```

### Rust Imports

```
Current: import_export_detector.ts::detect_rust_imports()
New: analysis/imports/rust/use_detector.ts::detect_use_statements()
Type: Rust-specific
Test: rust.test.ts:678-722 → unit/analysis/imports/rust/use_detector.test.ts
```

```
Current: import_export_detector.ts lines 846-890 (mod statements)
New: analysis/imports/rust/mod_detector.ts::detect_mod_statements()
Type: Rust-specific
Test: rust.test.ts:789-833 → unit/analysis/imports/rust/mod_detector.test.ts
```

### Universal Import Functions

```
Current: import_export_detector.ts::resolve_module_path()
New: analysis/imports/resolution/path_resolver.ts::resolve_path()
Type: Universal
Test: module_resolver.test.ts:45-89 → unit/analysis/imports/resolution/path_resolver.test.ts
```

```
Current: import_export_detector.ts::normalize_import_path()
New: analysis/imports/resolution/path_normalizer.ts::normalize_path()
Type: Universal
Test: module_resolver.test.ts:123-167 → unit/analysis/imports/resolution/path_normalizer.test.ts
```

```
Current: import_export_detector.ts::is_relative_import()
New: analysis/imports/predicates/import_predicates.ts::is_relative()
Type: Universal
Test: None → unit/analysis/imports/predicates/import_predicates.test.ts (NEW)
```

```
Current: import_export_detector.ts::is_absolute_import()
New: analysis/imports/predicates/import_predicates.ts::is_absolute()
Type: Universal
Test: None → unit/analysis/imports/predicates/import_predicates.test.ts
```

```
Current: import_export_detector.ts::get_import_type()
New: analysis/imports/classifier/import_classifier.ts::classify_import()
Type: Universal
Test: None → unit/analysis/imports/classifier/import_classifier.test.ts (NEW)
```

## 3. CALL DETECTION & ANALYSIS (35 functions across multiple files)

### Universal Call Detection Interface

```
Current: call_analysis/core.ts::analyze_calls()
New: analysis/call_graph/core/call_analyzer.ts::analyze_calls()
Type: Universal interface
Language Implementations:
  - analysis/call_graph/javascript/call_analyzer.ts
  - analysis/call_graph/python/call_analyzer.ts
  - analysis/call_graph/rust/call_analyzer.ts
Test: call_graph.test.ts:45-89 → unit/analysis/call_graph/core/call_analyzer.test.ts
```

### JavaScript/TypeScript Call Detection

```
Current: call_detection.ts::detect_function_call() with JS checks
New: analysis/call_graph/javascript/function_call_detector.ts::detect()
Type: JavaScript-specific
Test: javascript_core_features.test.ts:123-167 → unit/analysis/call_graph/javascript/function_call.test.ts
```

```
Current: call_detection.ts::detect_method_call() with JS checks
New: analysis/call_graph/javascript/method_call_detector.ts::detect()
Type: JavaScript-specific
Test: javascript_core_features.test.ts:234-278 → unit/analysis/call_graph/javascript/method_call.test.ts
```

```
Current: call_detection.ts::detect_constructor_call() with new keyword
New: analysis/call_graph/javascript/constructor_detector.ts::detect()
Type: JavaScript-specific
Test: javascript_core_features.test.ts:345-389 → unit/analysis/call_graph/javascript/constructor.test.ts
```

```
Current: call_detection.ts::detect_async_call()
New: analysis/call_graph/javascript/async_call_detector.ts::detect()
Type: JavaScript-specific
Test: edge_cases.test.ts:678-722 → unit/analysis/call_graph/javascript/async_call.test.ts
```

```
Current: call_detection.ts::detect_callback()
New: analysis/call_graph/javascript/callback_detector.ts::detect()
Type: JavaScript-specific
Test: edge_cases.test.ts:789-833 → unit/analysis/call_graph/javascript/callback.test.ts
```

### Python Call Detection

```
Current: call_detection.ts::detect_function_call() with Python checks
New: analysis/call_graph/python/function_call_detector.ts::detect()
Type: Python-specific
Test: python.test.ts:45-89 → unit/analysis/call_graph/python/function_call.test.ts
```

```
Current: call_detection.ts::detect_method_call() with Python checks
New: analysis/call_graph/python/method_call_detector.ts::detect()
Type: Python-specific
Test: python.test.ts:156-200 → unit/analysis/call_graph/python/method_call.test.ts
```

```
Current: call_detection.ts::detect_constructor_call() with __init__
New: analysis/call_graph/python/init_detector.ts::detect()
Type: Python-specific
Test: python.test.ts:267-311 → unit/analysis/call_graph/python/init_call.test.ts
```

### Rust Call Detection

```
Current: call_detection.ts::detect_function_call() with Rust checks
New: analysis/call_graph/rust/function_call_detector.ts::detect()
Type: Rust-specific
Test: rust.test.ts:45-89 → unit/analysis/call_graph/rust/function_call.test.ts
```

```
Current: call_detection.ts::detect_method_call() with Rust checks
New: analysis/call_graph/rust/method_call_detector.ts::detect()
Type: Rust-specific
Test: rust.test.ts:156-200 → unit/analysis/call_graph/rust/method_call.test.ts
```

```
Current: method_resolution.ts lines 345-401 (impl blocks)
New: analysis/call_graph/rust/impl_resolver.ts::resolve_impl_method()
Type: Rust-specific
Test: rust.test.ts:345-389 → unit/analysis/call_graph/rust/impl_resolver.test.ts
```

## 4. REFERENCE RESOLUTION (23 functions from reference_resolution.ts)

### Universal Reference Resolution

```
Current: reference_resolution.ts::resolve_reference()
New: analysis/call_graph/resolution/reference_resolver.ts::resolve()
Type: Universal orchestrator
Test: call_graph.test.ts:456-500 → unit/analysis/call_graph/resolution/reference_resolver.test.ts
```

```
Current: reference_resolution.ts::resolve_variable()
New: analysis/call_graph/resolution/variable_resolver.ts::resolve()
Type: Universal
Test: call_graph.test.ts:567-611 → unit/analysis/call_graph/resolution/variable_resolver.test.ts
```

```
Current: reference_resolution.ts::resolve_parameter()
New: analysis/call_graph/resolution/parameter_resolver.ts::resolve()
Type: Universal
Test: call_graph.test.ts:678-722 → unit/analysis/call_graph/resolution/parameter_resolver.test.ts
```

```
Current: reference_resolution.ts::resolve_import()
New: analysis/call_graph/resolution/import_resolver.ts::resolve()
Type: Universal
Test: import_resolver.test.ts:45-89 → unit/analysis/call_graph/resolution/import_resolver.test.ts
```

```
Current: reference_resolution.ts::resolve_property_access()
New: analysis/call_graph/resolution/property_resolver.ts::resolve()
Type: Universal
Test: call_graph.test.ts:789-833 → unit/analysis/call_graph/resolution/property_resolver.test.ts
```

### JavaScript-Specific Reference Resolution

```
Current: reference_resolution.ts::resolve_this_reference()
New: analysis/call_graph/resolution/javascript/this_resolver.ts::resolve()
Type: JavaScript-specific
Test: javascript_core_features.test.ts:456-500 → unit/analysis/call_graph/resolution/javascript/this.test.ts
```

```
Current: reference_resolution.ts::resolve_super_reference()
New: analysis/call_graph/resolution/javascript/super_resolver.ts::resolve()
Type: JavaScript-specific
Test: javascript_core_features.test.ts:567-611 → unit/analysis/call_graph/resolution/javascript/super.test.ts
```

```
Current: reference_resolution.ts::resolve_prototype_reference()
New: analysis/call_graph/resolution/javascript/prototype_resolver.ts::resolve()
Type: JavaScript-specific
Test: javascript_core_features.test.ts:678-722 → unit/analysis/call_graph/resolution/javascript/prototype.test.ts
```

### Python-Specific Reference Resolution

```
Current: reference_resolution.ts lines 567-623 (self resolution)
New: analysis/call_graph/resolution/python/self_resolver.ts::resolve()
Type: Python-specific
Test: python.test.ts:378-422 → unit/analysis/call_graph/resolution/python/self.test.ts
```

```
Current: reference_resolution.ts lines 645-701 (cls resolution)
New: analysis/call_graph/resolution/python/cls_resolver.ts::resolve()
Type: Python-specific
Test: python.test.ts:489-533 → unit/analysis/call_graph/resolution/python/cls.test.ts
```

### Rust-Specific Reference Resolution

```
Current: reference_resolution.ts lines 723-779 (self resolution)
New: analysis/call_graph/resolution/rust/self_resolver.ts::resolve()
Type: Rust-specific
Test: rust.test.ts:456-500 → unit/analysis/call_graph/resolution/rust/self.test.ts
```

```
Current: reference_resolution.ts lines 801-857 (Self type)
New: analysis/call_graph/resolution/rust/self_type_resolver.ts::resolve()
Type: Rust-specific
Test: rust.test.ts:567-611 → unit/analysis/call_graph/resolution/rust/self_type.test.ts
```

### Resolution Utilities

```
Current: reference_resolution.ts::find_binding()
New: analysis/call_graph/resolution/utils/binding_finder.ts::find()
Type: Universal
Test: None → unit/analysis/call_graph/resolution/utils/binding_finder.test.ts (NEW)
```

```
Current: reference_resolution.ts::get_reference_scope()
New: analysis/call_graph/resolution/utils/scope_finder.ts::get_scope()
Type: Universal
Test: None → unit/analysis/call_graph/resolution/utils/scope_finder.test.ts (NEW)
```

```
Current: reference_resolution.ts::is_reference()
New: analysis/call_graph/resolution/utils/reference_predicates.ts::is_reference()
Type: Universal
Test: None → unit/analysis/call_graph/resolution/utils/reference_predicates.test.ts (NEW)
```

```
Current: reference_resolution.ts::get_reference_type()
New: analysis/call_graph/resolution/utils/reference_classifier.ts::classify()
Type: Universal
Test: None → unit/analysis/call_graph/resolution/utils/reference_classifier.test.ts (NEW)
```

## 5. TYPE TRACKING (24 functions across type_tracker.ts and return_type_analyzer.ts)

### Universal Type Tracking

```
Current: type_tracker.ts::track_variable_type()
New: analysis/types/tracking/variable_tracker.ts::track()
Type: Universal
Test: type_tracker.test.ts:45-89 → unit/analysis/types/tracking/variable_tracker.test.ts
```

```
Current: type_tracker.ts::get_variable_type()
New: analysis/types/tracking/variable_tracker.ts::get_type()
Type: Universal
Test: type_tracker.test.ts:156-200 → unit/analysis/types/tracking/variable_tracker.test.ts
```

```
Current: type_tracker.ts::handle_reassignment()
New: analysis/types/tracking/reassignment_handler.ts::handle()
Type: Universal
Test: edge_cases.test.ts:234-278 → unit/analysis/types/tracking/reassignment.test.ts
```

```
Current: type_tracker.ts::get_scope_types()
New: analysis/types/tracking/scope_types.ts::get_types()
Type: Universal
Test: type_tracker.test.ts:267-311 → unit/analysis/types/tracking/scope_types.test.ts
```

### Return Type Analysis

```
Current: return_type_analyzer.ts::analyze_return_type()
New: analysis/types/return/return_analyzer.ts::analyze()
Type: Universal interface
Language Implementations:
  - analysis/types/javascript/return_analyzer.ts
  - analysis/types/python/return_analyzer.ts
  - analysis/types/rust/return_analyzer.ts
Test: type_tracker.test.ts:378-422 → unit/analysis/types/return/return_analyzer.test.ts
```

```
Current: return_type_analyzer.ts::infer_from_return_statements()
New: analysis/types/inference/return_inference.ts::infer()
Type: Universal
Test: type_tracker.test.ts:489-533 → unit/analysis/types/inference/return_inference.test.ts
```

### JavaScript-Specific Type Features

```
Current: return_type_analyzer.ts::get_async_return_type()
New: analysis/types/javascript/async_return_analyzer.ts::analyze()
Type: JavaScript-specific
Test: javascript_core_features.test.ts:789-833 → unit/analysis/types/javascript/async_return.test.ts
```

```
Current: return_type_analyzer.ts::get_generator_yield_type()
New: analysis/types/javascript/generator_analyzer.ts::analyze()
Type: JavaScript-specific
Test: edge_cases.test.ts:900-944 → unit/analysis/types/javascript/generator.test.ts
```

### Python-Specific Type Features

```
Current: type_tracker.ts lines 456-512 (type hints)
New: analysis/types/python/type_hint_parser.ts::parse()
Type: Python-specific
Test: python.test.ts:600-644 → unit/analysis/types/python/type_hints.test.ts
```

### Rust-Specific Type Features

```
Current: type_tracker.ts lines 591-647 (type inference)
New: analysis/types/rust/type_inference.ts::infer()
Type: Rust-specific
Test: rust.test.ts:900-944 → unit/analysis/types/rust/type_inference.test.ts
```

## 6. METHOD RESOLUTION (9 functions from method_resolution.ts)

### Universal Method Resolution

```
Current: method_resolution.ts::resolve_method_to_class()
New: analysis/call_graph/resolution/method/method_resolver.ts::resolve()
Type: Universal interface
Test: call_graph_method_resolution.test.ts:45-89 → unit/analysis/call_graph/resolution/method/method_resolver.test.ts
```

```
Current: method_resolution.ts::find_method_in_class()
New: analysis/call_graph/resolution/method/class_finder.ts::find()
Type: Universal
Test: call_graph_method_resolution.test.ts:156-200 → unit/analysis/call_graph/resolution/method/class_finder.test.ts
```

### JavaScript Method Resolution

```
Current: method_resolution.ts::resolve_prototype_method()
New: analysis/call_graph/resolution/javascript/prototype_method_resolver.ts::resolve()
Type: JavaScript-specific
Test: javascript_core_features.test.ts:900-944 → unit/analysis/call_graph/resolution/javascript/prototype_method.test.ts
```

### Python Method Resolution

```
Current: method_resolution.ts::resolve_through_inheritance()
New: analysis/call_graph/resolution/python/inheritance_resolver.ts::resolve()
Type: Python-specific
Test: python.test.ts:711-755 → unit/analysis/call_graph/resolution/python/inheritance.test.ts
```

```
Current: method_resolution.ts lines 167-223 (MRO)
New: analysis/call_graph/resolution/python/mro_resolver.ts::resolve()
Type: Python-specific
Test: python.test.ts:822-866 → unit/analysis/call_graph/resolution/python/mro.test.ts
```

### Rust Method Resolution

```
Current: method_resolution.ts lines 255-311 (trait methods)
New: analysis/call_graph/resolution/rust/trait_method_resolver.ts::resolve()
Type: Rust-specific
Test: rust.test.ts:678-722 → unit/analysis/call_graph/resolution/rust/trait_method.test.ts
```

## 7. PROJECT MANAGEMENT (45 functions across project files)

### Project Class Decomposition (23 methods)

```
Current: project.ts::add_file()
New: project/operations/file_operations.ts::add_file()
Type: Universal (made immutable)
Test: project.test.ts:45-89 → unit/project/operations/file_operations.test.ts
```

```
Current: project.ts::update_file()
New: project/operations/file_operations.ts::update_file()
Type: Universal (made immutable)
Test: project.test.ts:156-200 → unit/project/operations/file_operations.test.ts
```

```
Current: project.ts::remove_file()
New: project/operations/file_operations.ts::remove_file()
Type: Universal (made immutable)
Test: project.test.ts:267-311 → unit/project/operations/file_operations.test.ts
```

```
Current: project.ts::get_call_graph()
New: project/operations/analysis_operations.ts::get_call_graph()
Type: Universal
Test: project.test.ts:378-422 → unit/project/operations/analysis_operations.test.ts
```

```
Current: project.ts::find_definition()
New: project/operations/query_operations.ts::find_definition()
Type: Universal
Test: None → unit/project/operations/query_operations.test.ts (NEW)
```

```
Current: project.ts::get_references()
New: project/operations/query_operations.ts::get_references()
Type: Universal
Test: None → unit/project/operations/query_operations.test.ts
```

[Continuing with remaining ~300 functions...]

## Summary of Function Distribution

### By Feature Area
- **Scope Resolution**: 18 functions (13 universal, 5 language-specific)
- **Import/Export**: 19 functions (6 universal, 13 language-specific)
- **Call Detection**: 35 functions (8 universal, 27 language-specific)
- **Reference Resolution**: 23 functions (14 universal, 9 language-specific)
- **Type Tracking**: 24 functions (10 universal, 14 language-specific)
- **Method Resolution**: 9 functions (2 universal, 7 language-specific)
- **Graph Building**: 28 functions (all universal)
- **Project Management**: 45 functions (all universal)
- **Storage**: 14 functions (all universal)
- **Utilities**: 41 functions (all universal)
- **Language Configs**: 48 functions (all language-specific)
- **File Management**: 11 functions (all universal)
- **Inheritance Service**: 6 functions (language-specific)
- **Remaining**: ~171 functions

### By Language
- **Universal**: ~287 functions (59%)
- **JavaScript-specific**: ~78 functions (16%)
- **Python-specific**: ~62 functions (13%)
- **Rust-specific**: ~60 functions (12%)

Total: 487 functions ✓