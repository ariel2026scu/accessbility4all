import logging
import os
import re

logger = logging.getLogger(__name__)


class TextChunker:
    """Intelligently splits long text into meaningful chunks for LLM processing."""

    def __init__(self):
        self.max_chunk_size = int(os.getenv("CHUNK_SIZE", "1000"))
        self.enable_chunking = os.getenv("ENABLE_CHUNKING", "true").lower() == "true"

    def chunk_text(self, text: str) -> list[str]:
        """
        Split text into meaningful chunks based on paragraphs and sentences.

        Args:
            text: Input text to chunk

        Returns:
            List of text chunks
        """
        if not self.enable_chunking or len(text) <= self.max_chunk_size:
            return [text]

        logger.info(f"Text length ({len(text)}) exceeds max chunk size ({self.max_chunk_size}). Chunking enabled.")

        # First, try splitting by paragraphs (double newlines)
        chunks = self._chunk_by_paragraphs(text)

        # If paragraphs are still too large, split by sentences
        chunks = self._chunk_by_sentences(chunks)

        logger.info(f"Text split into {len(chunks)} chunks")
        return chunks

    def _chunk_by_paragraphs(self, text: str) -> list[str]:
        """Split text by paragraphs (double newlines or more)."""
        # Split by double+ newlines
        paragraphs = re.split(r"\n\n+", text.strip())
        chunks = []

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
            if len(para) <= self.max_chunk_size:
                chunks.append(para)
            else:
                # Paragraph is too large, will be handled by sentence splitting
                chunks.append(para)

        return chunks

    def _chunk_by_sentences(self, chunks: list[str]) -> list[str]:
        """Further split oversized chunks by sentences."""
        final_chunks = []

        for chunk in chunks:
            if len(chunk) <= self.max_chunk_size:
                final_chunks.append(chunk)
            else:
                # Split by sentences (periods, exclamation marks, question marks)
                # This regex tries to preserve sentence boundaries
                sentences = re.split(r'(?<=[.!?])\s+', chunk)

                current_chunk = ""
                for sentence in sentences:
                    if len(current_chunk) + len(sentence) + 1 <= self.max_chunk_size:
                        if current_chunk:
                            current_chunk += " " + sentence
                        else:
                            current_chunk = sentence
                    else:
                        if current_chunk:
                            final_chunks.append(current_chunk)
                        current_chunk = sentence

                if current_chunk:
                    final_chunks.append(current_chunk)

        return final_chunks

    def merge_chunks(self, chunks: list[str], separator: str = "\n\n") -> str:
        """Merge processed chunks back together."""
        return separator.join(chunk.strip() for chunk in chunks if chunk.strip())
