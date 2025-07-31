# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

TEN Agent is a modular AI agent system that integrates voice recognition (Whisper STT), language models (Ollama LLM), text-to-speech (Piper TTS), and real-time communication (LiveKit RTC). The system uses Node.js for the API server and Python for AI extensions.

## Common Development Commands

### Setup and Installation
```bash
npm run setup    # Run automated setup script
npm install      # Install Node.js dependencies
```

### Running the Application
```bash
# Start required services first:
ollama serve                 # Terminal 1: Start Ollama service
livekit-server --dev        # Terminal 2: Start LiveKit in dev mode

# Then start the application:
npm start                   # Terminal 3: Start the main server
npm run dev                 # Alternative: Start with auto-reload (nodemon)
```

### Testing
```bash
npm test         # Run comprehensive system tests
node scripts/test.js   # Run test suite directly
```

### Building
```bash
npm run build    # Currently just outputs a ready message
```

## Architecture

### Core Structure
- **api/server.js**: Express.js REST API server handling all endpoints
- **extensions/**: Self-contained AI modules with Python implementations
  - Each extension has `manifest.json` (metadata) and `extension.py` (logic)
  - Extensions: livekit_rtc, whisper_stt, ollama_llm, piper_tts
- **public/**: Web interface files
  - playground.html: Interactive testing UI
  - index.html: Landing page
- **scripts/**: Setup and utility scripts
  - setup.sh: Automated dependency installation
  - test.js: System component verification

### Key API Endpoints
- `GET /api/health` - Health check
- `POST /api/test` - Test all extensions
- `POST /api/transcribe` - Audio to text (Whisper)
- `POST /api/chat` - Text chat with LLM
- `POST /api/synthesize` - Text to speech
- `POST /api/livekit/join` - Join WebRTC room

### Extension System
Extensions follow a modular pattern where each extension:
1. Has its own directory under `extensions/`
2. Contains `manifest.json` defining capabilities
3. Implements core logic in `extension.py`
4. Can be configured via environment variables

### Important Notes
- The system depends on external services (Ollama, LiveKit) that must be running
- Python extensions use a virtual environment (`venv/`)
- File uploads are stored temporarily in `uploads/`
- No formal linting or type checking is currently configured
- Tests verify service availability rather than unit functionality

## Environment Configuration
Create `.env` from `.env.template` with key settings:
- `OLLAMA_MODEL`: LLM model to use (default: llama2)
- `LIVEKIT_URL`: LiveKit server URL
- `WHISPER_MODEL`: Whisper model size
- `PIPER_VOICE`: TTS voice model

## Development Workflow
1. Ensure external services (Ollama, LiveKit) are running
2. Make changes to extensions or API endpoints
3. Test using the playground UI or API endpoints
4. Run `npm test` to verify all components are working
5. For Python changes, ensure you're using the virtual environment