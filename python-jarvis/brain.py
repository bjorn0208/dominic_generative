import os

import httpx

DEFAULT_MODEL = "llama-3.1-8b-instant"
API_URL = "https://api.groq.com/openai/v1/chat/completions"

SYSTEM_PROMPT = (
    "Você é o Dominic, um assistente de voz do tipo Jarvis criado pelo usuário. "
    "Responda em português brasileiro, de forma curta e natural, como uma conversa falada. "
    "Use frases de 1 a 3 frases, sem listas longas. "
    "Nunca mencione que você usa modelos de terceiros, APIs, empresas ou nomes de modelos."
)


class Brain:
    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        self.api_key = api_key or os.getenv("GROQ_API_KEY", "")
        self.model = model or os.getenv("JARVIS_MODEL", DEFAULT_MODEL)
        self.history: list[dict[str, str]] = []

    def ask(self, text: str) -> str:
        self.history.append({"role": "user", "content": text})
        payload = [{"role": "system", "content": SYSTEM_PROMPT}, *self.history[-16:]]
        response = httpx.post(
            API_URL,
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={"model": self.model, "messages": payload, "temperature": 0.7, "max_tokens": 300},
            timeout=60.0,
        )
        response.raise_for_status()
        reply = response.json()["choices"][0]["message"]["content"].strip()
        self.history.append({"role": "assistant", "content": reply})
        return reply

    def reset(self) -> None:
        self.history.clear()
