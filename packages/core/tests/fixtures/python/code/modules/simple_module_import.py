"""
Test simple module imports without alias.
Tests: import X; X.func() pattern
"""
import utils  # Simple import without alias

greeting = utils.helper()
processed = utils.process_data("input")
total = utils.calculate_total([{"price": 10}, {"price": 20}])
