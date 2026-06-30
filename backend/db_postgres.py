import os, psycopg2, psycopg2.extras
from psycopg2 import pool as pg_pool

try:
    from flask import g, has_app_context
except Exception:  # pragma: no cover - db_postgres might be imported outside Flask in scripts
    g = None
    def has_app_context(): return False

DATABASE_URL = os.getenv("DATABASE_URL", "")

# ── Connection Pool ──────────────────────────────────────────────────────────
# আগে প্রতিটা get_db() কল আলাদা psycopg2.connect() করত আর কখনো close() হতো না।
# একটা route-এ গড়ে ২-৩ বার get_db() কল হতো, তাই অনেক connection জমে গিয়ে
# Render/Supabase free-tier limit ছুঁয়ে এলোমেলোভাবে "API error: 500" আসত
# (Settings save, Workflow status update ইত্যাদি কাজে)।
# এখন: (১) একটা ছোট connection pool থাকে, (২) একই Flask request-এর ভেতরে
# একাধিকবার get_db() কল হলেও একই connection reuse হয় (flask.g তে cache করা),
# (৩) request শেষে app.py-র teardown_appcontext এই connection pool-এ ফেরত দেয়।
_pool = None

def _get_pool():
    global _pool
    if _pool is None:
        _pool = pg_pool.ThreadedConnectionPool(1, 10, DATABASE_URL)
    return _pool


def get_db():
    if has_app_context() and g is not None:
        if "db_conn" not in g:
            raw = _get_pool().getconn()
            raw.autocommit = False
            g.db_conn = PgConn(raw)
        return g.db_conn
    # Flask app context ছাড়া (e.g. স্ক্রিপ্ট থেকে) কল হলে fallback — caller-কে .close() করতে হবে
    raw = _get_pool().getconn()
    raw.autocommit = False
    return PgConn(raw)


def release_db_connection():
    """app.py-র teardown_appcontext থেকে কল হয় — request শেষে connection pool-এ ফেরত দেয়।"""
    if has_app_context() and g is not None and "db_conn" in g:
        g.db_conn.close()
        del g.db_conn


class PgRow(dict):
    def __getitem__(self, key):
        if isinstance(key, int):
            return list(self.values())[key]
        return super().__getitem__(key)

    def __getattr__(self, key):
        try:
            return self[key]
        except KeyError:
            raise AttributeError(key)


class PgCursor:
    def __init__(self, cursor, conn):
        self._cur = cursor
        self._conn = conn
        self.lastrowid = None
        self.rowcount = 0

    def execute(self, sql, params=()):
        try:
            pg_sql = (
                sql.replace("?", "%s")
                .replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
                .replace("TEXT DEFAULT CURRENT_TIMESTAMP", "TIMESTAMP DEFAULT NOW()")
            )
            self._cur.execute(pg_sql, params)
            self.rowcount = self._cur.rowcount
            try:
                if sql.strip().upper().startswith("INSERT"):
                    self._cur.execute("SELECT lastval()")
                    self.lastrowid = self._cur.fetchone()[0]
            except Exception:
                pass
        except Exception as e:
            self._conn.rollback()
            raise e
        return self

    def fetchone(self):
        row = self._cur.fetchone()
        return PgRow(row) if row else None

    def fetchall(self):
        return [PgRow(r) for r in self._cur.fetchall()]

    def __iter__(self):
        for row in self._cur:
            yield PgRow(row)


class PgConn:
    def __init__(self, conn):
        self._conn = conn
        self._cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    def execute(self, sql, params=()):
        return PgCursor(self._cur, self._conn).execute(sql, params)

    def executescript(self, sql):
        depth = 0
        current = ""
        statements = []
        for char in sql:
            if char == '(':
                depth += 1
            elif char == ')':
                depth -= 1
            if char == ';' and depth == 0:
                if current.strip():
                    statements.append(current.strip())
                current = ""
            else:
                current += char
        if current.strip():
            statements.append(current.strip())
        cur = PgCursor(self._cur, self._conn)
        for stmt in statements:
            if stmt:
                cur.execute(stmt)
        return cur

    def commit(self):
        self._conn.commit()

    def close(self):
        """raw conn.close() করার বদলে pool-এ ফেরত (putconn) দেওয়া হয়, connection leak এড়াতে।"""
        try:
            self._cur.close()
        except Exception:
            pass
        try:
            _get_pool().putconn(self._conn)
        except Exception:
            try:
                self._conn.close()
            except Exception:
                pass
