# sqlalchemy/dialects/postgresql/base.py shape - pg.py

from sql import compiler


class PGDDLCompiler(compiler.DDLCompiler):
    def visit_create_sequence(self, create):
        return super().visit_create_sequence(create)
