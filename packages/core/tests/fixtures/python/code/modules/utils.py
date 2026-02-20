"""
Custom module utilities - utils.py
Tests: Python module function definitions for cross-module resolution
"""

from typing import List, Dict, Any


def helper() -> str:
    """Helper function for cross-module testing."""
    return "from utils"


def process_data(input_data: str) -> str:
    """Process input data by converting to uppercase."""
    return input_data.upper()


def calculate_total(items: List[Dict[str, Any]]) -> float:
    """Calculate total price from list of items."""
    return sum(item.get("price", 0) for item in items)


def validate_user_data(name: str, email: str) -> bool:
    """Validate user input data."""
    return bool(name and email and "@" in email)