"""Every superclass shape the grammar admits: bare, dotted, bare-generic,
dotted-generic, absent, and multiple bases (the sqlalchemy PGDDLCompiler
shape)."""

from sql import Registry, compiler


class BareBase(Registry):
    def bare(self):
        return 1


class DottedBase(compiler.Base):
    def dotted(self):
        return 2


class PGDDLCompiler(compiler.DDLCompiler):
    def visit_create_sequence(self, create):
        return super().visit_create_sequence(create)

    def visit_drop_sequence(self, drop):
        return self.visit_create_sequence(drop)


class GenericBase(Registry[int]):
    def generic(self):
        return 3


class DottedGenericBase(compiler.Registry[int]):
    def dotted_generic(self):
        return 4


class NoBase:
    def plain(self):
        return 5


class MultiBase(NoBase, compiler.DDLCompiler):
    def multi(self):
        return 6
