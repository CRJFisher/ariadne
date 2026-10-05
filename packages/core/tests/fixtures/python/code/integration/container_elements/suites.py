class Suite:
    def run(self):
        pass

    def close(self):
        pass

    def reset(self):
        pass

    def pause(self):
        pass

    def resume(self):
        pass

    def report(self):
        pass


def run_list(suites: list[Suite]):
    suites[0].run()
    for suite in suites:
        suite.close()
    for position, counted in enumerate(suites):
        counted.reset()


def run_dict(named: dict[str, Suite], key: str):
    named["root"].reset()
    named[key].pause()
    for each_value in named.values():
        each_value.resume()
    for name, entry_value in named.items():
        entry_value.report()
    found = named.get(key)
    found.run()
    for each_key in named:
        each_key.close()


def run_literal():
    literal = [Suite()]
    literal[0].reset()
    literal.append(Suite())
