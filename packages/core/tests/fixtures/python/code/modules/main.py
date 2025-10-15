"""
Cross-module imports - main.py
Tests: Python import statements, cross-module function calls
"""

# Different import patterns
from .utils import helper, process_data, calculate_total
import modules.utils as utils_module

# Cross-module function calls using direct imports
greeting = helper()
processed = process_data("hello world")

# Using imported function with data
items = [
    {"name": "item1", "price": 10.99},
    {"name": "item2", "price": 20.50}
]
total = calculate_total(items)

# Cross-module function call using module import
is_valid = utils_module.validate_user_data("John Doe", "john@example.com")

# Store results for potential export
results = {
    "greeting": greeting,
    "processed": processed,
    "total": total,
    "is_valid": is_valid,
}