# SimplyLegal Backend

A FastAPI-based backend that translates complex legal documents to plain language and generates audio narration.

## ✨ Features

- 📄 **Legal Text Translation**: Converts complex legal jargon to plain English
- 🔊 **Text-to-Speech**: Generates audio narration of translated text
- 🗂️ **Smart Chunking**: Intelligently splits long documents for efficient processing
- ⚠️ **Error Handling**: Comprehensive validation and error recovery
- 📊 **Monitoring**: Health check endpoint and detailed logging
- ⚙️ **Configurable**: Environment-based configuration for all settings

## 🚀 Quick Start

```bash
# Copy environment template
cp .env.example .env

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload
```

Server runs on: `http://localhost:8000`

## 📖 Documentation

**All documentation is in the `/docs` folder:**

- **[docs/IMPLEMENTATION_SUMMARY.md](docs/IMPLEMENTATION_SUMMARY.md)** - Complete project overview
- **[docs/INTEGRATION_GUIDE.md](docs/INTEGRATION_GUIDE.md)** - Frontend integration guide
- **[docs/CHUNKING.md](docs/CHUNKING.md)** - Text chunking documentation

👉 **Start here**: [docs/README.md](docs/README.md)

## 🧪 Test the API

```bash
# Health check
curl http://localhost:8000/api/health

# Translate legal text
curl -X POST http://localhost:8000/api/llm_output \
  -H "Content-Type: application/json" \
  -d '{"text":"This deed of conveyance is hereby executed..."}'
```

## 📋 Requirements

- Python 3.8+
- Ollama (for LLM processing)
- pyttsx3 (for text-to-speech)

See `requirements.txt` for full dependency list.

## 🔧 Configuration

All configuration is done via `.env` file. See `.env.example` for available options:

```env
# LLM Settings
LLM_MODEL=deepseek-r1:8b
LLM_BASE_URL=http://localhost:11434

# Chunking Settings
CHUNK_SIZE=1000
ENABLE_CHUNKING=true
```

## 📚 Project Structure

```
backend/
├── main.py                    # FastAPI application
├── requirements.txt           # Python dependencies
├── .env.example              # Configuration template
├── test_chunking.py          # Chunking tests
├── models/                   # Request/response models
├── routers/                  # API endpoints
├── services/                 # Business logic
│   ├── llm_tts.py           # LLM & TTS service
│   └── text_chunker.py      # Text chunking
└── docs/                     # 📚 Documentation
    ├── README.md            # Doc index
    ├── IMPLEMENTATION_SUMMARY.md
    ├── INTEGRATION_GUIDE.md
    └── CHUNKING.md
```

## 🎯 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Health check |
| `/api/` | GET | Welcome message |
| `/api/llm_output` | POST | Translate legal text to plain language with audio |

## 📊 Status

✅ **Production Ready** for hackathon deployment

**Implemented:**
- Environment-based configuration
- Comprehensive error handling
- Intelligent text chunking
- Complete logging
- Input validation
- API monitoring

## 🆘 Troubleshooting

Check the troubleshooting section in [docs/INTEGRATION_GUIDE.md](docs/INTEGRATION_GUIDE.md).

Common issues:
- **"Cannot connect to LLM"**: Ensure Ollama is running
- **Slow responses**: Adjust CHUNK_SIZE or increase timeout
- **Empty input error**: Ensure text is 1-5000 characters

## 📝 License

[Add your license here]

## 👥 Team

Built for the accessibility hackathon 🎯

---

**For detailed documentation, see [docs/README.md](docs/README.md)**
