import os
import re
import sys

from dotenv import load_dotenv

from brain import Brain
from stt import Listener
from tts import Speaker

load_dotenv()

WAKE_WORDS = tuple(os.getenv("JARVIS_WAKE_WORDS", "acorde,acorda").lower().split(","))
STOP_PHRASES = ("tchau", "até mais", "pode dormir", "vai dormir", "desativar")


def normalize(text: str) -> str:
    return re.sub(r"[^a-zA-Z0-9áéíóúâêôãõç]+", " ", text.lower()).strip()


def main() -> int:
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        print("Faltando GROQ_API_KEY no .env. Copie .env.example para .env e preencha.")
        return 1

    brain = Brain(api_key=api_key)
    listener = Listener()
    speaker = Speaker()

    print("Calibrando microfone... fique em silêncio por um instante.")
    listener.calibrate()
    print(f"Pronto. Diga {WAKE_WORDS[0].capitalize()} para acordar o assistente (Ctrl+C para sair).")

    awake = False
    while True:
        text = listener.listen()
        if not text:
            continue
        phrase = normalize(text)
        print(f"[você] {text}")
        if not phrase:
            continue

        if any(p in phrase for p in STOP_PHRASES):
            speaker.speak("Até mais! É só me chamar quando precisar.")
            awake = False
            continue

        if not awake:
            if any(w in phrase for w in WAKE_WORDS):
                awake = True
                speaker.speak("Olá, meu nome é Dominic, o que tá pegando?")
            continue

        try:
            reply = brain.ask(text)
            speaker.speak(reply)
        except Exception as exc:
            print(f"[brain] erro: {exc}")
            speaker.speak("Desculpe, não consegui processar isso agora. Pode repetir?")


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nEncerrando o Dominic.")
        sys.exit(0)
