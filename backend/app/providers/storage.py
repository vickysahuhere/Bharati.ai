import shutil
from pathlib import Path
from typing import BinaryIO
import uuid

from app.core.config import get_settings

class StorageProvider:
    def __init__(self):
        self.upload_dir = get_settings().upload_dir

    def save_upload(self, file_obj: BinaryIO, filename: str) -> str:
        """Saves file and returns a unique file_key."""
        ext = Path(filename).suffix
        file_key = f"{uuid.uuid4().hex}{ext}"
        dest = self.upload_dir / file_key
        with dest.open("wb") as f:
            shutil.copyfileobj(file_obj, f)
        return file_key

    def save_bytes(self, data: bytes, filename: str) -> str:
        """Saves raw bytes to disk and returns file_key."""
        ext = Path(filename).suffix
        file_key = f"{uuid.uuid4().hex}{ext}"
        dest = self.upload_dir / file_key
        dest.write_bytes(data)
        return file_key
        
    def get_path(self, file_key: str) -> Path:
        return self.upload_dir / file_key

    def ensure_file_on_disk(self, file_key: str, conn=None) -> Path:
        """Ensures file is on disk; if missing, restores from DB."""
        dest = self.upload_dir / file_key
        if dest.exists() and dest.stat().st_size > 0:
            return dest
        
        # Restore from database file_data column
        from app.db.session import pool
        close_conn = False
        if conn is None:
            conn = pool().connection()
            close_conn = True
        try:
            row = conn.execute("SELECT file_data FROM document_versions WHERE file_key=%s", (file_key,)).fetchone()
            if row and row[0]:
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(bytes(row[0]))
                return dest
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Could not restore file {file_key} from database: {e}")
        finally:
            if close_conn:
                conn.close()
        return dest
