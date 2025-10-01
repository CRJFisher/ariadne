/**
 * Symbol Resolution - Multi-phase symbol and type resolution
 *
 * Resolves all symbol references through a four-phase pipeline:
 * 1. Import/Export Resolution - Cross-file symbol mapping
 * 2. Function Call Resolution - Direct function calls via lexical scope
 * 3. Type Resolution - Type tracking and flow analysis
 * 4. Method/Constructor Resolution - Object-oriented call resolution
 */

export { resolve_symbols } from "./symbol_resolution";
