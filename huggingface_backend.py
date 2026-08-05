import os
from pathlib import Path

class HuggingFaceBackend:
    def __init__(self):
        self.enabled = False
        self.api_key = os.getenv("HF_TOKEN", "")
        self.datasets = []

    def configure(self, api_key=None, datasets=None):
        if api_key is not None:
            self.api_key = api_key
        if datasets is not None:
            self.datasets = datasets
        self.enabled = bool(self.api_key or self.datasets)

    def health(self):
        return {
            "status": "ready" if self.enabled else "not_configured",
            "datasets": self.datasets,
            "api_key_configured": bool(self.api_key)
        }

    def build_context(self, query, top_k=3):
        if not self.enabled:
            return []
        return [
            {"source": ds, "query": query, "rank": i}
            for i, ds in enumerate(self.datasets[:top_k])
        ]
