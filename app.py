from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Dominic Generative", version="0.1.0")

class ChatRequest(BaseModel):
    prompt: str

@app.get("/")
def home():
    return {
        "name": "Dominic Generative",
        "status": "online",
        "message": "Interface local pronta para conectar modelos e dados"
    }

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/chat")
def chat(req: ChatRequest):
    return {
        "response": f"Dominic Generative recebeu: {req.prompt}",
        "model": "placeholder",
        "source": "local-interface"
    }

@app.get("/chat")
def chat_get(prompt: str):
    return {
        "response": f"Dominic Generative recebeu: {prompt}",
        "model": "placeholder",
        "source": "local-interface"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
