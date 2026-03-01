from pydantic import BaseModel, Field

class LLMRequest(BaseModel):
    text: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        description="Text to translate (1-5000 characters)"
    )