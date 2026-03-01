import os

import ollama
import pyttsx3
import tempfile

class SimplyLegal_main:

    def __init__(self):
        self.engine = pyttsx3.init()
        self.is_busy = False

    def ask_ai(self, input):
        # Print the thinking status using the passed index and total
        # print(f"thinking [{current_idx}-{self.total_submitted}]")
        
        self.is_busy = True

        try:
            system = (
                "You are translation app, translating complex legal jargon into simple, easy-to-understand language. "
                "Be concise."
                f":: Prompt: {input}"
            )

            response = ollama.chat(model="deepseek-r1:8b", messages=[
                {"role": "user", "content": system}
            ])
            return response["message"]["content"]
        
        except Exception as e:
            print(f"Error in ask_ai: {e}")
            self.is_busy = False
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
