import os
import re
from dotenv import load_dotenv
import logging

import ollama
from groq import Groq
import pyttsx3
import tempfile
from services.text_chunker import TextChunker

# Load environment variables from .env file
load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)

class SimplyLegal_main:

    def __init__(self):
        self.engine = pyttsx3.init()
        self.is_busy = False
        self.chunker = TextChunker()

        self.system_prompt = os.getenv(
            "TRANSLATION_SYSTEM_PROMPT",
            "You are a translation app. Translate complex legal jargon or Old English into simple, easy-to-understand modern English. Be concise. Reply in English only."
        )

        # Groq takes priority when an API key is configured
        groq_key = os.getenv("GROQ_API_KEY")
        if groq_key:
            self.provider = "groq"
            self.groq_client = Groq(api_key=groq_key)
            self.groq_model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
            logger.info(f"LLM provider: Groq ({self.groq_model})")
        else:
            self.provider = "ollama"
            self.ollama_model = os.getenv("LLM_MODEL", "llama3.2:latest")
            self.llm_timeout = int(os.getenv("LLM_TIMEOUT", "60"))
            logger.info(f"LLM provider: Ollama ({self.ollama_model})")

    def _strip_think_tags(self, text: str) -> str:
        """Strip <think>…</think> reasoning blocks emitted by DeepSeek-R1 and similar models."""
        return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()

    def _ask_groq(self, system: str) -> str:
        response = self.groq_client.chat.completions.create(
            model=self.groq_model,
            messages=[{"role": "user", "content": system}],
        )
        return response.choices[0].message.content

    def _ask_ollama(self, system: str) -> str:
        response = ollama.chat(
            model=self.ollama_model,
            messages=[{"role": "user", "content": system}],
        )
        return response["message"]["content"]

    def ask_ai(self, input_text: str) -> str:
        """Translate text using the configured LLM provider."""
        self.is_busy = True
        try:
            logger.info(f"Sending request via {self.provider}")
            system = f"{self.system_prompt}\n:: Prompt: {input_text}"

            raw = self._ask_groq(system) if self.provider == "groq" else self._ask_ollama(system)
            result = self._strip_think_tags(raw)
            logger.info("LLM request completed successfully")
            return result

        except TimeoutError as e:
            logger.error(f"LLM timeout: {e}")
            raise Exception("LLM service timed out. Please try again.")
        except ConnectionError as e:
            logger.error(f"LLM connection error: {e}")
            raise Exception("Unable to connect to LLM service. Please check the service is running.")
        except Exception as e:
            logger.error(f"Unexpected LLM error: {e}")
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
        """
        Process text through chunking, LLM translation, and TTS.

        Returns:
            dict with keys: text, audio, chunks_processed
        """
        # Chunk the text if needed
        chunks = self.chunker.chunk_text(input_text)
        logger.info(f"Processing {len(chunks)} chunk(s)")

        # Process each chunk through LLM
        translated_chunks = []
        for i, chunk in enumerate(chunks, 1):
            logger.info(f"Processing chunk {i}/{len(chunks)} ({len(chunk)} chars)")
            try:
                translated_chunk = self.ask_ai(chunk)
                translated_chunks.append(translated_chunk)
            except Exception as e:
                logger.error(f"Error processing chunk {i}: {e}")
                raise

        # Merge translated chunks
        simplified_text = self.chunker.merge_chunks(translated_chunks)

        # Generate audio from combined text
        audio_bytes = self.tts_to_bytes(simplified_text)

        return {
            "text": simplified_text,
            "audio": audio_bytes,
            "chunks_processed": len(chunks)
        }
