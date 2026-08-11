"""Enum and Protocol classes across every base shape the grammar admits, so
the builder's discrimination and the query's member gates are exercised over
bare, dotted, and subscripted bases."""

import enum
import typing
from enum import Enum
from typing import Protocol, TypeVar

T_co = TypeVar("T_co", covariant=True)


class BareEnum(Enum):
    RED = 1
    BLUE = 2

    def describe(self):
        return self.name


class DottedEnum(enum.IntEnum):
    LOW = 1
    HIGH = 2


class MemberlessEnum(Enum):
    """An enum with no members may be subclassed, so it is a legal base."""

    def shared(self):
        return self.value


class DerivedEnum(MemberlessEnum):
    EXTRA = 3


class BareProtocol(Protocol):
    label: str

    def render(self) -> str: ...


class DottedProtocol(typing.Protocol):
    size: int


class GenericProtocol(Protocol[T_co]):
    payload: bytes


class NestedHolder(Enum):
    ONE = 1

    class Inner:
        """A plain class nested in an enum body stays a plain class."""

        def inner_method(self):
            return 1
