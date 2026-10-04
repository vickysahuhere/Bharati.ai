from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Any, Dict
import json

from app.db.session import pool
from app.api.auth import get_current_user, get_optional_user, UserResponse
from app.generation.pipeline import generate_answer, generate_answer_stream

router = APIRouter(prefix="/api/chat", tags=["chat"])

class SessionResponse(BaseModel):
    id: str
    title: Optional[str] = None
    created_at: str

class MessageRequest(BaseModel):
    query: str
    knowledge_domain: Optional[str] = None
    department: Optional[str] = None
    semester: Optional[int] = None
    subject: Optional[str] = None
    chat_history: Optional[List[Dict[str, str]]] = None

class FeedbackRequest(BaseModel):
    feedback: int # +1 or -1

@router.post("/query")
def direct_chat_query(
    req: MessageRequest,
    current_user: Optional[UserResponse] = Depends(get_optional_user)
):
    """
    Public / Stateless RAG endpoint:
    Answers institutional queries with thread-isolated chat history without requiring a login!
    """
    result = generate_answer(
        query=req.query,
        knowledge_domain=req.knowledge_domain,
        department=req.department,
        semester=req.semester,
        subject=req.subject,
        chat_history=req.chat_history
    )
    return {
        "content": result["answer"],
        "sources": result["sources"],
        "found": result.get("found", True)
    }

@router.post("/stream")
def direct_chat_stream(
    req: MessageRequest,
    current_user: Optional[UserResponse] = Depends(get_optional_user)
):
    """
    Real-time Server-Sent Events (SSE) streaming endpoint for instantaneous token delivery.
    """
    def event_generator():
        try:
            for event in generate_answer_stream(
                query=req.query,
                knowledge_domain=req.knowledge_domain,
                department=req.department,
                semester=req.semester,
                subject=req.subject,
                chat_history=req.chat_history
            ):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'token', 'token': f' Error: {str(e)}'})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@router.post("/sessions", response_model=SessionResponse)
def create_chat_session(current_user: Optional[UserResponse] = Depends(get_optional_user)):
    user_id = current_user.id if current_user else None
    with pool().connection() as conn:
        row = conn.execute(
            "INSERT INTO chat_sessions (user_id) VALUES (%s) RETURNING id, title, created_at",
            (user_id,)
        ).fetchone()
        
    return SessionResponse(id=str(row[0]), title=row[1], created_at=row[2].isoformat())

@router.get("/sessions", response_model=List[SessionResponse])
def get_chat_sessions(current_user: Optional[UserResponse] = Depends(get_optional_user)):
    if not current_user:
        return []
    with pool().connection() as conn:
        rows = conn.execute(
            "SELECT id, title, created_at FROM chat_sessions WHERE user_id = %s ORDER BY created_at DESC",
            (current_user.id,)
        ).fetchall()
        
    return [SessionResponse(id=str(r[0]), title=r[1], created_at=r[2].isoformat()) for r in rows]

@router.get("/sessions/{session_id}/messages")
def get_session_messages(session_id: str, current_user: Optional[UserResponse] = Depends(get_optional_user)):
    with pool().connection() as conn:
        # Check ownership or guest session
        if current_user:
            session = conn.execute(
                "SELECT id FROM chat_sessions WHERE id = %s AND (user_id = %s OR user_id IS NULL)",
                (session_id, current_user.id)
            ).fetchone()
        else:
            session = conn.execute(
                "SELECT id FROM chat_sessions WHERE id = %s",
                (session_id,)
            ).fetchone()
            
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")
            
        rows = conn.execute(
            "SELECT id, role, content, sources, feedback, created_at FROM messages WHERE session_id = %s ORDER BY id ASC",
            (session_id,)
        ).fetchall()
        
    return [
        {
            "id": r[0],
            "role": r[1],
            "content": r[2],
            "sources": r[3],
            "feedback": r[4],
            "created_at": r[5].isoformat()
        }
        for r in rows
    ]

@router.post("/sessions/{session_id}/messages")
def send_message(
    session_id: str,
    req: MessageRequest,
    current_user: Optional[UserResponse] = Depends(get_optional_user)
):
    with pool().connection() as conn:
        # Check ownership or guest session
        if current_user:
            session = conn.execute(
                "SELECT id FROM chat_sessions WHERE id = %s AND (user_id = %s OR user_id IS NULL)",
                (session_id, current_user.id)
            ).fetchone()
        else:
            session = conn.execute(
                "SELECT id FROM chat_sessions WHERE id = %s",
                (session_id,)
            ).fetchone()
            
        if not session:
            # Create session on-the-fly if not found
            user_id = current_user.id if current_user else None
            conn.execute(
                "INSERT INTO chat_sessions (id, user_id) VALUES (%s, %s) ON CONFLICT (id) DO NOTHING",
                (session_id, user_id)
            )
            
        # Get message history (from DB if present, else fallback to request payload)
        prev_rows = conn.execute(
            "SELECT role, content FROM messages WHERE session_id = %s ORDER BY id ASC",
            (session_id,)
        ).fetchall()
        
        if prev_rows:
            history = [{"role": r[0], "content": r[1]} for r in prev_rows]
        else:
            history = req.chat_history or []
        
        # Save user message
        conn.execute(
            "INSERT INTO messages (session_id, role, content) VALUES (%s, 'user', %s)",
            (session_id, req.query)
        )
        
        # Generate RAG answer
        result = generate_answer(
            query=req.query,
            knowledge_domain=req.knowledge_domain,
            department=req.department,
            semester=req.semester,
            subject=req.subject,
            chat_history=history
        )
        
        # Save assistant message
        row = conn.execute(
            """
            INSERT INTO messages (session_id, role, content, sources) 
            VALUES (%s, 'assistant', %s, %s) 
            RETURNING id, created_at
            """,
            (session_id, result["answer"], json.dumps(result["sources"]))
        ).fetchone()
        
    return {
        "id": row[0],
        "role": "assistant",
        "content": result["answer"],
        "sources": result["sources"],
        "created_at": row[1].isoformat()
    }

@router.post("/messages/{message_id}/feedback")
def submit_feedback(
    message_id: int,
    req: FeedbackRequest,
    current_user: Optional[UserResponse] = Depends(get_optional_user)
):
    if req.feedback not in (1, -1):
        raise HTTPException(status_code=400, detail="Feedback must be 1 or -1")
        
    with pool().connection() as conn:
        res = conn.execute(
            """
            UPDATE messages 
            SET feedback = %s 
            WHERE id = %s
            RETURNING id
            """,
            (req.feedback, message_id)
        ).fetchone()
        
        if not res:
            raise HTTPException(status_code=404, detail="Message not found")
            
    return {"status": "ok"}

class RenameRequest(BaseModel):
    title: str

@router.put("/sessions/{session_id}/title")
def rename_session(
    session_id: str,
    req: RenameRequest,
    current_user: UserResponse = Depends(get_current_user)
):
    with pool().connection() as conn:
        res = conn.execute(
            "UPDATE chat_sessions SET title = %s WHERE id = %s AND user_id = %s RETURNING id",
            (req.title, session_id, current_user.id)
        ).fetchone()
        if not res:
            raise HTTPException(status_code=404, detail="Chat session not found")
    return {"status": "ok"}
