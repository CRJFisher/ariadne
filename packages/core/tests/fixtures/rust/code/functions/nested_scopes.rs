// Nested function scopes - nested_scopes.rs
// Tests: enclosing_function_scope_id for calls at different scope levels

// Helper function for calls
fn helper() -> &'static str {
    "helper result"
}

// Top-level function call (module scope)
static TOP_LEVEL: &str = ""; // Will be set by lazy_static in real code

fn main() {
    // Call in main function scope
    let main_call = helper();

    // Block scope (Rust has true block scope)
    let block_result = {
        let block_call = helper();
        block_call
    };

    // Function call in function scope
    let outer_result = outer_function();

    println!("Main call: {}", main_call);
    println!("Block result: {}", block_result);
    println!("Outer result: {}", outer_result);
}

fn outer_function() -> String {
    // Call in outer function scope
    let outer_call = helper();

    // Nested function definition and call
    fn inner_function() -> String {
        // Call in inner function scope
        let inner_call = helper();

        // Deeper nested function
        fn deeper_function() -> &'static str {
            let deep_call = helper();
            deep_call
        }

        let deep_result = deeper_function();
        format!("{} -> {}", inner_call, deep_result)
    }

    let inner_result = inner_function();

    // Closure with nested call
    let closure = || {
        let closure_call = helper();
        closure_call
    };

    let closure_result = closure();

    format!("{} | {} | {}", outer_call, inner_result, closure_result)
}

// Function that uses helper in different contexts
fn complex_nesting() -> Vec<&'static str> {
    let mut results = Vec::new();

    // Call in function scope
    results.push(helper());

    // Call within if block
    if true {
        results.push(helper());
    }

    // Call within match
    match 42 {
        42 => results.push(helper()),
        _ => {}
    }

    // Call within for loop
    for _i in 0..1 {
        results.push(helper());
    }

    results
}