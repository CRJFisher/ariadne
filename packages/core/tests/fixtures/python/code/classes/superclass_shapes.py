"""Every superclass shape the grammar admits: bare, dotted, generic,
dotted-generic, absent, and multiple bases (the sqlalchemy PGDDLCompiler
shape)."""

from sql import compiler


class BareBase(compiler.Base):
    def bare(self):
        return 1


class PGDDLCompiler(compiler.DDLCompiler):
    def visit_create_sequence(self, create):
        return super().visit_create_sequence(create)

    def visit_drop_sequence(self, drop):
        return self.visit_create_sequence(drop)


class GenericBase(compiler.Registry[int]):
    def generic(self):
        return 2


class NoBase:
    def plain(self):
        return 3


class MultiBase(NoBase, compiler.DDLCompiler):
    def multi(self):
        return 4
