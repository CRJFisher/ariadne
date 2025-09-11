/**
 * Class hierarchy module - Refactored with configuration-driven pattern
 * 
 * Combines generic processing with language-specific bespoke handlers
 * to build class hierarchies across all supported languages.
 */

import {
  ClassDefinition,
  ClassHierarchy,
  Language,
  FilePath
} from '@ariadnejs/types';
import {
  build_generic_class_hierarchy,
  ClassHierarchyContext,
  BespokeHandlers,
  CLASS_HIERARCHY_CONTEXT
} from './class_hierarchy';
import { create_javascript_handlers, create_typescript_handlers } from './class_hierarchy.javascript';
import { create_python_handlers } from './class_hierarchy.python';
import { create_rust_handlers } from './class_hierarchy.rust';

/**
 * Build class hierarchy using configuration-driven processing
 */
export function build_class_hierarchy(
  definitions: ClassDefinition[],
  contexts: Map<FilePath, ClassHierarchyContext>
): ClassHierarchy {
  // Create bespoke handlers for each language
  const handlers = new Map<Language, BespokeHandlers>();
  
  // Register handlers based on languages in contexts
  for (const [_, context] of contexts) {
    if (!handlers.has(context.language)) {
      switch (context.language) {
        case 'javascript':
          handlers.set('javascript', create_javascript_handlers());
          break;
        case 'typescript':
          handlers.set('typescript', create_typescript_handlers());
          break;
        case 'python':
          handlers.set('python', create_python_handlers());
          break;
        case 'rust':
          handlers.set('rust', create_rust_handlers());
          break;
      }
    }
  }
  
  // Use generic processor with bespoke handlers
  return build_generic_class_hierarchy(definitions, contexts, handlers);
}

// Re-export types and context
export { ClassHierarchyContext } from './class_hierarchy';
export { CLASS_HIERARCHY_CONTEXT };
export type { ClassNode, ClassHierarchy, InheritanceEdge } from '@ariadnejs/types';
