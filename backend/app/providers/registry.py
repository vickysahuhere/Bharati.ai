from app.core.config import get_settings
from .adapters import GroqLLM, FastEmbedder, LocalStorage


def get_llm():
    s = get_settings()
    if s.llm_provider == "groq":
        return GroqLLM(s.groq_api_key, s.llm_model)
    raise ValueError(f"unknown LLM_PROVIDER={s.llm_provider}")


def get_embedder():
    s = get_settings()
    if s.embedding_provider == "fastembed":
        return FastEmbedder(s.embedding_model, s.embedding_dim)
    raise ValueError(f"unknown EMBEDDING_PROVIDER={s.embedding_provider}")


def get_storage():
    return LocalStorage(get_settings().data_dir)

_reranker = None
def get_reranker():
    global _reranker
    if _reranker is None:
        from .adapters import CrossEncoderReranker
        # Use lightweight local reranker
        _reranker = CrossEncoderReranker("BAAI/bge-reranker-v2-m3")
    return _reranker
