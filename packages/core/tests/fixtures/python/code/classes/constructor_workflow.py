"""
Constructor → type → method workflow - constructor_workflow.py
Tests: Constructor call, type binding, method call chain in single file
"""

from typing import Optional
from datetime import datetime


class Product:
    """Product class for testing constructor → method workflows."""

    def __init__(self, name: str, price: float, category: str) -> None:
        """Initialize product with name, price, and category."""
        self.name = name
        self.price = price
        self.category = category
        self.in_stock = True
        self.created_at = datetime.now()

    def get_name(self) -> str:
        """Get product name."""
        return self.name

    def get_price(self) -> float:
        """Get product price."""
        return self.price

    def apply_discount(self, percentage: float) -> 'Product':
        """Apply discount percentage and return self for chaining."""
        self.price = self.price * (1 - percentage / 100)
        return self

    def mark_out_of_stock(self) -> 'Product':
        """Mark product as out of stock and return self for chaining."""
        self.in_stock = False
        return self

    def get_info(self) -> dict:
        """Get product information."""
        return {
            "name": self.name,
            "price": self.price,
            "category": self.category,
            "in_stock": self.in_stock,
            "created_at": self.created_at,
        }


# Constructor call creates instance with type binding
product = Product("Laptop", 1000.0, "Electronics")

# Method calls on constructed instance
product_name = product.get_name()
original_price = product.get_price()

# Method chaining workflow
discounted_product = product.apply_discount(10.0).mark_out_of_stock()
final_price = discounted_product.get_price()
product_info = product.get_info()

# Store results
results = {
    "product": product,
    "product_name": product_name,
    "original_price": original_price,
    "final_price": final_price,
    "product_info": product_info,
}