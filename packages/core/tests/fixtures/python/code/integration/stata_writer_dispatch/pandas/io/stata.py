class StataParser:
    def __init__(self):
        self.version = None


class StataWriter(StataParser):
    def __init__(self, fname, data, convert_dates=None):
        super().__init__()
        self.fname = fname
        self.data = data

    def write_file(self):
        return self.fname


class StataWriter117(StataWriter):
    def __init__(self, fname, data, convert_dates=None, convert_strl=None):
        super().__init__(fname, data, convert_dates)
        self.convert_strl = convert_strl


class StataWriterUTF8(StataWriter117):
    def __init__(self, fname, data, convert_dates=None, convert_strl=None, version=None):
        super().__init__(fname, data, convert_dates, convert_strl)
        self.version = version
