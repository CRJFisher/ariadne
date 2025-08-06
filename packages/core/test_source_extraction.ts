import { Project } from "@ariadnejs/core";

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

for (const func of functions) {
  const source = project.get_source_code(func, 'test.js');
  console.log(`\nSource for ${func.name}:`);
  console.log(`"${source}"`);
  console.log(`Range: ${func.range.start.row}:${func.range.start.column} to ${func.range.end.row}:${func.range.end.column}`);
}