import os
from dotenv import load_dotenv

import ollama
import pyttsx3
import tempfile

# Load environment variables from .env file
load_dotenv()

class SimplyLegal_main:

    def __init__(self):
        self.engine = pyttsx3.init()
        self.is_busy = False

        # Load configuration from environment variables
        self.llm_model = os.getenv("LLM_MODEL", "deepseek-r1:8b")
        self.llm_base_url = os.getenv("LLM_BASE_URL", "http://localhost:11434")
        self.system_prompt = os.getenv(
            "TRANSLATION_SYSTEM_PROMPT",
            "You are translation app, translating complex legal jargon into simple, easy-to-understand language. Be concise."
        )

    def ask_ai(self, input):
        """Translate text using LLM"""
        self.is_busy = True

        try:
            system = f"{self.system_prompt}\n:: Prompt: {input}"

            response = ollama.chat(
                model=self.llm_model,
                messages=[{"role": "user", "content": system}]
            )
            return response["message"]["content"]

        except Exception as e:
            print(f"Error in ask_ai: {e}")
            raise e
        finally:
            self.is_busy = False

    def tts_to_bytes(self, text: str) -> bytes:
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        temp_file.close()
        try:
            self.engine.save_to_file(text, temp_file.name)
            self.engine.runAndWait()
            with open(temp_file.name, "rb") as f:
                audio_bytes = f.read()
            return audio_bytes
        finally:
            os.unlink(temp_file.name)

    def process_text(self, input_text: str) -> dict:
        simplified_text = self.ask_ai(input_text)
        audio_bytes = self.tts_to_bytes(simplified_text)
        return {"text": simplified_text, "audio": audio_bytes}
