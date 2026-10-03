class DataFrame:
    def to_stata(self, path, version=114, convert_dates=None, convert_strl=None):
        if version == 114:
            from pandas.io.stata import StataWriter as statawriter
        elif version == 117:
            from pandas.io.stata import StataWriter117 as statawriter
        else:
            from pandas.io.stata import StataWriterUTF8 as statawriter

        kwargs = {}
        if version is None or version >= 117:
            kwargs["convert_strl"] = convert_strl

        writer = statawriter(path, self, convert_dates=convert_dates, **kwargs)
        writer.write_file()
