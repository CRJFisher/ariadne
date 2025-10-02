import * as fs from "fs";

const builderPath = "/Users/chuck/workspace/ariadne/packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder.ts";
const builderContent = fs.readFileSync(builderPath, "utf8");

// Expected builder methods for each capture type
const expectedMethods: Record<string, string[]> = {
  "definition.class": ["add_class"],
  "definition.class.generic": ["add_class"],
  "definition.enum": ["add_enum"],
  "definition.enum.generic": ["add_enum"],
  "definition.enum_member": ["add_enum_member"],
  "definition.function": ["add_function"],
  "definition.function.generic": ["add_function"],
  "definition.function.async": ["add_function"],
  "definition.function.unsafe": ["add_function"],
  "definition.function.const": ["add_function"],
  "definition.interface": ["add_interface"],
  "definition.interface.generic": ["add_interface"],
  "definition.interface.method": ["add_method_signature_to_interface"],
  "definition.method": ["add_method_to_class"],
  "definition.method.async": ["add_method_to_class"],
  "definition.method.default": ["add_method_to_class"],
  "definition.constructor": ["add_method_to_class", "add_constructor_to_class"],
  "definition.parameter": ["add_parameter_to_callable"],
  "definition.parameter.self": ["add_parameter_to_callable"],
  "definition.parameter.closure": ["add_parameter_to_callable"],
  "definition.field": ["add_property_to_class"],
  "definition.variable": ["add_variable"],
  "definition.variable.mut": ["add_variable"],
  "definition.constant": ["add_variable"],
  "definition.type_alias": ["add_type_alias"],
  "definition.module": ["builder."], // Modules might not have specific method
};

console.log("=== VERIFYING HANDLER BUILDER METHOD CALLS ===\n");

// Extract handler sections
const handlerRegex = /\[\s*"(definition\.[^"]+)"\s*,\s*\{[^}]*process:[^}]+\}[^}]*\}/gs;
const matches = Array.from(builderContent.matchAll(handlerRegex));

console.log("Found " + matches.length + " handlers in rust_builder.ts\n");

const issues: Array<{capture: string, issue: string}> = [];

matches.forEach(match => {
  const fullMatch = match[0];
  const capture = match[1];
  
  const expected = expectedMethods[capture];
  if (!expected) {
    console.log("⚠️  " + capture + " - No expected method defined");
    return;
  }
  
  let foundMethod = false;
  for (const method of expected) {
    if (fullMatch.includes(method)) {
      foundMethod = true;
      console.log("✅ " + capture);
      console.log("   Calls: " + method);
      break;
    }
  }
  
  if (!foundMethod) {
    console.log("❌ " + capture);
    console.log("   Expected: " + expected.join(" or "));
    console.log("   Handler code:");
    console.log("   " + fullMatch.substring(0, 200).replace(/\n/g, "\n   ") + "...");
    issues.push({capture, issue: "Missing expected builder method call"});
  }
});

if (issues.length > 0) {
  console.log("\n=== ISSUES FOUND ===");
  issues.forEach(i => {
    console.log("- " + i.capture + ": " + i.issue);
  });
} else {
  console.log("\n✅ All handlers appear to call correct builder methods!");
}
