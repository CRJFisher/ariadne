"""
Method types - method_types.py
Tests: @classmethod, @staticmethod, magic methods, instance methods
"""

from typing import Any, Dict, List


class Calculator:
    """Calculator class demonstrating different method types."""

    count = 0  # Class variable

    def __init__(self, name: str) -> None:
        """Constructor method."""
        self.name = name
        self.history: List[str] = []
        Calculator.count += 1

    def add(self, a: float, b: float) -> float:
        """Instance method for addition."""
        result = a + b
        self.history.append(f"add({a}, {b}) = {result}")
        return result

    def multiply(self, a: float, b: float) -> float:
        """Instance method for multiplication."""
        result = a * b
        self.history.append(f"multiply({a}, {b}) = {result}")
        return result

    @classmethod
    def get_count(cls) -> int:
        """Class method to get instance count."""
        return cls.count

    @classmethod
    def create_scientific(cls, name: str) -> 'Calculator':
        """Class method factory for scientific calculator."""
        instance = cls(name)
        instance.history.append("Scientific mode enabled")
        return instance

    @staticmethod
    def validate_input(value: Any) -> bool:
        """Static method for input validation."""
        return isinstance(value, (int, float)) and not isinstance(value, bool)

    @staticmethod
    def convert_to_float(value: str) -> float:
        """Static method for type conversion."""
        return float(value)

    def __str__(self) -> str:
        """Magic method for string representation."""
        return f"Calculator(name={self.name}, operations={len(self.history)})"

    def __repr__(self) -> str:
        """Magic method for detailed representation."""
        return f"Calculator(name='{self.name}', history={self.history})"

    def __eq__(self, other: Any) -> bool:
        """Magic method for equality comparison."""
        if not isinstance(other, Calculator):
            return False
        return self.name == other.name

    def __call__(self, operation: str, a: float, b: float) -> float:
        """Magic method to make instance callable."""
        if operation == "add":
            return self.add(a, b)
        elif operation == "multiply":
            return self.multiply(a, b)
        else:
            raise ValueError(f"Unknown operation: {operation}")


# Test different method calls
calc1 = Calculator("Basic")
calc2 = Calculator("Advanced")

# Instance method calls
sum_result = calc1.add(10.5, 20.3)
product_result = calc1.multiply(5.0, 4.0)

# Class method calls
total_calculators = Calculator.get_count()
scientific_calc = Calculator.create_scientific("Scientific")

# Static method calls
is_valid_number = Calculator.validate_input(42.0)
is_valid_string = Calculator.validate_input("not_a_number")
converted_float = Calculator.convert_to_float("123.45")

# Magic method calls
calc_str = str(calc1)
calc_repr = repr(calc1)
calc_equal = calc1 == calc2
calc_not_equal = calc1 == Calculator("Basic")

# Callable magic method
call_result = calc1("add", 100.0, 200.0)

# Store results
results = {
    "calc1": calc1,
    "calc2": calc2,
    "scientific_calc": scientific_calc,
    "sum_result": sum_result,
    "product_result": product_result,
    "total_calculators": total_calculators,
    "is_valid_number": is_valid_number,
    "is_valid_string": is_valid_string,
    "converted_float": converted_float,
    "calc_str": calc_str,
    "calc_repr": calc_repr,
    "calc_equal": calc_equal,
    "calc_not_equal": calc_not_equal,
    "call_result": call_result,
}