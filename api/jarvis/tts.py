import asyncio
import json
import os
import tempfile
from http.server import BaseHTTPRequestHandler

import edge_tts

DEFAULT_VOICE = "pt-BR-FranciscaNeural"
DEFAULT_RATE = "+8%"


async def synthesize(text: str, path: str) -> None:
    voice = os.getenv("JARVIS_TTS_VOICE", DEFAULT_VOICE)
    rate = os.getenv("JARVIS_TTS_RATE", DEFAULT_RATE)
    communicate = edge_tts.Communicate(text, voice, rate=rate, receive_timeout=90)
    await communicate.save(path)


def handle_tts(body: bytes) -> tuple[int, str, bytes]:
    try:
        payload = json.loads(body or b"{}")
        text = str(payload.get("text", "")).strip()
    except (ValueError, TypeError):
        text = ""
    if not text:
        return 400, "application/json", json.dumps({"error": "text é obrigatório"}).encode()

    fd, path = tempfile.mkstemp(suffix=".mp3")
    os.close(fd)
    try:
        asyncio.run(synthesize(text, path))
        with open(path, "rb") as f:
            audio = f.read()
    except Exception as exc:
        return 500, "application/json", json.dumps({"error": str(exc)}).encode()
    finally:
        try:
            os.remove(path)
        except OSError:
            pass
    return 200, "audio/mpeg", audio


class handler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        length = int(self.headers.get("content-length", 0) or 0)
        body = self.rfile.read(length) if length else b""
        status, content_type, payload = handle_tts(body)
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)
