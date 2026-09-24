from functools import lru_cache
from pathlib import Path
import yaml
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    secret_key: str
    data_dir: str = "/data"
    college_config: str = "/config/college.yaml"

    llm_provider: str = "groq"
    llm_model: str = "llama-3.3-70b-versatile"
    groq_api_key: str = ""
    embedding_provider: str = "fastembed"
    embedding_model: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    embedding_dim: int = 384

    owner_email: str = ""
    owner_password: str = ""

    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    @property
    def upload_dir(self) -> Path:
        p = Path(self.data_dir) / "uploads"
        p.mkdir(parents=True, exist_ok=True)
        return p

@lru_cache
def get_settings() -> Settings:
    return Settings()


@lru_cache
def get_college_config() -> dict:
    p = Path(get_settings().college_config)
    return yaml.safe_load(p.read_text()) if p.exists() else {}
