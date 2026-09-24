from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
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

    # Save the file
    file_key = storage.save_upload(file.file, file.filename)
    
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
            
            # Create document version
            ver_row = conn.execute(
                """
                INSERT INTO document_versions (document_id, version, file_key, mime)
                VALUES (%s, 1, %s, %s)
                RETURNING id
                """,
                (doc_id, file_key, file.content_type)
            ).fetchone()
            ver_id = ver_row[0]
            
            # Queue ingestion job
            payload = json.dumps({"document_id": str(doc_id), "version_id": str(ver_id)})
            conn.execute(
                "INSERT INTO jobs (kind, payload) VALUES ('ingest_version', %s)",
                (payload,)
            )
            
    return {"status": "uploaded", "document_id": str(doc_id), "version_id": str(ver_id)}


@router.get("/status")
def get_documents_status(admin: UserResponse = Depends(get_admin_user)):
    with pool().connection() as conn:
        rows = conn.execute(
            """
            SELECT d.id, d.title, dv.version, dv.status, dv.error 
            FROM documents d
            JOIN document_versions dv ON d.id = dv.document_id
            WHERE d.deleted_at IS NULL
            ORDER BY d.created_at DESC
            """
        ).fetchall()
        
    return [
        {"document_id": str(r[0]), "title": r[1], "version": r[2], "status": r[3], "error": r[4]}
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
