import os
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["ONNXRUNTIME_EXECUTION_MODE"] = "ORT_SEQUENTIAL"

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from app.core.config import get_settings, get_college_config
from app.db.migrate import run_migrations
from app.db.session import pool


from app.api import auth, users, documents, chat
from app.core.bot_protection import BotProtectionMiddleware, ROBOTS_TXT_CONTENT

import threading
from worker.main import run_forever

@asynccontextmanager
async def lifespan(app: FastAPI):
    run_migrations(get_settings().embedding_dim)
    # Start Postgres-backed ingestion worker thread with 5s poll interval to save CPU/RAM
    worker_thread = threading.Thread(target=lambda: run_forever(poll=5.0), daemon=True, name="BudbakIngestionWorker")
    worker_thread.start()
    yield


app = FastAPI(title="Budbak.ai", lifespan=lifespan)
# Global bot protection, scanner blocking, and security headers
app.add_middleware(BotProtectionMiddleware)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(documents.router)
app.include_router(chat.router)

@app.get("/health")
def health():
    import psycopg
    import re
    db_url = get_settings().database_url
    if ("supabase" in db_url or "neon" in db_url) and "sslmode" not in db_url:
        separator = "&" if "?" in db_url else "?"
        db_url = f"{db_url}{separator}sslmode=require"
    try:
        with psycopg.connect(db_url, connect_timeout=5) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        safe_err = re.sub(r':[^:@/]+@', ':***@', str(e))
        return {"status": "degraded", "database_error": safe_err}


from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, PlainTextResponse

@app.get("/robots.txt", response_class=PlainTextResponse)
def get_robots_txt():
    """Serve robots.txt preventing search/AI bots from scraping internal routes."""
    return PlainTextResponse(ROBOTS_TXT_CONTENT, media_type="text/plain")

@app.get("/api/public/config")
def public_config():
    """Branding only. Nothing sensitive."""
    c = get_college_config()
    keys = ("college_name", "assistant_name", "welcome_message", "logo_url", "primary_color", "supported_languages")
    return {k: c.get(k) for k in keys}

# Mount static frontend
frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if not frontend_dist.exists():
    frontend_dist = Path("/frontend/dist")

if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        if full_path.startswith("api"):
            raise HTTPException(status_code=404, detail="API endpoint not found")
        target_file = frontend_dist / full_path
        if target_file.exists() and target_file.is_file():
            return FileResponse(target_file)
        return FileResponse(
            frontend_dist / "index.html",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )

