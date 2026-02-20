// Variable shadowing scenarios - variable_shadowing.rs
// Tests: Variable shadowing at different scope levels, parameter shadowing

mod utils;

use utils::{helper, process_data};

// Global-level function for testing
fn outer_helper() -> &'static str {
    "outer_helper"
}

// Global variable
static GLOBAL_VAR: &str = "global_value";

fn test_variable_shadowing() -> String {
    // Local variable shadows global
    let global_var = "local_value";

    // Local variable shadows imported function name
    let helper = "local_helper_var";

    // Call actual function by full module path since name is shadowed
    let actual_helper_result = utils::helper();

    // Call other imported function (not shadowed)
    let processed = process_data("test");

    // Function with parameter shadowing
    fn inner_function(global_var: &str, helper: i32) -> String {
        // Parameters shadow both global and local variables

        // Call function from outer scope
        let outer_result = outer_helper();

        // Use shadowed parameters
        let param_global = global_var;
        let param_helper = helper;

        // Nested block with more shadowing
        let block_result = {
            // Block-local variables shadow parameters
            let global_var = 42;
            let helper = vec![1, 2, 3];

            // Call function from outer scope
            let block_outer = outer_helper();

            format!("block: global_var={}, helper={:?}, outer={}",
                   global_var, helper, block_outer)
        };

        format!("inner: param_global={}, param_helper={}, outer={}, {}",
               param_global, param_helper, outer_result, block_result)
    }

    let inner_result = inner_function("param_value", 999);

    format!("local: global_var={}, helper={}, actual_helper={}, processed={}, inner={}",
           global_var, helper, actual_helper_result, processed, inner_result)
}

fn test_closure_shadowing() -> String {
    // Variables in closure scope
    let value = "outer_value";
    let helper = "closure_helper";

    // Closure with parameter shadowing
    let closure = |value: &str| -> String {
        // Parameter shadows outer variable
        let result = process_data(value);

        // Nested closure with more shadowing
        let nested = |helper: i32| -> String {
            // Parameter shadows both outer variables
            format!("nested: helper={}, value={}", helper, value)
        };

        let nested_result = nested(42);
        format!("closure: value={}, result={}, {}", value, result, nested_result)
    };

    let closure_result = closure("closure_param");

    format!("outer: value={}, helper={}, closure={}",
           value, helper, closure_result)
}

fn test_match_shadowing() -> String {
    let value = "match_outer";
    let helper = 100;

    // Match arm with shadowing
    let result = match helper {
        helper => {
            // Match variable shadows outer variable
            let processed = process_data(&format!("match_{}", helper));

            // Nested scope within match arm
            let nested = {
                let value = "match_nested";
                let outer_call = outer_helper();
                format!("nested: value={}, outer={}", value, outer_call)
            };

            format!("match: helper={}, processed={}, {}", helper, processed, nested)
        }
    };

    format!("outer: value={}, helper={}, match={}", value, helper, result)
}

fn test_loop_shadowing() -> String {
    let helper = "loop_outer";
    let mut results = Vec::new();

    // For loop with shadowing iterator variable
    for helper in 0..3 {
        // Loop variable shadows outer variable
        let processed = process_data(&format!("loop_{}", helper));

        // Block within loop with more shadowing
        let block_result = {
            let helper = format!("block_{}", helper);
            let outer_call = outer_helper();
            format!("block: helper={}, outer={}", helper, outer_call)
        };

        results.push(format!("iter: helper={}, processed={}, {}",
                           helper, processed, block_result));
    }

    format!("outer: helper={}, results={:?}", helper, results)
}

struct ShadowStruct {
    helper: String,
}

impl ShadowStruct {
    fn new(helper: String) -> Self {
        ShadowStruct { helper }
    }

    fn method_with_shadowing(&self, helper: &str) -> String {
        // Parameter shadows field
        let outer_call = outer_helper();
        let processed = process_data(helper);

        // Local variable shadows both parameter and field
        let local_result = {
            let helper = "method_local";
            format!("local: helper={}, outer={}", helper, outer_call)
        };

        format!("method: param_helper={}, field_helper={}, processed={}, {}",
               helper, self.helper, processed, local_result)
    }
}

pub fn main() {
    // Test all shadowing scenarios
    let var_result = test_variable_shadowing();
    let closure_result = test_closure_shadowing();
    let match_result = test_match_shadowing();
    let loop_result = test_loop_shadowing();

    // Test struct method shadowing
    let shadow_obj = ShadowStruct::new("field_helper".to_string());
    let method_result = shadow_obj.method_with_shadowing("param_helper");

    println!("Variable shadowing: {}", var_result);
    println!("Closure shadowing: {}", closure_result);
    println!("Match shadowing: {}", match_result);
    println!("Loop shadowing: {}", loop_result);
    println!("Method shadowing: {}", method_result);
}

// Function that tests if shadowing affects function calls
fn test_function_call_resolution() -> String {
    let helper = "should_not_affect_calls";

    // Even though 'helper' is shadowed as a variable,
    // function calls should still work via module path
    let result1 = utils::helper();
    let result2 = process_data("test");
    let result3 = outer_helper();

    format!("helper_var={}, utils::helper()={}, process_data()={}, outer_helper()={}",
           helper, result1, result2, result3)
}