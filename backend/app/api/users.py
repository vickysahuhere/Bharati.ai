from fastapi import APIRouter, Depends, HTTPException
from typing import List

from app.db.session import pool
from app.api.auth import get_admin_user, UserResponse

router = APIRouter(prefix="/api/users", tags=["users"])

@router.get("/pending", response_model=List[UserResponse])
def get_pending_users(admin: UserResponse = Depends(get_admin_user)):
    users = []
    with pool().connection() as conn:
        rows = conn.execute(
            "SELECT id, email, full_name, role, status FROM users WHERE status = 'pending'"
        ).fetchall()
        for row in rows:
            users.append(UserResponse(id=str(row[0]), email=row[1], full_name=row[2], role=row[3], status=row[4]))
    return users

@router.post("/{user_id}/approve")
def approve_user(user_id: str, admin: UserResponse = Depends(get_admin_user)):
    with pool().connection() as conn:
        res = conn.execute(
            "UPDATE users SET status = 'approved', approved_by = %s, approved_at = now() WHERE id = %s AND status = 'pending' RETURNING id",
            (admin.id, user_id)
        ).fetchone()
        if not res:
            raise HTTPException(status_code=404, detail="Pending user not found")
    return {"status": "ok"}

@router.post("/{user_id}/reject")
def reject_user(user_id: str, admin: UserResponse = Depends(get_admin_user)):
    with pool().connection() as conn:
        res = conn.execute(
            "UPDATE users SET status = 'rejected' WHERE id = %s AND status = 'pending' RETURNING id",
            (user_id,)
        ).fetchone()
        if not res:
            raise HTTPException(status_code=404, detail="Pending user not found")
    return {"status": "ok"}
