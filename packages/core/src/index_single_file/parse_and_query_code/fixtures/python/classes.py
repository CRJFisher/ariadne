# Test fixture: Python classes with inheritance, methods, and properties

class SimpleClass:
    """A simple class with basic methods."""

    def __init__(self, value):
        self.value = value

    def get_value(self):
        return self.value

    def set_value(self, new_value):
        self.value = new_value

class BaseClass:
    """Base class for inheritance testing."""

    class_var = "shared"

    def __init__(self):
        self.instance_var = "instance"

    def base_method(self):
        return "base"

    @staticmethod
    def static_method():
        return "static"

    @classmethod
    def class_method(cls):
        return cls.class_var

class DerivedClass(BaseClass):
    """Derived class with method overrides."""

    def __init__(self):
        super().__init__()
        self.derived_var = "derived"

    def base_method(self):
        # Override base method
        return super().base_method() + "_derived"

    def derived_method(self):
        return self.derived_var

class MultipleInheritance(BaseClass, SimpleClass):
    """Test multiple inheritance."""

    def __init__(self, value):
        BaseClass.__init__(self)
        SimpleClass.__init__(self, value)

    def combined_method(self):
        return self.base_method() + str(self.get_value())

class PropertyClass:
    """Class with property decorators."""

    def __init__(self):
        self._private = 0

    @property
    def value(self):
        """Getter for value."""
        return self._private

    @value.setter
    def value(self, val):
        """Setter for value."""
        self._private = val

    @value.deleter
    def value(self):
        """Deleter for value."""
        del self._private

    @property
    def readonly(self):
        """Read-only property."""
        return "readonly"

class AbstractClass:
    """Abstract class with abstract methods."""

    def concrete_method(self):
        return "concrete"

    def abstract_method(self):
        raise NotImplementedError

class NestedClass:
    """Class with nested class definition."""

    class Inner:
        """Inner nested class."""

        def inner_method(self):
            return "inner"

    def create_inner(self):
        return self.Inner()

class MagicMethods:
    """Class with magic/dunder methods."""

    def __init__(self, data):
        self.data = data

    def __str__(self):
        return f"MagicMethods({self.data})"

    def __repr__(self):
        return f"MagicMethods(data={self.data!r})"

    def __len__(self):
        return len(self.data)

    def __getitem__(self, key):
        return self.data[key]

    def __setitem__(self, key, value):
        self.data[key] = value

    def __call__(self, *args):
        return self.data(*args)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

class GenericClass:
    """Class with generic type usage."""

    def process_list(self, items: list[int]) -> list[int]:
        return [x * 2 for x in items]

    def process_dict(self, data: dict[str, any]) -> dict:
        return {k: str(v) for k, v in data.items()}

# Test instantiation and method calls
instance = SimpleClass(42)
value = instance.get_value()
instance.set_value(100)

derived = DerivedClass()
base_result = derived.base_method()
derived_result = derived.derived_method()

# Static and class method calls
static_result = BaseClass.static_method()
class_result = BaseClass.class_method()

# Property access
prop_obj = PropertyClass()
prop_obj.value = 10
current_value = prop_obj.value
readonly_val = prop_obj.readonly

# Method chaining
class ChainableClass:
    def method_a(self):
        return self

    def method_b(self):
        return self

    def final_method(self):
        return "done"

chained = ChainableClass().method_a().method_b().final_method()