"""
Basic class definition
Tests: class, __init__, instance methods
"""

class User:
    def __init__(self, name: str, email: str):
        self.name = name
        self.email = email
        self.active = True

    def activate(self):
        self.active = True

    def deactivate(self):
        self.active = False

    def get_info(self):
        return f"{self.name} ({self.email})"


class Product:
    def __init__(self, id: int, name: str, price: float):
        self.id = id
        self.name = name
        self.price = price

    def apply_discount(self, discount: float):
        self.price = self.price * (1 - discount)

    def get_price(self):
        return self.price
