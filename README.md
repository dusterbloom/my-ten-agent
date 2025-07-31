# TEN Agent - Voice & Text AI Agent

A comprehensive AI agent that combines voice recognition, natural language processing, and text-to-speech capabilities using modern open-source tools.

## 🎯 Overview

TEN Agent is a modular AI agent that provides:
- **Real-time voice communication** via WebRTC (LiveKit)
- **Speech-to-text** using OpenAI Whisper
- **Intelligent responses** using Ollama LLM
- **Natural speech synthesis** using Piper TTS

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- Python 3.8+
- macOS/Linux (Windows WSL2 supported)

### Installation

1. **Clone and setup:**
```bash
git clone <repository>
cd ten-agent
npm run setup
```

2. **Start services:**
```bash
# Terminal 1: Start Ollama
ollama serve

# Terminal 2: Start LiveKit (in dev mode)
livekit-server --dev

# Terminal 3: Start TEN Agent
npm start
```

3. **Access playground:**
- Open http://localhost:3000/playground.html
- Test voice and text interactions

## 🏗️ Architecture

### Core Components
- **LiveKit RTC**: WebRTC for real-time audio/video
- **Whisper STT**: Speech-to-text transcription
- **Ollama LLM**: Local language model inference
- **Piper TTS**: High-quality text-to-speech

### Extension System
Each extension is self-contained with:
- `manifest.json`: Extension metadata
- `extension.py`: Core functionality
- Modular design for easy addition/removal

## 📁 Project Structure

```
ten-agent/
├── api/                    # REST API server
│   └── server.js          # Express.js API endpoints
├── extensions/            # AI extensions
│   ├── livekit_rtc/       # WebRTC communication
│   ├── whisper_stt/       # Speech-to-text
│   ├── ollama_llm/        # Language model
│   └── piper_tts/         # Text-to-speech
├── public/               # Web interface
│   ├── playground.html   # Interactive testing UI
│   └── index.html        # Landing page
├── scripts/              # Setup and utilities
│   ├── setup.sh          # Automated setup
│   └── test.js           # System tests
├── uploads/              # Temporary files
└── logs/                 # Application logs
```

## 🔧 Configuration

### Environment Variables
Create `.env` from `.env.template`:
```bash
cp .env.template .env
```

Key settings:
- `OLLAMA_MODEL`: Default LLM model (default: llama2)
- `LIVEKIT_URL`: LiveKit server URL
- `WHISPER_MODEL`: Whisper model size (tiny/base/small/medium/large)
- `PIPER_VOICE`: Piper voice model

### Extension Configuration
Each extension can be configured via:
1. Environment variables
2. Extension-specific config files
3. API parameters

## 🧪 Testing

### System Tests
```bash
# Run comprehensive tests
npm test

# Check individual components
node scripts/test.js
```

### Manual Testing
1. **Web Interface**: Use playground.html
2. **API Testing**: Use curl or Postman
3. **Extension Testing**: Run individual extension tests

## 🎮 Usage Examples

### Voice Interaction
```javascript
// Start recording
POST /api/transcribe
// Audio file → Text

// Get response
POST /api/chat
// Text → LLM response + Audio
```

### Text Interaction
```javascript
// Direct chat
POST /api/chat
{ "message": "Hello, how are you?" }
```

### WebRTC Session
```javascript
// Join room
POST /api/livekit/join
{ "room": "test-room", "identity": "user-123" }
```

## 🔍 Troubleshooting

### Common Issues

**Ollama not responding:**
```bash
# Check if running
curl http://localhost:11434/api/tags

# Start manually
ollama serve
```

**Whisper import error:**
```bash
# Reinstall whisper
pip3 install openai-whisper --force-reinstall
```

**LiveKit connection failed:**
```bash
# Check if running
curl http://localhost:7880

# Start in dev mode
livekit-server --dev
```

### Debug Mode
Enable detailed logging:
```bash
DEBUG=1 npm start
```

## 📊 Performance

### Resource Requirements
- **Minimum**: 4GB RAM, 2 CPU cores
- **Recommended**: 8GB RAM, 4 CPU cores
- **GPU**: Optional (CUDA support for Whisper/Ollama)

### Optimization Tips
1. Use smaller Whisper models for faster transcription
2. Adjust Ollama model size based on hardware
3. Enable GPU acceleration where available

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new extensions
4. Submit pull request

### Extension Development
Create new extensions:
1. Add folder in `extensions/`
2. Create `manifest.json` and `extension.py`
3. Update API endpoints in `api/server.js`
4. Add tests in `scripts/test.js`

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Documentation**: Wiki pages

## 🔄 Updates

Stay updated:
```bash
git pull origin main
npm update
npm run setup  # Re-run for new dependencies