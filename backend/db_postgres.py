"""
PostgreSQL adapter — mimics sqlite3 interface so app.py works unchanged.
Each get_db() call opens a fresh connection and returns a PgConn wrapper.
"""
import os
import psycopg2
import psycopg2.extras

DATABASE_URL = os.getenv("DATABASE_URL", "")


def get_db():
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
    conn.autocommit = False
    return PgConn(conn)


class PgRow(dict):
    """Dict that also supports integer-index access (like sqlite3.Row)."""
    def __getitem__(self, key):
        if isinstance(key, int):
            return list(self.values())[key]
        return super().__getitem__(key)

    def __getattr__(self, key):
        try:
            return self[key]
        except KeyError:
            raise AttributeError(key)

    def get(self, key, default=None):
        return super().get(key, default)


class PgCursor:
    def __init__(self, conn):
        self._conn = conn
        self._cur = conn.cursor()
        self.lastrowid = None
        self.rowcount = 0

    def _translate(self, sql):
        """Convert SQLite dialect to PostgreSQL."""
        sql = sql.replace("?", "%s")
        sql = sql.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
        sql = sql.replace("TEXT DEFAULT CURRENT_TIMESTAMP", "TIMESTAMP DEFAULT NOW()")
        sql = sql.replace("CURRENT_TIMESTAMP", "NOW()")
        return sql

    def execute(self, sql, params=()):
        pg_sql = self._translate(sql)
        try:
            self._cur.execute(pg_sql, params)
            self.rowcount = self._cur.rowcount
            # Grab lastrowid for INSERT statements
            if sql.strip().upper().startswith("INSERT"):
                try:
                    self._cur.execute("SELECT lastval()")
                    row = self._cur.fetchone()
                    if row:
                        self.lastrowid = list(row.values())[0]
                except Exception:
                    pass
        except psycopg2.Error as e:
            self._conn.rollback()
            raise
        return self

    def fetchone(self):
        row = self._cur.fetchone()
        return PgRow(row) if row else None

    def fetchall(self):
        return [PgRow(r) for r in (self._cur.fetchall() or [])]

    def __iter__(self):
        for row in self._cur:
            yield PgRow(row)


class PgConn:
    def __init__(self, conn):
        self._conn = conn

    def execute(self, sql, params=()):
        return PgCursor(self._conn).execute(sql, params)

    def executescript(self, sql):
        """
        Execute multiple semicolon-separated statements.
        Handles parentheses correctly so ON CONFLICT clauses are not split.
        """
        depth = 0
        current = ""
        statements = []
        for ch in sql:
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
            if ch == ";" and depth == 0:
                stmt = current.strip()
                if stmt:
                    statements.append(stmt)
                current = ""
            else:
                current += ch
        if current.strip():
            statements.append(current.strip())

        last = None
        for stmt in statements:
            last = PgCursor(self._conn).execute(stmt)
        return last

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        try:
            self._conn.close()
        except Exception:
            pass

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self._conn.commit()
        self.close()
# refreshed
