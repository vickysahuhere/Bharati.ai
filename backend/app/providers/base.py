"""Provider interfaces. Swapping a provider = new adapter + config change."""
from typing import Protocol


class LLMProvider(Protocol):
    def generate(self, messages: list[dict], temperature: float = 0.1) -> str: ...


class EmbeddingProvider(Protocol):
    model_name: str
    dim: int
    def embed(self, texts: list[str]) -> list[list[float]]: ...


class Reranker(Protocol):
    def rerank(self, query: str, passages: list[str]) -> list[float]: ...


class StorageProvider(Protocol):
    def put(self, key: str, data: bytes) -> None: ...
    def get(self, key: str) -> bytes: ...
    def delete(self, key: str) -> None: ...
