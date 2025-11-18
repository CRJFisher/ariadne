"""
Protocol with multiple implementations
Tests: polymorphic method resolution, Protocol method calls resolve to all implementations
"""

from typing import Protocol


class Handler(Protocol):
    """Handler protocol defining the interface"""

    def process(self) -> None:
        """Process the handler"""
        ...

    def get_name(self) -> str:
        """Get handler name"""
        ...


class HandlerA:
    """First implementation of Handler protocol"""

    def process(self) -> None:
        print("Handler A processing")

    def get_name(self) -> str:
        return "Handler A"


class HandlerB:
    """Second implementation of Handler protocol"""

    def process(self) -> None:
        print("Handler B processing")

    def get_name(self) -> str:
        return "Handler B"


class HandlerC:
    """Third implementation of Handler protocol"""

    def process(self) -> None:
        print("Handler C processing")

    def get_name(self) -> str:
        return "Handler C"


def execute_handler(handler: Handler) -> None:
    """
    Polymorphic function that calls protocol methods.
    These calls should resolve to ALL three implementations.
    """
    handler.process()
    name = handler.get_name()
    print(f"Executed: {name}")


# Usage with concrete types
if __name__ == "__main__":
    a = HandlerA()
    b = HandlerB()
    c = HandlerC()

    execute_handler(a)
    execute_handler(b)
    execute_handler(c)
