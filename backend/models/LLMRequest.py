from pydantic import BaseModel

class LLMRequest(BaseModel):
    text: str