/**
 * Call chain analysis and traversal
 * 
 * Analyzes sequences of function calls to understand execution flow
 */

import { Language, FunctionCall, MethodCall, ConstructorCall, CallChainNode, CallChain, CallInfo } from '@ariadnejs/types';
import {
  CallChainContext,
  analyze_call_chains,
  build_call_chains,
  detect_recursion,
  find_paths_between,
  get_longest_chain,
  get_recursive_functions,
  create_call_graph
} from './call_chain_analysis';

// Re-export types and functions from common module
export {
  CallChainNode,
  CallChain,
  CallChainContext,
  analyze_call_chains,
  build_call_chains,
  detect_recursion,
  find_paths_between,
  get_longest_chain,
  get_recursive_functions,
  create_call_graph
};

