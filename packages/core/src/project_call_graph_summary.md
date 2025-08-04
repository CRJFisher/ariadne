# Project Call Graph Summary

## Overview

The `project_call_graph.ts` file is currently 60KB (1589 lines) and contains all the call graph functionality for Ariadne. It needs to be split into smaller modules to stay under the 32KB tree-sitter limit.

## Classes and Their Responsibilities

### 1. FileTypeTracker (lines 10-116)

**Purpose**: Tracks variable type information at the file level
**Key Methods**:

- `setVariableType()`: Set type of a variable at a specific position
- `getVariableType()`: Get type of a variable at a specific position
- `setImportedClass()`: Track an imported class
- `getImportedClass()`: Get imported class information
- `markAsExported()`: Mark a definition as exported
- `isExported()`: Check if a definition is exported
- `clear()`: Clear all type information
**Data**:
- `variableTypes`: Map of variable names to type info with positions
- `importedClasses`: Map of local names to imported class info
- `exportedDefinitions`: Set of exported definition names

### 2. LocalTypeTracker (lines 121-177)

**Purpose**: Local type tracker that inherits from a parent FileTypeTracker
**Key Methods**:

- `setVariableType()`: Set variable type in local scope
- `getVariableType()`: Get variable type (checks local then parent)
- `getImportedClass()`: Get imported class from parent
**Data**:
- `localTypes`: Map of local variable types
- `parent`: Reference to FileTypeTracker

### 3. ProjectTypeRegistry (lines 190-256)

**Purpose**: Registry for tracking type information across files in a project
**Key Methods**:

- `registerExport()`: Register an exported type from a file
- `getImportedType()`: Get type information for an imported symbol
- `clearFileExports()`: Clear type information for a specific file
**Data**:
- `exportedTypes`: Map of exported symbols to type information
- `fileExports`: Map of file paths to their exported symbols

### 4. ProjectCallGraph (lines 261-1589) - Main Class

**Purpose**: Handles call graph related operations for the Project class
**Constructor**: Takes file_graphs, file_cache, and languages maps

#### Major Method Groups

##### Type Tracking Methods (lines 283-310)

- `getFileTypeTracker()`: Get or create FileTypeTracker for a file
- `clearFileTypeTracker()`: Clear type tracker for a file
- `isDefinitionExported()`: Check if a definition is exported

##### Import/Export Detection (lines 315-537)

- `initializeFileImports()`: Initialize import information for a file
- `detectFileExports()`: Detect and track exported definitions
  - Handles Python (all top-level non-underscore)
  - Handles Rust (pub keyword)
  - Handles JavaScript (CommonJS & ES6)
  - Handles TypeScript (ES6)

##### Call Analysis Methods (lines 616-1172)

- `get_module_level_calls()`: Get calls made outside functions/classes
- `get_calls_from_definition()`: Get all calls from within a definition
  - Complex method with type tracking
  - Constructor call detection
  - Method call resolution
  - Cross-file resolution

##### Call Graph Building (lines 1179-1451)

- `extract_call_graph()`: Get all function call relationships
- `get_call_graph()`: Build complete call graph with filtering options
  - Node creation
  - Edge building
  - Top-level node identification
  - Max depth filtering

##### Helper Methods (lines 1457-1541)

- `apply_max_depth_filter()`: Apply depth filtering to call graph
- `is_position_within_range()`: Check if position is within range
- `computeClassEnclosingRange()`: Compute enclosing range for class
- `trackImplicitInstanceParameter()`: Track self/this for methods
- `createLocalTypeTracker()`: Create local type tracker

##### Delegation Methods (lines 1543-1589)

- Methods that delegate to Project class:
  - `go_to_definition()`
  - `get_imports_with_definitions()`
  - `get_all_functions()`
  - `get_function_calls()`
- Setter methods for delegation

## Key Dependencies

- Imports from './graph': Point, Def, Ref, FunctionCall, ImportInfo, CallGraph, etc.
- ScopeGraph from './graph'
- LanguageConfig from './types'
- Tree from 'tree-sitter'
- normalize_module_path from './symbol_naming'

## Size Analysis

- Total: ~1589 lines
- FileTypeTracker: ~106 lines
- LocalTypeTracker: ~56 lines  
- ProjectTypeRegistry: ~66 lines
- ProjectCallGraph: ~1328 lines
  - Type tracking: ~30 lines
  - Import/Export: ~220 lines
  - Call analysis: ~550 lines
  - Call graph building: ~270 lines
  - Helpers: ~85 lines
  - Delegation: ~45 lines

## Logical Separation Points

1. **Type Tracking Module** (~230 lines)
   - FileTypeTracker
   - LocalTypeTracker
   - ProjectTypeRegistry

2. **Import/Export Detection Module** (~220 lines)
   - detectFileExports method
   - initializeFileImports method

3. **Call Analysis Module** (~550 lines)
   - get_module_level_calls
   - get_calls_from_definition
   - Related helper methods

4. **Call Graph Building Module** (~270 lines)
   - extract_call_graph
   - get_call_graph
   - apply_max_depth_filter

5. **Main Coordinator** (~200 lines)
   - ProjectCallGraph class shell
   - Delegation methods
   - Basic helpers

## State Mutations Analysis

### Overview

The codebase has several types of mutations, mostly concentrated in specific areas. Most mutations are "add-only" operations that build up data structures rather than modifying existing data.

### Mutation Locations and Types

#### 1. FileTypeTracker Mutations

**Where**: Lines 29, 37, 70, 84, 105-107
**What**:

- `setVariableType()`: Adds to `variableTypes` Map (line 37)
- `setImportedClass()`: Adds to `importedClasses` Map (line 70)
- `markAsExported()`: Adds to `exportedDefinitions` Set (line 84)
- `clear()`: Clears all three data structures (lines 105-107)

**Pattern**: Mostly additive, only `clear()` removes data

#### 2. LocalTypeTracker Mutations

**Where**: Lines 136, 144
**What**:

- `setVariableType()`: Adds to local `localTypes` Map

**Pattern**: Additive only, inherits from parent

#### 3. ProjectTypeRegistry Mutations

**Where**: Lines 212, 220, 222, 243, 245
**What**:

- `registerExport()`: Adds to `exportedTypes` Map and `fileExports` Map
- `clearFileExports()`: Removes entries from both maps

**Pattern**: Mostly additive, only `clearFileExports()` removes data

#### 4. ProjectCallGraph State Mutations

**Where**: Throughout, but concentrated in specific methods
**What**:

- `file_type_trackers` Map: Created lazily in `getFileTypeTracker()` (line 287)
- `project_type_registry`: Modified through `registerExport()` calls in `detectFileExports()`

**Key Mutation Points**:

1. **Type Tracker Creation** (line 287): Lazy initialization
2. **Export Detection** (lines 397, 419, 447, 464, 485, 510, 531): Registers exports
3. **Import Tracking** (in `initializeFileImports`): Sets imported classes

#### 5. Call Graph Building Mutations

**Where**: Lines 1258, 1323, 1334, 1345, 1350, 1390, 1393, 1398
**What**:

- Building `nodes` Map (line 1258)
- Adding to `calls` array on nodes (line 1323)
- Building `edges` array (lines 1334, 1390)
- Building `called_symbols` Set (lines 1345, 1393)
- Adding to `called_by` arrays (lines 1350, 1398)

**Pattern**: Pure construction - builds new data structures

### Mutation Categories

1. **Initialization Mutations** (Easy to refactor)
   - Lazy creation of type trackers
   - Initial setup of data structures

2. **Registration Mutations** (Easy to refactor)
   - Adding exports to registry
   - Adding imports to trackers
   - Marking definitions as exported

3. **Clear/Reset Mutations** (Moderate difficulty)
   - Clearing type trackers
   - Clearing file exports

4. **Build Mutations** (Already functional)
   - Building call graph nodes and edges
   - These create new structures rather than modifying existing

### Refactoring Difficulty Assessment

**Easy to refactor** (80% of mutations):

- Most mutations are "add-only" operations
- Clear ownership of data (file-specific trackers)
- Registration pattern is straightforward

**Moderate difficulty** (15% of mutations):

- Lazy initialization patterns
- Clear operations that affect multiple structures

**Difficult** (5% of mutations):

- Cross-cutting concerns like `detectFileExports` that both read and write
- Methods that initialize data as side effects

### Recommended Refactoring Strategy

1. **Keep mutations localized**: Most mutations happen in specific "setup" or "registration" phases
2. **Make initialization explicit**: Convert lazy initialization to explicit setup functions
3. **Batch operations**: Collect all exports/imports first, then register in one operation
4. **Return new data**: For clear operations, consider returning new instances instead of mutating
