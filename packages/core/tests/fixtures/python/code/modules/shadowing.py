"""
Shadowing scenario - shadowing.py
Tests: Local function definition shadows imported function
"""

from .utils import helper, process_data


# Local function with same name as imported function - shadows the import
def helper() -> str:
    """Local helper function that shadows the imported one."""
    return "local helper"


# This call should resolve to LOCAL helper, not imported one
result = helper()

# Use a different imported function to verify imports still work
processed = process_data("test data")

# Store results
results = {
    "result": result,
    "processed": processed,
}