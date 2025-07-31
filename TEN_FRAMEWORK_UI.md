# TEN Framework UI Implementation

## Overview

This implementation recreates the TEN Framework playground experience using your existing local services (STT, LLM, TTS, LiveKit). The UI matches the original design and functionality while connecting to your local infrastructure.

## Key Features

### 1. **Agent View (Left Panel)**
- **Video Interface**: Shows AI agent avatar and local user video (PiP)
- **WebRTC Controls**: Connect/disconnect buttons with status indicators
- **Audio/Video Controls**: Mic and camera toggle buttons
- **Real-time Status**: Connection status and visual feedback

### 2. **Enhanced Chat Panel (Right Panel)**
- **Message History**: Persistent chat with user, agent, and system messages
- **Real-time Typing**: Shows typing indicators during responses
- **Message Types**: User (blue), Agent (gray), System (yellow) messages
- **Auto-scroll**: Automatically scrolls to new messages

### 3. **Responsive Header**
- **Configuration Panel**: Language, voice, and agent type selection
- **Mobile Tabs**: Switch between Agent and Chat views on mobile
- **Status Bar**: Shows current configuration and connection status
- **GitHub Integration**: Link to TEN Framework repository

### 4. **Redux State Management**
- **Global State**: Manages connection status, chat history, and configuration
- **Mobile Responsive**: Handles mobile/desktop layout switching
- **Persistent Config**: Remembers user preferences

## API Compatibility

### TEN Framework Compatible Endpoints
- `POST /api/agents/start` - Start agent with graph configuration
- `POST /api/agents/stop` - Stop running agent
- `POST /api/livekit/join` - Join LiveKit room with agent
- `POST /api/chat` - Send chat messages to LLM
- `POST /api/transcribe` - Audio transcription via Whisper

### Local Service Integration
- **Whisper STT**: Local speech-to-text transcription
- **Ollama LLM**: Local language model processing
- **Piper TTS**: Local text-to-speech synthesis
- **LiveKit RTC**: Local WebRTC server for real-time communication

## Mobile Experience

### Responsive Design
- **Mobile Tabs**: Toggle between Agent video and Chat interface
- **Touch Optimized**: Large buttons and touch-friendly controls
- **Adaptive Layout**: Automatically adjusts for screen size
- **Portrait/Landscape**: Works in both orientations

## Dark Theme

### TEN Framework Styling
- **Dark Background**: `#0f0f11` primary background
- **Card Backgrounds**: `#181a1d` for panels and cards
- **Typography**: White text with gray variations
- **Custom Scrollbars**: Styled to match the theme

## Usage

### Starting the Application
```bash
# Start backend services first
ollama serve                 # Terminal 1
livekit-server --dev        # Terminal 2

# Start the TEN Agent server  
npm start                   # Terminal 3

# Access the new UI
http://localhost:3000/new
```

### Configuration Options
1. **Language**: English, Chinese, Korean, Japanese
2. **Voice**: Male/Female voice options
3. **Agent Type**: 
   - Voice Agent (Local LLM + Local TTS)
   - Voice Agent with Vision (includes camera)

### Connection Flow
1. Configure language, voice, and agent type
2. Click "Connect" to start agent session
3. Use microphone for voice input or type in chat
4. Agent responds with both text and audio
5. Click "Disconnect" to end session

## Architecture

### Component Structure
```
src/
├── components/
│   ├── Agent/
│   │   └── AgentView.tsx          # Main agent video interface
│   ├── Chat/
│   │   └── EnhancedChatPanel.tsx  # TEN Framework-style chat
│   ├── Layout/
│   │   └── Header.tsx             # Configuration and navigation
│   └── ui/                        # Reusable UI components
├── store/
│   ├── slices/
│   │   └── globalSlice.ts         # Redux state management
│   └── StoreProvider.tsx          # Redux provider
└── hooks/
    └── useBreakpoint.ts           # Responsive design hooks
```

### State Management
- **Redux Toolkit**: For global state management
- **Chat History**: Persistent message storage
- **Connection Status**: Real-time status tracking
- **Mobile Layout**: Responsive tab switching

## Customization

### Adding New Languages
Edit `src/components/Layout/Header.tsx`:
```typescript
const LANGUAGE_OPTIONS = [
  { label: "English", value: "en-US" },
  { label: "Chinese", value: "zh-CN" },
  // Add new languages here
]
```

### Custom Agent Types
Edit the graph options in `Header.tsx`:
```typescript
const GRAPH_OPTIONS = [
  { label: "Voice Agent - Local LLM + Local TTS", value: "va_local" },
  // Add new agent configurations
]
```

### Styling Changes
- **Theme Colors**: Edit CSS variables in `src/index.css`
- **Component Styles**: Use Tailwind classes in components
- **Dark Mode**: Modify dark theme variables

## Future Enhancements

1. **Real LiveKit Integration**: Connect to actual LiveKit server
2. **Audio Visualization**: Add real-time audio waveforms
3. **Screen Sharing**: Support for screen capture in vision mode
4. **Multi-language TTS**: Support for different language voices
5. **Voice Activity Detection**: Automatic speech detection
6. **Chat Export**: Save conversation history
7. **Agent Personality**: Configurable agent personas
8. **Performance Metrics**: Real-time latency and quality metrics

This implementation provides the exact TEN Framework playground experience while leveraging your existing local services infrastructure.