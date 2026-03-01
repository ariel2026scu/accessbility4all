import base64

from fastapi import APIRouter
from services.llm_tts import SimplyLegal_main
from models.LLMRequest import LLMRequest

router = APIRouter(prefix="/api", tags=["api"])
model = SimplyLegal_main()

@router.get("/")
async def root():
    return {"message": "Hello World"}

@router.post("/llm_output")
async def get_llm_output(request: LLMRequest):
    result = model.process_text(request.text)
    audio_b64 = base64.b64encode(result["audio"]).decode("utf-8")

    return {
        "text": result["text"],
        "audio": audio_b64
    }