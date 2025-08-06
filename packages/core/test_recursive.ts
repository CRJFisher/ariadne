import { Project } from "@ariadnejs/core";

const project = new Project();

// Single file recursive - this works
project.add_or_update_file("single.ts", `
function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}
`);

const singleFileFunctions = project.get_functions_in_file("single.ts");
const factorial = singleFileFunctions.find(f => f.name === "factorial");
const singleFileCalls = project.get_function_calls(factorial!);
console.log("Single file recursive calls:", singleFileCalls.map(c => ({
  caller: c.caller_def.name,
  called: c.called_def.name,
  file: c.called_def.file_path
})));

// Cross-file recursive - test this
project.add_or_update_file("math/factorial.ts", `
import { multiply } from './multiply';

export function factorial(n: number): number {
  if (n <= 1) return 1;
  return multiply(n, factorial(n - 1));
}
`);

project.add_or_update_file("math/multiply.ts", `
export function multiply(a: number, b: number): number {
  return a * b;
}
`);

const crossFileFunctions = project.get_functions_in_file("math/factorial.ts");
const crossFactorial = crossFileFunctions.find(f => f.name === "factorial");
const crossFileCalls = project.get_function_calls(crossFactorial!);
console.log("\nCross-file factorial calls:", crossFileCalls.map(c => ({
  caller: c.caller_def.name,
  called: c.called_def.name,
  file: c.called_def.file_path,
  id: c.called_def.id,
  symbol_id: c.called_def.symbol_id
})));

// Check if any calls are to itself
const selfCalls = crossFileCalls.filter(c => c.called_def.name === "factorial");
console.log("\nSelf-recursive calls found:", selfCalls.length);