"""
Class inheritance
Tests: inheritance, super(), method overriding
"""

class Animal:
    def __init__(self, name: str):
        self.name = name

    def speak(self) -> str:
        raise NotImplementedError("Subclass must implement speak()")

    def move(self, distance: int = 0):
        print(f"{self.name} moved {distance} meters")


class Dog(Animal):
    def __init__(self, name: str, breed: str):
        super().__init__(name)
        self.breed = breed

    def speak(self) -> str:
        return "Woof!"

    def fetch(self, item: str):
        print(f"{self.name} fetched {item}")


class Cat(Animal):
    def speak(self) -> str:
        return "Meow!"

    def climb(self):
        print(f"{self.name} is climbing")
