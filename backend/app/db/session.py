from psycopg_pool import ConnectionPool
from app.core.config import get_settings

_pool: ConnectionPool | None = None


def pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        db_url = get_settings().database_url
        if ("supabase" in db_url or "neon" in db_url) and "sslmode" not in db_url:
            separator = "&" if "?" in db_url else "?"
            db_url = f"{db_url}{separator}sslmode=require"
        _pool = ConnectionPool(db_url, min_size=1, max_size=20, open=True)
    return _pool
