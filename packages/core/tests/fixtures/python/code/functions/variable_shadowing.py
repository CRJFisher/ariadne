"""
Variable shadowing scenarios - variable_shadowing.py
Tests: Variable shadowing at different scope levels, parameter shadowing
"""

from typing import Any, Callable
from modules.utils import helper as imported_helper, process_data


def outer_helper() -> str:
    """Outer helper function."""
    return "outer_helper"


# Global variable
global_var = "global_value"
helper = "global_helper_var"  # Shadows imported function name


def test_variable_shadowing() -> dict:
    """Test variable shadowing at different levels."""
    # Local variable shadows global
    global_var = "local_value"

    # Local variable shadows imported function
    imported_helper = "local_imported_helper"

    # Function call using global helper variable (string)
    # This should NOT resolve to a function since helper is now a string
    try:
        # This would cause an error if we tried to call string as function
        # helper_result = helper()  # Would fail
        helper_result = "string_not_callable"
    except:
        helper_result = "error_calling_string"

    # Call the actual imported function by full name
    actual_helper_result = process_data("test")

    def inner_function(global_var: str, imported_helper: int) -> dict:
        """Inner function with parameter shadowing."""
        # Parameters shadow both global and local variables

        # Call outer function
        outer_result = outer_helper()

        # Use shadowed parameters
        param_global = global_var
        param_imported = imported_helper

        def deeper_function() -> dict:
            """Deeper function with more shadowing."""
            # Local variables shadow parameters and outer variables
            global_var = 42
            imported_helper = [1, 2, 3]

            # Call function from outer scope
            deeper_outer = outer_helper()

            return {
                "deep_global_var": global_var,
                "deep_imported_helper": imported_helper,
                "deeper_outer": deeper_outer,
            }

        deep_result = deeper_function()

        return {
            "param_global": param_global,
            "param_imported": param_imported,
            "outer_result": outer_result,
            "deep_result": deep_result,
        }

    inner_result = inner_function("param_value", 999)

    return {
        "local_global_var": global_var,
        "local_imported_helper": imported_helper,
        "helper_result": helper_result,
        "actual_helper_result": actual_helper_result,
        "inner_result": inner_result,
    }


def test_comprehension_shadowing() -> dict:
    """Test variable shadowing in comprehensions."""
    items = [1, 2, 3, 4, 5]
    helper = "comprehension_helper"  # Shadow imported function

    # List comprehension with shadowing
    # The 'item' variable shadows any outer 'item' variable
    item = "outer_item"
    comp_result = [process_data(f"item_{item}") for item in items]

    # After comprehension, outer 'item' is still accessible
    final_item = item

    # Dictionary comprehension with function calls
    dict_comp = {
        str(x): process_data(f"value_{x}")
        for x in items
        if x % 2 == 0
    }

    return {
        "comp_result": comp_result,
        "final_item": final_item,
        "dict_comp": dict_comp,
        "helper": helper,
    }


def test_lambda_shadowing() -> dict:
    """Test variable shadowing in lambda functions."""
    helper = "lambda_helper"  # Shadow imported function

    # Lambda that shadows parameter
    x = "outer_x"
    lambda_func = lambda x: process_data(f"lambda_{x}")
    lambda_result = lambda_func("inner_x")

    # Outer x should be unchanged
    final_x = x

    # Nested lambda with multiple shadowing levels
    def create_nested_lambda(param: str) -> Callable:
        """Create nested lambda with parameter shadowing."""
        helper = "nested_lambda_helper"  # Shadow again

        return lambda param: lambda param: process_data(f"deeply_nested_{param}")

    nested_lambda = create_nested_lambda("first")
    nested_result = nested_lambda("second")("third")

    return {
        "lambda_result": lambda_result,
        "final_x": final_x,
        "nested_result": nested_result,
        "helper": helper,
    }


def test_class_method_shadowing() -> dict:
    """Test variable shadowing in class methods."""

    class ShadowTest:
        """Class for testing variable shadowing in methods."""

        helper = "class_helper"  # Class variable shadows imported function

        def __init__(self, helper: str) -> None:
            """Constructor with parameter shadowing class variable."""
            self.helper = helper  # Instance variable shadows class variable

        def method_with_shadowing(self, helper: Any) -> dict:
            """Method with parameter shadowing instance variable."""
            # Parameter shadows both instance and class variables

            # Call function from outer scope
            outer_call = outer_helper()

            # Use process_data function (not shadowed)
            processed = process_data("method_test")

            def local_function() -> str:
                """Local function within method."""
                helper = "local_method_helper"  # Shadow parameter
                return process_data(f"local_{helper}")

            local_result = local_function()

            return {
                "param_helper": helper,
                "instance_helper": self.helper,
                "class_helper": ShadowTest.helper,
                "outer_call": outer_call,
                "processed": processed,
                "local_result": local_result,
            }

    # Test class shadowing
    shadow_obj = ShadowTest("instance_helper")
    method_result = shadow_obj.method_with_shadowing("param_helper")

    return {
        "shadow_obj": shadow_obj,
        "method_result": method_result,
    }


# Test all shadowing scenarios
shadowing_result = test_variable_shadowing()
comprehension_result = test_comprehension_shadowing()
lambda_result = test_lambda_shadowing()
class_result = test_class_method_shadowing()

# Store results
results = {
    "shadowing_result": shadowing_result,
    "comprehension_result": comprehension_result,
    "lambda_result": lambda_result,
    "class_result": class_result,
    "global_var": global_var,
    "helper": helper,
}