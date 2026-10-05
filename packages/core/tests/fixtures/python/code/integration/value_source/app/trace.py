# celery/app/trace.py shape - trace.py

from app.task import BaseTask


class TraceInfo:
    def __init__(self, state):
        self.state = state

    def handle_error_state(self, task):
        return self.state


def setup_worker_optimizations():
    orig = BaseTask.__call__

    def __protected_call__(self, *args, **kwargs):
        return orig(self, *args, **kwargs)

    BaseTask.__call__ = __protected_call__


def build_tracer(task, Info=TraceInfo):
    info = Info("FAILURE")
    return info.handle_error_state(task)
