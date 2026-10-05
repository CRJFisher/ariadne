# The conforming class, naming no protocol - file_reader.py


class FileReader:
    def read(self) -> str:
        return "contents"

    def close(self) -> None:
        return None

    def seek(self, offset: int) -> None:
        return None
