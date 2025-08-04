# Call Analysis Module Plan

The call_analysis.ts module will be the largest module (~20KB) and will contain:

## Functions to Extract:

### 1. Module-level call detection
- `get_module_level_calls()` - Get calls made outside any function/class

### 2. Definition call analysis  
- `get_calls_from_definition()` - Main function to get all calls from within a definition
- This is the most complex function with:
  - Variable type tracking setup
  - Constructor call detection (first pass)
  - Method call resolution (second pass)
  - Cross-file resolution

### 3. Helper functions
- `track_implicit_instance_parameter()` - Track self/this for methods
- `resolve_method_call()` - Resolve method calls on typed variables
- `detect_constructor_call()` - Check if a reference is a constructor call
- `track_variable_assignment()` - Track variable type from constructor/assignment

## Refactoring Strategy:

1. Extract the helper functions first (they're more self-contained)
2. Break up `get_calls_from_definition()` into smaller functions:
   - `setup_type_tracking()` 
   - `first_pass_constructor_tracking()`
   - `second_pass_call_resolution()`
3. Keep the main orchestration logic clean and functional

## Dependencies:
- Will need access to type tracking functions
- Will need file cache for AST access
- Will need delegation functions for go_to_definition, etc.

The goal is to make this module focused purely on analyzing calls within code, with clean functional interfaces.