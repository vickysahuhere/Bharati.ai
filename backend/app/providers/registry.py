from app.core.config import get_settings
from .adapters import GroqLLM, FastEmbedder, LocalStorage


def get_llm():
    s = get_settings()
    if s.llm_provider == "groq":
        return GroqLLM(s.groq_api_key, s.llm_model)
    raise ValueError(f"unknown LLM_PROVIDER={s.llm_provider}")


_embedder = None
def get_embedder():
    global _embedder
    if _embedder is None:
        s = get_settings()
        if s.embedding_provider == "fastembed":
            _embedder = FastEmbedder(s.embedding_model, s.embedding_dim)
        else:
            raise ValueError(f"unknown EMBEDDING_PROVIDER={s.embedding_provider}")
    return _embedder


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
