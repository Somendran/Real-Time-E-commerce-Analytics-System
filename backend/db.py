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
DB_SSLMODE = os.getenv("DB_SSLMODE", "require")
_pool: ThreadedConnectionPool | None = None


def _get_pool() -> ThreadedConnectionPool:
    global _pool

    if _pool is not None:
        return _pool

    if not DB_URL:
        raise EnvironmentError("Set SUPABASE_DB_URL or DATABASE_URL environment variable.")

    # Supabase requires SSL; local Docker Postgres can set DB_SSLMODE=disable.
    _pool = ThreadedConnectionPool(
        minconn=1,
        maxconn=10,
        dsn=DB_URL,
        sslmode=DB_SSLMODE,
    )
    return _pool


@contextmanager
def get_connection() -> Iterator[psycopg2.extensions.connection]:
    pool = _get_pool()
    conn = pool.getconn()
    try:
        yield conn
    finally:
        pool.putconn(conn)


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
