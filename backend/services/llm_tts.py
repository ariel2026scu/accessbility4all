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
# System prompt — contract risk auditor persona with structured JSON output:
#   simplified_text  : plain-English translation
#   red_flags        : list of { quote, risk, severity, worst_case }
# ---------------------------------------------------------------------------
_DEFAULT_SYSTEM_PROMPT = """\
You are a contract risk auditor trained to identify hidden, asymmetric, or \
user-unfriendly clauses.

Analyze the following contract text and:

1. Translate any complex legal jargon or Old English into simple, easy-to-understand \
modern English.
2. Identify all potential red flags, assuming the reader is an individual user or \
small business with less bargaining power.
3. Highlight clauses that:
   - Limit legal rights
   - Shift liability
   - Allow unilateral changes
   - Cap damages
   - Remove court access
   - Broadly license data/IP
   - Allow termination without notice
   - Create financial traps (auto-renewal, fees, penalties)

Be conservative: if a clause could reasonably be harmful, mark it.

Respond with ONLY a valid JSON object — no markdown, no explanation, \
no text outside the JSON:

{
  "simplified_text": "<plain-English translation of the full text>",
  "red_flags": [
    {
      "quote":      "<exact or near-exact quote of the risky clause>",
      "risk":       "<plain-English explanation of the hidden risk>",
      "severity":   "high",
      "worst_case": "<realistic worst-case scenario for the user>"
    }
  ]
}

Severity levels:
- "high":   severely limits rights, imposes unlimited liability, waives legal \
recourse, or may be illegal
- "medium": meaningfully one-sided, creates significant financial or legal risk \
if triggered
- "low":    worth reviewing but common in contracts; low probability of harm

If there are no red flags use: "red_flags": []
Reply in English only. Output ONLY the JSON object, nothing else.\
"""


class SimplyLegal_main:

    def __init__(self):
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
        """Remove <think>…</think> reasoning blocks."""
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
            {
                "simplified_text": str,
                "red_flags": [
                    {
                        "quote":      str,
                        "risk":       str,
                        "severity":   "high" | "medium" | "low",
                        "worst_case": str,
                    }
                ]
            }

        Falls back to treating the entire response as simplified_text with no
        red flags if the JSON cannot be parsed.
        """
        VALID_SEVERITIES = {"high", "medium", "low"}

        # Strip markdown code fences the model sometimes adds
        cleaned = re.sub(r"```(?:json)?\s*", "", raw).replace("```", "").strip()

        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if match:
            try:
                parsed    = json.loads(match.group())
                simplified = str(parsed.get("simplified_text", "")).strip()
                raw_flags  = parsed.get("red_flags", [])

                red_flags = []
                for f in raw_flags:
                    if not isinstance(f, dict):
                        continue
                    # Accept both new schema (quote/risk/severity/worst_case)
                    # and old schema (text/risk_level) for backward compatibility
                    quote     = str(f.get("quote") or f.get("text", "")).strip()
                    risk      = str(f.get("risk", "")).strip()
                    severity  = f.get("severity") or f.get("risk_level", "low")
                    worst_case = str(f.get("worst_case", "")).strip()

                    if not quote:
                        continue
                    if severity not in VALID_SEVERITIES:
                        severity = "low"

                    red_flags.append({
                        "quote":      quote,
                        "risk":       risk,
                        "severity":   severity,
                        "worst_case": worst_case,
                    })

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
            engine = pyttsx3.init()          # fresh instance every call
            engine.save_to_file(text, temp_file.name)
            engine.runAndWait()
            engine.stop()                    # cleanly tear down the event loop
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

