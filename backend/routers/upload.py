import io
import logging
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile, status

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["upload"])

_MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
_ALLOWED_EXTENSIONS = {".txt", ".pdf", ".docx"}


def _extract_pdf(content: bytes) -> str:
    try:
        from pypdf import PdfReader
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="PDF support not installed. Run: pip install pypdf",
        )
    reader = PdfReader(io.BytesIO(content))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n\n".join(pages).strip()


def _extract_docx(content: bytes) -> str:
    try:
        from docx import Document
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="DOCX support not installed. Run: pip install python-docx",
        )
    doc = Document(io.BytesIO(content))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n\n".join(paragraphs).strip()


@router.post("/upload", response_description="Extracted text from uploaded file")
async def upload_file(file: UploadFile = File(...)):
    """
    Extract raw text from an uploaded .txt, .pdf, or .docx file.

    Files are processed entirely in memory — nothing is written to disk,
    ensuring immediate privacy compliance.

    - **file**: The file to upload (.txt / .pdf / .docx, max 10 MB)

    Returns:
    - **text**: Extracted plain text
    - **filename**: Original filename
    - **file_type**: Detected extension
    - **char_count**: Length of extracted text
    """
    # Validate file extension
    ext = Path(file.filename or "").suffix.lower()
    if ext not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{ext}'. Allowed: .txt, .pdf, .docx",
        )

    # Read entire file into memory (no disk write)
    content = await file.read()

    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty",
        )

    if len(content) > _MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large ({len(content) // 1024} KB). Maximum is 10 MB.",
        )

    logger.info(f"Processing upload: {file.filename} ({len(content)} bytes, type={ext})")

    # Extract text based on file type — all in-memory, no temp files
    try:
        if ext == ".txt":
            text = content.decode("utf-8", errors="replace")
        elif ext == ".pdf":
            text = _extract_pdf(content)
        elif ext == ".docx":
            text = _extract_docx(content)
        else:
            # Unreachable due to extension check above, but satisfies type checkers
            raise HTTPException(status_code=400, detail="Unsupported file type")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error extracting text from {file.filename}: {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not extract text from file: {str(e)}",
        )

    text = text.strip()
    if not text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No text could be extracted from the file",
        )

    logger.info(f"Extracted {len(text)} chars from {file.filename}")
    return {
        "text": text,
        "filename": file.filename,
        "file_type": ext,
        "char_count": len(text),
    }
