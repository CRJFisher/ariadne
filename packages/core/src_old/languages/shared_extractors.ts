import { SyntaxNode } from 'tree-sitter';
import { ExtractedContext } from '../types';

/**
 * Extract JSDoc comments and decorators for JavaScript/TypeScript
 */
export function extract_jsdoc_context(
  node: SyntaxNode,
  source_lines: string[],
  start_line: number
): ExtractedContext {
  const context: ExtractedContext = {};
  
  // Extract JSDoc comments before the definition
  let line_index = start_line - 1;
  const js_doc_lines: string[] = [];
  let in_js_doc = false;
  
  while (line_index >= 0) {
    const line = source_lines[line_index];
    const trimmed_line = line.trim();
    
    if (trimmed_line.endsWith('*/')) {
      in_js_doc = true;
      js_doc_lines.unshift(line);
    } else if (in_js_doc && trimmed_line.startsWith('/**')) {
      js_doc_lines.unshift(line);
      // Extract JSDoc content
      const js_doc_text = js_doc_lines.join('\n');
      const start_idx = js_doc_text.indexOf('/**') + 3;
      const end_idx = js_doc_text.lastIndexOf('*/');
      context.docstring = js_doc_text.substring(start_idx, end_idx)
        .split('\n')
        .map(line => line.trim().replace(/^\* ?/, ''))
        .filter(line => line.length > 0)
        .join('\n')
        .trim();
      break;
    } else if (in_js_doc) {
      js_doc_lines.unshift(line);
    } else if (trimmed_line === '') {
      // Skip empty lines when not in JSDoc
      line_index--;
      continue;
    } else {
      // Non-empty, non-JSDoc line - stop searching
      break;
    }
    line_index--;
  }
  
  // Extract decorators (TypeScript experimental decorators)
  const decorators: string[] = [];
  line_index = start_line - 1;
  while (line_index >= 0) {
    const line = source_lines[line_index].trim();
    if (line.startsWith('@') && !line.includes('/**')) {
      decorators.unshift(line);
      line_index--;
    } else if (line === '' || line.endsWith('*/')) {
      // Skip empty lines or JSDoc end
      line_index--;
    } else {
      // Stop at first non-decorator line
      break;
    }
  }
  if (decorators.length > 0) {
    context.decorators = decorators;
  }
  
  return context;
}