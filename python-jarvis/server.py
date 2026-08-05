import io
import json
import os
import subprocess
import tempfile

import speech_recognition as sr
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from brain import Brain
from tts import _synthesize_async

load_dotenv()

app = FastAPI(title="Dominic Jarvis Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SESSIONS: dict[str, Brain] = {}


def get_brain(session_id: str) -> Brain:
    if session_id not in SESSIONS:
        SESSIONS[session_id] = Brain()
    return SESSIONS[session_id]


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "Dominic Jarvis", "tts": True, "stt": True, "brain": True}


@app.post("/api/tts")
async def tts(request: Request) -> Response:
    body = await request.json()
    text = str(body.get("text", "")).strip()
    if not text:
        return Response(status_code=400, content='{"error":"text é obrigatório"}', media_type="application/json")

    fd, path = tempfile.mkstemp(suffix=".mp3")
    os.close(fd)
    try:
        await _synthesize_async(text, path)
        with open(path, "rb") as f:
            audio = f.read()
    finally:
        try:
            os.remove(path)
        except OSError:
            pass
    return Response(content=audio, media_type="audio/mpeg")


@app.post("/api/stt")
async def stt(request: Request) -> Response:
    data = await request.body()
    if not data:
        return Response(status_code=400, content='{"error":"áudio vazio"}', media_type="application/json")

    try:
        proc = subprocess.run(
            ["ffmpeg", "-y", "-i", "-", "-ar", "16000", "-ac", "1", "-f", "wav", "pipe:1"],
            input=data,
            capture_output=True,
        )
        wav = proc.stdout
        if not wav:
            return Response(status_code=422, content='{"error":"não foi possível converter o áudio"}', media_type="application/json")
    except FileNotFoundError:
        return Response(status_code=500, content='{"error":"ffmpeg não encontrado"}', media_type="application/json")

    recognizer = sr.Recognizer()
    try:
        with sr.AudioFile(io.BytesIO(wav)) as source:
            audio = recognizer.record(source)
        text = recognizer.recognize_google(audio, language="pt-BR")
    except sr.UnknownValueError:
        text = ""
    except sr.RequestError as exc:
        return Response(status_code=502, content=json.dumps({"error": f"Google STT indisponível: {exc}"}), media_type="application/json")
    return Response(content=json.dumps({"text": text}), media_type="application/json")


@app.post("/api/brain")
async def brain(request: Request) -> Response:
    body = await request.json()
    text = str(body.get("text", "")).strip()
    session_id = str(body.get("session_id", "default"))
    if not text:
        return Response(status_code=400, content='{"error":"text é obrigatório"}', media_type="application/json")

    try:
        reply = get_brain(session_id).ask(text)
    except Exception as exc:
        return Response(status_code=502, content=json.dumps({"error": str(exc)}), media_type="application/json")
    return Response(content=json.dumps({"reply": reply}), media_type="application/json")


@app.post("/api/reset")
async def reset(request: Request) -> Response:
    body = await request.json()
    session_id = str(body.get("session_id", "default"))
    if session_id in SESSIONS:
        SESSIONS[session_id].reset()
    return Response(content='{"ok":true}', media_type="application/json")
