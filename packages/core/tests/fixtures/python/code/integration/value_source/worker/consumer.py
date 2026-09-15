# celery/worker/consumer/consumer.py shape - consumer.py

from worker import loops


class Consumer:
    def __init__(self, hub):
        if not hasattr(self, "loop"):
            self.loop = loops.asynloop if hub else loops.synloop


class Evloop:
    def start(self, c):
        c.loop(c.connection, c)
