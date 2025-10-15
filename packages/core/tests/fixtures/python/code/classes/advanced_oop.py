"""
Advanced OOP patterns - advanced_oop.py
Tests: Multiple inheritance, properties, method overriding, super() calls
"""

from typing import Any, Optional
from abc import ABC, abstractmethod


class Animal(ABC):
    """Abstract base class for animals."""

    def __init__(self, name: str, species: str) -> None:
        """Initialize animal with name and species."""
        self._name = name
        self._species = species
        self._energy = 100

    @property
    def name(self) -> str:
        """Property getter for name."""
        return self._name

    @name.setter
    def name(self, value: str) -> None:
        """Property setter for name."""
        if not value:
            raise ValueError("Name cannot be empty")
        self._name = value

    @property
    def species(self) -> str:
        """Read-only property for species."""
        return self._species

    @property
    def energy(self) -> int:
        """Property getter for energy."""
        return self._energy

    @abstractmethod
    def make_sound(self) -> str:
        """Abstract method for animal sound."""
        pass

    def move(self) -> str:
        """Base method for movement."""
        self._energy -= 10
        return f"{self.name} moves"

    def rest(self) -> str:
        """Method for resting."""
        self._energy = min(100, self._energy + 20)
        return f"{self.name} rests"


class Mammal(Animal):
    """Mammal class inheriting from Animal."""

    def __init__(self, name: str, species: str, fur_color: str) -> None:
        """Initialize mammal with additional fur color."""
        super().__init__(name, species)
        self.fur_color = fur_color

    def make_sound(self) -> str:
        """Implementation of abstract method."""
        return f"{self.name} makes a mammal sound"

    def groom(self) -> str:
        """Mammal-specific method."""
        return f"{self.name} grooms {self.fur_color} fur"


class Bird(Animal):
    """Bird class inheriting from Animal."""

    def __init__(self, name: str, species: str, wing_span: float) -> None:
        """Initialize bird with wing span."""
        super().__init__(name, species)
        self.wing_span = wing_span

    def make_sound(self) -> str:
        """Implementation of abstract method."""
        return f"{self.name} chirps"

    def fly(self) -> str:
        """Bird-specific method."""
        self._energy -= 20
        return f"{self.name} flies with {self.wing_span}m wingspan"

    def move(self) -> str:
        """Override base move method."""
        base_move = super().move()
        return f"{base_move} by flying"


class Flyable:
    """Mixin class for flying behavior."""

    def take_off(self) -> str:
        """Method for taking off."""
        return f"{self.name} takes off"

    def land(self) -> str:
        """Method for landing."""
        return f"{self.name} lands"


class Bat(Mammal, Flyable):
    """Bat class with multiple inheritance."""

    def __init__(self, name: str, species: str) -> None:
        """Initialize bat."""
        super().__init__(name, species, "dark brown")

    def make_sound(self) -> str:
        """Override mammal sound."""
        return f"{self.name} screeches"

    def echolocate(self) -> str:
        """Bat-specific method."""
        return f"{self.name} uses echolocation"

    def fly(self) -> str:
        """Implement flying for bat."""
        self._energy -= 15
        return f"{self.name} flies silently"


# Test object creation and method calls
dog = Mammal("Rex", "Canis lupus", "golden")
eagle = Bird("Aquila", "Aquila chrysaetos", 2.3)
vampire_bat = Bat("Vlad", "Desmodus rotundus")

# Test property access and modification
dog_name = dog.name
dog_species = dog.species
original_energy = dog.energy

# Test property setter
dog.name = "Max"
new_name = dog.name

# Test method calls on different classes
dog_sound = dog.make_sound()
dog_groom = dog.groom()
dog_move = dog.move()
dog_rest = dog.rest()

eagle_sound = eagle.make_sound()
eagle_fly = eagle.fly()
eagle_move = eagle.move()

# Test multiple inheritance methods
bat_sound = vampire_bat.make_sound()
bat_groom = vampire_bat.groom()  # From Mammal
bat_takeoff = vampire_bat.take_off()  # From Flyable
bat_land = vampire_bat.land()  # From Flyable
bat_echo = vampire_bat.echolocate()
bat_fly = vampire_bat.fly()

# Test super() calls through inheritance chain
bat_move = vampire_bat.move()

# Store results
results = {
    "dog": dog,
    "eagle": eagle,
    "vampire_bat": vampire_bat,
    "dog_name": dog_name,
    "dog_species": dog_species,
    "original_energy": original_energy,
    "new_name": new_name,
    "dog_sound": dog_sound,
    "dog_groom": dog_groom,
    "dog_move": dog_move,
    "dog_rest": dog_rest,
    "eagle_sound": eagle_sound,
    "eagle_fly": eagle_fly,
    "eagle_move": eagle_move,
    "bat_sound": bat_sound,
    "bat_groom": bat_groom,
    "bat_takeoff": bat_takeoff,
    "bat_land": bat_land,
    "bat_echo": bat_echo,
    "bat_fly": bat_fly,
    "bat_move": bat_move,
}