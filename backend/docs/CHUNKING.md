# Text Chunking System

## Overview

The SimplyLegal backend includes an intelligent text chunking system designed to handle long legal documents efficiently. Instead of sending the entire document to the LLM at once, the system splits it into meaningful chunks, processes each chunk separately, and then combines the results.

## Why Chunking?

- **API Limits**: Some LLM APIs have token/character limits
- **Cost Efficiency**: Process large documents more efficiently
- **Better Quality**: Smaller contexts often produce better translations
- **Parallel Processing Ready**: Chunks can be processed in parallel in future iterations
- **Memory Efficiency**: Reduces memory footprint for very long documents

## How It Works

### 1. Splitting Strategy

The chunking algorithm uses a **hierarchical approach**:

```
Input Text
    ↓
[Step 1] Split by Paragraphs (double newlines)
    ↓
[Step 2] If paragraph > CHUNK_SIZE, split by sentences
    ↓
Final Chunks (all ≤ CHUNK_SIZE)
```

### 2. Chunk Processing

```
Chunks → [LLM Translation] → Translated Chunks → [Merge] → Full Text → [TTS] → Audio
```

Each chunk:
1. Is sent to the LLM for translation
2. Translation is collected
3. Translated chunks are merged with double-newline separators
4. Audio is generated from the complete merged text

### 3. Response

The API response includes a `chunks_processed` field:

```json
{
  "text": "Simplified legal text...",
  "audio": "base64_encoded_audio_data",
  "chunks_processed": 3,
  "status": "success"
}
```

## Configuration

### Environment Variables

```env
# Enable/disable chunking
ENABLE_CHUNKING=true

# Maximum characters per chunk
CHUNK_SIZE=1000
```

### Behavior

- **Text ≤ CHUNK_SIZE**: Processed as single chunk (ENABLE_CHUNKING=true still applies)
- **Text > CHUNK_SIZE**: Split into multiple chunks automatically
- **ENABLE_CHUNKING=false**: All text processed as single request (not recommended for large docs)

## Examples

### Example 1: Short Document (No Chunking)

**Input:** "This contract is hereby entered into..."
**Length:** 500 characters
**Chunks:** 1
**Processing:** Single LLM request

### Example 2: Long Document (Automatic Chunking)

**Input:** 3,000 character legal document
**Length:** 3,000 characters
**CHUNK_SIZE:** 1,000
**Chunks:** 3
**Processing:**
1. Chunk 1: ~1,000 chars → LLM Translation 1
2. Chunk 2: ~1,000 chars → LLM Translation 2
3. Chunk 3: ~1,000 chars → LLM Translation 3
4. Merge all translations
5. Generate audio from combined text

### Example 3: Very Long Document (Sentence-Level Chunking)

If a single paragraph exceeds CHUNK_SIZE:
- Split paragraph into sentences
- Each sentence is added to chunks until reaching CHUNK_SIZE
- Sentences are never split

## API Usage

### Request

```bash
curl -X POST http://localhost:8000/api/llm_output \
  -H "Content-Type: application/json" \
  -d '{
    "text": "This deed of conveyance hereby establishes..."
  }'
```

### Response (Multi-Chunk)

```json
{
  "text": "This document transfers property ownership from one person to another as follows...",
  "audio": "//NExAAiQAFHCQuCAVbKxUANvAA+/3/5+f//5////////...",
  "chunks_processed": 2,
  "status": "success"
}
```

## Performance Characteristics

| Document Size | CHUNK_SIZE | Chunks | LLM Calls | Est. Time |
|---|---|---|---|---|
| < 1KB | 1000 | 1 | 1 | ~5-10s |
| 2KB | 1000 | 2 | 2 | ~10-20s |
| 5KB | 1000 | 5 | 5 | ~25-50s |
| 10KB | 1000 | 10 | 10 | ~50-100s |

*Times are approximate and depend on LLM model and server performance*

## Testing

Run the chunking tests:

```bash
python test_chunking.py
```

Expected output:
```
Test 1 - Short text: ✓ PASS
Test 2 - Multi-paragraph text: ✓ PASS
Test 3 - Long legal text: ✓ PASS
Test 4 - Merging chunks: ✓ PASS
```

## Advanced Configuration

### Tuning CHUNK_SIZE

The default `CHUNK_SIZE=1000` works well for most legal documents:

- **Smaller chunks** (500-800): More frequent API calls, safer for LLMs with lower limits
- **Larger chunks** (1500-2000): Fewer API calls, may exceed some API limits
- **Very large** (5000+): Risk of losing context between chunks

### Disabling Chunking

To disable chunking (process entire document at once):

```env
ENABLE_CHUNKING=false
```

⚠️ **Warning**: Only use this for documents under your LLM's token limit.

## Future Enhancements

Potential improvements:
- Parallel chunk processing using async/await
- Caching for repeated chunks
- Adaptive chunk sizing based on LLM response time
- Chunk priority/weighting for important sections
- Support for other document formats (PDF, DOCX)

## Troubleshooting

### Chunks too large?
↳ Reduce `CHUNK_SIZE` in `.env`

### Processing takes too long?
↳ Increase `CHUNK_SIZE` in `.env` (if within LLM limits)

### Audio doesn't match original?
↳ Check merged text by examining `chunks_processed` value
↳ Verify paragraph spacing is preserved

### Chunks not being merged properly?
↳ Check that chunks contain complete sentences
↳ Adjust `CHUNK_SIZE` if sentences are being split
