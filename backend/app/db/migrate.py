from pathlib import Path
from .session import pool

MIG_DIR = Path(__file__).parent / "migrations"


def run_migrations(dim: int) -> None:
    try:
        with pool().connection() as conn:
            conn.execute("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz DEFAULT now())")
            done = {r[0] for r in conn.execute("SELECT name FROM schema_migrations")}
            for f in sorted(MIG_DIR.glob("*.sql")):
                if f.name in done:
                    continue
                try:
                    conn.execute(f.read_text().replace("{{EMBEDDING_DIM}}", str(dim)))
                except Exception as e:
                    print(f"[MIGRATE] Migration notice for {f.name}: {e}", flush=True)
                try:
                    conn.execute("INSERT INTO schema_migrations (name) VALUES (%s) ON CONFLICT (name) DO NOTHING", (f.name,))
                except Exception:
                    pass
    except Exception as e:
        print(f"[MIGRATE] Database initialization notice: {e}", flush=True)

