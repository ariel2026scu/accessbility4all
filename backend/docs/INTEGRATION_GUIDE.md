# Backend Integration Guide

## Quick Start

### 1. Setup

```bash
# Copy environment template
cp .env.example .env

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload
```

Server runs on: `http://localhost:8000`

### 2. Test the API

#### Health Check
```bash
curl http://localhost:8000/api/health
```

Response:
```json
{"status": "ok", "message": "Backend is running"}
```

#### Translate Legal Text
```bash
curl -X POST http://localhost:8000/api/llm_output \
  -H "Content-Type: application/json" \
  -d '{
    "text": "The aforementioned deed of conveyance is hereby executed between the parties hereinabove named."
  }'
```

Response:
```json
{
  "text": "The document is now officially signed by both parties mentioned above.",
  "audio": "//NExAAiQAFHCQuCAVbKxUANvAA+/3/5+f...",
  "chunks_processed": 1,
  "status": "success"
}
```

### 3. Key Features

✅ **Error Handling**
- Empty input validation (400)
- LLM timeout handling (503)
- Connection errors (503)
- Encoding errors (500)

✅ **Text Chunking**
- Automatic splitting for long documents
- Intelligent paragraph/sentence preservation
- Configurable chunk size (CHUNK_SIZE env var)
- Response includes chunks_processed count

✅ **Production Ready**
- Comprehensive logging
- HTTP status codes
- Input validation (1-5000 chars)
- Base64 audio encoding

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check for monitoring |
| GET | `/api/` | Welcome message |
| POST | `/api/llm_output` | Translate legal text to plain language with audio |

## Request/Response Format

### POST /api/llm_output

**Request:**
```json
{
  "text": "Legal text to translate (1-5000 characters)"
}
```

**Successful Response (200):**
```json
{
  "text": "Plain language translation",
  "audio": "base64-encoded WAV audio",
  "chunks_processed": 1,
  "status": "success"
}
```

**Error Response (400):**
```json
{
  "detail": "Text input cannot be empty"
}
```

**Error Response (503):**
```json
{
  "detail": "LLM service timed out. Please try again."
}
```

**Error Response (500):**
```json
{
  "detail": "An unexpected error occurred. Please try again."
}
```

## Environment Configuration

### Essential Variables

```env
# LLM Service
LLM_MODEL=deepseek-r1:8b
LLM_BASE_URL=http://localhost:11434
LLM_TIMEOUT=60

# Text Chunking
CHUNK_SIZE=1000
ENABLE_CHUNKING=true
```

### Optional Variables

```env
# Custom translation prompt
TRANSLATION_SYSTEM_PROMPT=Your custom prompt here

# Future API keys (not yet used)
GEMINI_API_KEY=your_key
CLAUDE_API_KEY=your_key
TTS_SERVICE_KEY=your_key
```

## Frontend Integration

### Example: JavaScript/React

```javascript
// Function to translate legal text
async function translateLegalText(text) {
  try {
    const response = await fetch('http://localhost:8000/api/llm_output', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail);
    }

    const data = await response.json();

    // Use the translated text
    console.log('Translated:', data.text);
    console.log('Chunks processed:', data.chunks_processed);

    // Play the audio
    const audioBlob = Uint8Array.from(atob(data.audio), c => c.charCodeAt(0));
    const audioUrl = URL.createObjectURL(new Blob([audioBlob], { type: 'audio/wav' }));
    const audio = new Audio(audioUrl);
    audio.play();

    return data;
  } catch (error) {
    console.error('Translation failed:', error.message);
  }
}

// Usage
translateLegalText("This deed of conveyance...");
```

### Example: Python

```python
import requests
import base64

def translate_legal_text(text):
    response = requests.post(
        'http://localhost:8000/api/llm_output',
        json={'text': text}
    )
    response.raise_for_status()

    data = response.json()

    # Decode and save audio
    audio_bytes = base64.b64decode(data['audio'])
    with open('output.wav', 'wb') as f:
        f.write(audio_bytes)

    print(f"Translated: {data['text']}")
    print(f"Chunks processed: {data['chunks_processed']}")

    return data

# Usage
translate_legal_text("This deed of conveyance...")
```

## Monitoring & Logging

### View Logs

```bash
# Run with logging
uvicorn main:app --reload --log-level info

# See logs in terminal:
# INFO: Uvicorn running on http://0.0.0.0:8000
# INFO: Processing request with text length: 250
# INFO: Processing LLM request with model: deepseek-r1:8b
# INFO: Request processed successfully
```

### Key Log Messages

- `Processing request with text length: X` - New request received
- `Text split into N chunks` - Chunking occurred
- `Processing chunk i/N` - Currently processing specific chunk
- `LLM request completed successfully` - LLM response received
- `Audio generated successfully` - Audio encoding complete
- `Request processed successfully` - Full request successful

## Troubleshooting

### Issue: "LLM service timed out"
**Solution**: Check that Ollama is running on the configured LLM_BASE_URL

### Issue: "Unable to connect to LLM service"
**Solution**:
- Verify Ollama is running: `ollama serve`
- Check LLM_BASE_URL is correct in .env
- Ensure deepseek-r1:8b model is installed: `ollama pull deepseek-r1:8b`

### Issue: "Text input cannot be empty"
**Solution**: Ensure request contains non-empty, non-whitespace text

### Issue: Slow response time
**Solution**:
- Reduce CHUNK_SIZE for fewer LLM calls per request
- Increase LLM_TIMEOUT if processing is legitimate
- Check Ollama server performance

### Issue: Audio playback issues
**Solution**:
- Verify audio is valid WAV format by decoding base64
- Test audio file locally: `ffplay output.wav`
- Check pyttsx3 is properly installed

## Performance Metrics

### Typical Processing Times (Ollama deepseek-r1:8b)

| Text Length | Chunks | LLM Time | TTS Time | Total |
|---|---|---|---|---|
| 500 chars | 1 | ~5-10s | ~2s | ~7-12s |
| 2KB | 2 | ~10-20s | ~3s | ~13-23s |
| 5KB | 5 | ~25-50s | ~5s | ~30-55s |

*Times vary based on system performance and LLM complexity*

## Next Steps

1. ✅ Copy `.env.example` to `.env`
2. ✅ Configure LLM service (Ollama, Gemini, etc.)
3. ✅ Test health endpoint
4. ✅ Test translation with sample legal text
5. ✅ Integrate with frontend
6. ✅ Configure logging/monitoring for production
7. ✅ Set up error handling in frontend
8. ✅ Test end-to-end with real documents

## Support

For issues or questions:
- Check logs: `uvicorn main:app --log-level debug`
- Review CHUNKING.md for text splitting details
- Test individual endpoints with curl
- Enable debug logging for detailed tracing
