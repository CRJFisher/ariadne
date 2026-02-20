"""
Nested imports module - nested_imports.py
Tests: Multi-level relative imports (from .. and from ..module)
"""

# Multi-level relative import - go up 2 levels to modules/utils.py
from ...modules.utils import helper, process_data

# Parent directory relative import - import from parent package
from .. import subpackage

# Import from sibling module
from .core import core_function, CoreClass


def test_nested_imports() -> dict:
    """Test that all nested imports work correctly."""
    return {
        "helper": helper(),
        "process_data": process_data("test"),
        "core": core_function(),
    }


# Use imported class
instance = CoreClass("test value")
result = instance.get_value()
