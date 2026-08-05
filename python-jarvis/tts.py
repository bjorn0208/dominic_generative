import os
import tempfile
import asyncio
import threading

import edge_tts
import pygame

DEFAULT_VOICE = "pt-BR-FranciscaNeural"
DEFAULT_RATE = "+8%"


def _resolve_voice() -> str:
    return os.getenv("JARVIS_TTS_VOICE", DEFAULT_VOICE)


def _synthesize_sync(text: str, path: str) -> None:
    async def _run() -> None:
        await _synthesize_async(text, path)

    asyncio.run(_run())


async def _synthesize_async(text: str, path: str) -> None:
    rate = os.getenv("JARVIS_TTS_RATE", DEFAULT_RATE)
    voice = _resolve_voice()
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            communicate = edge_tts.Communicate(text, voice, rate=rate, receive_timeout=90)
            await communicate.save(path)
            if os.path.getsize(path) > 0:
                return
        except Exception as exc:
            last_error = exc
        await asyncio.sleep(1.0 + attempt * 1.5)
    if last_error:
        raise last_error


def _play_blocking(path: str) -> None:
    if not pygame.mixer.get_init():
        pygame.mixer.init()
    pygame.mixer.music.load(path)
    pygame.mixer.music.play()
    while pygame.mixer.music.get_busy():
        pygame.time.wait(60)


class Speaker:
    def __init__(self) -> None:
        self._lock = threading.Lock()

    def speak(self, text: str) -> None:
        if not text.strip():
            return
        print(f"\n[Dominic] {text}\n")
        with self._lock:
            fd, path = tempfile.mkstemp(suffix=".mp3")
            os.close(fd)
            try:
                _synthesize_sync(text, path)
                _play_blocking(path)
            finally:
                try:
                    os.remove(path)
                except OSError:
                    pass
