/**
 * Call chain analysis and traversal
 * 
 * Analyzes sequences of function calls to understand execution flow
 */

import { Language, FunctionCallInfo, MethodCallInfo, ConstructorCallInfo, CallChainNode, CallChain } from '@ariadnejs/types';
import {
  CallChainContext,
  build_call_chains,
  detect_recursion,
  find_paths_between,
  get_longest_chain,
  get_recursive_functions
} from './call_chain_analysis';

// Re-export types and functions from common module
export {
  CallChainNode,
  CallChain,
  CallChainContext,
  build_call_chains,
  detect_recursion,
  find_paths_between,
  get_longest_chain,
  get_recursive_functions
};

