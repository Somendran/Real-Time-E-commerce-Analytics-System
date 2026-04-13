from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Any, Iterator

import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import RealDictCursor
from psycopg2.pool import ThreadedConnectionPool

load_dotenv()

DB_URL = os.getenv("SUPABASE_DB_URL") or os.getenv("DATABASE_URL")
if not DB_URL:
    raise EnvironmentError("Set SUPABASE_DB_URL or DATABASE_URL environment variable.")

# Supabase PostgreSQL requires SSL.
_pool = ThreadedConnectionPool(
    minconn=1,
    maxconn=10,
    dsn=DB_URL,
    sslmode="require",
)


@contextmanager
def get_connection() -> Iterator[psycopg2.extensions.connection]:
    conn = _pool.getconn()
    try:
        yield conn
    finally:
        _pool.putconn(conn)


def fetch_one(query: str, params: tuple[Any, ...] | None = None) -> dict[str, Any]:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, params)
            row = cur.fetchone()
            return dict(row) if row else {}


def fetch_all(query: str, params: tuple[Any, ...] | None = None) -> list[dict[str, Any]]:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, params)
            rows = cur.fetchall()
            return [dict(row) for row in rows]
