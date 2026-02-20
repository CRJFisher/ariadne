"""
Python language features - language_features.py
Tests: List comprehensions, context managers, generators, with function calls
"""

from typing import Iterator, List, Dict, Any, Generator
from contextlib import contextmanager
import io


def helper() -> str:
    """Helper function for language feature testing."""
    return "helper result"


def process_item(item: int) -> int:
    """Process a single item."""
    return item * 2


def validate_item(item: int) -> bool:
    """Validate a single item."""
    return item % 2 == 0


def transform_string(s: str) -> str:
    """Transform a string."""
    return s.upper()


# List comprehensions with function calls
numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

# Simple list comprehension with function call
processed_numbers = [process_item(x) for x in numbers]

# List comprehension with filter and function call
even_processed = [process_item(x) for x in numbers if validate_item(x)]

# Nested list comprehension with function calls
matrix = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
flattened_processed = [process_item(item) for row in matrix for item in row]

# Dictionary comprehension with function calls
string_dict = {str(x): transform_string(f"item_{x}") for x in numbers[:5]}

# Set comprehension with function calls
processed_set = {process_item(x) for x in numbers if validate_item(x)}


# Generator functions with nested calls
def number_generator(limit: int) -> Generator[int, None, None]:
    """Generator that yields processed numbers."""
    for i in range(limit):
        # Function call within generator
        helper_result = helper()
        processed = process_item(i)
        yield processed


def fibonacci_generator() -> Generator[int, None, None]:
    """Fibonacci generator with function calls."""
    a, b = 0, 1
    while True:
        # Call helper in generator loop
        helper_result = helper()
        yield a
        a, b = b, a + b


# Context manager class
class ResourceManager:
    """Custom context manager for testing."""

    def __init__(self, name: str) -> None:
        """Initialize resource manager."""
        self.name = name
        self.resource = None

    def __enter__(self) -> 'ResourceManager':
        """Enter context manager."""
        # Function call in __enter__
        helper_result = helper()
        self.resource = f"resource_{self.name}"
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        """Exit context manager."""
        # Function call in __exit__
        helper_result = helper()
        self.resource = None

    def process(self) -> str:
        """Process method for context manager."""
        return f"processing {self.resource}"


@contextmanager
def simple_context(name: str) -> Iterator[str]:
    """Simple context manager using decorator."""
    # Function call before yield
    helper_result = helper()
    resource = f"context_{name}"
    try:
        yield resource
    finally:
        # Function call in finally block
        cleanup_result = helper()


# Generator usage with function calls
gen = number_generator(5)
first_three = [next(gen) for _ in range(3)]

fib_gen = fibonacci_generator()
first_fib = [next(fib_gen) for _ in range(5)]

# Context manager usage
with ResourceManager("test") as rm:
    # Function calls within context
    resource_helper = helper()
    processed_resource = rm.process()

with simple_context("simple") as ctx:
    # Function calls within simple context
    context_helper = helper()
    transformed_ctx = transform_string(ctx)

# Advanced comprehensions with nested function calls
nested_result = [
    {
        "original": x,
        "processed": process_item(x),
        "helper": helper(),
        "valid": validate_item(x)
    }
    for x in numbers[:5]
    if validate_item(process_item(x))
]

# Lambda with function calls in comprehension
lambda_result = [
    (lambda x: process_item(x) + len(helper()))(x)
    for x in numbers[:3]
]

# Store results
results = {
    "processed_numbers": processed_numbers,
    "even_processed": even_processed,
    "flattened_processed": flattened_processed,
    "string_dict": string_dict,
    "processed_set": processed_set,
    "first_three": first_three,
    "first_fib": first_fib,
    "processed_resource": processed_resource,
    "transformed_ctx": transformed_ctx,
    "nested_result": nested_result,
    "lambda_result": lambda_result,
}