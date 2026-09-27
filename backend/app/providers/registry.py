from app.core.config import get_settings
from .adapters import GroqLLM, LocalStorage, CrossEncoderReranker


def get_llm():
    s = get_settings()
    if s.llm_provider == "groq":
        return GroqLLM(s.groq_api_key, s.llm_model)
    raise ValueError(f"unknown LLM_PROVIDER={s.llm_provider}")


_embedder = None
def get_embedder():
    global _embedder
    if _embedder is None:
        from worker.ingestion import get_embed_model
        model = get_embed_model()
        class SharedFastEmbedder:
            def embed(self, texts):
                return [v.tolist() for v in model.embed(texts)]
        _embedder = SharedFastEmbedder()
    return _embedder


def get_storage():
    return LocalStorage(get_settings().data_dir)

_reranker = None
def get_reranker():
    global _reranker
    if _reranker is None:
        _reranker = CrossEncoderReranker()
    return _reranker

