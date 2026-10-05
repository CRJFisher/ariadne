# pandas/io/html.py shape - html.py


class _HtmlFrameParser:
    def parse_tables(self):
        return []


class Connection:
    def execute(self):
        return None


class Engine:
    def connect(self) -> Connection:
        return Connection()

    def run(self):
        conn = self.connect()
        conn.execute()


def connect() -> Connection:
    return Connection()


def _parser_dispatch(flavor) -> type[_HtmlFrameParser]:
    return _HtmlFrameParser


def make() -> type[_HtmlFrameParser]:
    return _HtmlFrameParser


def _parse(flavor, io):
    parser = _parser_dispatch(flavor)
    p = parser(io)
    return p.parse_tables()


def run_engine(engine: Engine):
    conn = engine.connect()
    conn.execute()


def run_connection():
    conn = connect()
    conn.execute()


def run_factory(io):
    p = make()(io)
    return p.parse_tables()
