from typing import Optional

import pkg as compiler
from pkg import leaf


def emit(ddl: compiler.DDLCompiler):
    ddl.compile()


def emit_submodule(ddl: Optional[leaf.DDLCompiler]):
    ddl.compile()
