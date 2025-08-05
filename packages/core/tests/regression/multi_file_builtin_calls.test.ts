import { Project } from '../../src/index';
import { describe, it, expect } from 'vitest';

describe('Multi-file built-in call tracking regression tests', () => {
  it('should track built-in calls when multiple files are added', () => {
    const project = new Project();
    
    // Add first file with built-in calls
    const file1 = `
      function processData() {
        const items = [];
        items.push(1);
        items.push(2);
        console.log('Processing...');
        return items.join(',');
      }
    `;
    project.add_or_update_file('file1.ts', file1);
    
    // Check calls before adding second file
    let graph = project.get_call_graph({ include_external: false });
    let processData = Array.from(graph.nodes.values()).find(n => n.definition.name === 'processData');
    expect(processData).toBeDefined();
    expect(processData!.calls.length).toBe(4); // 2 push + 1 console.log + 1 join
    
    // Add second file - this used to break built-in tracking
    const file2 = `
      export class DataManager {
        private data: any[] = [];
        
        add(item: any) {
          this.data.push(item);
        }
        
        getAll() {
          return this.data;
        }
      }
    `;
    project.add_or_update_file('file2.ts', file2);
    
    // Check calls after adding second file
    graph = project.get_call_graph({ include_external: false });
    processData = Array.from(graph.nodes.values()).find(n => n.definition.name === 'processData');
    
    // This should still track built-in calls
    expect(processData).toBeDefined();
    
    
    expect(processData!.calls.length).toBeGreaterThan(0); // At least some calls
    
    const builtinCalls = processData!.calls
      .filter(c => c.symbol.startsWith('<builtin>#'))
      .map(c => c.symbol.replace('<builtin>#', ''))
      .sort();
    
    // Should have built-in calls
    expect(builtinCalls.length).toBeGreaterThan(0);
  });
  
  it('should track built-in calls across multiple files', () => {
    const project = new Project();
    
    // Add multiple files at once
    const files = {
      'utils.ts': `
        export function arrayOps() {
          const arr = [1, 2, 3];
          arr.push(4);
          arr.pop();
          return arr.slice(0, 2);
        }
      `,
      'string-utils.ts': `
        export function stringOps(str: string) {
          return str.split(',').map(s => s.trim()).join(';');
        }
      `,
      'json-utils.ts': `
        export function jsonOps(data: any) {
          const json = JSON.stringify(data);
          return JSON.parse(json);
        }
      `
    };
    
    for (const [filename, content] of Object.entries(files)) {
      project.add_or_update_file(filename, content);
    }
    
    const graph = project.get_call_graph({ include_external: false });
    
    // Check arrayOps
    const arrayOps = Array.from(graph.nodes.values()).find(n => n.definition.name === 'arrayOps');
    expect(arrayOps).toBeDefined();
    expect(arrayOps!.calls.length).toBe(3); // push, pop, slice
    
    // Check stringOps
    const stringOps = Array.from(graph.nodes.values()).find(n => n.definition.name === 'stringOps');
    expect(stringOps).toBeDefined();
    expect(stringOps!.calls.length).toBe(4); // split, map, trim (inside map), join
    
    // Check jsonOps
    const jsonOps = Array.from(graph.nodes.values()).find(n => n.definition.name === 'jsonOps');
    expect(jsonOps).toBeDefined();
    expect(jsonOps!.calls.length).toBe(2); // JSON.stringify, JSON.parse
  });
  
  it('should maintain high percentage of nodes with calls in multi-file projects', () => {
    const project = new Project();
    
    // Add a realistic set of files
    const files = {
      'main.ts': `
        import { processData } from './processor';
        import { Logger } from './logger';
        
        function main() {
          const logger = new Logger();
          logger.info('Starting application');
          
          const data = [1, 2, 3, 4, 5];
          const result = processData(data);
          
          console.log('Result:', result);
        }
      `,
      'processor.ts': `
        export function processData(items: number[]) {
          return items
            .filter(n => n > 2)
            .map(n => n * 2)
            .reduce((sum, n) => sum + n, 0);
        }
      `,
      'logger.ts': `
        export class Logger {
          info(message: string) {
            console.log('[INFO]', message);
          }
          
          error(message: string) {
            console.error('[ERROR]', message);
          }
        }
      `
    };
    
    for (const [filename, content] of Object.entries(files)) {
      project.add_or_update_file(filename, content);
    }
    
    const graph = project.get_call_graph({ include_external: false });
    
    // Calculate percentage of nodes with calls
    const nodesWithCalls = Array.from(graph.nodes.values()).filter(n => n.calls.length > 0);
    const percentage = (nodesWithCalls.length / graph.nodes.size) * 100;
    
    // Should maintain a high percentage even with multiple files
    expect(percentage).toBeGreaterThan(80);
  });
});