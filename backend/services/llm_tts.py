import os
import re
import json
from dotenv import load_dotenv
import logging

import ollama
from groq import Groq
import pyttsx3
import tempfile
from services.text_chunker import TextChunker

load_dotenv()
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# System prompt — instructs the LLM to return structured JSON with:
#   simplified_text  : plain-English translation
#   red_flags        : list of { text, risk_level: "high"|"low" }
# ---------------------------------------------------------------------------
_DEFAULT_SYSTEM_PROMPT = """\
You are a legal document analyzer. Given the text below, do TWO things:

1. SIMPLIFY: Translate any complex legal jargon or Old English into plain, \
easy-to-understand modern English.
2. RED FLAGS: Identify any clauses that are potentially unfair, risky, or one-sided.

Respond with ONLY a valid JSON object — no markdown, no explanation, \
no text outside the JSON:

{
  "simplified_text": "<plain-English translation>",
  "red_flags": [
    { "text": "<risky clause, quoted or briefly paraphrased>", "risk_level": "high" },
    { "text": "<another clause>", "risk_level": "low" }
  ]
}

Risk level rules:
- "high": severely limits user rights, imposes unlimited liability, allows \
unilateral changes without notice, waives legal rights, or may be illegal
- "low": one-sided but common in contracts, or worth reviewing with a lawyer

If there are no red flags use: "red_flags": []
Reply in English only. Output ONLY the JSON object, nothing else.\
"""


class SimplyLegal_main:

    def __init__(self):
        self.engine = pyttsx3.init()
        self.is_busy = False
        self.chunker = TextChunker()

        # Allow full prompt override via env, otherwise use the structured default
        self.system_prompt = os.getenv("TRANSLATION_SYSTEM_PROMPT") or _DEFAULT_SYSTEM_PROMPT

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

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _strip_think_tags(self, text: str) -> str:
        """Remove <think>…</think> reasoning blocks (DeepSeek-R1 etc.)."""
        return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()

    def _ask_groq(self, prompt: str) -> str:
        response = self.groq_client.chat.completions.create(
            model=self.groq_model,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content

    def _ask_ollama(self, prompt: str) -> str:
        response = ollama.chat(
            model=self.ollama_model,
            messages=[{"role": "user", "content": prompt}],
        )
        return response["message"]["content"]

    def _parse_llm_response(self, raw: str) -> dict:
        """
        Extract structured data from the LLM's JSON response.

        Returns:
            { "simplified_text": str, "red_flags": [{ "text": str, "risk_level": "high"|"low" }] }

        Falls back to treating the entire response as simplified_text with no
        red flags if the JSON cannot be parsed.
        """
        # Strip markdown code fences the model sometimes adds
        cleaned = re.sub(r"```(?:json)?\s*", "", raw).replace("```", "").strip()

        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if match:
            try:
                parsed = json.loads(match.group())
                simplified = str(parsed.get("simplified_text", "")).strip()
                raw_flags  = parsed.get("red_flags", [])

                # Validate and normalise each flag
                red_flags = []
                for f in raw_flags:
                    if not isinstance(f, dict) or not f.get("text"):
                        continue
                    level = f.get("risk_level", "low")
                    if level not in ("high", "low"):
                        level = "low"
                    red_flags.append({"text": str(f["text"]).strip(), "risk_level": level})

                if simplified:
                    return {"simplified_text": simplified, "red_flags": red_flags}
            except (json.JSONDecodeError, ValueError):
                pass

        logger.warning("Could not parse structured JSON from LLM; returning raw text, no red flags")
        return {"simplified_text": raw, "red_flags": []}

    def _ask_and_parse(self, input_text: str) -> dict:
        """
        Call the LLM and return a parsed dict:
            { "simplified_text": str, "red_flags": [...] }
        """
        self.is_busy = True
        try:
            logger.info(f"Sending request via {self.provider}")
            prompt = f"{self.system_prompt}\n\n:: Input text:\n{input_text}"
            raw = self._ask_groq(prompt) if self.provider == "groq" else self._ask_ollama(prompt)
            raw = self._strip_think_tags(raw)
            result = self._parse_llm_response(raw)
            logger.info(
                f"LLM response parsed — "
                f"{len(result['red_flags'])} red flag(s) found"
            )
            return result

        except TimeoutError:
            raise Exception("LLM service timed out. Please try again.")
        except ConnectionError:
            raise Exception("Unable to connect to LLM service. Please check the service is running.")
        except Exception as e:
            logger.error(f"Unexpected LLM error: {e}")
            raise Exception(f"Error processing text: {str(e)}")
        finally:
            self.is_busy = False

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def tts_to_bytes(self, text: str) -> bytes:
        """Convert text to WAV audio bytes."""
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
        Chunk → translate (with red-flag detection) → merge → TTS.

        Returns:
            {
                "text":             str,
                "red_flags":        [{ "text": str, "risk_level": "high"|"low" }],
                "audio":            bytes,
                "chunks_processed": int,
            }
        """
        chunks = self.chunker.chunk_text(input_text)
        logger.info(f"Processing {len(chunks)} chunk(s)")

        simplified_parts: list[str] = []
        all_red_flags:    list[dict] = []

        for i, chunk in enumerate(chunks, 1):
            logger.info(f"Processing chunk {i}/{len(chunks)} ({len(chunk)} chars)")
            try:
                result = self._ask_and_parse(chunk)
                simplified_parts.append(result["simplified_text"])
                all_red_flags.extend(result["red_flags"])
            except Exception as e:
                logger.error(f"Error on chunk {i}: {e}")
                raise

        simplified_text = self.chunker.merge_chunks(simplified_parts)
        audio_bytes     = self.tts_to_bytes(simplified_text)

        return {
            "text":             simplified_text,
            "red_flags":        all_red_flags,
            "audio":            audio_bytes,
            "chunks_processed": len(chunks),
        }
