# Migration Task List for Epic 11

## Complete List of Leaf Nodes to Migrate

### High-Level Features (src/)

#### call_graph/
- [x] task-epic-11.6 - function_calls
- [x] task-epic-11.7 - method_calls
- [x] task-epic-11.8 - constructor_calls
- [x] task-epic-11.9 - call_chain_analysis

#### import_export/
- [x] task-epic-11.10 - import_resolution
- [x] task-epic-11.11 - export_detection
- [x] task-epic-11.12 - namespace_resolution
- [x] task-epic-11.13 - module_graph

#### type_analysis/
- [x] task-epic-11.14 - type_tracking
- [x] task-epic-11.15 - return_type_inference
- [x] task-epic-11.16 - parameter_type_inference
- [x] task-epic-11.17 - type_propagation

#### scope_analysis/
- [x] task-epic-11.18 - scope_tree
- [x] task-epic-11.19 - symbol_resolution
- [x] task-epic-11.20 - definition_finder
- [x] task-epic-11.21 - usage_finder

#### inheritance_analysis/
- [x] task-epic-11.22 - class_hierarchy
- [x] task-epic-11.23 - method_override
- [x] task-epic-11.24 - interface_implementation

### Data Layer (src/)

#### project/
- [x] task-epic-11.25 - project_manager
- [x] task-epic-11.26 - file_tracker
- [x] task-epic-11.27 - incremental_updates

#### storage/
- [x] task-epic-11.28 - storage_interface
- [x] task-epic-11.29 - memory_storage
- [x] task-epic-11.30 - disk_storage
- [x] task-epic-11.31 - cache_layer

#### graph/
- [x] task-epic-11.32 - graph_builder
- [x] task-epic-11.33 - graph_data
- [x] task-epic-11.34 - graph_algorithms

### Foundation (src/)

#### scope_queries/
- [x] task-epic-11.35 - loader
- [x] task-epic-11.36 - javascript.scm
- [x] task-epic-11.37 - typescript.scm
- [x] task-epic-11.38 - python.scm
- [x] task-epic-11.39 - rust.scm

#### ast/
- [x] task-epic-11.40 - node_utils
- [x] task-epic-11.41 - query_executor
- [x] task-epic-11.42 - position_utils

#### utils/
- [x] task-epic-11.43 - path_utils
- [x] task-epic-11.44 - string_utils
- [x] task-epic-11.45 - collection_utils

### API Layer
- [x] task-epic-11.46 - index.ts (exports only)