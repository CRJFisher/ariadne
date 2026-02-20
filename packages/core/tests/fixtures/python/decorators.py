"""
Python Decorators Test Fixture
Contains various decorator patterns for testing semantic analysis
"""

import functools
from typing import Callable, Any
from dataclasses import dataclass

# Simple decorator
def simple_decorator(func):
    """Simple function decorator"""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        print(f"Calling {func.__name__}")
        return func(*args, **kwargs)
    return wrapper

# Parametrized decorator
def repeat(times: int):
    """Decorator factory that repeats execution"""
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for _ in range(times):
                result = func(*args, **kwargs)
            return result
        return wrapper
    return decorator

# Class-based decorator
class CountCalls:
    """Class-based decorator to count function calls"""

    def __init__(self, func):
        self.func = func
        self.count = 0
        functools.update_wrapper(self, func)

    def __call__(self, *args, **kwargs):
        self.count += 1
        print(f"Call {self.count} of {self.func.__name__}")
        return self.func(*args, **kwargs)

# Method decorator
def validate_args(func):
    """Decorator for method argument validation"""
    @functools.wraps(func)
    def wrapper(self, *args, **kwargs):
        # Validation logic here
        return func(self, *args, **kwargs)
    return wrapper

# Property decorators
class PropertyExample:
    """Class demonstrating property decorators"""

    def __init__(self, value: int = 0):
        self._value = value

    @property
    def value(self) -> int:
        """Property getter"""
        return self._value

    @value.setter
    def value(self, new_value: int) -> None:
        """Property setter"""
        if new_value < 0:
            raise ValueError("Value must be non-negative")
        self._value = new_value

    @value.deleter
    def value(self) -> None:
        """Property deleter"""
        self._value = 0

# Static and class method decorators
class MethodDecorators:
    """Class demonstrating static and class method decorators"""

    class_var = "class_variable"

    @staticmethod
    def static_method(x: int, y: int) -> int:
        """Static method example"""
        return x + y

    @classmethod
    def class_method(cls, name: str) -> str:
        """Class method example"""
        return f"{cls.class_var}: {name}"

    @validate_args
    def instance_method(self, data: str) -> str:
        """Instance method with decorator"""
        return f"Processed: {data}"

# Multiple decorators
@simple_decorator
@repeat(3)
def multiple_decorated_function(message: str) -> str:
    """Function with multiple decorators"""
    print(message)
    return message

# Alternative name for testing
@simple_decorator
@repeat(2)
def multi_decorated_function(message: str) -> str:
    """Another function with multiple decorators"""
    print(message)
    return message

@CountCalls
def counted_function(x: int) -> int:
    """Function with class-based decorator"""
    return x * 2

# Decorated class
@simple_decorator
class DecoratedClass:
    """Class with decorator"""

    def __init__(self, name: str):
        self.name = name

    def get_name(self) -> str:
        return self.name

# Dataclass examples
@dataclass
class DataClassExample:
    """Example dataclass with decorator"""
    name: str
    age: int
    active: bool = True

    def greet(self) -> str:
        return f"Hello, I'm {self.name}"

@dataclass(frozen=True)
class FrozenDataClass:
    """Frozen dataclass example"""
    id: int
    value: str

# Context manager decorator
from contextlib import contextmanager

@contextmanager
def custom_context():
    """Custom context manager using decorator"""
    print("Entering context")
    try:
        yield "context_value"
    finally:
        print("Exiting context")

# Async decorator
import asyncio

def async_decorator(func):
    """Decorator for async functions"""
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        print(f"Async calling {func.__name__}")
        return await func(*args, **kwargs)
    return wrapper

@async_decorator
async def async_function(delay: float) -> str:
    """Async function with decorator"""
    await asyncio.sleep(delay)
    return "Async result"

# Decorator with arguments and kwargs
def log_calls(level: str = "INFO", include_args: bool = True):
    """Decorator factory with multiple arguments"""
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            if include_args:
                print(f"[{level}] Calling {func.__name__} with args={args}, kwargs={kwargs}")
            else:
                print(f"[{level}] Calling {func.__name__}")
            return func(*args, **kwargs)
        return wrapper
    return decorator

@log_calls(level="DEBUG", include_args=False)
def logged_function(x: int, y: int = 10) -> int:
    """Function with parametrized decorator"""
    return x + y

# Chained property decorators
class ChainedProperties:
    """Class with chained property decorators"""

    def __init__(self):
        self._temperature = 0

    @property
    def temperature(self) -> float:
        return self._temperature

    @temperature.setter
    def temperature(self, value: float) -> None:
        self._temperature = value

    @property
    def read_only(self) -> str:
        """Read-only property"""
        return "read_only_value"

    @property
    def fahrenheit(self) -> float:
        return self._temperature * 9/5 + 32

    @fahrenheit.setter
    def fahrenheit(self, value: float) -> None:
        self._temperature = (value - 32) * 5/9

# Use decorated functions
if __name__ == "__main__":
    # Test simple decorator
    @simple_decorator
    def test_function():
        return "test"

    result = test_function()

    # Test parametrized decorator
    result2 = multiple_decorated_function("Hello")

    # Test class decorator
    result3 = counted_function(5)

    # Test property decorators
    prop_example = PropertyExample()
    prop_example.value = 42
    print(prop_example.value)