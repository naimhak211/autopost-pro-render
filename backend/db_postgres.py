import os
import psycopg2
import psycopg2.extras

DATABASE_URL = os.getenv("DATABASE_URL", "")

def get_db():
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
    conn.autocommit = False
    return PgConn(conn)

class PgRow(dict):
    def __getitem__(self, key):
        if isinstance(key, int): return list(self.values())[key]
        return super().__getitem__(key)
    def __getattr__(self, key):
        try: return self[key]
        except KeyError: raise AttributeError(key)
    def get(self, key, default=None): return super().get(key, default)

class PgConn:
    def __init__(self, conn):
        self._conn = conn
        self._cur = conn.cursor()

    def _translate(self, sql):
        sql = sql.replace("?", "%s")
        sql = sql.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
        sql = sql.replace("TEXT DEFAULT CURRENT_TIMESTAMP", "TIMESTAMP DEFAULT NOW()")
        sql = sql.replace("CURRENT_TIMESTAMP", "NOW()")
        return sql

    def execute(self, sql, params=()):
        try:
            self._cur.execute(self._translate(sql), params)
            self.rowcount = self._cur.rowcount
            self.lastrowid = None
            if sql.strip().upper().startswith("INSERT"):
                try:
                    self._cur.execute("SELECT lastval()")
                    r = self._cur.fetchone()
                    if r: self.lastrowid = list(r.values())[0]
                except: pass
        except psycopg2.Error:
            self._conn.rollback()
            raise
        return self

    def fetchone(self):
        r = self._cur.fetchone()
        return PgRow(r) if r else None

    def fetchall(self):
        return [PgRow(r) for r in (self._cur.fetchall() or [])]

    def __iter__(self):
        for r in self._cur: yield PgRow(r)

    def executescript(self, sql):
        depth = 0; current = ""; stmts = []
        for ch in sql:
            if ch == "(": depth += 1
            elif ch == ")": depth -= 1
            if ch == ";" and depth == 0:
                if current.strip(): stmts.append(current.strip())
                current = ""
            else: current += ch
        if current.strip(): stmts.append(current.strip())
        for s in stmts:
            if s:
                try:
                    self._cur.execute(self._translate(s))
                    self._conn.commit()
                except Exception as e:
                    self._conn.rollback()
        return self

    def commit(self): self._conn.commit()
    def rollback(self): self._conn.rollback()
    def close(self):
        try: self._conn.close()
        except: pass
