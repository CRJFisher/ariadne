from sqlalchemy import Column
from sqlalchemy import types as sqltypes
from sqlalchemy.dialects.mysql import base as mysql
from sqlalchemy.testing import eq_


def test_float_type_compile():
    eq_(mysql.FLOAT().compile(), "FLOAT")
    eq_(sqltypes.Float().compile(), "FLOAT")
    eq_(Column("id").compile(), "id")
