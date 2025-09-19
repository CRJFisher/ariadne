# Test fixture: Python type annotations and type hints

from typing import (
    Any, Union, Optional, List, Dict, Tuple, Set,
    Callable, TypeVar, Generic, Protocol, Literal,
    TypedDict, Final, ClassVar, cast, overload
)
from collections.abc import Sequence, Mapping
from dataclasses import dataclass
from enum import Enum

# Basic type annotations
simple_int: int = 42
simple_str: str = "hello"
simple_float: float = 3.14
simple_bool: bool = True
simple_none: None = None

# Container type annotations
list_of_ints: list[int] = [1, 2, 3]
dict_str_int: dict[str, int] = {"a": 1, "b": 2}
tuple_mixed: tuple[int, str, float] = (1, "two", 3.0)
set_of_str: set[str] = {"a", "b", "c"}

# Union types
union_type: Union[int, str] = 42
union_type = "now a string"

# Optional types (Union with None)
optional_int: Optional[int] = None
optional_int = 10
optional_str: int | None = None  # Python 3.10+ syntax

# Type aliases
Vector = list[float]
Matrix = list[list[float]]
JsonValue = Union[str, int, float, bool, None, Dict[str, Any], List[Any]]

my_vector: Vector = [1.0, 2.0, 3.0]
my_matrix: Matrix = [[1.0, 2.0], [3.0, 4.0]]
json_data: JsonValue = {"key": [1, 2, "three"]}

# Generic types
T = TypeVar('T')
K = TypeVar('K')
V = TypeVar('V')

class GenericContainer(Generic[T]):
    """A generic container class."""

    def __init__(self, value: T) -> None:
        self.value: T = value

    def get(self) -> T:
        return self.value

    def set(self, value: T) -> None:
        self.value = value

class GenericMapping(Generic[K, V]):
    """A generic mapping class."""

    def __init__(self) -> None:
        self.data: dict[K, V] = {}

    def put(self, key: K, value: V) -> None:
        self.data[key] = value

    def get(self, key: K) -> V | None:
        return self.data.get(key)

# Constrained type variables
Number = TypeVar('Number', int, float)

def add_numbers(a: Number, b: Number) -> Number:
    """Function with constrained type variable."""
    return a + b

# Callable types
simple_callback: Callable[[int], str] = lambda x: str(x)
complex_callback: Callable[[int, str], dict[str, any]] = lambda i, s: {s: i}
no_arg_callback: Callable[[], None] = lambda: None

# Protocol (structural subtyping)
class Drawable(Protocol):
    """Protocol defining drawable objects."""

    def draw(self) -> None: ...

class Shape:
    """Class implicitly implementing Drawable protocol."""

    def draw(self) -> None:
        print("Drawing shape")

# TypedDict
class PersonDict(TypedDict):
    """TypedDict for person data."""
    name: str
    age: int
    email: Optional[str]

person_data: PersonDict = {
    "name": "Alice",
    "age": 30,
    "email": "alice@example.com"
}

# Literal types
Mode = Literal["read", "write", "append"]

def open_file(name: str, mode: Mode) -> None:
    """Function with literal type parameter."""
    pass

# Final and ClassVar
class Configuration:
    """Class with final and class variables."""

    MAX_SIZE: Final[int] = 100
    default_timeout: ClassVar[float] = 30.0

    def __init__(self) -> None:
        self.instance_var: str = "instance"

# Dataclass with type annotations
@dataclass
class Point:
    """Dataclass with type annotations."""
    x: float
    y: float
    z: float = 0.0

    def distance_from_origin(self) -> float:
        """Calculate distance from origin."""
        return (self.x ** 2 + self.y ** 2 + self.z ** 2) ** 0.5

# Enum with type hints
class Status(Enum):
    """Enum with typed values."""
    PENDING: str = "pending"
    RUNNING: str = "running"
    COMPLETED: str = "completed"
    FAILED: str = "failed"

# Function overloads
@overload
def process(data: str) -> str: ...

@overload
def process(data: int) -> int: ...

@overload
def process(data: list) -> list: ...

def process(data: Union[str, int, list]) -> Union[str, int, list]:
    """Function with overloaded signatures."""
    if isinstance(data, str):
        return data.upper()
    elif isinstance(data, int):
        return data * 2
    else:
        return data * 2

# Type casting
unknown_value: Any = "42"
casted_int: int = cast(int, unknown_value)

# Complex nested types
ComplexType = dict[str, list[tuple[int, Optional[str]]]]
complex_data: ComplexType = {
    "items": [(1, "one"), (2, None), (3, "three")]
}

# Forward references
class Node:
    """Class with forward reference."""

    def __init__(self, value: int, next_node: Optional['Node'] = None) -> None:
        self.value: int = value
        self.next: Optional['Node'] = next_node

# Type annotations in different contexts
def generic_function(
    items: Sequence[T],
    transform: Callable[[T], V]
) -> list[V]:
    """Generic function with type parameters."""
    return [transform(item) for item in items]

class AnnotatedClass:
    """Class with various type annotations."""

    class_attr: ClassVar[int] = 0

    def __init__(self, value: int) -> None:
        self.instance_attr: int = value
        self._private: Optional[str] = None

    def method_with_return(self) -> int:
        """Method with return type annotation."""
        return self.instance_attr

    def method_with_params(self, x: int, y: str = "default") -> tuple[int, str]:
        """Method with parameter and return annotations."""
        return x, y

    @property
    def typed_property(self) -> str:
        """Property with type annotation."""
        return self._private or ""

    @typed_property.setter
    def typed_property(self, value: str) -> None:
        """Setter with type annotation."""
        self._private = value