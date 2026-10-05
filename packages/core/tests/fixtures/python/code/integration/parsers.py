"""
Parser class and factories - parsers.py
Tests: the class a construction resolves to, plus factory functions that return
it without declaring a return type, and a plain function that is never a class.

Imported by uses_parsers.py.
"""


class Parser:
    def parse(self, text):
        return text

    def close(self):
        return None


def make():
    return Parser()


def dispatch(flavor):
    return Parser()


def helper(value):
    return value


class Wrapper:
    def build(self):
        return Parser()
