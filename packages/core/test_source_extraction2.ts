import { Project } from "@ariadnejs/core";
import { ProjectSource } from "@ariadnejs/core/src/project_source";

const code = `
function testFunction(a, b) {
  const result = a + b;
  return result;
}

class TestClass {
  testMethod() {
    return "hello";
  }
}
`;

const project = new Project();
project.add_or_update_file('test.js', code);

const functions = project.get_functions_in_file('test.js');
console.log("Functions found:", functions.map(f => f.name));

// Test using Project's method
console.log("\n=== Using Project.get_source_code ===");
for (const func of functions) {
  const source = project.get_source_code(func, 'test.js');
  console.log(`\nSource for ${func.name}:`);
  console.log(`"${source}"`);
}

// Test directly using ProjectSource
const state = (project as any).storage.getState();
const projectSource = new ProjectSource(state.file_cache, (project as any).languages);

console.log("\n=== Using ProjectSource directly ===");
for (const func of functions) {
  const source = projectSource.get_source_code(func, 'test.js');
  console.log(`\nSource for ${func.name}:`);
  console.log(`"${source}"`);
}