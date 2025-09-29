# Test fixture for Python class inheritance and type resolution

from typing import List, Dict, Optional, Generic, TypeVar
from abc import ABC, abstractmethod

T = TypeVar('T')

class BaseClass:
    """Base class with various member types"""

    def __init__(self, name: str):
        self.name: str = name
        self.base_value: int = 100

    def base_method(self) -> str:
        return f"Base: {self.name}"

    @classmethod
    def class_method(cls) -> str:
        return "class method"

    @staticmethod
    def static_method() -> str:
        return "static method"

    @property
    def computed_value(self) -> int:
        return self.base_value * 2


class DerivedClass(BaseClass):
    """Derived class with additional members and overrides"""

    def __init__(self, name: str, extra: float):
        super().__init__(name)
        self.extra_value: float = extra
        self._private_value: int = 42

    def base_method(self) -> str:
        """Override base method"""
        return f"Derived: {super().base_method()}"

    def derived_method(self, param: Dict[str, Any]) -> List[str]:
        return list(param.keys())

    @property
    def private_value(self) -> int:
        return self._private_value

    @private_value.setter
    def private_value(self, value: int) -> None:
        self._private_value = value


class AbstractBase(ABC):
    """Abstract base class"""

    @abstractmethod
    def abstract_method(self, data: Any) -> bool:
        pass

    def concrete_method(self) -> str:
        return "concrete"


class ConcreteImplementation(AbstractBase, DerivedClass):
    """Multiple inheritance example"""

    def __init__(self):
        DerivedClass.__init__(self, "concrete", 3.14)

    def abstract_method(self, data: Any) -> bool:
        return data is not None


class GenericContainer(Generic[T]):
    """Generic class for testing type parameters"""

    def __init__(self, value: T):
        self._value: T = value

    def get_value(self) -> T:
        return self._value

    def set_value(self, value: T) -> None:
        self._value = value

    def transform(self, func: Callable[[T], T]) -> T:
        return func(self._value)


# Type annotations for testing
def process_data(
    input_data: List[Dict[str, str]],
    processor: Optional[BaseClass] = None
) -> Dict[str, List[int]]:
    """Function with complex type annotations"""
    result: Dict[str, List[int]] = {}
    return result


# Variable with type annotation
typed_variable: List[DerivedClass] = []
optional_value: Optional[BaseClass] = None
union_type: Union[int, str, BaseClass] = 42