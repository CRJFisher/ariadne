"""
Nested function scopes - nested_scopes.py
Tests: enclosing_function_scope_id for calls at different scope levels
"""

from typing import Dict, Any


def helper() -> str:
    """Helper function for calls."""
    return "helper result"


# Top-level function call (module scope)
top_level = helper()


def outer_function() -> Dict[str, Any]:
    """Outer function with nested calls."""
    # Call in outer function scope
    outer_call = helper()

    # Block scope simulation (Python doesn't have true block scope)
    if True:
        block_call = helper()

    def inner_function() -> Dict[str, Any]:
        """Inner function with nested calls."""
        # Call in inner function scope
        inner_call = helper()

        def deeper_function() -> str:
            """Deeper nested function."""
            deep_call = helper()
            return deep_call

        deep_result = deeper_function()
        return {"inner_call": inner_call, "deep_result": deep_result}

    inner_result = inner_function()
    return {"outer_call": outer_call, "block_call": block_call, "inner_result": inner_result}


# Calls from different scopes
module_result = outer_function()


def lambda_function() -> str:
    """Function with lambda containing call."""
    lambda_func = lambda: helper()
    return lambda_func()


lambda_result = lambda_function()

# Store results
results = {
    "top_level": top_level,
    "module_result": module_result,
    "lambda_result": lambda_result,
}