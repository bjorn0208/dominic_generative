import speech_recognition as sr

class Listener:
    def __init__(self, language: str = "pt-BR") -> None:
        self.language = language
        self.recognizer = sr.Recognizer()
        self.microphone = sr.Microphone()
        self.recognizer.energy_threshold = 300
        self.recognizer.dynamic_energy_threshold = True

    def calibrate(self, seconds: float = 1.2) -> None:
        with self.microphone as source:
            self.recognizer.adjust_for_ambient_noise(source, duration=seconds)

    def listen(self, timeout: float = 3.0, phrase_limit: float = 10.0) -> str | None:
        try:
            with self.microphone as source:
                audio = self.recognizer.listen(source, timeout=timeout, phrase_time_limit=phrase_limit)
        except sr.WaitTimeoutError:
            return None
        except Exception as exc:
            print(f"[stt] erro de captura: {exc}")
            return None
        try:
            return self.recognizer.recognize_google(audio, language=self.language)
        except sr.UnknownValueError:
            return None
        except sr.RequestError as exc:
            print(f"[stt] erro de rede no Google STT: {exc}")
            return None
