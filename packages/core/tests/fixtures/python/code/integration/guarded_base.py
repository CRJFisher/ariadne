class Celery:
    def send_task(self, name):
        return name


def make_app():
    return Celery()


def shutdown():
    return None


def _bootstrap():
    return Celery()
