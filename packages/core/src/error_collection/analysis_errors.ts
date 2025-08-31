/**
 * Analysis Error Collection
 * 
 * Collects and manages errors during code analysis
 */

import { 
  AnalysisError,
  ErrorSeverity,
  Location,
  Language
} from '@ariadnejs/types';

/**
 * Error collector context
 */
export interface ErrorContext {
  file_path: string;
  language: Language;
  phase: AnalysisPhase;
}

/**
 * Analysis phases where errors can occur
 */
export type AnalysisPhase = 
  | 'parsing'
  | 'scope_analysis'
  | 'import_resolution'
  | 'export_detection'
  | 'type_tracking'
  | 'call_graph'
  | 'class_detection'
  | 'return_type_inference';

/**
 * Error collector class
 */
export class ErrorCollector {
  private errors: AnalysisError[] = [];
  private context: ErrorContext;
  
  constructor(context: ErrorContext) {
    this.context = context;
  }
  
  /**
   * Add an error to the collection
   */
  add_error(
    message: string,
    location?: Location,
    severity: ErrorSeverity = 'error',
    details?: Record<string, any>
  ): void {
    const error: AnalysisError = {
      message,
      severity,
      phase: this.context.phase,
      location: location || {
        file_path: this.context.file_path,
        line: 0,
        column: 0,
        end_line: 0,
        end_column: 0
      },
      details
    };
    
    this.errors.push(error);
  }
  
  /**
   * Add a warning
   */
  add_warning(message: string, location?: Location, details?: Record<string, any>): void {
    this.add_error(message, location, 'warning', details);
  }
  
  /**
   * Add an info message
   */
  add_info(message: string, location?: Location, details?: Record<string, any>): void {
    this.add_error(message, location, 'info', details);
  }
  
  /**
   * Get all collected errors
   */
  get_errors(): readonly AnalysisError[] {
    return Object.freeze([...this.errors]);
  }
  
  /**
   * Check if there are any errors
   */
  has_errors(): boolean {
    return this.errors.some(e => e.severity === 'error');
  }
  
  /**
   * Check if there are any warnings
   */
  has_warnings(): boolean {
    return this.errors.some(e => e.severity === 'warning');
  }
  
  /**
   * Clear all errors
   */
  clear(): void {
    this.errors = [];
  }
  
  /**
   * Set current analysis phase
   */
  set_phase(phase: AnalysisPhase): void {
    this.context.phase = phase;
  }
  
  /**
   * Create location from node positions
   */
  static create_location(
    file_path: string,
    start_row: number,
    start_col: number,
    end_row: number,
    end_col: number
  ): Location {
    return {
      file_path,
      line: start_row,
      column: start_col,
      end_line: end_row,
      end_column: end_col
    };
  }
}

/**
 * Create a new error collector
 */
export function create_error_collector(
  file_path: string,
  language: Language,
  initial_phase: AnalysisPhase = 'parsing'
): ErrorCollector {
  return new ErrorCollector({
    file_path,
    language,
    phase: initial_phase
  });
}

/**
 * Common error messages
 */
export const ERROR_MESSAGES = {
  // Parsing errors
  PARSE_ERROR: 'Failed to parse file',
  SYNTAX_ERROR: 'Syntax error in source code',
  
  // Import/Export errors
  UNRESOLVED_IMPORT: 'Cannot resolve import',
  CIRCULAR_DEPENDENCY: 'Circular dependency detected',
  INVALID_EXPORT: 'Invalid export declaration',
  
  // Type errors
  TYPE_MISMATCH: 'Type mismatch',
  UNKNOWN_TYPE: 'Unknown type reference',
  INVALID_TYPE_ANNOTATION: 'Invalid type annotation',
  
  // Call graph errors
  UNRESOLVED_FUNCTION: 'Cannot resolve function call',
  UNRESOLVED_METHOD: 'Cannot resolve method call',
  INVALID_CONSTRUCTOR: 'Invalid constructor call',
  
  // Class errors
  DUPLICATE_CLASS: 'Duplicate class definition',
  INVALID_INHERITANCE: 'Invalid inheritance chain',
  
  // Scope errors
  UNDEFINED_VARIABLE: 'Undefined variable',
  DUPLICATE_DECLARATION: 'Duplicate declaration',
  INVALID_SCOPE: 'Invalid scope nesting'
};

/**
 * Format error for display
 */
export function format_error(error: AnalysisError): string {
  const severity = error.severity.toUpperCase();
  const location = error.location;
  const file = location.file_path;
  const position = `${location.line}:${location.column}`;
  
  let formatted = `[${severity}] ${file}:${position} - ${error.message}`;
  
  if (error.details) {
    formatted += '\n  Details: ' + JSON.stringify(error.details, null, 2);
  }
  
  return formatted;
}

/**
 * Collect all errors from multiple collectors
 */
export function merge_error_collectors(
  collectors: ErrorCollector[]
): readonly AnalysisError[] {
  const all_errors: AnalysisError[] = [];
  
  for (const collector of collectors) {
    all_errors.push(...collector.get_errors());
  }
  
  return Object.freeze(all_errors);
}