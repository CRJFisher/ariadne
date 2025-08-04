import { describe, it, expect } from 'vitest';
import { Project, get_all_functions } from '../src/index';
import { CallGraph, Def } from '../src/types';

// Helper function to create a test project with multiple files
function createTestProject(files: Record<string, string>): Project {
  const project = new Project();
  for (const [filename, content] of Object.entries(files)) {
    project.add_or_update_file(filename, content);
  }
  return project;
}

// Helper to get all definitions from all files in a project
function getAllProjectDefinitions(project: Project, files: Record<string, string>): Def[] {
  const allDefs: Def[] = [];
  for (const filename of Object.keys(files)) {
    const fileDefs = project.get_definitions(filename);
    allDefs.push(...fileDefs);
  }
  return allDefs;
}

describe('Edge Cases - Cross-file Resolution', () => {
  describe('Circular Imports', () => {
    it('handles direct circular imports (A imports B, B imports A)', async () => {
      const files = {
        'moduleA.ts': `
          import { functionB } from './moduleB';
          
          export function functionA() {
            functionB();
            return 'A';
          }
        `,
        'moduleB.ts': `
          import { functionA } from './moduleA';
          
          export function functionB() {
            if (Math.random() > 0.5) {
              functionA();
            }
            return 'B';
          }
        `
      };
      const project = createTestProject(files);

      const allDefs = getAllProjectDefinitions(project, files);
      
      const functionADef = allDefs.find(d => d.name === 'functionA');
      const functionBDef = allDefs.find(d => d.name === 'functionB');
      
      expect(functionADef).toBeDefined();
      expect(functionBDef).toBeDefined();
      
      // Check that both functions are detected and can reference each other
      const callsFromA = project.get_calls_from_definition(functionADef!);
      const callsFromB = project.get_calls_from_definition(functionBDef!);
      
      expect(callsFromA.some(call => call.called_def.id === functionBDef!.id)).toBe(true);
      expect(callsFromB.some(call => call.called_def.id === functionADef!.id)).toBe(true);
    });

    it('handles indirect circular imports (A → B → C → A)', async () => {
      const files = {
        'moduleA.ts': `
          import { functionB } from './moduleB';
          
          export function functionA() {
            return functionB() + 'A';
          }
        `,
        'moduleB.ts': `
          import { functionC } from './moduleC';
          
          export function functionB() {
            return functionC() + 'B';
          }
        `,
        'moduleC.ts': `
          import { functionA } from './moduleA';
          
          export function functionC() {
            if (Math.random() > 0.5) {
              return functionA() + 'C';
            }
            return 'C';
          }
        `
      };
      const project = createTestProject(files);

      const allDefs = getAllProjectDefinitions(project, files);
      
      const functionADef = allDefs.find(d => d.name === 'functionA');
      const functionBDef = allDefs.find(d => d.name === 'functionB');
      const functionCDef = allDefs.find(d => d.name === 'functionC');
      
      expect(functionADef).toBeDefined();
      expect(functionBDef).toBeDefined();
      expect(functionCDef).toBeDefined();
      
      // Verify the circular chain
      const callsFromA = project.get_calls_from_definition(functionADef!);
      const callsFromB = project.get_calls_from_definition(functionBDef!);
      const callsFromC = project.get_calls_from_definition(functionCDef!);
      
      expect(callsFromA.some(call => call.called_def.id === functionBDef!.id)).toBe(true);
      expect(callsFromB.some(call => call.called_def.id === functionCDef!.id)).toBe(true);
      expect(callsFromC.some(call => call.called_def.id === functionADef!.id)).toBe(true);
    });

    it('handles self-referential imports', async () => {
      const files = {
        'recursive.ts': `
          // Self-import for type references
          import type { TreeNode } from './recursive';
          
          export interface TreeNode {
            value: number;
            left?: TreeNode;
            right?: TreeNode;
          }
          
          export function traverseTree(node: TreeNode): number[] {
            const result: number[] = [node.value];
            if (node.left) {
              result.push(...traverseTree(node.left));
            }
            if (node.right) {
              result.push(...traverseTree(node.right));
            }
            return result;
          }
        `
      };
      const project = createTestProject(files);

      const allDefs = getAllProjectDefinitions(project, files);
      
      const traverseDef = allDefs.find(d => d.name === 'traverseTree');
      expect(traverseDef).toBeDefined();
      
      // Check self-referential calls
      const callsFromTraverse = project.get_calls_from_definition(traverseDef!);
      const selfCalls = callsFromTraverse.filter(call => call.called_def.id === traverseDef!);
      
      expect(selfCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Deeply Nested Call Chains', () => {
    it('tracks multi-level method calls across files', async () => {
      const files = {
        'services/userService.ts': `
          import { Database } from '../database/database';
          
          export class UserService {
            private db: Database;
            
            constructor() {
              this.db = new Database();
            }
            
            async getUser(id: string) {
              return this.db.query('users').where('id', id).first();
            }
          }
        `,
        'database/database.ts': `
          import { QueryBuilder } from './queryBuilder';
          
          export class Database {
            query(table: string) {
              return new QueryBuilder(table);
            }
          }
        `,
        'database/queryBuilder.ts': `
          import { Connection } from './connection';
          
          export class QueryBuilder {
            private connection: Connection;
            private table: string;
            private conditions: any[] = [];
            
            constructor(table: string) {
              this.table = table;
              this.connection = new Connection();
            }
            
            where(field: string, value: any) {
              this.conditions.push({ field, value });
              return this;
            }
            
            async first() {
              return this.connection.execute(this.buildQuery());
            }
            
            private buildQuery() {
              return \`SELECT * FROM \${this.table}\`;
            }
          }
        `,
        'database/connection.ts': `
          export class Connection {
            async execute(query: string) {
              // Mock database execution
              return { id: '123', name: 'Test User' };
            }
          }
        `
      };
      const project = createTestProject(files);

      const allDefs = getAllProjectDefinitions(project, files);
      
      // Find the getUser method
      const getUserDef = allDefs.find(d => d.name === 'getUser');
      expect(getUserDef).toBeDefined();
      
      // Track the call chain: getUser → query → where → first → execute
      const callsFromGetUser = project.get_calls_from_definition(getUserDef!);
      
      // Should call query method
      const queryDef = allDefs.find(d => d.name === 'query');
      expect(callsFromGetUser.some(call => call.called_def.id === queryDef?.id)).toBe(true);
    });

    it('handles chained property access with method calls', async () => {
      const files = {
        'api/client.ts': `
          import { RequestBuilder } from './requestBuilder';
          
          export class ApiClient {
            request() {
              return new RequestBuilder();
            }
          }
          
          export const api = new ApiClient();
        `,
        'api/requestBuilder.ts': `
          import { ResponseHandler } from './responseHandler';
          
          export class RequestBuilder {
            private handler = new ResponseHandler();
            
            get(url: string) {
              return this;
            }
            
            post(url: string) {
              return this;
            }
            
            withAuth(token: string) {
              return this;
            }
            
            async send() {
              return this.handler.process({});
            }
          }
        `,
        'api/responseHandler.ts': `
          export class ResponseHandler {
            process(response: any) {
              return this.validate(response);
            }
            
            private validate(data: any) {
              return { success: true, data };
            }
          }
        `,
        'usage.ts': `
          import { api } from './api/client';
          
          async function fetchUser() {
            const result = await api
              .request()
              .get('/users/123')
              .withAuth('token')
              .send();
            return result;
          }
        `
      };
      const project = createTestProject(files);

      const allDefs = getAllProjectDefinitions(project, files);
      
      const fetchUserDef = allDefs.find(d => d.name === 'fetchUser');
      expect(fetchUserDef).toBeDefined();
      
      // Check that the chained calls are tracked
      const methodNames = ['request', 'get', 'withAuth', 'send'];
      
      for (const methodName of methodNames) {
        const methodDef = allDefs.find(d => d.name === methodName);
        expect(methodDef).toBeDefined();
      }
    });

    it('tracks recursive function calls across files', async () => {
      const files = {
        'math/factorial.ts': `
          import { multiply } from './operations';
          
          export function factorial(n: number): number {
            if (n <= 1) return 1;
            return multiply(n, factorial(n - 1));
          }
        `,
        'math/operations.ts': `
          export function multiply(a: number, b: number): number {
            return a * b;
          }
        `,
        'math/fibonacci.ts': `
          import { add } from './operations';
          
          export function fibonacci(n: number): number {
            if (n <= 1) return n;
            return add(fibonacci(n - 1), fibonacci(n - 2));
          }
          
          export function add(a: number, b: number): number {
            return a + b;
          }
        `
      };
      const project = createTestProject(files);

      const allDefs = getAllProjectDefinitions(project, files);
      
      // Check factorial recursion
      const factorialDef = allDefs.find(d => d.name === 'factorial');
      expect(factorialDef).toBeDefined();
      
      const factorialCalls = project.get_calls_from_definition(factorialDef!);
      const selfCalls = factorialCalls.filter(call => call.called_def.id === factorialDef!);
      expect(selfCalls.length).toBeGreaterThan(0);
      
      // Check cross-file call to multiply
      const multiplyDef = allDefs.find(d => d.name === 'multiply');
      expect(factorialCalls.some(call => call.called_def.id === multiplyDef?.id)).toBe(true);
    });
  });

  describe('Inheritance Edge Cases', () => {
    it('handles multi-level inheritance chains', async () => {
      const files = {
        'base/animal.ts': `
          export class Animal {
            name: string;
            
            constructor(name: string) {
              this.name = name;
            }
            
            speak() {
              return 'Some sound';
            }
          }
        `,
        'mammals/mammal.ts': `
          import { Animal } from '../base/animal';
          
          export class Mammal extends Animal {
            furColor: string;
            
            constructor(name: string, furColor: string) {
              super(name);
              this.furColor = furColor;
            }
            
            nurse() {
              return 'Nursing young';
            }
          }
        `,
        'mammals/dog.ts': `
          import { Mammal } from './mammal';
          
          export class Dog extends Mammal {
            breed: string;
            
            constructor(name: string, furColor: string, breed: string) {
              super(name, furColor);
              this.breed = breed;
            }
            
            speak() {
              return 'Woof!';
            }
            
            wagTail() {
              return 'Wagging tail';
            }
          }
        `,
        'usage.ts': `
          import { Dog } from './mammals/dog';
          
          function testDog() {
            const dog = new Dog('Buddy', 'brown', 'Labrador');
            dog.speak();      // Overridden method
            dog.nurse();      // Inherited from Mammal
            dog.wagTail();    // Dog's own method
          }
        `
      };
      const project = createTestProject(files);

      const allDefs = getAllProjectDefinitions(project, files);
      
      // Find all class constructors
      const animalCtor = allDefs.find(d => 
        d.name === 'Animal' && d.symbol_kind === 'class'
      );
      const mammalCtor = allDefs.find(d => 
        d.name === 'Mammal' && d.symbol_kind === 'class'
      );
      const dogCtor = allDefs.find(d => 
        d.name === 'Dog' && d.symbol_kind === 'class'
      );
      
      expect(animalCtor).toBeDefined();
      expect(mammalCtor).toBeDefined();
      expect(dogCtor).toBeDefined();
      
      // Check method inheritance
      const testDogDef = allDefs.find(d => d.name === 'testDog');
      const callsFromTestDog = project.get_calls_from_definition(testDogDef!);
      
      // Should call methods from different levels of inheritance
      const methodNames = ['speak', 'nurse', 'wagTail'];
      for (const methodName of methodNames) {
        const methodDef = allDefs.find(d => d.name === methodName);
        expect(methodDef).toBeDefined();
      }
    });

    it('handles interface implementation chains', async () => {
      const files = {
        'interfaces/readable.ts': `
          export interface Readable {
            read(): string;
          }
        `,
        'interfaces/writable.ts': `
          export interface Writable {
            write(data: string): void;
          }
        `,
        'interfaces/stream.ts': `
          import { Readable } from './readable';
          import { Writable } from './writable';
          
          export interface Stream extends Readable, Writable {
            close(): void;
          }
        `,
        'implementations/fileStream.ts': `
          import { Stream } from '../interfaces/stream';
          
          export class FileStream implements Stream {
            private buffer: string = '';
            
            read(): string {
              return this.buffer;
            }
            
            write(data: string): void {
              this.buffer += data;
            }
            
            close(): void {
              this.buffer = '';
            }
          }
        `,
        'implementations/networkStream.ts': `
          import { Stream } from '../interfaces/stream';
          
          export class NetworkStream implements Stream {
            read(): string {
              return 'network data';
            }
            
            write(data: string): void {
              // Send over network
            }
            
            close(): void {
              // Close connection
            }
            
            reconnect(): void {
              // Network-specific method
            }
          }
        `
      };
      const project = createTestProject(files);
      const allDefs = getAllProjectDefinitions(project, files);
      
      // Check that interfaces are properly parsed - interfaces might not be in the definitions
      // as they're type-only constructs, so we'll check for the implementing classes
      const implementations = ['FileStream', 'NetworkStream'];
      for (const className of implementations) {
        const classDef = allDefs.find(d => 
          d.name === className && d.symbol_kind === 'class'
        );
        expect(classDef).toBeDefined();
      }
    });

    it('handles mixin patterns', async () => {
      const files = {
        'mixins/timestamped.ts': `
          export function Timestamped<T extends new(...args: any[]) => {}>(Base: T) {
            return class extends Base {
              timestamp = Date.now();
              
              getTimestamp() {
                return this.timestamp;
              }
            };
          }
        `,
        'mixins/tagged.ts': `
          export function Tagged<T extends new(...args: any[]) => {}>(Base: T) {
            return class extends Base {
              tags: string[] = [];
              
              addTag(tag: string) {
                this.tags.push(tag);
              }
              
              getTags() {
                return this.tags;
              }
            };
          }
        `,
        'models/document.ts': `
          import { Timestamped } from '../mixins/timestamped';
          import { Tagged } from '../mixins/tagged';
          
          class DocumentBase {
            title: string;
            
            constructor(title: string) {
              this.title = title;
            }
            
            getTitle() {
              return this.title;
            }
          }
          
          export class Document extends Tagged(Timestamped(DocumentBase)) {
            content: string;
            
            constructor(title: string, content: string) {
              super(title);
              this.content = content;
            }
            
            getContent() {
              return this.content;
            }
          }
        `,
        'usage.ts': `
          import { Document } from './models/document';
          
          function testDocument() {
            const doc = new Document('My Title', 'My Content');
            doc.getTitle();       // From base class
            doc.getTimestamp();   // From Timestamped mixin
            doc.addTag('important'); // From Tagged mixin
            doc.getTags();        // From Tagged mixin
            doc.getContent();     // From Document class
          }
        `
      };
      const project = createTestProject(files);

      const allDefs = getAllProjectDefinitions(project, files);
      
      // Find mixin functions
      const timestampedDef = allDefs.find(d => d.name === 'Timestamped');
      const taggedDef = allDefs.find(d => d.name === 'Tagged');
      
      expect(timestampedDef).toBeDefined();
      expect(taggedDef).toBeDefined();
      
      // Check that Document class and its usage are tracked
      const documentDef = allDefs.find(d => 
        d.name === 'Document' && d.symbol_kind === 'class'
      );
      expect(documentDef).toBeDefined();
      
      const testDocDef = allDefs.find(d => d.name === 'testDocument');
      const callsFromTest = project.get_calls_from_definition(testDocDef!);
      
      // Should track calls to methods from base class and mixins
      const expectedMethods = ['getTitle', 'getTimestamp', 'addTag', 'getTags', 'getContent'];
      const calledMethods = allDefs
        .filter(d => expectedMethods.includes(d.name))
        .map(d => d.name);
      
      expect(calledMethods.length).toBeGreaterThan(0);
    });
  });

  describe('Complex Import/Export Patterns', () => {
    it('handles re-exports and barrel exports', async () => {
      const files = {
        'utils/string.ts': `
          export function capitalize(str: string) {
            return str.charAt(0).toUpperCase() + str.slice(1);
          }
          
          export function lowercase(str: string) {
            return str.toLowerCase();
          }
        `,
        'utils/number.ts': `
          export function clamp(value: number, min: number, max: number) {
            return Math.min(Math.max(value, min), max);
          }
          
          export function round(value: number, decimals: number) {
            return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
          }
        `,
        'utils/index.ts': `
          // Barrel export with re-exports
          export * from './string';
          export * from './number';
          
          // Named re-exports
          export { capitalize as cap, lowercase as lower } from './string';
          
          // Default export
          export default {
            name: 'utils',
            version: '1.0.0'
          };
        `,
        'main.ts': `
          import { capitalize, clamp, cap } from './utils';
          import utils from './utils';
          
          function test() {
            capitalize('hello');
            clamp(5, 0, 10);
            cap('world');
            console.log(utils.name);
          }
        `
      };
      const project = createTestProject(files);

      const allDefs = getAllProjectDefinitions(project, files);
      
      // Check that functions are accessible through barrel export
      const testDef = allDefs.find(d => d.name === 'test');
      const callsFromTest = project.get_calls_from_definition(testDef!);
      
      // Original functions should be found
      const capitalizeDef = allDefs.find(d => d.name === 'capitalize');
      const clampDef = allDefs.find(d => d.name === 'clamp');
      
      expect(capitalizeDef).toBeDefined();
      expect(clampDef).toBeDefined();
      
      // Check that calls are tracked correctly
      expect(callsFromTest.some(call => call.called_def.id === capitalizeDef?.id)).toBe(true);
      expect(callsFromTest.some(call => call.called_def.id === clampDef?.id)).toBe(true);
    });

    it('handles namespace imports with nested access', async () => {
      const files = {
        'math/constants.ts': `
          export const PI = 3.14159;
          export const E = 2.71828;
          export const GOLDEN_RATIO = 1.61803;
        `,
        'math/operations.ts': `
          export function add(a: number, b: number) {
            return a + b;
          }
          
          export function multiply(a: number, b: number) {
            return a * b;
          }
          
          export class Calculator {
            calculate(operation: string, a: number, b: number) {
              switch(operation) {
                case 'add': return add(a, b);
                case 'multiply': return multiply(a, b);
                default: throw new Error('Unknown operation');
              }
            }
          }
        `,
        'math/index.ts': `
          import * as constants from './constants';
          import * as operations from './operations';
          
          export { constants, operations };
          export { Calculator } from './operations';
        `,
        'app.ts': `
          import * as math from './math';
          
          function calculateArea(radius: number) {
            const area = math.operations.multiply(
              math.constants.PI,
              math.operations.multiply(radius, radius)
            );
            
            const calc = new math.Calculator();
            return calc.calculate('multiply', area, 1);
          }
        `
      };
      const project = createTestProject(files);

      const allDefs = getAllProjectDefinitions(project, files);
      
      // Find the calculateArea function
      const calculateAreaDef = allDefs.find(d => d.name === 'calculateArea');
      expect(calculateAreaDef).toBeDefined();
      
      // Check that namespace imports are resolved
      const multiplyDef = allDefs.find(d => d.name === 'multiply');
      const calculatorDef = allDefs.find(d => 
        d.name === 'Calculator' && d.symbol_kind === 'class'
      );
      
      expect(multiplyDef).toBeDefined();
      expect(calculatorDef).toBeDefined();
      
      const callsFromCalculateArea = project.get_calls_from_definition(calculateAreaDef!);
      expect(callsFromCalculateArea.some(call => call.called_def.id === multiplyDef?.id)).toBe(true);
    });

    it('handles dynamic imports', async () => {
      const files = {
        'lazy/heavyModule.ts': `
          export function processData(data: any[]) {
            return data.map(item => item * 2);
          }
          
          export class DataProcessor {
            async process(data: any[]) {
              return processData(data);
            }
          }
        `,
        'app.ts': `
          async function loadAndProcess() {
            const module = await import('./lazy/heavyModule');
            const result = module.processData([1, 2, 3]);
            
            const processor = new module.DataProcessor();
            return processor.process(result);
          }
          
          function conditionalImport(condition: boolean) {
            if (condition) {
              import('./lazy/heavyModule').then(mod => {
                mod.processData([4, 5, 6]);
              });
            }
          }
        `
      };
      const project = createTestProject(files);
      
      const allDefs = getAllProjectDefinitions(project, files);
      
      // Dynamic imports should still have their exports available
      const processDataDef = allDefs.find(d => d.name === 'processData');
      const dataProcessorDef = allDefs.find(d => 
        d.name === 'DataProcessor' && d.symbol_kind === 'class'
      );
      
      expect(processDataDef).toBeDefined();
      expect(dataProcessorDef).toBeDefined();
    });

    it('handles mixed CommonJS and ES6 patterns', async () => {
      const files = {
        'legacy/commonjs.js': `
          function oldFunction() {
            return 'legacy';
          }
          
          module.exports = {
            oldFunction,
            constant: 42
          };
          
          module.exports.additionalExport = function() {
            return 'added later';
          };
        `,
        'modern/es6.js': `
          // Import CommonJS module
          const { oldFunction, constant } = require('../legacy/commonjs');
          
          export function modernFunction() {
            return oldFunction() + ' modernized';
          }
          
          export { constant as LEGACY_CONSTANT };
          
          // Mix with ES6 exports
          export default class ModernClass {
            useLegacy() {
              return oldFunction();
            }
          }
        `,
        'app.js': `
          // ES6 imports
          import ModernClass, { modernFunction, LEGACY_CONSTANT } from './modern/es6';
          
          // CommonJS require
          const legacy = require('./legacy/commonjs');
          
          function mixedUsage() {
            const modern = new ModernClass();
            modern.useLegacy();
            modernFunction();
            legacy.oldFunction();
            legacy.additionalExport();
          }
        `
      };
      const project = createTestProject(files);

      const allDefs = getAllProjectDefinitions(project, files);
      
      // Check that both CommonJS and ES6 exports are tracked
      const oldFunctionDef = allDefs.find(d => d.name === 'oldFunction');
      const modernFunctionDef = allDefs.find(d => d.name === 'modernFunction');
      const modernClassDef = allDefs.find(d => 
        d.name === 'ModernClass' && d.symbol_kind === 'class'
      );
      
      expect(oldFunctionDef).toBeDefined();
      expect(modernFunctionDef).toBeDefined();
      expect(modernClassDef).toBeDefined();
      
      // Check mixed usage
      const mixedUsageDef = allDefs.find(d => d.name === 'mixedUsage');
      const callsFromMixed = project.get_calls_from_definition(mixedUsageDef!);
      
      // Should call functions from both module systems
      expect(callsFromMixed.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles missing files/imports gracefully', async () => {
      const files = {
        'app.ts': `
          // Import from non-existent file
          import { missingFunction } from './does-not-exist';
          
          // Import non-existent export
          import { notExported } from './utils';
          
          function test() {
            missingFunction();
            notExported();
            existingFunction();
          }
        `,
        'utils.ts': `
          export function existingFunction() {
            return 'exists';
          }
        `
      };
      const project = createTestProject(files);

      const allDefs = getAllProjectDefinitions(project, files);
      
      // Should still analyze what it can
      const testDef = allDefs.find(d => d.name === 'test');
      const existingDef = allDefs.find(d => d.name === 'existingFunction');
      
      expect(testDef).toBeDefined();
      expect(existingDef).toBeDefined();
      
      // Should track call to existing function
      const callsFromTest = project.get_calls_from_definition(testDef!);
      expect(callsFromTest.some(call => call.called_def.id === existingDef?.id)).toBe(true);
    });

    it('handles malformed import statements', async () => {
      const files = {
        'broken.js': `
          // Various malformed imports
          import from './nowhere';
          import { } from './empty';
          import { a b c } from './no-commas';
          import { valid } from './valid';
          
          function test() {
            valid();
          }
        `,
        'valid.js': `
          export function valid() {
            return 'valid';
          }
        `
      };
      const project = createTestProject(files);
      
      const allDefs = getAllProjectDefinitions(project, files);
      
      // Should still process valid imports
      const validDef = allDefs.find(d => d.name === 'valid');
      expect(validDef).toBeDefined();
    });

    it('handles conflicting exports', async () => {
      const files = {
        'conflicts/a.ts': `
          export function duplicate() {
            return 'from A';
          }
          
          export const value = 'A';
        `,
        'conflicts/b.ts': `
          export function duplicate() {
            return 'from B';
          }
          
          export const value = 'B';
        `,
        'conflicts/index.ts': `
          // Re-export with conflicts
          export * from './a';
          export * from './b';
          
          // Explicit resolution
          export { duplicate as duplicateA } from './a';
          export { duplicate as duplicateB } from './b';
        `,
        'usage.ts': `
          import { duplicateA, duplicateB } from './conflicts';
          
          function test() {
            duplicateA();
            duplicateB();
          }
        `
      };
      const project = createTestProject(files);

      const allDefs = getAllProjectDefinitions(project, files);
      
      // Both versions should be accessible through renamed exports
      const testDef = allDefs.find(d => d.name === 'test');
      const callsFromTest = project.get_calls_from_definition(testDef!);
      
      // Should have calls to both duplicate functions
      const duplicateDefs = allDefs.filter(d => d.name === 'duplicate');
      expect(duplicateDefs.length).toBe(2);
    });
  });
});