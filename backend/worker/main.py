"""Postgres-backed job runner. No Redis. Handlers register per job kind (M1: 'ingest_version')."""
import time
from app.db.session import pool

from worker.ingestion import ingest_version
from worker.reindex import reindex_all_chunks

HANDLERS: dict = {
    "ingest_version": ingest_version,
    "reindex_all_chunks": reindex_all_chunks
}
CLAIM = """
UPDATE jobs SET status='running', locked_at=now(), attempts=attempts+1
WHERE id = (SELECT id FROM jobs WHERE status='queued' AND run_after<=now()
            ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1)
RETURNING id, kind, payload
"""
RESET_STUCK = """
UPDATE jobs SET status='queued', locked_at=NULL, last_error='Job timed out after 1 hour'
WHERE status='running' AND locked_at < now() - interval '1 hour'
"""

def run_forever(poll: float = 2.0):
    import sys
    print("[WORKER] Bharti.ai Background Ingestion Worker started and polling for jobs...", flush=True)
    last_reset = 0
    while True:
        with pool().connection() as c:
            # Reset stuck jobs periodically (every ~60s)
            if time.time() - last_reset > 60:
                c.execute(RESET_STUCK)
                last_reset = time.time()
                
            row = c.execute(CLAIM).fetchone()
        if not row:
            time.sleep(poll)
            continue
            
        job_id, kind, payload = row
        print(f"[WORKER] Claimed job {job_id} ({kind}) with payload: {payload}", flush=True)
        try:
            HANDLERS[kind](payload)
            status, err = "done", None
            print(f"[WORKER] Successfully finished job {job_id} ({kind})!", flush=True)
        except Exception as e:  # noqa: BLE001
            status, err = "failed", str(e)
            print(f"[WORKER] ERROR processing job {job_id} ({kind}): {e}", flush=True)
            
        with pool().connection() as c:
            c.execute("UPDATE jobs SET status=%s, last_error=%s WHERE id=%s", (status, err, job_id))


if __name__ == "__main__":
    run_forever()

