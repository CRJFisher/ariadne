# A second subclass declaring the hook, with a constructor of its own - xml_handler.py

from handler import Handler


class XmlHandler(Handler):
    def __init__(self):
        self.depth = 0

    def handle(self):
        return "xml"

    def close(self):
        return super().close()
