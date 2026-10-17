"""Conexión a la base de datos SQLite de KERN.

La base viaja junto al programa: vive en la misma carpeta que el .exe
(empaquetado) o en la raíz del proyecto (desarrollo). Para "cambiar de
computadora" basta con copiar la carpeta completa (exe + kern.db).
"""
import os
import sqlite3
import sys
from datetime import datetime
from decimal import Decimal

from flask import g

if getattr(sys, "frozen", False):
    CARPETA_BASE = os.path.dirname(sys.executable)
else:
    CARPETA_BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUTA_BASE = os.path.join(CARPETA_BASE, "kern.db")

# datetime <-> texto ISO (SQLite no tiene tipo fecha propio)
sqlite3.register_adapter(datetime, lambda d: d.isoformat(" "))
sqlite3.register_converter("DATETIME", lambda b: datetime.fromisoformat(b.decode()))


def _adaptar(params):
    """SQLite no entiende Decimal (dinero): lo convierte a float."""
    return tuple(float(p) if isinstance(p, Decimal) else p for p in params)


def get_db():
    """Conexion activa para la peticion actual."""
    if "conn" not in g:
        conn = sqlite3.connect(
            RUTA_BASE,
            detect_types=sqlite3.PARSE_DECLTYPES,
            timeout=5,  # espera si otra persona esta escribiendo a la vez
        )
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA busy_timeout = 5000")
        g.conn = conn
    return g.conn


def close_db(exc=None):
    conn = g.pop("conn", None)
    if conn is not None:
        conn.close()


def init_app(app):
    app.teardown_appcontext(close_db)


def query(sql, params=()):
    """Devuelve todas las filas como lista de dicts."""
    cur = get_db().cursor()
    try:
        cur.execute(sql, _adaptar(params))
        return [dict(fila) for fila in cur.fetchall()]
    finally:
        cur.close()


def query_one(sql, params=()):
    """Devuelve la primera fila como dict o None."""
    rows = query(sql, params)
    return rows[0] if rows else None


def execute(sql, params=()):
    """Ejecuta INSERT/UPDATE/DELETE con commit. Devuelve rowcount."""
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute(sql, _adaptar(params))
        conn.commit()
        return cur.rowcount
    finally:
        cur.close()


def insert_returning(sql, params=()):
    """Ejecuta INSERT ... RETURNING y devuelve la fila creada como dict."""
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute(sql, _adaptar(params))
        row = cur.fetchone()
        conn.commit()
        return dict(row) if row else None
    finally:
        cur.close()


def ejecutar_esquema(sql):
    """Aplica schema.sql completo (varias sentencias) de forma idempotente."""
    conn = get_db()
    conn.executescript(sql)
    conn.commit()
