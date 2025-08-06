#!/usr/bin/env tsx
/**
 * Outputs Ariadne's API methods and call graph in YAML format for validation
 */

import { Project } from "../src/index";
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
  const project = new Project();
  
  // Analyze Ariadne's source
  const srcDir = path.join(__dirname, "../src");
  const files = getAllFiles(srcDir, ['.ts', '.js']);
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    if (content.length > 32 * 1024) continue; // Skip large files
    
    const relativePath = path.relative(path.dirname(srcDir), file);
    project.add_or_update_file(relativePath, content);
  }
  
  // Get all definitions from Project class file
  const projectDefs = project.get_definitions("src/project/project.ts");
  const callGraph = project.get_call_graph({ include_external: false });
  
  // Build output
  const output: ValidationOutput = {
    meta: {
      timestamp: new Date().toISOString(),
      ariadne_version: JSON.parse(fs.readFileSync(path.join(__dirname, "../package.json"), 'utf-8')).version,
      total_files: project.get_all_scope_graphs().size,
      total_functions: Array.from(callGraph.nodes.values()).length,
      total_calls: callGraph.edges.length
    },
    api_methods: [],
    sampled_functions: []
  };
  
  // Extract Project class methods
  for (const def of projectDefs) {
    if (def.symbol_kind === 'method' || def.symbol_kind === 'function') {
      const node = callGraph.nodes.get(def.symbol_id);
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
  const sampledNodes = Array.from(callGraph.nodes.values()).slice(0, 10);
  for (const node of sampledNodes) {
    const outgoing = node.calls
      .filter(c => !c.symbol.startsWith('<builtin>#'))
      .map(c => c.resolved_definition?.name || c.symbol);
    
    const incoming = callGraph.edges
      .filter(e => e.to === node.symbol)
      .map(e => callGraph.nodes.get(e.from)?.definition.name || e.from);
    
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

function getAllFiles(dir: string, extensions: string[]): string[] {
  const files: string[] = [];
  
  function traverse(currentPath: string) {
    const entries = fs.readdirSync(currentPath);
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
        traverse(fullPath);
      } else if (stat.isFile() && extensions.some(ext => entry.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

main();