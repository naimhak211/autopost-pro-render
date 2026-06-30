import os, psycopg2, psycopg2.extras
from psycopg2.pool import ThreadedConnectionPool

DATABASE_URL = os.getenv("DATABASE_URL", "")

# A small connection pool so we don't open a brand-new TCP/SSL connection on
# every single get_db() call (this was exhausting Render's free Postgres
# connection limit and causing random "SSL error: bad record mac" /
# "connection already closed" failures).
_pool = None

def _get_pool():
    global _pool
    if _pool is None:
        _pool = ThreadedConnectionPool(
            minconn=1,
            maxconn=int(os.getenv("DB_POOL_MAX", "8")),
            dsn=DATABASE_URL,
            cursor_factory=psycopg2.extras.RealDictCursor,
        )
    return _pool

def get_db():
    pool = _get_pool()
    conn = pool.getconn()
    # If a previous user of this connection left it in a broken/aborted
    # state, reset it instead of poisoning every future query.
    try:
        if conn.closed:
            pool.putconn(conn, close=True)
            conn = pool.getconn()
        else:
            conn.rollback()
    except Exception:
        try:
            pool.putconn(conn, close=True)
        except Exception:
            pass
        conn = pool.getconn()
    conn.autocommit = False
    return PgConn(conn, pool)

class PgRow(dict):
    def __getitem__(self,key):
        if isinstance(key,int): return list(self.values())[key]
        return super().__getitem__(key)
    def __getattr__(self,key):
        try: return self[key]
        except KeyError: raise AttributeError(key)

class PgCursor:
    def __init__(self,cursor,conn):
        self._cur=cursor; self._conn=conn; self.lastrowid=None; self.rowcount=0
    def execute(self,sql,params=()):
        try:
            pg_sql=sql.replace("?","%s").replace("INTEGER PRIMARY KEY AUTOINCREMENT","SERIAL PRIMARY KEY").replace("TEXT DEFAULT CURRENT_TIMESTAMP","TIMESTAMP DEFAULT NOW()")
            self._cur.execute(pg_sql,params)
            self.rowcount=self._cur.rowcount
            try:
                if sql.strip().upper().startswith("INSERT"):
                    self._cur.execute("SELECT lastval()")
                    self.lastrowid=self._cur.fetchone()[0]
            except: pass
        except Exception as e:
            self._conn.rollback()
            raise e
        return self
    def fetchone(self):
        row=self._cur.fetchone(); return PgRow(row) if row else None
    def fetchall(self): return [PgRow(r) for r in self._cur.fetchall()]
    def __iter__(self):
        for row in self._cur: yield PgRow(row)

class PgConn:
    def __init__(self,conn,pool=None):
        self._conn=conn; self._cur=conn.cursor(); self._pool=pool; self._closed=False
    def execute(self,sql,params=()):
        return PgCursor(self._cur,self._conn).execute(sql,params)
    def executescript(self,sql):
        depth=0; current=""; statements=[]
        for char in sql:
            if char=='(': depth+=1
            elif char==')': depth-=1
            if char==';' and depth==0:
                if current.strip(): statements.append(current.strip())
                current=""
            else: current+=char
        if current.strip(): statements.append(current.strip())
        cur=PgCursor(self._cur,self._conn)
        for stmt in statements:
            if stmt: cur.execute(stmt)
        return cur
    def commit(self): self._conn.commit()
    def close(self):
        # Return the connection to the pool instead of actually closing the
        # TCP/SSL socket, so it can be safely reused by the next request.
        if self._closed:
            return
        self._closed = True
        try:
            self._cur.close()
        except Exception:
            pass
        if self._pool is not None:
            try:
                self._conn.rollback()
            except Exception:
                pass
            try:
                self._pool.putconn(self._conn)
            except Exception:
                try: self._conn.close()
                except Exception: pass
        else:
            try: self._conn.close()
            except Exception: pass
