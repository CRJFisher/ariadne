"""
Closures and variable capture - closures.py
Tests: Variable capture in nested functions, closures, decorator patterns
"""

from typing import Callable, Any, List
from functools import wraps


def helper() -> str:
    """Helper function for closure testing."""
    return "helper called"


def create_counter(start: int = 0) -> Callable[[], int]:
    """Factory function that creates a counter closure."""
    count = start

    def increment() -> int:
        """Inner function that captures and modifies outer variable."""
        nonlocal count
        count += 1
        # Call helper function from within closure
        helper_result = helper()
        return count

    return increment


def create_multiplier(factor: int) -> Callable[[int], int]:
    """Factory function that creates a multiplier closure."""

    def multiply(value: int) -> int:
        """Inner function that captures factor from outer scope."""
        # Multiple nested calls
        intermediate = helper()
        result = value * factor
        return result

    return multiply


def decorator_with_closure(prefix: str) -> Callable:
    """Decorator factory that creates closures."""

    def decorator(func: Callable) -> Callable:
        """Actual decorator that captures prefix."""

        @wraps(func)
        def wrapper(*args, **kwargs) -> str:
            """Wrapper function with variable capture."""
            # Call helper in nested decorator context
            helper_result = helper()
            original_result = func(*args, **kwargs)
            return f"{prefix}: {original_result}"

        return wrapper
    return decorator


@decorator_with_closure("Result")
def greet(name: str) -> str:
    """Function with decorator that uses closures."""
    return f"Hello, {name}"


def complex_nested_scopes() -> dict:
    """Function with multiple levels of nesting and variable capture."""
    outer_var = "outer"

    def level_one() -> dict:
        """First level of nesting."""
        level_one_var = "level_one"

        def level_two() -> dict:
            """Second level of nesting."""
            level_two_var = "level_two"

            def level_three() -> str:
                """Third level of nesting with variable capture."""
                # Access variables from all outer scopes
                combined = f"{outer_var}-{level_one_var}-{level_two_var}"
                # Call helper from deep nested context
                helper_result = helper()
                return combined

            # Call nested function and helper
            nested_result = level_three()
            helper_in_two = helper()

            return {
                "level_two_var": level_two_var,
                "nested_result": nested_result,
                "helper_in_two": helper_in_two,
            }

        # Call nested function and helper
        two_result = level_two()
        helper_in_one = helper()

        return {
            "level_one_var": level_one_var,
            "two_result": two_result,
            "helper_in_one": helper_in_one,
        }

    # Call nested function and helper
    one_result = level_one()
    helper_in_outer = helper()

    return {
        "outer_var": outer_var,
        "one_result": one_result,
        "helper_in_outer": helper_in_outer,
    }


# Test closure creation and usage
counter = create_counter(10)
multiplier = create_multiplier(5)

# Call closures
count1 = counter()
count2 = counter()
count3 = counter()

product1 = multiplier(3)
product2 = multiplier(7)

# Test decorated function
greeting = greet("Alice")

# Test complex nested scopes
nested_result = complex_nested_scopes()

# Lambda with closure
captured_value = 42
lambda_closure = lambda x: x + captured_value
lambda_result = lambda_closure(8)

# Store results
results = {
    "counter": counter,
    "multiplier": multiplier,
    "count1": count1,
    "count2": count2,
    "count3": count3,
    "product1": product1,
    "product2": product2,
    "greeting": greeting,
    "nested_result": nested_result,
    "lambda_result": lambda_result,
}