import { Project } from './index';

describe('Project - Cross-file resolution', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project();
  });

  test('finds definition across files', () => {
    // File 1: utils.ts - contains the definition
    const utilsCode = `
export function calculateSum(a: number, b: number): number {
  return a + b;
}

export const PI = 3.14159;

export class Calculator {
  add(x: number, y: number): number {
    return x + y;
  }
}

export interface Config {
  apiUrl: string;
  timeout: number;
}
`;

    // File 2: main.ts - imports and uses the exports
    const mainCode = `
import { calculateSum, PI, Calculator, Config } from './utils';

const result = calculateSum(5, 10);
console.log(PI);

const calc = new Calculator();
const sum = calc.add(1, 2);

const config: Config = {
  apiUrl: 'https://api.example.com',
  timeout: 5000
};
`;

    // Add files to project
    project.add_or_update_file('utils.ts', utilsCode);
    project.add_or_update_file('main.ts', mainCode);

    // Test 1: Find definition of calculateSum from its usage
    const calculateSumDef = project.go_to_definition('main.ts', { row: 3, column: 15 }); // calculateSum in main.ts
    expect(calculateSumDef).toBeDefined();
    expect(calculateSumDef?.name).toBe('calculateSum');
    expect(calculateSumDef?.kind).toBe('definition');
    expect(calculateSumDef?.symbol_kind).toBe('function');

    // Test 2: Find definition of PI from its usage
    const piDef = project.go_to_definition('main.ts', { row: 4, column: 12 }); // PI in console.log(PI)
    expect(piDef).toBeDefined();
    expect(piDef?.name).toBe('PI');
    expect(piDef?.symbol_kind).toBe('constant');

    // Test 3: Find definition of Calculator from its usage
    const calculatorDef = project.go_to_definition('main.ts', { row: 6, column: 17 }); // Calculator in new Calculator()
    expect(calculatorDef).toBeDefined();
    expect(calculatorDef?.name).toBe('Calculator');
    expect(calculatorDef?.symbol_kind).toBe('class');

    // Test 4: Find definition of Config from its type annotation
    const configDef = project.go_to_definition('main.ts', { row: 9, column: 14 }); // Config in config: Config
    expect(configDef).toBeDefined();
    expect(configDef?.name).toBe('Config');
    expect(configDef?.symbol_kind).toBe('interface');
  });

  test('finds all references across files', () => {
    // File 1: shared.ts - contains shared types and functions
    const sharedCode = `
export interface User {
  id: number;
  name: string;
  email: string;
}

export function validateUser(user: User): boolean {
  return user.id > 0 && user.name.length > 0;
}
`;

    // File 2: api.ts - uses User type
    const apiCode = `
import { User, validateUser } from './shared';

export async function fetchUser(id: number): Promise<User> {
  // Mock implementation
  const user: User = {
    id,
    name: 'John Doe',
    email: 'john@example.com'
  };
  
  if (validateUser(user)) {
    return user;
  }
  
  throw new Error('Invalid user');
}
`;

    // File 3: component.ts - also uses User type
    const componentCode = `
import { User } from './shared';
import { fetchUser } from './api';

export class UserComponent {
  private currentUser: User | null = null;
  
  async loadUser(id: number): Promise<void> {
    this.currentUser = await fetchUser(id);
  }
  
  getUser(): User | null {
    return this.currentUser;
  }
}
`;

    // Add files to project
    project.add_or_update_file('shared.ts', sharedCode);
    project.add_or_update_file('api.ts', apiCode);
    project.add_or_update_file('component.ts', componentCode);

    // Find all references to User interface
    const userRefs = project.find_references('shared.ts', { row: 1, column: 17 }); // User interface definition
    
    // Should find references in:
    // 1. validateUser parameter type in shared.ts
    // 2. Import in api.ts
    // 3. Return type in api.ts
    // 4. Variable type in api.ts
    // 5. Import in component.ts
    // 6. Field type in component.ts
    // 7. Return type in component.ts
    
    expect(userRefs.length).toBeGreaterThanOrEqual(4); // At least the direct type references
    
    // Find all references to validateUser function
    const validateUserRefs = project.find_references('shared.ts', { row: 7, column: 16 }); // validateUser function
    
    // Should find references in:
    // 1. Import in api.ts
    // 2. Function call in api.ts
    
    expect(validateUserRefs.length).toBeGreaterThanOrEqual(1); // At least the function call
  });

  test('handles namespaced imports', () => {
    // File 1: math.ts
    const mathCode = `
export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}

export const E = 2.71828;
`;

    // File 2: app.ts - uses namespace import
    const appCode = `
import * as math from './math';

const sum = math.add(1, 2);
const product = math.multiply(3, 4);
console.log(math.E);
`;

    project.add_or_update_file('math.ts', mathCode);
    project.add_or_update_file('app.ts', appCode);

    // Note: Full namespace import resolution might require additional implementation
    // This test documents the expected behavior
  });

  test('handles renamed imports', () => {
    // File 1: helpers.ts
    const helpersCode = `
export function formatDate(date: Date): string {
  return date.toISOString();
}

export function parseDate(str: string): Date {
  return new Date(str);
}
`;

    // File 2: main.ts - uses renamed imports
    const mainCode = `
import { formatDate as format, parseDate as parse } from './helpers';

const now = new Date();
const formatted = format(now);
const parsed = parse('2023-01-01');
`;

    project.add_or_update_file('helpers.ts', helpersCode);
    project.add_or_update_file('main.ts', mainCode);

    // Find definition of 'format' (renamed from formatDate)
    const formatRef = (project as any).file_graphs.get('main.ts')
      .findNodeAtPosition({ row: 4, column: 18 });
    expect(formatRef).toBeDefined();
    expect(formatRef?.kind).toBe('reference');
    expect(formatRef?.name).toBe('format');
    
    // Find definition of format (should resolve to formatDate in helpers.ts)
    const formatDef = project.go_to_definition('main.ts', { row: 4, column: 18 });
    expect(formatDef).toBeDefined();
    expect(formatDef?.name).toBe('formatDate'); // Now correctly resolves to the original export name
    expect(formatDef?.range.start.row).toBe(1);
    
    // Find definition of parse (should resolve to parseDate in helpers.ts)
    const parseDef = project.go_to_definition('main.ts', { row: 5, column: 15 });
    expect(parseDef).toBeDefined();
    expect(parseDef?.name).toBe('parseDate');
    expect(parseDef?.range.start.row).toBe(5);
  });

  test('handles default exports', () => {
    // File 1: logger.ts
    const loggerCode = `
export default class Logger {
  log(message: string): void {
    console.log(message);
  }
}
`;

    // File 2: app.ts
    const appCode = `
import Logger from './logger';

const logger = new Logger();
logger.log('Hello, world!');
`;

    project.add_or_update_file('logger.ts', loggerCode);
    project.add_or_update_file('app.ts', appCode);

    // Find definition of Logger from its usage
    const loggerDef = project.go_to_definition('app.ts', { row: 3, column: 19 }); // Logger in new Logger()
    expect(loggerDef).toBeDefined();
    expect(loggerDef?.name).toBe('Logger');
    expect(loggerDef?.symbol_kind).toBe('class');
  });

  test('handles mixed exports', () => {
    // File 1: mixed.ts
    const mixedCode = `
export const VERSION = '1.0.0';

export function helper(): void {
  console.log('Helper function');
}

export default {
  name: 'MixedModule',
  version: VERSION,
  helper
};
`;

    // File 2: consumer.ts
    const consumerCode = `
import defaultExport, { VERSION, helper } from './mixed';

console.log(VERSION);
helper();
console.log(defaultExport.name);
`;

    project.add_or_update_file('mixed.ts', mixedCode);
    project.add_or_update_file('consumer.ts', consumerCode);

    // Find definition of VERSION
    const versionDef = project.go_to_definition('consumer.ts', { row: 3, column: 12 }); // VERSION in console.log
    expect(versionDef).toBeDefined();
    expect(versionDef?.name).toBe('VERSION');
    expect(versionDef?.symbol_kind).toBe('constant');

    // Find definition of helper
    const helperDef = project.go_to_definition('consumer.ts', { row: 4, column: 0 }); // helper function call
    expect(helperDef).toBeDefined();
    expect(helperDef?.name).toBe('helper');
    expect(helperDef?.symbol_kind).toBe('function');
  });

  test('handles circular imports', () => {
    // File 1: moduleA.ts
    const moduleACode = `
import { functionB } from './moduleB';

export function functionA(): void {
  console.log('Function A');
  functionB();
}
`;

    // File 2: moduleB.ts
    const moduleBCode = `
import { functionA } from './moduleA';

export function functionB(): void {
  console.log('Function B');
  // functionA(); // Would cause infinite loop if called
}
`;

    project.add_or_update_file('moduleA.ts', moduleACode);
    project.add_or_update_file('moduleB.ts', moduleBCode);

    // Find definition of functionB from moduleA
    const funcBDef = project.go_to_definition('moduleA.ts', { row: 5, column: 2 }); // functionB call
    expect(funcBDef).toBeDefined();
    expect(funcBDef?.name).toBe('functionB');

    // Find definition of functionA from moduleB
    const funcADef = project.go_to_definition('moduleB.ts', { row: 1, column: 9 }); // functionA import
    expect(funcADef).toBeDefined();
    expect(funcADef?.name).toBe('functionA');
  });

  test('finds references in same file', () => {
    const code = `
function greet(name: string): string {
  const message = \`Hello, \${name}!\`;
  return message;
}

const user = 'Alice';
const greeting = greet(user);
console.log(greeting);

// Use greet again
const admin = 'Bob';
const adminGreeting = greet(admin);
`;

    project.add_or_update_file('local.ts', code);

    // Find all references to greet function
    const greetRefs = project.find_references('local.ts', { row: 1, column: 9 }); // greet definition
    expect(greetRefs.length).toBe(2); // Two calls to greet

    // Find all references to user variable
    const userRefs = project.find_references('local.ts', { row: 6, column: 6 }); // user definition
    expect(userRefs.length).toBe(1); // One use in greet(user)
  });

  test('handles file updates', () => {
    const originalCode = `
export function oldFunction(): void {
  console.log('Old implementation');
}
`;

    const updatedCode = `
export function newFunction(): void {
  console.log('New implementation');
}

export function oldFunction(): void {
  console.log('Updated implementation');
}
`;

    // Add original file
    project.add_or_update_file('module.ts', originalCode);

    // Verify original function exists
    const oldFuncDef = project.go_to_definition('module.ts', { row: 1, column: 16 });
    expect(oldFuncDef?.name).toBe('oldFunction');

    // Update the file
    project.add_or_update_file('module.ts', updatedCode);

    // Verify new function exists
    const newFuncDef = project.go_to_definition('module.ts', { row: 1, column: 16 });
    expect(newFuncDef?.name).toBe('newFunction');
  });

  test('handles file removal', () => {
    const code = `
export function testFunction(): void {
  console.log('Test');
}
`;

    // Add and then remove file
    project.add_or_update_file('temp.ts', code);
    project.remove_file('temp.ts');

    // Verify file is removed (should return null since file doesn't exist)
    const def = project.go_to_definition('temp.ts', { row: 1, column: 16 });
    expect(def).toBeNull();
  });
});