#!/usr/bin/env tsx
/**
 * Agent validation test for Ariadne - parses Ariadne's own codebase and outputs results
 * in YAML format for LLM/agent validation
 */

import { Project, CallGraph } from "../src";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";

// Output interface for YAML
interface ValidationOutput {
  meta: {
    timestamp: string;
    ariadne_version: string;
    total_files: number;
    total_functions: number;
    total_calls: number;
  };
  top_level_nodes: Array<{
    id: string;
    name: string;
    file: string;
    line: number;
    is_exported: boolean;
    calls_count: number;
    called_by_count: number;
  }>;
  sampled_nodes: Array<{
    node: {
      id: string;
      name: string;
      file: string;
      line: number;
    };
    outgoing_calls: Array<{
      target_id: string;
      target_name: string;
      target_file: string;
      call_line: number;
      call_type?: string;
    }>;
    incoming_calls: Array<{
      source_id: string;
      source_name: string;
      source_file: string;
    }>;
    source_snippet: string;
  }>;
  file_summary: Array<{
    file: string;
    function_count: number;
    exported_function_count: number;
    import_count: number;
  }>;
  validation_stats: {
    nodes_with_calls_pct: number;
    nodes_called_by_others_pct: number;
    exported_nodes_pct: number;
    edges_with_call_type_pct: number;
    top_level_accuracy_pct: number;
  };
}

async function main() {
  console.log("🔍 Starting Ariadne self-analysis for agent validation...");

  const project = new Project();
  
  // Directories to analyze
  const dirsToAnalyze = [
    path.join(__dirname, "../../core/src"),
    path.join(__dirname, "../../types/src")
  ];
  
  console.log("📁 Analyzing directories:");
  dirsToAnalyze.forEach(dir => console.log(`  - ${dir}`));
  
  try {
    // Add all TypeScript/JavaScript files
    let fileCount = 0;
    for (const dir of dirsToAnalyze) {
      if (!fs.existsSync(dir)) continue;
      
      const files = getAllFiles(dir, ['.ts', '.tsx', '.js', '.jsx']);
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        const relativePath = path.relative(path.dirname(dir), file);
        const fileSize = (content.length / 1024).toFixed(1);
        
        // Skip files that are too large for tree-sitter
        if (content.length > 32 * 1024) {
          console.log(`  ⚠️  Skipping: ${relativePath} (${fileSize}KB - exceeds 32KB limit)`);
          continue;
        }
        
        console.log(`  Adding: ${relativePath} (${fileSize}KB)`);
        project.add_or_update_file(relativePath, content);
        console.log(`  ✓ Added: ${relativePath}`);
        fileCount++;
      }
    }
    
    console.log(`\n📊 Added ${fileCount} files to project`);
    
    // Extract call graph
    console.log("\n🔗 Extracting call graph...");
    const callGraph = project.get_call_graph({
      include_external: false
    });
    
    // Calculate statistics
    const stats = {
      totalNodes: callGraph.nodes.size,
      nodesWithCalls: Array.from(callGraph.nodes.values()).filter(n => 
        n.calls.length > 0  // Count nodes with any calls (including built-ins)
      ).length,
      nodesCalledByOthers: Array.from(callGraph.nodes.values()).filter(n =>
        callGraph.edges.some(e => e.to === n.symbol)
      ).length,
      exportedNodes: Array.from(callGraph.nodes.values()).filter(n => n.is_exported).length,
      edgesWithCallType: callGraph.edges.filter(e => e.call_type).length
    };
    
    // Get all function definitions for counting
    let totalFunctions = 0;
    for (const [filePath, scopeGraph] of project.get_all_scope_graphs()) {
      const funcs = project.get_functions_in_file(filePath);
      totalFunctions += funcs.length;
    }
    
    // Create output structure
    const output: ValidationOutput = {
      meta: {
        timestamp: new Date().toISOString(),
        ariadne_version: JSON.parse(fs.readFileSync(path.join(__dirname, "../package.json"), 'utf-8')).version,
        total_files: project.get_all_scope_graphs().size,
        total_functions: totalFunctions,
        total_calls: callGraph.edges.length
      },
      top_level_nodes: [],
      sampled_nodes: [],
      file_summary: [],
      validation_stats: {
        nodes_with_calls_pct: (stats.nodesWithCalls / stats.totalNodes * 100),
        nodes_called_by_others_pct: (stats.nodesCalledByOthers / stats.totalNodes * 100),
        exported_nodes_pct: (stats.exportedNodes / stats.totalNodes * 100),
        edges_with_call_type_pct: (stats.edgesWithCallType / callGraph.edges.length * 100),
        top_level_accuracy_pct: callGraph.top_level_nodes.filter(id => {
          const node = callGraph.nodes.get(id);
          return node && !callGraph.edges.some(e => e.to === id);
        }).length / callGraph.top_level_nodes.length * 100
      }
    };
  
  // Process top-level nodes
  console.log("\n🌳 Identifying top-level nodes...");
  for (const nodeId of callGraph.top_level_nodes) {
    const node = callGraph.nodes.get(nodeId);
    if (!node) continue;
    
    const outgoingCalls = callGraph.edges.filter(e => e.from === nodeId);
    const incomingCalls = callGraph.edges.filter(e => e.to === nodeId);
    
    output.top_level_nodes.push({
      id: nodeId,
      name: node.definition.name,
      file: node.definition.file_path,
      line: node.definition.range?.start?.row ? node.definition.range.start.row + 1 : 0,
      is_exported: node.is_exported,
      calls_count: node.calls.length, // Use node.calls to include built-in calls
      called_by_count: incomingCalls.length
    });
  }
  
  console.log(`  Found ${output.top_level_nodes.length} top-level nodes`);
  
  // Sample some nodes for detailed validation
  console.log("\n🎯 Sampling nodes for detailed analysis...");
  const nodesToSample = [
    ...output.top_level_nodes.slice(0, 3).map(n => n.id), // First 3 top-level
    ...Array.from(callGraph.nodes.keys())
      .filter(id => !callGraph.top_level_nodes.includes(id))
      .slice(0, 5) // 5 non-top-level nodes
  ];
  
  for (const nodeId of nodesToSample) {
    const node = callGraph.nodes.get(nodeId);
    if (!node) continue;
    
    const outgoing = node.calls.map(call => {
      const isBuiltin = call.symbol.startsWith('<builtin>#');
      return {
        target_id: call.symbol,
        target_name: isBuiltin ? call.symbol.replace('<builtin>#', '') : call.resolved_definition?.name || call.symbol,
        target_file: isBuiltin ? '<builtin>' : call.resolved_definition?.file_path || '',
        call_line: call.range.start.row + 1,
        call_type: call.kind === 'method' ? 'method' : 'direct'
      };
    });
    
    const incoming = callGraph.edges
      .filter(e => e.to === nodeId)
      .map(e => {
        const source = callGraph.nodes.get(e.from);
        return source ? {
          source_id: e.from,
          source_name: source.definition.name,
          source_file: source.definition.file_path
        } : null;
      })
      .filter(Boolean) as any[];
    
    // Get source snippet
    let sourceSnippet = "";
    try {
      const sourceResult = project.get_source_with_context(
        node.definition, 
        node.definition.file_path, 
        2
      );
      sourceSnippet = sourceResult.source;
    } catch (e) {
      sourceSnippet = "// Source not available";
    }
    
    output.sampled_nodes.push({
      node: {
        id: nodeId,
        name: node.definition.name,
        file: node.definition.file_path,
        line: node.definition.range?.start?.row ? node.definition.range.start.row + 1 : 0
      },
      outgoing_calls: outgoing,
      incoming_calls: incoming,
      source_snippet: sourceSnippet
    });
  }
  
  console.log(`  Sampled ${output.sampled_nodes.length} nodes`);
  
    // File summary
    console.log("\n📄 Generating file summary...");
    const fileMap = new Map<string, { functions: number; exported: number; imports: number }>();
    
    // Count functions per file
    for (const [filePath, scopeGraph] of project.get_all_scope_graphs()) {
      const funcs = project.get_functions_in_file(filePath);
      const exportedFuncs = funcs.filter(f => {
        const node = callGraph.nodes.get(f.symbol_id);
        return node?.is_exported || false;
      });
      
      fileMap.set(filePath, {
        functions: funcs.length,
        exported: exportedFuncs.length,
        imports: scopeGraph.getImportStatementCount()
      });
    }
    
    // Sort by function count
    const sortedFiles = Array.from(fileMap.entries())
      .sort((a, b) => b[1].functions - a[1].functions);
    
    for (const [file, counts] of sortedFiles) {
      if (counts.functions > 0) {
        output.file_summary.push({
          file: file,
          function_count: counts.functions,
          exported_function_count: counts.exported,
          import_count: counts.imports
        });
      }
    }
    
    console.log("✅ Analysis complete!");
    
    // Write output
    const outputPath = path.join(__dirname, "ariadne-validation-output.yaml");
    const yamlStr = yaml.dump(output, {
      lineWidth: 120,
      noRefs: true,
      sortKeys: false
    });
    
    fs.writeFileSync(outputPath, yamlStr);
    console.log(`\n💾 Output written to: ${outputPath}`);
    
    // Print summary
    console.log("\n📈 Summary:");
    console.log(`  - Total files: ${output.meta.total_files}`);
    console.log(`  - Total functions: ${output.meta.total_functions}`);
    console.log(`  - Total calls: ${output.meta.total_calls}`);
    console.log(`  - Top-level nodes: ${output.top_level_nodes.length}`);
    
    console.log("\n📊 Validation Statistics:");
    console.log(`  - Nodes with outgoing calls: ${stats.nodesWithCalls}/${stats.totalNodes} (${output.validation_stats.nodes_with_calls_pct.toFixed(1)}%)`);
    console.log(`  - Nodes called by others: ${stats.nodesCalledByOthers}/${stats.totalNodes} (${output.validation_stats.nodes_called_by_others_pct.toFixed(1)}%)`);
    console.log(`  - Exported nodes: ${stats.exportedNodes}/${stats.totalNodes} (${output.validation_stats.exported_nodes_pct.toFixed(1)}%)`);
    console.log(`  - Edges with call_type: ${stats.edgesWithCallType}/${callGraph.edges.length} (${output.validation_stats.edges_with_call_type_pct.toFixed(1)}%)`);
    console.log(`  - Top-level accuracy: ${output.validation_stats.top_level_accuracy_pct.toFixed(1)}%`);
    
  } catch (error) {
    console.error("❌ Error during analysis:", error);
    process.exit(1);
  }
}

// Helper function to get all files recursively
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

// Run the validation
main().catch(console.error);