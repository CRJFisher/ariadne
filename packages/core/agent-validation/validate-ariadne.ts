#!/usr/bin/env tsx
/**
 * Outputs Ariadne's API methods and call graph in YAML format for validation
 */

import fs from "fs";
import path from "path";
import yaml from "js-yaml";

interface ValidationOutput {
  meta: {
    timestamp: string;
    ariadne_version: string;
    total_files: number;
    total_functions: number;
    total_calls: number;
  };
  api_methods: Array<{
    name: string;
    file: string;
    line: number;
    is_exported: boolean;
    symbol_kind: string;
  }>;
  sampled_functions: Array<{
    name: string;
    file: string;
    line: number;
    calls: string[];
    called_by: string[];
  }>;
}

function main() {
  
  // Analyze Ariadne's source
  const src_dir = path.join(__dirname, "../src");
  const files = get_all_files(src_dir, ['.ts', '.js']);
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    if (content.length > 32 * 1024) continue; // Skip large files
    
    const relative_path = path.relative(path.dirname(src_dir), file);
    project.add_or_update_file(relative_path, content);
  }
  
  // Get all definitions from Project class file
  const project_defs = project.get_definitions("src/project/project.ts");
  const call_graph = project.get_call_graph({ include_external: false });
  
  // Build output
  const output: ValidationOutput = {
    meta: {
      timestamp: new Date().toISOString(),
      ariadne_version: JSON.parse(fs.readFileSync(path.join(__dirname, "../package.json"), 'utf-8')).version,
      total_files: project.get_all_scope_graphs().size,
      total_functions: Array.from(call_graph.nodes.values()).length,
      total_calls: call_graph.edges.length
    },
    api_methods: [],
    sampled_functions: []
  };
  
  // Extract Project class methods
  for (const def of project_defs) {
    if (def.symbol_kind === 'method' || def.symbol_kind === 'function') {
      const node = call_graph.nodes.get(def.symbol_id);
      output.api_methods.push({
        name: def.name,
        file: def.file_path,
        line: def.range.start.row + 1,
        is_exported: node?.is_exported || false,
        symbol_kind: def.symbol_kind
      });
    }
  }
  
  // Sample some functions for validation
  const sampled_nodes = Array.from(call_graph.nodes.values()).slice(0, 10);
  for (const node of sampled_nodes) {
    const outgoing = node.calls
      .filter(c => !c.symbol.startsWith('<builtin>#'))
      .map(c => c.resolved_definition?.name || c.symbol);
    
    const incoming = call_graph.edges
      .filter(e => e.to === node.symbol)
      .map(e => call_graph.nodes.get(e.from)?.definition.name || e.from);
    
    output.sampled_functions.push({
      name: node.definition.name,
      file: node.definition.file_path,
      line: node.definition.range.start.row + 1,
      calls: outgoing,
      called_by: incoming
    });
  }
  
  // Output YAML
  console.log(yaml.dump(output, {
    lineWidth: 120,
    noRefs: true,
    sortKeys: false
  }));
}

function get_all_files(dir: string, extensions: string[]): string[] {
  const files: string[] = [];
  
  function traverse(current_path: string) {
    const entries = fs.readdirSync(current_path);
    
    for (const entry of entries) {
      const full_path = path.join(current_path, entry);
      const stat = fs.statSync(full_path);
      
      if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
        traverse(full_path);
      } else if (stat.isFile() && extensions.some(ext => entry.endsWith(ext))) {
        files.push(full_path);
      }
    }
  }
  
  traverse(dir);
  return files;
}

main();