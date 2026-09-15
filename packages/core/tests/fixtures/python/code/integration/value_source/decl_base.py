# sqlalchemy/orm/decl_base.py shape - decl_base.py


class Mapper:
    def __init__(self, cls, table):
        self.cls = cls


class ClassicMapper:
    def __init__(self, cls, table):
        self.cls = cls


class Parser:
    def __init__(self, source):
        self.source = source

    def parse(self):
        return self.source


class Processor:
    def __call__(self, data):
        return data


def map_declarative(cls, table):
    mapper_cls = Mapper
    mapped = mapper_cls(cls, table)
    mapper_cls = ClassicMapper
    return mapped


def parse_aliased(source):
    cls = Parser
    aliased = cls(source)
    return aliased.parse()


def process(data):
    processor = Processor()
    return processor(data)


def make() -> type[Parser]:
    return Parser


def parse_factory(source):
    produced = make()(source)
    return produced.parse()


def parse_annotated(source):
    annotated: Parser = make()
    return annotated.parse()
