/**
 * Call chain analysis and traversal
 * 
 * Analyzes sequences of function calls to understand execution flow
 */

import { Language } from '@ariadnejs/types';
import { FunctionCallInfo } from '../function_calls';
import { MethodCallInfo } from '../method_calls';
import { ConstructorCallInfo } from '../constructor_calls';
import {
  CallChainNode,
  CallChain,
  CallChainContext,
  CallChainAnalysisResult,
  build_call_chains,
  detect_recursion,
  find_paths_between,
  get_longest_chain,
  get_recursive_functions,
  analyze_call_graph
} from './call_chain_analysis';

// Re-export types and functions from common module
export {
  CallChainNode,
  CallChain,
  CallChainContext,
  CallChainAnalysisResult,
  build_call_chains,
  detect_recursion,
  find_paths_between,
  get_longest_chain,
  get_recursive_functions,
  analyze_call_graph
};

/**
 * Analyze call chains from mixed call types
 * 
 * This is the main entry point that combines function, method, and constructor calls
 * to build a complete picture of the call chain.
 * 
 * @param function_calls Array of function calls
 * @param method_calls Array of method calls
 * @param constructor_calls Array of constructor calls
 * @param context Analysis context with options
 * @returns Complete call chain analysis
 */
export function analyze_call_chains(
  function_calls: FunctionCallInfo[],
  method_calls: MethodCallInfo[],
  constructor_calls: ConstructorCallInfo[],
  context: CallChainContext
): CallChainAnalysisResult {
  // Combine all calls
  const all_calls = [
    ...function_calls,
    ...method_calls,
    ...constructor_calls
  ];
  
  return build_call_chains(all_calls, context);
}

/**
 * Analyze call chains from a single file
 */
export function analyze_file_call_chains(
  file_path: string,
  function_calls: FunctionCallInfo[],
  method_calls: MethodCallInfo[],
  constructor_calls: ConstructorCallInfo[],
  language: Language,
  options?: {
    max_depth?: number;
    track_recursion?: boolean;
  }
): CallChainAnalysisResult {
  // Filter calls from this file
  const file_function_calls = function_calls.filter(c => c.file_path === file_path);
  const file_method_calls = method_calls.filter(c => c.file_path === file_path);
  const file_constructor_calls = constructor_calls.filter(c => c.file_path === file_path);
  
  const context: CallChainContext = {
    language,
    max_depth: options?.max_depth || 10,
    track_recursion: options?.track_recursion !== false
  };
  
  return analyze_call_chains(
    file_function_calls,
    file_method_calls,
    file_constructor_calls,
    context
  );
}

/**
 * Find call chains starting from a specific function
 */
export function find_chains_from_function(
  function_name: string,
  function_calls: FunctionCallInfo[],
  method_calls: MethodCallInfo[],
  constructor_calls: ConstructorCallInfo[],
  language: Language,
  max_depth: number = 10
): CallChain[] {
  const context: CallChainContext = {
    language,
    max_depth,
    track_recursion: true
  };
  
  const result = analyze_call_chains(
    function_calls,
    method_calls,
    constructor_calls,
    context
  );
  
  // Filter chains that start with the specified function
  return result.chains.filter(chain => chain.root === function_name);
}

/**
 * Find all recursive call chains
 */
export function find_recursive_chains(
  function_calls: FunctionCallInfo[],
  method_calls: MethodCallInfo[],
  constructor_calls: ConstructorCallInfo[],
  language: Language
): CallChain[] {
  const context: CallChainContext = {
    language,
    max_depth: 20, // Higher depth to find deeper recursions
    track_recursion: true
  };
  
  const result = analyze_call_chains(
    function_calls,
    method_calls,
    constructor_calls,
    context
  );
  
  return result.recursive_chains;
}

/**
 * Get call chain statistics
 */
export interface CallChainStats {
  total_chains: number;
  recursive_chains: number;
  max_depth: number;
  average_depth: number;
  total_unique_functions: number;
  functions_with_recursion: number;
}

export function get_call_chain_stats(
  result: CallChainAnalysisResult
): CallChainStats {
  const all_functions = new Set<string>();
  let total_depth = 0;
  
  for (const chain of result.chains) {
    all_functions.add(chain.root);
    for (const node of chain.nodes) {
      all_functions.add(node.caller);
      all_functions.add(node.callee);
      total_depth += node.depth;
    }
  }
  
  const recursive_functions = get_recursive_functions(result.recursive_chains);
  
  return {
    total_chains: result.chains.length,
    recursive_chains: result.recursive_chains.length,
    max_depth: result.max_chain_depth,
    average_depth: result.chains.length > 0 
      ? total_depth / result.chains.reduce((sum, c) => sum + c.nodes.length, 0)
      : 0,
    total_unique_functions: all_functions.size,
    functions_with_recursion: recursive_functions.size
  };
}

/**
 * Format call chain for display
 */
export function format_call_chain(
  chain: CallChain,
  options?: {
    show_location?: boolean;
    indent?: string;
  }
): string {
  const indent = options?.indent || '  ';
  const lines: string[] = [];
  
  lines.push(`Root: ${chain.root}`);
  
  if (chain.is_recursive) {
    lines.push(`⚠️ Recursive chain detected at: ${chain.cycle_point}`);
  }
  
  for (const node of chain.nodes) {
    const depth_indent = indent.repeat(node.depth);
    let line = `${depth_indent}${node.caller} → ${node.callee}`;
    
    if (options?.show_location) {
      line += ` (${node.file_path}:${node.location.row}:${node.location.column})`;
    }
    
    lines.push(line);
  }
  
  lines.push(`Max depth: ${chain.max_depth}`);
  
  return lines.join('\n');
}

/**
 * Export call chains to JSON
 */
export function export_call_chains_to_json(
  result: CallChainAnalysisResult
): string {
  return JSON.stringify({
    chains: result.chains,
    recursive_chains: result.recursive_chains,
    max_chain_depth: result.max_chain_depth,
    call_graph: Array.from(result.call_graph.entries()).map(([caller, callees]) => ({
      caller,
      callees: Array.from(callees)
    }))
  }, null, 2);
}

/**
 * Create a Graphviz DOT representation of call chains
 */
export function export_call_chains_to_dot(
  result: CallChainAnalysisResult,
  options?: {
    highlight_recursive?: boolean;
    cluster_by_file?: boolean;
  }
): string {
  const lines: string[] = [];
  lines.push('digraph CallChains {');
  lines.push('  rankdir=TB;');
  lines.push('  node [shape=box];');
  
  // Add nodes
  const all_nodes = new Set<string>();
  for (const [caller, callees] of result.call_graph.entries()) {
    all_nodes.add(caller);
    for (const callee of callees) {
      all_nodes.add(callee);
    }
  }
  
  // Identify recursive functions
  const recursive_functions = get_recursive_functions(result.recursive_chains);
  
  // Add node declarations
  for (const node of all_nodes) {
    if (options?.highlight_recursive && recursive_functions.has(node)) {
      lines.push(`  "${node}" [style=filled, fillcolor=lightcoral];`);
    } else {
      lines.push(`  "${node}";`);
    }
  }
  
  // Add edges
  for (const [caller, callees] of result.call_graph.entries()) {
    for (const callee of callees) {
      if (caller === callee) {
        // Self-recursion
        lines.push(`  "${caller}" -> "${callee}" [color=red, style=bold];`);
      } else if (recursive_functions.has(caller) && recursive_functions.has(callee)) {
        // Part of recursive cycle
        lines.push(`  "${caller}" -> "${callee}" [color=orange];`);
      } else {
        lines.push(`  "${caller}" -> "${callee}";`);
      }
    }
  }
  
  lines.push('}');
  return lines.join('\n');
}