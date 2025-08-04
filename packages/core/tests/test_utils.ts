import { Project } from "../src/index";
import { ScopeGraph, Def, Ref, Import, Scope } from "../src/graph";

export interface ScopeDebug {
  definitions: DefDebug[];
  imports: ImportDebug[];
  references: RefDebug[];
  child_scopes: ScopeDebug[];
}

export interface DefDebug {
  name: string;
  kind: string;
  context: string;
  referenced_in: string[];
}

export interface ImportDebug {
  name: string;
  context: string;
  referenced_in: string[];
}

export interface RefDebug {
  name: string;
  context: string;
}

export function debug_scope_graph(
  graph: ScopeGraph,
  source_code: string
): ScopeDebug {
  const lines = source_code.split("\n");

  // Helper to get context string with highlighted name
  const get_context = (range: any, name: string): string => {
    const line = lines[range.start.row] || "";
    const before = line.substring(0, range.start.column);
    const after = line.substring(range.end.column);

    // Find the name in the line and highlight it with §
    const name_index = line.indexOf(name, range.start.column);
    if (name_index >= 0) {
      const highlighted =
        line.substring(0, name_index) +
        "§" +
        name +
        "§" +
        line.substring(name_index + name.length);
      return highlighted.trim();
    }

    return `${before}§${name}§${after}`.trim();
  };

  // Get all nodes by type
  const scopes = graph.getNodes<Scope>("scope");
  const defs = graph.getNodes<Def>("definition");
  const imports = graph.getNodes<Import>("import");
  const refs = graph.getNodes<Ref>("reference");

  // Find root scope
  const root_scope = scopes.find((s) => s.id === 0);
  if (!root_scope) throw new Error("No root scope found");

  // Build scope tree
  const build_scope_debug = (scope_id: number): ScopeDebug => {
    // Find definitions in this scope
    const scope_defs = defs.filter((def) => {
      const edges = graph.getEdges("def_to_scope");
      return edges.some(
        (e) => e.source_id === def.id && e.target_id === scope_id
      );
    });

    // Find imports in this scope
    const scope_imports = imports.filter((imp) => {
      const edges = graph.getEdges("import_to_scope");
      return edges.some(
        (e) => e.source_id === imp.id && e.target_id === scope_id
      );
    });

    // Build definition debug info
    const def_debugs: DefDebug[] = scope_defs.map((def) => {
      // Find references to this definition
      const def_refs = graph.getRefsForDef(def.id);
      const ref_contexts = def_refs.map((ref) =>
        get_context(ref.range, ref.name)
      );

      return {
        name: def.name,
        kind: def.symbol_kind,
        context: get_context(def.range, def.name),
        referenced_in: ref_contexts,
      };
    });

    // Build import debug info
    const import_debugs: ImportDebug[] = scope_imports.map((imp) => {
      // Find references to this import
      const import_refs = refs.filter((ref) => {
        const edges = graph.getEdges("ref_to_import");
        return edges.some(
          (e) => e.source_id === ref.id && e.target_id === imp.id
        );
      });
      const ref_contexts = import_refs.map((ref) =>
        get_context(ref.range, ref.name)
      );

      return {
        name: imp.name,
        context: get_context(imp.range, imp.name),
        referenced_in: ref_contexts,
      };
    });

    // Find child scopes
    const child_scopes = scopes.filter((child) => {
      const edges = graph.getEdges("scope_to_scope");
      return edges.some(
        (e) => e.source_id === child.id && e.target_id === scope_id
      );
    });

    // Recursively build child scope debug info
    const child_debugs = child_scopes.map((child) =>
      build_scope_debug(child.id)
    );

    // Find references in this scope that aren't to definitions or imports (orphaned)
    const scope_refs = refs.filter((ref) => {
      // Check if reference belongs to this scope
      const ref_edges = graph.getEdges("ref_to_scope");
      const in_this_scope = ref_edges.some(
        (e) => e.source_id === ref.id && e.target_id === scope_id
      );
      if (!in_this_scope) return false;
      
      // Check if reference has a target (definition or import)
      const def_edges = graph.getEdges("ref_to_def");
      const imp_edges = graph.getEdges("ref_to_import");
      const has_target =
        def_edges.some((e) => e.source_id === ref.id) ||
        imp_edges.some((e) => e.source_id === ref.id);
      return !has_target;
    });

    const ref_debugs: RefDebug[] = scope_refs.map((ref) => ({
      name: ref.name,
      context: get_context(ref.range, ref.name),
    }));

    return {
      definitions: def_debugs,
      imports: import_debugs,
      references: ref_debugs,
      child_scopes: child_debugs,
    };
  };

  return build_scope_debug(root_scope.id);
}

export function test_scopes(
  language: string,
  source_code: string,
  expected: ScopeDebug
): void {
  const project = new Project();
  const file_path = `test.${language === "TypeScript" ? "ts" : "js"}`;

  project.add_or_update_file(file_path, source_code);

  const graph = (project as any).file_graphs.get(file_path);
  if (!graph) throw new Error("No graph found for file");

  const actual = debug_scope_graph(graph, source_code);

  // Normalize the debug output for comparison
  const normalize = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.map(normalize).sort((a, b) => {
        const aStr = JSON.stringify(a);
        const bStr = JSON.stringify(b);
        return aStr.localeCompare(bStr);
      });
    } else if (obj && typeof obj === "object") {
      const sorted: any = {};
      Object.keys(obj)
        .sort()
        .forEach((key) => {
          sorted[key] = normalize(obj[key]);
        });
      return sorted;
    }
    return obj;
  };

  expect(normalize(actual)).toEqual(normalize(expected));
}
