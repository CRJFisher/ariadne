"""
Comprehensive Python definitions test fixture
Tests all symbol definition types and Python-specific behaviors
"""

# Module-level variables and constants
MODULE_CONSTANT = "constant"
module_variable = 42
_private_variable = "private"

# Basic functions
def simple_function():
    """Simple function definition"""
    return "hello"

def function_with_params(param1, param2="default"):
    """Function with parameters"""
    return param1 + param2

def function_with_annotations(param: str) -> str:
    """Function with type annotations"""
    return param.upper()

async def async_function() -> str:
    """Async function"""
    return "async"

def generator_function():
    """Generator function"""
    yield 1
    yield 2
    yield 3

# Lambda function
lambda_function = lambda x: x * 2

# Class definitions
class SimpleClass:
    """Simple class definition"""

    # Class variables
    class_variable = "class_var"
    _private_class_var = "private"

    def __init__(self, name, age):
        """Constructor method"""
        self.name = name  # Instance variable
        self.age = age
        self._private_instance = "private"

    def instance_method(self):
        """Instance method"""
        return self.name

    @classmethod
    def class_method(cls):
        """Class method"""
        return cls.class_variable

    @staticmethod
    def static_method():
        """Static method"""
        return "static"

    @property
    def age_property(self):
        """Property getter"""
        return self._age

    @age_property.setter
    def age_property(self, value):
        """Property setter"""
        self._age = value

# Inheritance
class BaseClass:
    """Base class for inheritance"""

    def __init__(self, value):
        self.value = value

    def base_method(self):
        return self.value

class DerivedClass(BaseClass):
    """Derived class"""

    def __init__(self, value, extra):
        super().__init__(value)
        self.extra = extra

    def base_method(self):
        """Override base method"""
        return f"derived: {self.value}"

    def derived_method(self):
        return self.extra

# Multiple inheritance
class Mixin:
    """Mixin class"""

    def mixin_method(self):
        return "mixin"

class MultipleInheritance(BaseClass, Mixin):
    """Class with multiple inheritance"""

    def __init__(self, value):
        super().__init__(value)

# Abstract base class (using abc module concepts)
class AbstractBase:
    """Abstract base class"""

    def concrete_method(self):
        return "concrete"

    def abstract_method(self):
        raise NotImplementedError("Must implement abstract_method")

# Dataclass-style class
class DataClassStyle:
    """Dataclass-style class"""

    def __init__(self, name: str, age: int, email: str = ""):
        self.name = name
        self.age = age
        self.email = email

# Nested classes
class OuterClass:
    """Outer class with nested definitions"""

    outer_var = "outer"

    class NestedClass:
        """Nested class"""

        nested_var = "nested"

        def __init__(self, data):
            self.data = data

        def nested_method(self):
            return self.data

    def outer_method(self):
        """Method with local definitions"""

        # Local variable
        local_var = "local"

        # Local function
        def local_function():
            return local_var + self.outer_var

        # Local class
        class LocalClass:
            def __init__(self, value):
                self.value = value

        return local_function()

# Decorators
def decorator_function(func):
    """Function decorator"""
    def wrapper(*args, **kwargs):
        result = func(*args, **kwargs)
        return f"decorated: {result}"
    return wrapper

def parametrized_decorator(param):
    """Parametrized decorator"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            result = func(*args, **kwargs)
            return f"{param}: {result}"
        return wrapper
    return decorator

@decorator_function
def decorated_function():
    """Decorated function"""
    return "function"

@parametrized_decorator("custom")
def parametrized_decorated_function():
    """Function with parametrized decorator"""
    return "function"

# Class decorators
@decorator_function
class DecoratedClass:
    """Decorated class"""

    @decorator_function
    def decorated_method(self):
        return "method"

    @property
    @decorator_function
    def decorated_property(self):
        return "property"

# Exception classes
class CustomException(Exception):
    """Custom exception"""

    def __init__(self, message):
        super().__init__(message)
        self.message = message

class SpecificError(CustomException):
    """Specific error type"""
    pass

# Context managers
class ContextManager:
    """Context manager class"""

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

# Magic methods
class MagicMethods:
    """Class with magic methods"""

    def __init__(self, value):
        self.value = value

    def __str__(self):
        return str(self.value)

    def __repr__(self):
        return f"MagicMethods({self.value})"

    def __add__(self, other):
        return MagicMethods(self.value + other.value)

    def __getitem__(self, key):
        return self.value[key]

    def __setitem__(self, key, value):
        self.value[key] = value

# Type variables and generics (typing module concepts)
from typing import TypeVar, Generic, List, Dict, Optional, Union

T = TypeVar('T')
K = TypeVar('K')
V = TypeVar('V')

class GenericClass(Generic[T]):
    """Generic class"""

    def __init__(self, data: T):
        self.data = data

    def get_data(self) -> T:
        return self.data

class GenericDict(Generic[K, V]):
    """Generic dictionary-like class"""

    def __init__(self):
        self._data: Dict[K, V] = {}

    def set_item(self, key: K, value: V) -> None:
        self._data[key] = value

    def get_item(self, key: K) -> Optional[V]:
        return self._data.get(key)

# Type aliases
StringList = List[str]
IntDict = Dict[str, int]
OptionalString = Optional[str]
UnionType = Union[str, int]

# Function with complex type annotations
def complex_typed_function(
    param1: List[str],
    param2: Dict[str, int],
    param3: Optional[str] = None,
    *args: str,
    **kwargs: int
) -> Union[str, None]:
    """Function with complex type annotations"""
    return param3

# Variables with type annotations
annotated_string: str = "hello"
annotated_list: List[int] = [1, 2, 3]
annotated_dict: Dict[str, str] = {"key": "value"}

# Global variables that test hoisting behavior
try:
    # This variable is defined conditionally
    conditional_variable = "conditional"
except:
    conditional_variable = "fallback"

# Variables in different scopes
if True:
    block_variable = "block"  # Not hoisted in Python

def scope_test_function():
    """Function to test variable scoping"""
    function_variable = "function"  # Local to function

    if True:
        nested_block_variable = "nested"  # Still function scope in Python

    return function_variable, nested_block_variable

# Import statements (would be at top in real code)
# These are here to test import handling
import os
import sys as system
from typing import Any, Callable
from collections import defaultdict, OrderedDict