# Test fixture: Comprehensive Python exports
"""
Comprehensive exports fixture for testing Python export handling.
"""

from typing import Any, List, Dict
from collections import defaultdict, Counter
import os
import sys

# Public functions that should be in __all__
def public_function() -> str:
    """A public function."""
    return "public"

def another_public_function(x: int, y: int) -> int:
    """Another public function."""
    return x + y

# Private function (not in __all__ by convention)
def _private_function() -> str:
    """A private function."""
    return "private"

# Magic/dunder function
def __special_function__() -> None:
    """A special dunder function."""
    pass

# Public classes
class PublicClass:
    """A public class."""

    def __init__(self, value: Any):
        self.value = value

    def get_value(self) -> Any:
        return self.value

    def set_value(self, value: Any) -> None:
        self.value = value

class UtilityClass:
    """A utility class."""

    @staticmethod
    def utility_method() -> str:
        return "utility"

    @classmethod
    def from_string(cls, s: str) -> 'UtilityClass':
        return cls()

# Private class
class _PrivateClass:
    """A private class."""
    pass

# Constants
PUBLIC_CONSTANT = 42
_private_constant = "hidden"
__version__ = "1.0.0"

# Variables with different naming conventions
public_variable = "visible"
_protected_variable = "protected"

# Re-exports from other modules
from collections import defaultdict as default_dict
from typing import List as ListType

# Complex __all__ definition
__all__ = [
    "public_function",
    "another_public_function",
    "PublicClass",
    "UtilityClass",
    "PUBLIC_CONSTANT",
    "public_variable",
    # Re-exported items
    "default_dict",
    "ListType",
]

# Additional symbols not in __all__
def unlisted_function() -> None:
    """Function not in __all__."""
    pass

class UnlistedClass:
    """Class not in __all__."""
    pass

# Test module-level code
if __name__ == "__main__":
    print("Running comprehensive exports module")