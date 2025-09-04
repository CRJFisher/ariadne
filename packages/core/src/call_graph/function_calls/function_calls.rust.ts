/**
 * Rust-specific bespoke features
 * 
 * Only contains features that cannot be expressed through configuration
 */

import { FunctionCallContext } from './function_calls';
import { FunctionCallInfo } from '@ariadnejs/types';

/**
 * Handle Rust macros (bespoke feature export for generic processor)
 * 
 * Note: Rust macro handling is already done in the generic processor
 * through configuration. This export is kept for compatibility but
 * returns an empty array as the generic processor handles macros.
 */
export function handle_rust_macros(
  context: FunctionCallContext
): FunctionCallInfo[] {
  // Macros are already handled by the generic processor using configuration
  // This function exists for API consistency but doesn't need to do anything
  return [];
}