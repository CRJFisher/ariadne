"""
Advanced import patterns - import_patterns.py
Tests: from...import *, aliased imports, multiple imports in one statement
"""

# Import entire module with alias
import modules.utils as utils_mod

# Import specific functions with aliases
from modules.utils import helper as util_helper, process_data as process

# Import multiple items in one statement
from modules.user_class import User
from datetime import datetime, timedelta

# Use aliased module import
greeting = utils_mod.helper()
processed_data = utils_mod.process_data("test input")

# Use aliased function imports
util_result = util_helper()
processed_result = process("more data")

# Use direct imports
user = User("John", "john@example.com")
current_time = datetime.now()
future_time = current_time + timedelta(days=1)

# Function calls using imported functions
items = [{"price": 10.0}, {"price": 20.0}]
total_price = utils_mod.calculate_total(items)

# Store results
results = {
    "greeting": greeting,
    "processed_data": processed_data,
    "util_result": util_result,
    "processed_result": processed_result,
    "user": user,
    "current_time": current_time,
    "future_time": future_time,
    "total_price": total_price,
}