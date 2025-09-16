/**
 * Call chain and call graph analysis types
 */

import { SymbolId, SymbolName } from "./symbols";
import { Location } from "./common";
import { CallInfo } from "./calls";
import { ScopeId } from "./scopes";

/**
 * Node in a call graph representing a function/method
 */
export interface FunctionNode {
  readonly symbol_id: SymbolId;
  readonly name: SymbolName;
  readonly enclosed_calls: readonly EnclosedCall[];
  readonly location: Location;
}

/**
 * Edge in a call graph representing a call relationship
 */
export interface EnclosedCall {
  readonly location: Location;
  // readonly scope_id: ScopeId; // TODO: implement so we can 
  readonly call: CallInfo;
}

/**
 * Complete call graph structure
 */
export interface CallGraph {
  readonly nodes: ReadonlyMap<SymbolId, FunctionNode>;
  readonly entry_points: readonly SymbolId[];
}
