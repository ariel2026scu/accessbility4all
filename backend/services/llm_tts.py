import ollama
import pyttsx3

class SimplyLegal_main:

    def __init__(self):
        self.engine = pyttsx3.init()
        self.is_busy = False

    def speak(self, text):
        # Strip out the <tool_call> tags if using DeepSeek-R1

        if "<tool_call>" in text:
            text = text.split("<tool_call>")[-1].strip()

        print(f"SimplyLegal: {text}")
        self.engine.say(text)
        self.engine.runAndWait()
        self.engine.stop()

    def ask_ai(self, input):
        # Print the thinking status using the passed index and total
        # print(f"thinking [{current_idx}-{self.total_submitted}]")
        
        self.is_busy = True

        system = (
            "You are translation app, translating complex legal jargon into simple, easy-to-understand language. "
            "Be concise."
            f":: Prompt: {input}"
        )

        response = ollama.chat(model="deepseek-r1:8b", messages=[
            {"role": "user", "content": system}
        ])
        return response["message"]["content"]

    def _run_tts(self, text):

        try:
            response = self.ask_ai(text)
            self.speak(response)

        except Exception as e:
            print(f"Error: {e}")

        finally:
            self.is_busy = False
            print("\nReady for next command...")


    def start_listening(self):
        print("SimplyLegal is ready to assist you. Type 'exit' to quit.")
        while True:
            user_input = input("You: ")
            if user_input.lower() == "exit":
                print("Goodbye!")
                break
            if not self.is_busy:
                self._run_tts(user_input)
            else:
                print("SimplyLegal is currently processing another request. Please wait...")

if __name__ == "__main__":
    awareness_system = SimplyLegal_main()
    awareness_system.start_listening()
