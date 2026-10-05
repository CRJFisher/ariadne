"""
Construction vs. plain call - uses_parsers.py
Tests: one CallReference per call; Parser() recorded as a constructor call to
the class; a declared annotation beating an inferred construction; an
unresolvable annotation falling back to the construction; and a factory result
that nothing types.

Pinned by line number in project.python.integration.test.ts and by byte offset
in query_code_tree.test.ts - re-pin both if you edit this file.
"""
from typing import Optional

from parsers import Parser, Wrapper, make, dispatch, helper

total = helper(1)


class Reader:
    def __init__(self):
        self.parser = Parser()

    def run(self, flavor):
        count = helper(2)
        parser = dispatch(flavor)
        parser.close()
        return count


def build():
    p: Parser = make()
    p.parse("x")
    x = Parser()
    x.close()
    a: Optional[Parser] = Parser()
    a.close()
    return p


def nested():
    w: Parser = Wrapper().build()
    w.parse("y")
