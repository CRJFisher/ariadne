"""
Comprehensive Type Hints Test Fixture
Contains various Python type annotation patterns for semantic analysis testing
"""

from typing import (
    List, Dict, Set, Tuple, Optional, Union, Any, Callable,
    TypeVar, Generic, Protocol, Literal, Final, ClassVar,
    Awaitable, AsyncIterator, Iterator, Generator, Type,
    overload, cast
)
from typing_extensions import NotRequired, TypedDict
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum, IntEnum
import asyncio
from collections.abc import Sequence, Mapping

# Type variables
T = TypeVar('T')
K = TypeVar('K')
V = TypeVar('V')
NumberT = TypeVar('NumberT', int, float)

# Basic type annotations
def basic_types(
    string_param: str,
    int_param: int,
    float_param: float,
    bool_param: bool,
    none_param: None
) -> str:
    """Function with basic type annotations"""
    return f"{string_param}: {int_param}"

# Collection types
def collection_types(
    list_param: List[str],
    dict_param: Dict[str, int],
    set_param: Set[float],
    tuple_param: Tuple[str, int, bool]
) -> Dict[str, Any]:
    """Function with collection type annotations"""
    return {
        "list": list_param,
        "dict": dict_param,
        "set": set_param,
        "tuple": tuple_param
    }

# Optional and Union types
def optional_union_types(
    optional_param: Optional[str] = None,
    union_param: Union[str, int, None] = None,
    literal_param: Literal["red", "green", "blue"] = "red"
) -> Optional[Union[str, int]]:
    """Function with Optional and Union types"""
    if optional_param:
        return optional_param
    return union_param

# Generic function
def generic_function(items: List[T]) -> Optional[T]:
    """Generic function with type variable"""
    return items[0] if items else None

# Function type annotations
def higher_order_function(
    callback: Callable[[str, int], str],
    transform: Callable[[T], T]
) -> Callable[[], str]:
    """Function with callable type annotations"""
    def inner() -> str:
        result = callback("test", 42)
        return result
    return inner

# Class with type annotations
class TypedClass(Generic[T]):
    """Generic class with comprehensive type annotations"""

    class_var: ClassVar[str] = "class_variable"
    final_var: Final[int] = 42

    def __init__(self, value: T, items: List[T]) -> None:
        self.value: T = value
        self.items: List[T] = items
        self.optional_value: Optional[T] = None
        self._private_value: str = "private"

    def get_value(self) -> T:
        """Return the stored value"""
        return self.value

    def set_value(self, new_value: T) -> None:
        """Set a new value"""
        self.value = new_value

    def process_items(self, processor: Callable[[T], str]) -> List[str]:
        """Process items with a callback"""
        return [processor(item) for item in self.items]

    @classmethod
    def create_empty(cls) -> 'TypedClass[str]':
        """Create an empty instance"""
        return cls("", [])

    @staticmethod
    def utility_function(x: int, y: int) -> int:
        """Static utility function"""
        return x + y

# Protocol definition
class Drawable(Protocol):
    """Protocol for drawable objects"""

    def draw(self) -> None:
        """Draw the object"""
        ...

    def get_area(self) -> float:
        """Get the area of the object"""
        ...

# Class implementing protocol
class Circle:
    """Circle class implementing Drawable protocol"""

    def __init__(self, radius: float) -> None:
        self.radius: float = radius

    def draw(self) -> None:
        print(f"Drawing circle with radius {self.radius}")

    def get_area(self) -> float:
        return 3.14159 * self.radius ** 2

# Abstract base class
class Shape(ABC):
    """Abstract base class for shapes"""

    def __init__(self, name: str) -> None:
        self.name: str = name

    @abstractmethod
    def calculate_area(self) -> float:
        """Calculate the area of the shape"""
        pass

    def describe(self) -> str:
        """Describe the shape"""
        return f"This is a {self.name} with area {self.calculate_area()}"

class Rectangle(Shape):
    """Rectangle implementation of Shape"""

    def __init__(self, width: float, height: float) -> None:
        super().__init__("rectangle")
        self.width: float = width
        self.height: float = height

    def calculate_area(self) -> float:
        return self.width * self.height

# Dataclass with type annotations
@dataclass
class Person:
    """Person dataclass with type annotations"""
    name: str
    age: int
    email: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

# TypedDict
class UserDict(TypedDict):
    """TypedDict for user data"""
    id: int
    name: str
    email: str
    active: bool
    roles: List[str]

class PartialUserDict(TypedDict, total=False):
    """Partial TypedDict where all fields are optional"""
    id: NotRequired[int]
    name: str
    email: NotRequired[str]

# Enum with type annotations
class Color(Enum):
    """Color enumeration"""
    RED = "red"
    GREEN = "green"
    BLUE = "blue"

class Priority(IntEnum):
    """Priority integer enumeration"""
    LOW = 1
    MEDIUM = 2
    HIGH = 3

# Async function with type annotations
async def async_function(delay: float) -> str:
    """Async function with type annotations"""
    await asyncio.sleep(delay)
    return "completed"

async def async_generator() -> AsyncIterator[int]:
    """Async generator with type annotations"""
    for i in range(5):
        await asyncio.sleep(0.1)
        yield i

# Generator with type annotations
def number_generator(start: int, end: int) -> Generator[int, None, None]:
    """Generator function with type annotations"""
    current = start
    while current < end:
        yield current
        current += 1

# Function overloading
@overload
def process_data(data: str) -> str: ...

@overload
def process_data(data: int) -> int: ...

@overload
def process_data(data: List[str]) -> List[str]: ...

def process_data(data: Union[str, int, List[str]]) -> Union[str, int, List[str]]:
    """Overloaded function with multiple signatures"""
    if isinstance(data, str):
        return data.upper()
    elif isinstance(data, int):
        return data * 2
    elif isinstance(data, list):
        return [item.upper() for item in data]
    else:
        raise ValueError("Unsupported data type")

# Complex nested types
NestedDict = Dict[str, Dict[str, List[Tuple[str, int]]]]
CallbackType = Callable[[str, int], Awaitable[Optional[str]]]
ComplexGeneric = Dict[K, List[Tuple[V, Optional[V]]]]

def complex_types_function(
    nested: NestedDict,
    callback: CallbackType,
    generic_data: ComplexGeneric[str, int]
) -> Tuple[NestedDict, bool]:
    """Function with complex nested type annotations"""
    return nested, bool(generic_data)

# Type casting and type checking
def type_operations(data: Any) -> str:
    """Function demonstrating type operations"""
    # Type casting
    string_data = cast(str, data)

    # Type checking
    if isinstance(data, str):
        return data.upper()
    elif isinstance(data, (int, float)):
        return str(data)
    else:
        return repr(data)

# Forward reference
class Node:
    """Node class with forward reference"""

    def __init__(self, value: int, parent: Optional['Node'] = None) -> None:
        self.value: int = value
        self.parent: Optional['Node'] = parent
        self.children: List['Node'] = []

    def add_child(self, child: 'Node') -> None:
        """Add a child node"""
        child.parent = self
        self.children.append(child)

# Class with type annotations for properties
class Temperature:
    """Temperature class with typed properties"""

    def __init__(self, celsius: float) -> None:
        self._celsius: float = celsius

    @property
    def celsius(self) -> float:
        """Get temperature in Celsius"""
        return self._celsius

    @celsius.setter
    def celsius(self, value: float) -> None:
        """Set temperature in Celsius"""
        self._celsius = value

    @property
    def fahrenheit(self) -> float:
        """Get temperature in Fahrenheit"""
        return self._celsius * 9/5 + 32

    @fahrenheit.setter
    def fahrenheit(self, value: float) -> None:
        """Set temperature in Fahrenheit"""
        self._celsius = (value - 32) * 5/9

# Module-level variables with type annotations
module_string: str = "module_level"
module_list: List[int] = [1, 2, 3, 4, 5]
module_dict: Dict[str, Any] = {"key": "value", "number": 42}
module_optional: Optional[str] = None

# Complex type aliases
StringProcessor = Callable[[str], str]
AsyncStringProcessor = Callable[[str], Awaitable[str]]
DataMapper = Callable[[T], Dict[str, Any]]
EventHandler = Callable[[str, Dict[str, Any]], None]

# Function using type aliases
def use_type_aliases(
    processor: StringProcessor,
    async_processor: AsyncStringProcessor,
    mapper: DataMapper[Person],
    handler: EventHandler
) -> None:
    """Function using various type aliases"""
    result = processor("test")
    person = Person("John", 30)
    mapped_data = mapper(person)
    handler("user_created", mapped_data)

# Additional generic classes for testing
class GenericContainer(Generic[T, K]):
    """Generic container class for testing"""

    def __init__(self) -> None:
        self.items: Dict[K, T] = {}

    def add(self, key: K, value: T) -> None:
        self.items[key] = value

    def get(self, key: K) -> Optional[T]:
        return self.items.get(key)

class GenericProcessor(Generic[T]):
    """Generic processor class for testing"""

    def process(self, item: T) -> T:
        return item