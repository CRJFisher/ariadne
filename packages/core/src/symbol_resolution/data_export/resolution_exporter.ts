/**
 * Symbol Resolution Data Export
 *
 * Provides clean data export interfaces for resolved symbol data,
 * enabling future call graph construction and external analysis tools.
 */

import type {
  Location,
  SymbolId,
  FilePath,
  SymbolName,
  TypeId,
} from "@ariadnejs/types";
import { type LocationKey } from "@ariadnejs/types";
import type { ResolvedSymbols } from "../types";

/**
 * Exported symbol resolution data structure
 * Clean interface for external consumption
 */
export interface ExportedSymbolResolution {
  readonly metadata: {
    readonly export_version: string;
    readonly timestamp: number;
    readonly total_files: number;
    readonly total_symbols: number;
    readonly total_resolved_references: number;
  };
  readonly imports: ExportedImportMap;
  readonly function_calls: ExportedCallMap;
  readonly method_calls: ExportedCallMap;
  readonly constructor_calls: ExportedCallMap;
  readonly symbol_definitions: ExportedSymbolMap;
  readonly type_information: ExportedTypeInfo;
}

/**
 * Exported import mappings
 */
export interface ExportedImportMap {
  readonly imports: Array<{
    readonly file_path: FilePath;
    readonly imported_name: SymbolName;
    readonly resolved_symbol: SymbolId;
  }>;
}

/**
 * Exported call mappings
 */
export interface ExportedCallMap {
  readonly calls: Array<{
    readonly call_location: Location;
    readonly resolved_symbol: SymbolId;
  }>;
}

/**
 * Exported symbol definitions
 */
export interface ExportedSymbolMap {
  readonly symbols: Array<{
    readonly symbol_id: SymbolId;
    readonly references: Location[];
  }>;
}

/**
 * Exported type information
 */
export interface ExportedTypeInfo {
  readonly symbol_types: Array<{
    readonly symbol_id: SymbolId;
    readonly type_id: TypeId;
  }>;
  readonly type_members: Array<{
    readonly type_id: TypeId;
    readonly members: Array<{
      readonly member_name: SymbolName;
      readonly member_symbol: SymbolId;
    }>;
  }>;
}

/**
 * Main export function - converts resolved symbols to exportable format
 */
export function export_symbol_resolution_data(
  resolved_symbols: ResolvedSymbols,
  format: "json" | "csv" = "json"
): string {
  const exported_data = create_exported_data(resolved_symbols);

  if (format === "json") {
    return JSON.stringify(exported_data, null, 2);
  } else {
    return convert_to_csv(exported_data);
  }
}

/**
 * Create the exported data structure from resolved symbols
 */
function create_exported_data(
  resolved_symbols: ResolvedSymbols
): ExportedSymbolResolution {
  // Calculate metadata
  const total_files = new Set<FilePath>();
  for (const loc of resolved_symbols.resolved_references.keys()) {
    total_files.add(parse_location_key(loc).file_path);
  }

  const total_symbols = new Set<SymbolId>();
  for (const symbol of resolved_symbols.resolved_references.values()) {
    total_symbols.add(symbol);
  }

  return {
    metadata: {
      export_version: "1.0.0",
      timestamp: Date.now(),
      total_files: total_files.size,
      total_symbols: total_symbols.size,
      total_resolved_references: resolved_symbols.resolved_references.size,
    },
    imports: export_import_mappings(resolved_symbols.phases.imports.imports),
    function_calls: export_call_mappings(
      resolved_symbols.phases.functions.function_calls
    ),
    method_calls: export_call_mappings(
      resolved_symbols.phases.methods.method_calls
    ),
    constructor_calls: export_call_mappings(
      resolved_symbols.phases.methods.constructor_calls
    ),
    symbol_definitions: export_symbol_definitions(resolved_symbols),
    type_information: export_type_information(resolved_symbols.phases.types),
  };
}

/**
 * Export import mappings to clean format
 */
function export_import_mappings(
  imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>
): ExportedImportMap {
  const result: ExportedImportMap["imports"] = [];

  for (const [file_path, file_imports] of imports) {
    for (const [imported_name, resolved_symbol] of file_imports) {
      result.push({
        file_path,
        imported_name,
        resolved_symbol,
      });
    }
  }

  return { imports: result };
}

/**
 * Export call mappings from LocationKey-based maps
 */
function export_call_mappings(
  calls: ReadonlyMap<LocationKey, SymbolId> | ReadonlyMap<Location, SymbolId>
): ExportedCallMap {
  const result: ExportedCallMap["calls"] = [];

  for (const [location_key_or_location, resolved_symbol] of calls) {
    // Handle both LocationKey and Location types
    let location: Location;
    if (typeof location_key_or_location === "string") {
      // It's a LocationKey, parse it back to Location
      location = parse_location_key(location_key_or_location as LocationKey);
    } else {
      // It's already a Location
      location = location_key_or_location as Location;
    }

    result.push({
      call_location: location,
      resolved_symbol,
    });
  }

  return { calls: result };
}

/**
 * Export symbol definitions with their references
 */
function export_symbol_definitions(
  resolved_symbols: ResolvedSymbols
): ExportedSymbolMap {
  const result: ExportedSymbolMap["symbols"] = [];

  for (const [symbol_id, references] of resolved_symbols.references_to_symbol) {
    result.push({
      symbol_id,
      references: [...(references || [])],
    });
  }

  return { symbols: result };
}

/**
 * Export type information
 */
function export_type_information(
  types: ResolvedSymbols["phases"]["types"]
): ExportedTypeInfo {
  const symbol_types: ExportedTypeInfo["symbol_types"] = [];
  const type_members: ExportedTypeInfo["type_members"] = [];

  // Export symbol -> type mappings
  for (const [symbol_id, type_id] of types.symbol_types) {
    symbol_types.push({ symbol_id, type_id });
  }

  // Export type members
  for (const [type_id, members] of types.type_members) {
    const member_list: Array<{
      member_name: SymbolName;
      member_symbol: SymbolId;
    }> = [];
    for (const [member_name, member_symbol] of members) {
      member_list.push({ member_name, member_symbol });
    }
    type_members.push({ type_id, members: member_list });
  }

  return { symbol_types, type_members };
}

/**
 * Parse LocationKey back to Location
 * Format: "file_path:line:column"
 */
function parse_location_key(key: LocationKey): Location {
  const parts = key.split(":");
  const line = parseInt(parts[parts.length - 2], 10);
  const column = parseInt(parts[parts.length - 1], 10);
  const file_path = parts.slice(0, -2).join(":") as FilePath;

  return {
    file_path,
    line,
    column,
    end_line: line,
    end_column: column,
  };
}

/**
 * Convert exported data to CSV format
 */
function convert_to_csv(data: ExportedSymbolResolution): string {
  const csv_lines: string[] = [];

  // Add metadata header
  csv_lines.push("# Symbol Resolution Export");
  csv_lines.push(`# Version: ${data.metadata.export_version}`);
  csv_lines.push(
    `# Timestamp: ${new Date(data.metadata.timestamp).toISOString()}`
  );
  csv_lines.push(`# Files: ${data.metadata.total_files}`);
  csv_lines.push(`# Symbols: ${data.metadata.total_symbols}`);
  csv_lines.push(
    `# Resolved References: ${data.metadata.total_resolved_references}`
  );
  csv_lines.push("");

  // Imports section
  csv_lines.push("## Imports");
  csv_lines.push("File Path,Imported Name,Resolved Symbol");
  for (const imp of data.imports.imports) {
    csv_lines.push(
      `"${imp.file_path}","${imp.imported_name}","${imp.resolved_symbol}"`
    );
  }
  csv_lines.push("");

  // Function calls section
  csv_lines.push("## Function Calls");
  csv_lines.push("Call Location,Resolved Symbol");
  for (const call of data.function_calls.calls) {
    const loc = `${call.call_location.file_path}:${call.call_location.line}:${call.call_location.column}`;
    csv_lines.push(`"${loc}","${call.resolved_symbol}"`);
  }
  csv_lines.push("");

  // Method calls section
  csv_lines.push("## Method Calls");
  csv_lines.push("Call Location,Resolved Symbol");
  for (const call of data.method_calls.calls) {
    const loc = `${call.call_location.file_path}:${call.call_location.line}:${call.call_location.column}`;
    csv_lines.push(`"${loc}","${call.resolved_symbol}"`);
  }
  csv_lines.push("");

  // Constructor calls section
  csv_lines.push("## Constructor Calls");
  csv_lines.push("Call Location,Resolved Symbol");
  for (const call of data.constructor_calls.calls) {
    const loc = `${call.call_location.file_path}:${call.call_location.line}:${call.call_location.column}`;
    csv_lines.push(`"${loc}","${call.resolved_symbol}"`);
  }

  return csv_lines.join("\n");
}

/**
 * Count total symbols in resolved data
 */
export function count_total_symbols(resolved_symbols: ResolvedSymbols): number {
  const unique_symbols = new Set<SymbolId>();

  // Count from resolved references
  for (const symbol of resolved_symbols.resolved_references.values()) {
    unique_symbols.add(symbol);
  }

  // Count from references_to_symbol
  for (const symbol of resolved_symbols.references_to_symbol.keys()) {
    unique_symbols.add(symbol);
  }

  return unique_symbols.size;
}
