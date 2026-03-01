# SimplyLegal Backend Documentation

Welcome to the SimplyLegal backend documentation. This folder contains all guides and documentation for the backend system.

## 📚 Documentation Index

### 🚀 Getting Started
- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - Complete overview of the backend system
  - Project status and features implemented
  - Processing pipeline architecture
  - Deployment checklist
  - Performance metrics

### 🔌 Integration Guides
- **[INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md)** - How to integrate with frontend
  - Quick start setup instructions
  - API endpoint reference
  - Request/response formats
  - JavaScript/React examples
  - Python integration examples
  - Troubleshooting guide

### 📖 Feature Documentation
- **[CHUNKING.md](CHUNKING.md)** - Text chunking system documentation
  - How intelligent chunking works
  - Configuration options
  - Performance characteristics
  - Testing guide
  - Advanced tuning options

## 🎯 Quick Navigation

**I want to...**

- **Deploy the backend** → Read [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) section "Hackathon Deployment Checklist"
- **Integrate with my frontend** → Read [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md)
- **Understand text chunking** → Read [CHUNKING.md](CHUNKING.md)
- **Configure the system** → Read [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) section "Configuration Examples"
- **Troubleshoot issues** → Read [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) section "Troubleshooting"
- **Understand error handling** → Read [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) section "Production-Ready Error Handling"

## 📋 Backend Features

✅ **Text Translation**
- Translates complex legal documents to plain language
- Uses LLM (Ollama, Gemini, Claude support planned)

✅ **Text-to-Speech**
- Converts translated text to audio (WAV format)
- Base64 encoded for safe transmission

✅ **Intelligent Chunking**
- Automatically splits long documents
- Paragraph/sentence-aware splitting
- Configurable chunk sizes

✅ **Error Handling**
- Comprehensive validation
- Graceful error responses
- HTTP status codes

✅ **Logging & Monitoring**
- Structured logging
- Health check endpoint
- Performance tracking

## 🏗️ Architecture

```
Backend (FastAPI)
├── API Endpoints
│   ├── /api/health (monitoring)
│   ├── /api/ (info)
│   └── /api/llm_output (main translation endpoint)
├── Services
│   ├── LLM Service (deepseek-r1:8b)
│   ├── TTS Service (pyttsx3)
│   └── Text Chunking Service
└── Models
    └── Request validation
```

## 🔧 Environment Configuration

All configuration is done via `.env` file. Template: `.env.example`

**Essential variables:**
```env
LLM_MODEL=deepseek-r1:8b
LLM_BASE_URL=http://localhost:11434
LLM_TIMEOUT=60
CHUNK_SIZE=1000
ENABLE_CHUNKING=true
```

See [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) for all available options.

## 🧪 Testing

Run the included test suite:
```bash
python test_chunking.py
```

Expected output:
```
✓ Test 1 - Short text: PASS
✓ Test 2 - Multi-paragraph text: PASS
✓ Test 3 - Long legal text: PASS
✓ Test 4 - Merging chunks: PASS
```

## 📊 API Reference

### Translate Legal Text
```
POST /api/llm_output
Content-Type: application/json

Request:
{
  "text": "Legal text to translate (1-5000 characters)"
}

Response:
{
  "text": "Plain language translation",
  "audio": "base64-encoded WAV audio",
  "chunks_processed": 1,
  "status": "success"
}
```

See [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) for complete API documentation.

## 📈 Performance

- Small docs (< 1KB): ~7-12 seconds
- Medium docs (2-5KB): ~15-30 seconds
- Large docs (5-10KB): ~30-60 seconds

See [CHUNKING.md](CHUNKING.md) for detailed performance analysis.

## ⚠️ Troubleshooting

Common issues and solutions are documented in [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md).

## 📞 Support

For questions or issues:
1. Check the relevant documentation file above
2. Review the troubleshooting section
3. Check logs: `uvicorn main:app --log-level debug`
4. Test individual endpoints with curl

## 📝 File Organization

```
backend/
├── main.py                 # FastAPI entry point
├── requirements.txt        # Dependencies
├── .env.example           # Configuration template
├── test_chunking.py       # Test suite
├── models/                # Request/response models
├── routers/               # API routes
├── services/              # Business logic
│   ├── llm_tts.py        # LLM + TTS orchestration
│   └── text_chunker.py   # Intelligent chunking
└── docs/                  # This documentation folder
    ├── README.md          # This file
    ├── IMPLEMENTATION_SUMMARY.md
    ├── INTEGRATION_GUIDE.md
    └── CHUNKING.md
```

## 🎓 For Different Roles

**Frontend Developer** → Start with [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md)

**DevOps/Deployment** → Start with [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) Deployment Checklist

**QA/Testing** → Run `python test_chunking.py` and check [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) Troubleshooting

**Backend Developer** → Read all docs, focus on [CHUNKING.md](CHUNKING.md) for implementation details

---

**Version**: 1.0 (Production Ready)
**Last Updated**: 2026-02-28
**Status**: ✅ Ready for Hackathon
