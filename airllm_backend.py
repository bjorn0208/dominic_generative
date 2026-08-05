import os
import json
import subprocess
import sys
from pathlib import Path

class AirLLMBackend:
    def __init__(self, model_id="Qwen/Qwen3-32B"):
        self.model_id = model_id
        self.enabled = False
        self.error = None

    def is_available(self):
        return self.enabled

    def configure(self, model_id=None):
        if model_id:
            self.model_id = model_id
        self.enabled = True
        self.error = None

    def generate(self, prompt, max_new_tokens=120):
        if not self.is_available():
            raise RuntimeError("AirLLM backend não está configurado")
        try:
            import airllm
            from airllm import AutoModel
        except Exception as exc:
            raise RuntimeError(f"AirLLM não está instalado: {exc}") from exc

        model = AutoModel.from_pretrained(self.model_id)
        messages = [{"role": "user", "content": prompt}]
        output = model.generate(messages, max_new_tokens=max_new_tokens)
        return output

    def health(self):
        return {"status": "ready" if self.is_available() else "not_configured", "model": self.model_id}
