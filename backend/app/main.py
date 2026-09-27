from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.core.config import get_settings, get_college_config
from app.db.migrate import run_migrations
from app.db.session import pool


from app.api import auth, users, documents, chat

import threading
from worker.main import run_forever

@asynccontextmanager
async def lifespan(app: FastAPI):
    run_migrations(get_settings().embedding_dim)
    # Start Postgres-backed ingestion worker thread
    worker_thread = threading.Thread(target=run_forever, daemon=True, name="BhartiIngestionWorker")
    worker_thread.start()
    yield


app = FastAPI(title="camp-ai", lifespan=lifespan)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(documents.router)
app.include_router(chat.router)

@app.get("/health")
def health():
    with pool().connection() as c:
        c.execute("SELECT 1")
    return {"status": "ok"}


from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

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
            return {"error": "Not Found"}
        target_file = frontend_dist / full_path
        if target_file.exists() and target_file.is_file():
            return FileResponse(target_file)
        return FileResponse(frontend_dist / "index.html")

