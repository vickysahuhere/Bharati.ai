from functools import lru_cache
from pathlib import Path
try:
    import yaml
except ImportError:
    yaml = None
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
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    embedding_dim: int = 384
    openai_api_key: str = ""
    fastembed_cache_dir: str = "/srv/models_cache"

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
    candidates = [
        Path(get_settings().college_config),
        Path(__file__).resolve().parent.parent.parent.parent / "config" / "college.yaml",
        Path(__file__).resolve().parent.parent.parent / "config" / "college.yaml",
        Path("config/college.yaml"),
        Path("../config/college.yaml")
    ]
    for p in candidates:
        if p.exists() and yaml is not None:
            try:
                data = yaml.safe_load(p.read_text(encoding="utf-8"))
                if isinstance(data, dict):
                    return data
            except Exception:
                pass
    return {}
