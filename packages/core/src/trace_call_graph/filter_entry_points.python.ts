/**
 * Python Entry Point Filtering
 *
 * Filters Python dunder methods that are framework-invoked and cannot be
 * traced through static call graph analysis.
 *
 * Dunder methods fall into two categories:
 * 1. **Traceable** - Can be detected through static call resolution:
 *    - `__init__` - via constructor calls `ClassName()`
 *    - `__call__` - via callable instance calls `instance()`
 *    - `__new__` - via constructor call chain
 *
 * 2. **Framework-invoked** - Called by Python runtime, not traceable:
 *    - `__str__`, `__repr__` - string conversion
 *    - `__len__`, `__iter__`, `__next__` - iteration protocol
 *    - `__eq__`, `__hash__`, `__lt__`, `__gt__` - comparison protocol
 *    - `__enter__`, `__exit__` - context manager protocol
 *    - All other `__xxx__` dunder methods
 *
 * This filter removes framework-invoked dunder methods from entry point
 * detection since they appear as false positives (never called in static analysis
 * but actually invoked by the Python runtime).
 */

import type { SymbolName } from "@ariadnejs/types";

/**
 * Dunder methods that SHOULD remain in entry point detection.
 * These are traceable through static call graph analysis.
 */
const TRACEABLE_DUNDER_METHODS: ReadonlySet<string> = new Set([
  "__init__", // Constructor: ClassName()
  "__call__", // Callable instance: instance()
  "__new__", // Object creation: part of ClassName() chain
]);

/**
 * Check if a name is a dunder method (starts and ends with double underscores).
 */
function is_dunder_method(name: string): boolean {
  return (
    name.length > 4 && name.startsWith("__") && name.endsWith("__")
  );
}

/**
 * Determine if a Python symbol should be filtered from entry points.
 *
 * Returns true for dunder methods that are framework-invoked and cannot
 * be traced through static analysis.
 *
 * @param name - The symbol name to check
 * @returns true if the symbol should be filtered out, false otherwise
 */
export function should_filter_python_entry_point(name: SymbolName): boolean {
  const name_str = name as string;

  // Only filter dunder methods
  if (!is_dunder_method(name_str)) {
    return false;
  }

  // Keep traceable dunder methods (they can be resolved via call graph)
  if (TRACEABLE_DUNDER_METHODS.has(name_str)) {
    return false;
  }

  // Filter all other dunder methods (framework-invoked)
  return true;
}
