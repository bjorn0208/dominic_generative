import json
import os
from pathlib import Path
from airllm_backend import AirLLMBackend
from huggingface_backend import HuggingFaceBackend

class DominicBackendService:
    def __init__(self):
        self.airllm = AirLLMBackend()
        self.hf = HuggingFaceBackend()

    def configure_airllm(self, model_id=None):
        self.airllm.configure(model_id=model_id)
        return self.airllm.health()

    def configure_huggingface(self, api_key=None, datasets=None):
        self.hf.configure(api_key=api_key, datasets=datasets)
        return self.hf.health()

    def handle_prompt(self, prompt, model_id=None):
        if self.airllm.is_available():
            try:
                result = self.airllm.generate(prompt)
                return {
                    "reply": str(result),
                    "backend": "airllm",
                    "model": model_id or self.airllm.model_id
                }
            except Exception as exc:
                return {
                    "reply": f"Erro no AirLLM: {exc}",
                    "backend": "airllm_error",
                    "model": model_id or self.airllm.model_id
                }

        context = self.hf.build_context(prompt)
        return {
            "reply": f"Dominic Generative recebeu: {prompt}\nContexto Hugging Face: {json.dumps(context, ensure_ascii=False)}",
            "backend": "masked_interface",
            "model": model_id or "local-mask"
        }
