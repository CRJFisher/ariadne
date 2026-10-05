# sqlalchemy/sql/compiler.py shape - compiler.py
# Tests: a base class a subclass names through its module, `compiler.DDLCompiler`


class DDLCompiler:
    def visit_create_sequence(self, create):
        return create

    def visit_drop_sequence(self, drop):
        return self.visit_create_sequence(drop)
