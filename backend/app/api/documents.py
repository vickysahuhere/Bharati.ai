from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List
import hashlib
import json

from app.db.session import pool
from app.api.auth import get_admin_user, UserResponse
from app.providers.storage import StorageProvider

router = APIRouter(prefix="/api/documents", tags=["documents"])
storage = StorageProvider()

@router.post("/upload")
def upload_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    knowledge_domain: str = Form(...),
    department: str = Form(None),
    semester: int = Form(None),
    subject: str = Form(None),
    document_type: str = Form(None),
    effective_date: Optional[str] = Form(None),
    expiration_date: Optional[str] = Form(None),
    source_url: str = Form(None),
    admin: UserResponse = Depends(get_admin_user)
):
    # Validate file type
    allowed_types = [
        'application/pdf', 
        'image/jpeg', 
        'image/png',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'text/plain'
    ]
    is_supported_ext = any(file.filename.lower().endswith(ext) for ext in ['.pdf', '.docx', '.doc', '.txt', '.png', '.jpg', '.jpeg'])
    if file.content_type not in allowed_types and not is_supported_ext:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type '{file.content_type}'. Please upload PDF, DOCX, TXT, JPEG, or PNG files."
        )

    # Clean dates
    eff_date = effective_date.strip() if effective_date and effective_date.strip() else None
    exp_date = expiration_date.strip() if expiration_date and expiration_date.strip() else None

    # Read file bytes to store persistently in Postgres and on disk
    file_bytes = file.file.read()
    if len(file_bytes) > 30 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds maximum allowable limit of 30MB.")

    file_key = storage.save_bytes(file_bytes, file.filename)
    
    with pool().connection() as conn:
        with conn.transaction():
            # Create document
            doc_row = conn.execute(
                """
                INSERT INTO documents (title, knowledge_domain, department, semester, subject, document_type, source_url, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (title, knowledge_domain, department, semester, subject, document_type, source_url, admin.id)
            ).fetchone()
            doc_id = doc_row[0]
            
            # Create document version with persistent binary data and dates
            ver_row = conn.execute(
                """
                INSERT INTO document_versions (document_id, version, file_key, mime, file_data, effective_date, expiration_date)
                VALUES (%s, 1, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (doc_id, file_key, file.content_type, file_bytes, eff_date, exp_date)
            ).fetchone()
            ver_id = ver_row[0]
            
            # Queue ingestion job
            payload = json.dumps({"document_id": str(doc_id), "version_id": str(ver_id)})
            conn.execute(
                "INSERT INTO jobs (kind, payload) VALUES ('ingest_version', %s)",
                (payload,)
            )

    return {
        "status": "processing", 
        "document_id": str(doc_id), 
        "version_id": str(ver_id),
        "message": "Document uploaded and queued for background indexing."
    }


@router.get("/public/notices")
def get_public_notices():
    """Public list of active documents and notices for the student Notice Board."""
    with pool().connection() as conn:
        rows = conn.execute(
            """
            SELECT d.id, d.title, d.knowledge_domain, d.department, d.semester, d.subject, 
                   d.document_type, d.source_url, dv.created_at, dv.effective_date, dv.expiration_date
            FROM documents d
            JOIN document_versions dv ON d.id = dv.document_id
            WHERE d.deleted_at IS NULL AND dv.status = 'indexed'
            ORDER BY dv.created_at DESC
            LIMIT 50
            """
        ).fetchall()
        
    return [
        {
            "id": str(r[0]),
            "title": r[1],
            "domain": r[2],
            "department": r[3],
            "semester": r[4],
            "subject": r[5],
            "document_type": r[6],
            "source_url": r[7],
            "created_at": r[8].isoformat() if r[8] else None,
            "effective_date": r[9].isoformat() if r[9] else None,
            "expiration_date": r[10].isoformat() if r[10] else None,
        }
        for r in rows
    ]


@router.get("/status")

def get_documents_status(admin: UserResponse = Depends(get_admin_user)):
    with pool().connection() as conn:
        rows = conn.execute(
            """
            SELECT d.id, d.title, dv.version, dv.status, dv.error,
                   (SELECT COUNT(*) FROM chunks c WHERE c.version_id = dv.id) as chunks_count,
                   dv.created_at, dv.effective_date, dv.expiration_date,
                   d.department, d.semester, d.subject, d.document_type
            FROM documents d
            JOIN document_versions dv ON d.id = dv.document_id
            WHERE d.deleted_at IS NULL
            ORDER BY dv.created_at DESC
            """
        ).fetchall()
        
    return [
        {
            "document_id": str(r[0]), 
            "title": r[1], 
            "version": r[2], 
            "status": r[3], 
            "error": r[4],
            "chunks_count": r[5],
            "created_at": r[6].isoformat() if r[6] else None,
            "effective_date": r[7].isoformat() if r[7] else None,
            "expiration_date": r[8].isoformat() if r[8] else None,
            "department": r[9],
            "semester": r[10],
            "subject": r[11],
            "document_type": r[12]
        }
        for r in rows
    ]

@router.post("/{doc_id}/reindex")
def reindex_document(doc_id: str, admin: UserResponse = Depends(get_admin_user)):
    with pool().connection() as conn:
        ver = conn.execute(
            "SELECT id FROM document_versions WHERE document_id=%s ORDER BY version DESC LIMIT 1",
            (doc_id,)
        ).fetchone()
        if not ver:
            raise HTTPException(status_code=404, detail="Document version not found")
        ver_id = str(ver[0])
        
        # Mark version as processing
        conn.execute("UPDATE document_versions SET status='processing', error=NULL WHERE id=%s", (ver_id,))
        
        # Queue ingestion job for background worker
        payload = json.dumps({"document_id": str(doc_id), "version_id": str(ver_id)})
        conn.execute(
            "INSERT INTO jobs (kind, payload) VALUES ('ingest_version', %s)",
            (payload,)
        )
        
    return {
        "status": "processing", 
        "document_id": doc_id, 
        "version_id": ver_id,
        "message": "Re-indexing queued for background processing."
    }

@router.post("/process-queue")
def process_queue(admin: UserResponse = Depends(get_admin_user)):
    """Verifies queued jobs and resets any stuck jobs so the background worker can process them."""
    with pool().connection() as conn:
        # Reset any jobs stuck in running state for > 5 minutes
        conn.execute(
            "UPDATE jobs SET status='queued', locked_at=NULL, last_error='Reset by admin' WHERE status='running' AND locked_at < now() - interval '5 minutes'"
        )
        queued_count = conn.execute("SELECT COUNT(*) FROM jobs WHERE status='queued'").fetchone()[0]
    return {
        "status": "ok", 
        "queued": queued_count, 
        "message": f"{queued_count} job(s) in queue. The background worker is processing them."
    }

@router.delete("/admin/purge-all")
def purge_all_documents(admin: UserResponse = Depends(get_admin_user)):
    """Permanently deletes all ingested documents, versions, chunks, and queued ingestion jobs."""
    with pool().connection() as conn:
        with conn.transaction():
            conn.execute("DELETE FROM chunks")
            conn.execute("DELETE FROM document_versions")
            conn.execute("DELETE FROM documents")
            conn.execute("DELETE FROM jobs WHERE kind='ingest_version'")
@router.get("/admin/unresolved-queries")
def get_unresolved_queries(admin: UserResponse = Depends(get_admin_user)):
    """Returns unresolved student questions to identify missing documents."""
    with pool().connection() as conn:
        try:
            rows = conn.execute(
                "SELECT id, query, created_at FROM unresolved_queries ORDER BY created_at DESC LIMIT 100"
            ).fetchall()
            return [{"id": r[0], "query": r[1], "created_at": r[2].isoformat()} for r in rows]
        except Exception:
            return []

@router.delete("/admin/unresolved-queries/{query_id}")
def delete_unresolved_query(query_id: int, admin: UserResponse = Depends(get_admin_user)):
    """Dismisses an unresolved query from the dashboard."""
    with pool().connection() as conn:
        try:
            conn.execute("DELETE FROM unresolved_queries WHERE id = %s", (query_id,))
        except Exception:
            pass
    return {"status": "ok"}

@router.delete("/admin/unresolved-queries")
def clear_unresolved_queries(admin: UserResponse = Depends(get_admin_user)):
    """Clears all unresolved queries."""
    with pool().connection() as conn:
        try:
            conn.execute("DELETE FROM unresolved_queries")
        except Exception:
            pass
    return {"status": "ok"}

@router.get("/{doc_id}/chunks")
def get_document_chunks(doc_id: str, admin: UserResponse = Depends(get_admin_user)):
    """Returns all parsed chunks and tables for visual inspection in Admin Panel."""
    with pool().connection() as conn:
        rows = conn.execute(
            """
            SELECT c.id, c.chunk_index, c.content, c.page, c.section, c.metadata, dv.version
            FROM chunks c
            JOIN document_versions dv ON c.version_id = dv.id
            WHERE c.document_id = %s
            ORDER BY c.page ASC, c.chunk_index ASC
            """,
            (doc_id,)
        ).fetchall()
    return [
        {
            "id": r[0],
            "chunk_index": r[1],
            "content": r[2],
            "page": r[3],
            "section": r[4],
            "metadata": r[5] if isinstance(r[5], dict) else {},
            "version": r[6]
        }
        for r in rows
    ]

@router.delete("/{doc_id}")
def delete_document(doc_id: str, admin: UserResponse = Depends(get_admin_user)):
    with pool().connection() as conn:
        res = conn.execute(
            "UPDATE documents SET deleted_at = now() WHERE id = %s RETURNING id",
            (doc_id,)
        ).fetchone()
        if not res:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Deactivate all versions from search
        conn.execute("UPDATE document_versions SET is_active = false WHERE document_id = %s", (doc_id,))
    return {"status": "deleted"}

@router.post("/{doc_id}/versions")
def new_version(
    doc_id: str,
    file: UploadFile = File(...),
    admin: UserResponse = Depends(get_admin_user)
):
    allowed_types = ['application/pdf', 'image/jpeg', 'image/png']
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Unsupported file type")
        
    file_key = storage.save_upload(file.file, file.filename)
    
    with pool().connection() as conn:
        with conn.transaction():
            # Check if doc exists
            doc = conn.execute("SELECT id FROM documents WHERE id = %s AND deleted_at IS NULL", (doc_id,)).fetchone()
            if not doc:
                raise HTTPException(status_code=404, detail="Document not found")
                
            # Get latest version number
            ver = conn.execute("SELECT coalesce(max(version), 0) + 1 FROM document_versions WHERE document_id = %s", (doc_id,)).fetchone()[0]
            
            # Insert new version
            ver_row = conn.execute(
                """
                INSERT INTO document_versions (document_id, version, file_key, mime)
                VALUES (%s, %s, %s, %s)
                RETURNING id
                """,
                (doc_id, ver, file_key, file.content_type)
            ).fetchone()
            
            # Deactivate old versions
            conn.execute("UPDATE document_versions SET is_active = false WHERE document_id = %s", (doc_id,))
            
            # Queue ingestion
            payload = json.dumps({"document_id": doc_id, "version_id": str(ver_row[0])})
            conn.execute("INSERT INTO jobs (kind, payload) VALUES ('ingest_version', %s)", (payload,))
            
    return {"status": "uploaded", "version_id": str(ver_row[0])}
