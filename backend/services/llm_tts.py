import os
from dotenv import load_dotenv
import logging

import ollama
import pyttsx3
import tempfile

# Load environment variables from .env file
load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)

class SimplyLegal_main:

    def __init__(self):
        self.engine = pyttsx3.init()
        self.is_busy = False

        # Load configuration from environment variables
        self.llm_model = os.getenv("LLM_MODEL", "deepseek-r1:8b")
        self.llm_base_url = os.getenv("LLM_BASE_URL", "http://localhost:11434")
        self.llm_timeout = int(os.getenv("LLM_TIMEOUT", "60"))  # Default 60 seconds
        self.system_prompt = os.getenv(
            "TRANSLATION_SYSTEM_PROMPT",
            "You are translation app, translating complex legal jargon into simple, easy-to-understand language. Be concise."
        )

    def ask_ai(self, input_text: str) -> str:
        """Translate text using LLM"""
        self.is_busy = True

        try:
            logger.info(f"Processing LLM request with model: {self.llm_model}")
            system = f"{self.system_prompt}\n:: Prompt: {input_text}"

            response = ollama.chat(
                model=self.llm_model,
                messages=[{"role": "user", "content": system}]
            )
            result = response["message"]["content"]
            logger.info("LLM request completed successfully")
            return result

        except TimeoutError as e:
            logger.error(f"LLM request timeout: {e}")
            raise Exception("LLM service timed out. Please try again.")
        except ConnectionError as e:
            logger.error(f"LLM connection error: {e}")
            raise Exception("Unable to connect to LLM service. Please check the service is running.")
        except Exception as e:
            logger.error(f"Unexpected error in LLM processing: {e}")
            raise Exception(f"Error processing text: {str(e)}")
        finally:
            self.is_busy = False

    def tts_to_bytes(self, text: str) -> bytes:
        """Convert text to audio bytes"""
        if not text or not text.strip():
            raise ValueError("Cannot generate audio from empty text")

        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        temp_file.close()
        try:
            logger.info("Generating audio from text")
            self.engine.save_to_file(text, temp_file.name)
            self.engine.runAndWait()
            with open(temp_file.name, "rb") as f:
                audio_bytes = f.read()
            logger.info(f"Audio generated successfully ({len(audio_bytes)} bytes)")
            return audio_bytes
        except Exception as e:
            logger.error(f"Error generating audio: {e}")
            raise Exception(f"Failed to generate audio: {str(e)}")
        finally:
            if os.path.exists(temp_file.name):
                os.unlink(temp_file.name)

    def process_text(self, input_text: str) -> dict:
        simplified_text = self.ask_ai(input_text)
        audio_bytes = self.tts_to_bytes(simplified_text)
        return {"text": simplified_text, "audio": audio_bytes}
