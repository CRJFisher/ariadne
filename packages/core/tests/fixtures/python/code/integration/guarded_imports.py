import os

STATIC = os.environ.get("STATIC")
OTHER = os.environ.get("OTHER")

if STATIC:
    from guarded_base import Celery
elif OTHER:
    from guarded_base import Celery
else:
    from guarded_base import Celery

try:
    from guarded_base import make_app
except ImportError:
    from guarded_base import make_app
finally:
    from guarded_base import shutdown

with open("marker") as handle:
    from guarded_base import _bootstrap


def build():
    from guarded_base import Celery as LocalCelery
    local = LocalCelery()
    local.send_task("local")
    return local


import guarded_base as gb

app = Celery()
app.send_task("boot")
made = make_app()
booted = _bootstrap()
shutdown()
gb.make_app()
gb._bootstrap()
