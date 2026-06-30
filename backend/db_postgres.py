import os, psycopg2, psycopg2.extras

DATABASE_URL = os.getenv("DATABASE_URL", "")

def get_db():
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
    conn.autocommit = False
    return PgConn(conn)

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
        self._conn=conn; self._cur=conn.cursor(); self._closed=False
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
    def rollback(self):
        try: self._conn.rollback()
        except Exception: pass
    def close(self):
        if self._closed:
            return
        self._closed = True
        try: self._cur.close()
        except Exception: pass
        try: self._conn.close()
        except Exception: pass
