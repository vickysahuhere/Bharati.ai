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
        
    def get_path(self, file_key: str) -> Path:
        return self.upload_dir / file_key
