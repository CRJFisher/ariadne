export { startServer } from './start_server';

// Re-export types that might be useful for consumers
export type { AriadneMCPServerOptions } from './start_server';

// Export the new context-oriented tools
export { 
  getSymbolContext, 
  getSymbolContextSchema,
  type GetSymbolContextRequest,
  type GetSymbolContextResponse,
  type SymbolContext,
  type SymbolInfo,
  type DefinitionInfo,
  type UsageInfo,
  type RelationshipInfo,
  type MetricsInfo
} from './tools/get_symbol_context';