import base64
import logging

from fastapi import APIRouter, HTTPException, status
from services.llm_tts import SimplyLegal_main
from models.LLMRequest import LLMRequest

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["api"])
model = SimplyLegal_main()

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "message": "Backend is running"}

@router.get("/")
async def root():
    return {"message": "SimplyLegal API - Translate complex text to plain language"}

@router.post("/llm_output", response_description="Translated text and audio")
async def get_llm_output(request: LLMRequest):
    """
    Translate complex text (e.g., legal documents) to plain language and convert to audio.

    - **text**: The text to translate (1-5000 characters)

    Returns:
    - **text**: Simplified translation
    - **audio**: Base64-encoded WAV audio file
    """
    try:
        logger.info(f"Processing request with text length: {len(request.text)}")

        # Trim and validate input
        text = request.text.strip()
        if not text:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Text input cannot be empty"
            )

        # Process the text
        try:
            result = model.process_text(text)
        except Exception as service_error:
            logger.error(f"Service error: {service_error}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(service_error)
            )

        # Validate results
        if not result.get("text") or not result.get("audio"):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to process text or generate audio"
            )

        # Encode audio to base64
        try:
            audio_b64 = base64.b64encode(result["audio"]).decode("utf-8")
        except Exception as e:
            logger.error(f"Error encoding audio: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to encode audio output"
            )

        logger.info("Request processed successfully")
        return {
            "text": result["text"],
            "audio": audio_b64,
            "chunks_processed": result.get("chunks_processed", 1),
            "status": "success"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in get_llm_output: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred. Please try again."
        )