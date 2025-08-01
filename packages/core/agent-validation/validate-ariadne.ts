#!/usr/bin/env tsx
/**
 * Agent validation test for Ariadne - parses Ariadne's own codebase and outputs results
 * in YAML format for LLM/agent validation
 */

import { Project, get_call_graph } from "../src/index";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

interface AgentValidationOutput {
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
}

async function validateAriadneCodebase(): Promise<AgentValidationOutput> {
  console.log("🔍 Starting Ariadne self-analysis for agent validation...");
  
  // Get the root directory (3 levels up from agent-validation folder)
  const rootDir = path.resolve(__dirname, "..", "..", "..");
  const coreDir = path.join(rootDir, "packages", "core", "src");
  const typesDir = path.join(rootDir, "packages", "types", "src");
  
  console.log(`📁 Analyzing directories:\n  - ${coreDir}\n  - ${typesDir}`);
  
  // Create project and add all TypeScript files
  const project = new Project();
  let fileCount = 0;
  
  // Helper to recursively add files
  const addFilesFromDir = (dir: string, baseDir: string) => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory() && !file.startsWith(".") && file !== "node_modules") {
        addFilesFromDir(filePath, baseDir);
      } else if (file.endsWith(".ts") && !file.endsWith(".test.ts") && !file.endsWith(".d.ts")) {
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          const relativePath = path.relative(baseDir, filePath);
          const sizeKB = content.length / 1024;
          
          if (sizeKB > 32) {
            console.log(`  ⚠️  Skipping ${relativePath} (${sizeKB.toFixed(1)}KB > 32KB limit)`);
            continue;
          }
          
          console.log(`  Adding: ${relativePath} (${sizeKB.toFixed(1)}KB)`);
          project.add_or_update_file(relativePath, content);
          fileCount++;
          console.log(`  ✓ Added: ${relativePath}`);
        } catch (e) {
          console.error(`  ❌ Failed to add ${filePath}: ${e}`);
        }
      }
    }
  };
  
  addFilesFromDir(coreDir, coreDir);
  addFilesFromDir(typesDir, typesDir);
  
  console.log(`\n📊 Added ${fileCount} files to project`);
  
  // Extract call graph
  console.log("\n🔗 Extracting call graph...");
  const callGraph = project.get_call_graph({
    include_external: false,
    max_depth: 10
  });
  
  // Read version from package.json
  let version = "unknown";
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8"));
    version = packageJson.version;
  } catch (e) {
    // Use fallback
  }
  
  // Prepare output data
  const output: AgentValidationOutput = {
    meta: {
      timestamp: new Date().toISOString(),
      ariadne_version: version,
      total_files: fileCount,
      total_functions: callGraph.nodes.size,
      total_calls: callGraph.edges.length
    },
    top_level_nodes: [],
    sampled_nodes: [],
    file_summary: []
  };
  
  // Process top-level nodes
  console.log("\n🌳 Identifying top-level nodes...");
  for (const nodeId of callGraph.top_level_nodes) {
    const node = callGraph.nodes.get(nodeId);
    if (!node) continue;
    
    const outgoingCalls = callGraph.edges.filter(e => e.source === nodeId);
    const incomingCalls = callGraph.edges.filter(e => e.target === nodeId);
    
    output.top_level_nodes.push({
      id: nodeId,
      name: node.name,
      file: node.file_path,
      line: node.range?.start?.row ? node.range.start.row + 1 : 0,
      is_exported: node.is_exported || false,
      calls_count: outgoingCalls.length,
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
    
    const outgoing = callGraph.edges
      .filter(e => e.source === nodeId)
      .map(e => {
        const target = callGraph.nodes.get(e.target);
        return target ? {
          target_id: e.target,
          target_name: target.name,
          target_file: target.file_path,
          call_line: e.location?.row ? e.location.row + 1 : 0
        } : null;
      })
      .filter(Boolean) as any[];
    
    const incoming = callGraph.edges
      .filter(e => e.target === nodeId)
      .map(e => {
        const source = callGraph.nodes.get(e.source);
        return source ? {
          source_id: e.source,
          source_name: source.name,
          source_file: source.file_path
        } : null;
      })
      .filter(Boolean) as any[];
    
    // Get source snippet
    let sourceSnippet = "";
    try {
      const functions = project.get_functions_in_file(node.file_path);
      const func = functions.find(f => f.name === node.name);
      if (func) {
        sourceSnippet = project.get_source_with_context(func, node.file_path, 2);
      }
    } catch (e) {
      sourceSnippet = "// Could not extract source";
    }
    
    output.sampled_nodes.push({
      node: {
        id: nodeId,
        name: node.name,
        file: node.file_path,
        line: node.range?.start?.row ? node.range.start.row + 1 : 0
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
  
  for (const [nodeId, node] of callGraph.nodes) {
    if (!fileMap.has(node.file_path)) {
      fileMap.set(node.file_path, { functions: 0, exported: 0, imports: 0 });
    }
    const stats = fileMap.get(node.file_path)!;
    stats.functions++;
    if (node.is_exported) stats.exported++;
  }
  
  // Count imports per file
  for (const [filePath, _] of fileMap) {
    try {
      const imports = project.get_scope_graph(filePath)?.getAllImports() || [];
      fileMap.get(filePath)!.imports = imports.length;
    } catch (e) {
      // Ignore errors
    }
  }
  
  for (const [file, stats] of fileMap) {
    output.file_summary.push({
      file,
      function_count: stats.functions,
      exported_function_count: stats.exported,
      import_count: stats.imports
    });
  }
  
  output.file_summary.sort((a, b) => b.function_count - a.function_count);
  
  console.log("✅ Analysis complete!");
  return output;
}

async function main() {
  try {
    const output = await validateAriadneCodebase();
    
    // Write YAML output
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
    
  } catch (error) {
    console.error("❌ Error during analysis:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { validateAriadneCodebase, AgentValidationOutput };