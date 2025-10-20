"""
Core module in nested package - core.py
Tests: Deep nested package imports
"""


def core_function() -> str:
    """Core function from nested package."""
    return "core function result"


class CoreClass:
    """Core class from nested package."""

    def __init__(self, value: str):
        self.value = value

    def get_value(self) -> str:
        return self.value
