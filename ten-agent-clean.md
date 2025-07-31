# Clean TEN Agent Project

A minimal TEN agent implementation using TEN framework as a dependency, with LiveKit, local STT/TTS, and Ollama.

## Project Structure

```
my-ten-agent/
├── .env
├── package.json
├── requirements.txt
├── docker-compose.yml
├── property.json           # Agent configuration
├── app/
│   └── manifest.json      # App manifest
├── extensions/            # Our custom extensions
│   ├── livekit_rtc/
│   ├── whisper_stt/
│   ├── piper_tts/
│   └── ollama_llm/
├── scripts/
│   └── setup.sh
└── README.md
```

## Step 1: Initialize Project

```bash
mkdir my-ten-agent
cd my-ten-agent
npm init -y
```

## Step 2: Package.json with TEN as Dependency

```json
{
  "name": "my-ten-agent",
  "version": "1.0.0",
  "description": "Local TEN Agent with LiveKit, Whisper, and Ollama",
  "main": "index.js",
  "scripts": {
    "setup": "./scripts/setup.sh",
    "dev": "ten-agent-cli dev",
    "build": "ten-agent-cli build",
    "start": "ten-agent-cli start"
  },
  "dependencies": {
    "@ten-framework/agent-cli": "latest",
    "@ten-framework/core": "latest",
    "@ten-framework/node-bindings": "latest"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0"
  }
}
```

## Step 3: App Configuration

### `app/manifest.json`
```json
{
  "type": "app",
  "name": "local_voice_agent",
  "version": "1.0.0",
  "dependencies": [
    {
      "type": "extension",
      "name": "livekit_rtc",
      "version": "1.0.0"
    },
    {
      "type": "extension",
      "name": "whisper_stt",
      "version": "1.0.0"
    },
    {
      "type": "extension",
      "name": "ollama_llm",
      "version": "1.0.0"
    },
    {
      "type": "extension",
      "name": "piper_tts",
      "version": "1.0.0"
    }
  ]
}
```

### `property.json`
```json
{
  "type": "app",
  "name": "local_voice_agent",
  "version": "1.0.0",
  "ten": {
    "graph": {
      "nodes": [
        {
          "type": "extension",
          "extension_group": "default",
          "name": "livekit_rtc",
          "addon": "livekit_rtc"
        },
        {
          "type": "extension",
          "extension_group": "default",
          "name": "whisper_stt",
          "addon": "whisper_stt"
        },
        {
          "type": "extension",
          "extension_group": "default",
          "name": "ollama_llm",
          "addon": "ollama_llm"
        },
        {
          "type": "extension",
          "extension_group": "default",
          "name": "piper_tts",
          "addon": "piper_tts"
        }
      ],
      "connections": [
        {
          "extension": "livekit_rtc",
          "data": [
            {
              "name": "audio_frame",
              "dest": [
                {
                  "extension": "whisper_stt"
                }
              ]
            }
          ]
        },
        {
          "extension": "whisper_stt",
          "data": [
            {
              "name": "text",
              "dest": [
                {
                  "extension": "ollama_llm",
                  "name": "user_input"
                }
              ]
            }
          ]
        },
        {
          "extension": "ollama_llm",
          "data": [
            {
              "name": "text",
              "dest": [
                {
                  "extension": "piper_tts",
                  "name": "text_input"
                }
              ]
            }
          ]
        },
        {
          "extension": "piper_tts",
          "data": [
            {
              "name": "audio_frame",
              "dest": [
                {
                  "extension": "livekit_rtc"
                }
              ]
            }
          ]
        }
      ]
    },
    "property": {
      "livekit_rtc": {
        "livekit_url": "${LIVEKIT_URL:-http://localhost:7880}",
        "api_key": "${LIVEKIT_API_KEY:-devkey}",
        "api_secret": "${LIVEKIT_API_SECRET:-secret}",
        "room_name": "local-agent"
      },
      "whisper_stt": {
        "model": "base",
        "language": "en"
      },
      "ollama_llm": {
        "model": "${OLLAMA_MODEL:-llama3.2}",
        "base_url": "${OLLAMA_BASE_URL:-http://localhost:11434}",
        "ctx_size": 4096,
        "temperature": 0.7,
        "top_p": 0.9,
        "frequency_penalty": 0.0,
        "presence_penalty": 0.0
      },
      "piper_tts": {
        "voice": "en_US-amy-medium",
        "speed": 1.0
      }
    }
  }
}
```

## Step 4: Extension Implementations

### `extensions/livekit_rtc/manifest.json`
```json
{
  "type": "extension",
  "name": "livekit_rtc",
  "version": "1.0.0",
  "api": {
    "property": {
      "livekit_url": {
        "type": "string"
      },
      "api_key": {
        "type": "string"
      },
      "api_secret": {
        "type": "string"
      },
      "room_name": {
        "type": "string"
      }
    },
    "data_in": [
      {
        "name": "audio_frame",
        "property": {}
      }
    ],
    "data_out": [
      {
        "name": "audio_frame",
        "property": {}
      }
    ]
  }
}
```

### `extensions/livekit_rtc/extension.py`
```python
"""
LiveKit RTC Extension for TEN Framework
"""

from ten import (
    Extension,
    TenEnv,
    Cmd,
    Data,
    AudioFrame,
    VideoFrame,
    CmdResult,
    StatusCode,
)
from ten.exceptions import TenError
from dataclasses import dataclass
import asyncio
import threading
import json
from livekit import rtc, api
import numpy as np
import logging

logger = logging.getLogger(__name__)


class LiveKitRTCExtension(Extension):
    """LiveKit WebRTC extension for TEN framework"""
    
    def __init__(self, name: str) -> None:
        super().__init__(name)
        self.livekit_url = None
        self.api_key = None
        self.api_secret = None
        self.room_name = None
        self.room = None
        self.audio_source = None
        self.loop = None
        self.thread = None
        
    def on_configure(self, ten_env: TenEnv) -> None:
        """Configure extension"""
        logger.info("LiveKit RTC: on_configure")
        
        try:
            # Get configuration from property.json
            self.livekit_url = ten_env.get_property_string("livekit_url")
            self.api_key = ten_env.get_property_string("api_key")
            self.api_secret = ten_env.get_property_string("api_secret")
            self.room_name = ten_env.get_property_string("room_name")
            
            ten_env.on_configure_done()
        except Exception as e:
            logger.error(f"Failed to configure: {e}")
            ten_env.on_configure_done()
            
    def on_start(self, ten_env: TenEnv) -> None:
        """Start extension"""
        logger.info("LiveKit RTC: on_start")
        
        try:
            # Create event loop for async operations
            self.loop = asyncio.new_event_loop()
            self.thread = threading.Thread(target=self._run_event_loop)
            self.thread.start()
            
            # Schedule async start
            future = asyncio.run_coroutine_threadsafe(
                self._async_start(ten_env),
                self.loop
            )
            
            # Wait for completion
            future.result(timeout=10)
            
        except Exception as e:
            logger.error(f"Failed to start: {e}")
            ten_env.on_start_done()
            
    def _run_event_loop(self):
        """Run async event loop in thread"""
        asyncio.set_event_loop(self.loop)
        self.loop.run_forever()
        
    async def _async_start(self, ten_env: TenEnv):
        """Async start implementation"""
        try:
            # Generate access token
            token = self._generate_token()
            
            # Create room instance
            self.room = rtc.Room()
            
            # Set up event handlers
            self.room.on("track_subscribed", self._on_track_subscribed)
            self.room.on("track_published", self._on_track_published)
            self.room.on("participant_connected", self._on_participant_connected)
            self.room.on("participant_disconnected", self._on_participant_disconnected)
            
            # Connect to room
            logger.info(f"Connecting to LiveKit room: {self.room_name}")
            await self.room.connect(self.livekit_url, token)
            
            # Create audio source
            self.audio_source = rtc.AudioSource(16000, 1)  # 16kHz mono
            
            # Create and publish audio track
            audio_track = rtc.LocalAudioTrack.create_audio_track(
                "agent-audio",
                self.audio_source
            )
            
            options = rtc.TrackPublishOptions()
            await self.room.local_participant.publish_track(audio_track, options)
            
            logger.info("Successfully connected and published audio track")
            ten_env.on_start_done()
            
        except Exception as e:
            logger.error(f"Failed in async start: {e}")
            ten_env.on_start_done()
            
    def on_stop(self, ten_env: TenEnv) -> None:
        """Stop extension"""
        logger.info("LiveKit RTC: on_stop")
        
        try:
            if self.loop:
                # Schedule async stop
                future = asyncio.run_coroutine_threadsafe(
                    self._async_stop(),
                    self.loop
                )
                future.result(timeout=5)
                
                # Stop event loop
                self.loop.call_soon_threadsafe(self.loop.stop)
                self.thread.join(timeout=5)
                
            ten_env.on_stop_done()
            
        except Exception as e:
            logger.error(f"Error during stop: {e}")
            ten_env.on_stop_done()
            
    async def _async_stop(self):
        """Async stop implementation"""
        if self.room:
            await self.room.disconnect()
            self.room = None
            
    def on_data(self, ten_env: TenEnv, data: Data) -> None:
        """Handle incoming data"""
        try:
            # Handle audio frames to send
            if data.get_name() == "audio_frame":
                if self.audio_source and self.loop:
                    # Get audio data
                    audio_frame = AudioFrame.from_data(data)
                    
                    # Schedule async send
                    asyncio.run_coroutine_threadsafe(
                        self._send_audio(audio_frame),
                        self.loop
                    )
                    
        except Exception as e:
            logger.error(f"Error handling data: {e}")
            
    async def _send_audio(self, audio_frame: AudioFrame):
        """Send audio to LiveKit"""
        try:
            # Get audio data
            data = audio_frame.get_data()
            sample_rate = audio_frame.get_sample_rate()
            num_channels = audio_frame.get_number_of_channels()
            
            # Create LiveKit audio frame
            frame = rtc.AudioFrame.create(
                sample_rate,
                num_channels,
                len(data) // 2  # int16 samples
            )
            frame.data = data
            
            # Send to LiveKit
            await self.audio_source.capture_frame(frame)
            
        except Exception as e:
            logger.error(f"Error sending audio: {e}")
            
    def _generate_token(self) -> str:
        """Generate LiveKit access token"""
        token = api.AccessToken(self.api_key, self.api_secret)
        token.with_identity("ten-agent")
        token.with_name("TEN Agent")
        token.with_grants(api.VideoGrants(
            room_join=True,
            room=self.room_name
        ))
        return token.to_jwt()
        
    async def _on_track_subscribed(self, track: rtc.Track, publication: rtc.TrackPublication, 
                                   participant: rtc.RemoteParticipant):
        """Handle subscribed tracks"""
        logger.info(f"Track subscribed: {track.sid} from {participant.identity}")
        
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            # Create audio stream
            audio_stream = rtc.AudioStream(track)
            
            # Process audio stream
            asyncio.create_task(self._process_audio_stream(audio_stream, participant))
            
    async def _process_audio_stream(self, stream: rtc.AudioStream, 
                                   participant: rtc.RemoteParticipant):
        """Process incoming audio stream"""
        try:
            async for event in stream:
                if isinstance(event, rtc.AudioFrameEvent):
                    # Create TEN audio frame
                    audio_frame = AudioFrame.create(self.name)
                    audio_frame.set_data(event.frame.data)
                    audio_frame.set_sample_rate(event.frame.sample_rate)
                    audio_frame.set_number_of_channels(event.frame.num_channels)
                    
                    # Send to next extension
                    self.send_data(audio_frame.to_data())
                    
        except Exception as e:
            logger.error(f"Error processing audio stream: {e}")
            
    async def _on_track_published(self, publication: rtc.LocalTrackPublication,
                                 participant: rtc.LocalParticipant):
        """Handle published tracks"""
        logger.info(f"Track published: {publication.sid}")
        
    async def _on_participant_connected(self, participant: rtc.RemoteParticipant):
        """Handle participant connected"""
        logger.info(f"Participant connected: {participant.identity}")
        
    async def _on_participant_disconnected(self, participant: rtc.RemoteParticipant):
        """Handle participant disconnected"""
        logger.info(f"Participant disconnected: {participant.identity}")


def register_extension():
    """Register extension with TEN framework"""
    return LiveKitRTCExtension("livekit_rtc")
```

### `extensions/whisper_stt/extension.py`
```python
"""
Whisper STT Extension for TEN Framework
"""

from ten import Extension, TenEnv, Data, AudioFrame
import whisper
import numpy as np
import threading
import queue
import time
import logging

logger = logging.getLogger(__name__)


class WhisperSTTExtension(Extension):
    """Whisper Speech-to-Text extension"""
    
    def __init__(self, name: str) -> None:
        super().__init__(name)
        self.model = None
        self.model_name = "base"
        self.language = "en"
        self.audio_queue = queue.Queue()
        self.processing_thread = None
        self.running = False
        
    def on_configure(self, ten_env: TenEnv) -> None:
        """Configure extension"""
        try:
            self.model_name = ten_env.get_property_string("model") or "base"
            self.language = ten_env.get_property_string("language") or "en"
            ten_env.on_configure_done()
        except Exception as e:
            logger.error(f"Configuration error: {e}")
            ten_env.on_configure_done()
            
    def on_start(self, ten_env: TenEnv) -> None:
        """Start extension"""
        logger.info(f"Loading Whisper model: {self.model_name}")
        
        try:
            # Load Whisper model
            self.model = whisper.load_model(self.model_name)
            
            # Start processing thread
            self.running = True
            self.processing_thread = threading.Thread(
                target=self._process_audio_loop,
                args=(ten_env,)
            )
            self.processing_thread.start()
            
            logger.info("Whisper STT started successfully")
            ten_env.on_start_done()
            
        except Exception as e:
            logger.error(f"Failed to start: {e}")
            ten_env.on_start_done()
            
    def on_stop(self, ten_env: TenEnv) -> None:
        """Stop extension"""
        logger.info("Stopping Whisper STT")
        
        self.running = False
        if self.processing_thread:
            self.processing_thread.join(timeout=5)
            
        ten_env.on_stop_done()
        
    def on_data(self, ten_env: TenEnv, data: Data) -> None:
        """Handle incoming audio data"""
        try:
            if data.get_name() == "audio_frame":
                # Extract audio frame
                audio_frame = AudioFrame.from_data(data)
                
                # Add to processing queue
                self.audio_queue.put({
                    'data': audio_frame.get_data(),
                    'sample_rate': audio_frame.get_sample_rate(),
                    'timestamp': time.time()
                })
                
        except Exception as e:
            logger.error(f"Error handling audio data: {e}")
            
    def _process_audio_loop(self, ten_env: TenEnv):
        """Process audio in separate thread"""
        audio_buffer = []
        last_process_time = time.time()
        BUFFER_DURATION = 3.0  # Process every 3 seconds
        
        while self.running:
            try:
                # Get audio from queue (with timeout)
                audio_item = self.audio_queue.get(timeout=0.1)
                
                # Convert to numpy array
                audio_data = np.frombuffer(audio_item['data'], dtype=np.int16)
                audio_buffer.extend(audio_data)
                
                # Check if we should process
                current_time = time.time()
                buffer_duration = len(audio_buffer) / 16000  # Assuming 16kHz
                
                if buffer_duration >= BUFFER_DURATION or \
                   (current_time - last_process_time >= BUFFER_DURATION and len(audio_buffer) > 0):
                    
                    # Convert to float32 for Whisper
                    audio_float = np.array(audio_buffer, dtype=np.float32) / 32768.0
                    
                    # Transcribe
                    result = self.model.transcribe(
                        audio_float,
                        language=self.language,
                        fp16=False,
                        temperature=0.0
                    )
                    
                    text = result["text"].strip()
                    if text:
                        logger.info(f"Transcribed: {text}")
                        
                        # Create text data
                        text_data = Data.create("text")
                        text_data.set_property("text", text)
                        text_data.set_property("is_final", True)
                        text_data.set_property("language", result.get("language", self.language))
                        
                        # Send to next extension
                        ten_env.send_data(text_data)
                    
                    # Clear buffer
                    audio_buffer = []
                    last_process_time = current_time
                    
            except queue.Empty:
                continue
            except Exception as e:
                logger.error(f"Error in audio processing: {e}")
                

def register_extension():
    """Register extension with TEN framework"""
    return WhisperSTTExtension("whisper_stt")
```

### `extensions/ollama_llm/extension.py`
```python
"""
Ollama LLM Extension for TEN Framework
"""

from ten import Extension, TenEnv, Data
import aiohttp
import asyncio
import json
import logging

logger = logging.getLogger(__name__)


class OllamaLLMExtension(Extension):
    """Ollama Language Model extension"""
    
    def __init__(self, name: str) -> None:
        super().__init__(name)
        self.base_url = "http://localhost:11434"
        self.model = "llama3.2"
        self.conversation_history = []
        self.session = None
        
    def on_configure(self, ten_env: TenEnv) -> None:
        """Configure extension"""
        try:
            self.base_url = ten_env.get_property_string("base_url") or self.base_url
            self.model = ten_env.get_property_string("model") or self.model
            self.temperature = ten_env.get_property_float("temperature") or 0.7
            self.ctx_size = ten_env.get_property_int("ctx_size") or 4096
            
            ten_env.on_configure_done()
        except Exception as e:
            logger.error(f"Configuration error: {e}")
            ten_env.on_configure_done()
            
    def on_start(self, ten_env: TenEnv) -> None:
        """Start extension"""
        logger.info(f"Starting Ollama LLM with model: {self.model}")
        
        # Add system prompt
        self.conversation_history.append({
            "role": "system",
            "content": "You are a helpful voice assistant. Keep responses concise and conversational."
        })
        
        ten_env.on_start_done()
        
    def on_stop(self, ten_env: TenEnv) -> None:
        """Stop extension"""
        if self.session:
            asyncio.create_task(self.session.close())
        ten_env.on_stop_done()
        
    def on_data(self, ten_env: TenEnv, data: Data) -> None:
        """Handle incoming text data"""
        try:
            if data.get_name() == "text":
                # Get user input
                user_text = data.get_property_string("text")
                
                if user_text:
                    logger.info(f"User: {user_text}")
                    
                    # Process with Ollama
                    asyncio.create_task(
                        self._process_with_ollama(ten_env, user_text)
                    )
                    
        except Exception as e:
            logger.error(f"Error handling data: {e}")
            
    async def _process_with_ollama(self, ten_env: TenEnv, user_text: str):
        """Process text with Ollama"""
        try:
            # Add user message to history
            self.conversation_history.append({
                "role": "user",
                "content": user_text
            })
            
            # Create session if needed
            if not self.session:
                self.session = aiohttp.ClientSession()
            
            # Prepare request
            payload = {
                "model": self.model,
                "messages": self.conversation_history,
                "stream": False,
                "options": {
                    "temperature": self.temperature,
                    "num_ctx": self.ctx_size
                }
            }
            
            # Send request
            async with self.session.post(
                f"{self.base_url}/api/chat",
                json=payload
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    
                    # Extract response text
                    assistant_text = result["message"]["content"]
                    logger.info(f"Assistant: {assistant_text}")
                    
                    # Add to history
                    self.conversation_history.append({
                        "role": "assistant",
                        "content": assistant_text
                    })
                    
                    # Keep history size manageable
                    if len(self.conversation_history) > 20:
                        # Keep system prompt and last 18 messages
                        self.conversation_history = (
                            self.conversation_history[:1] + 
                            self.conversation_history[-18:]
                        )
                    
                    # Send to TTS
                    response_data = Data.create("text")
                    response_data.set_property("text", assistant_text)
                    ten_env.send_data(response_data)
                    
                else:
                    logger.error(f"Ollama API error: {response.status}")
                    
        except Exception as e:
            logger.error(f"Error processing with Ollama: {e}")
            

def register_extension():
    """Register extension with TEN framework"""
    return OllamaLLMExtension("ollama_llm")
```

### `extensions/piper_tts/extension.py`
```python
"""
Piper TTS Extension for TEN Framework
"""

from ten import Extension, TenEnv, Data, AudioFrame
import subprocess
import tempfile
import wave
import numpy as np
import os
import asyncio
import logging

logger = logging.getLogger(__name__)


class PiperTTSExtension(Extension):
    """Piper Text-to-Speech extension"""
    
    def __init__(self, name: str) -> None:
        super().__init__(name)
        self.voice = "en_US-amy-medium"
        self.speed = 1.0
        
    def on_configure(self, ten_env: TenEnv) -> None:
        """Configure extension"""
        try:
            self.voice = ten_env.get_property_string("voice") or self.voice
            self.speed = ten_env.get_property_float("speed") or self.speed
            ten_env.on_configure_done()
        except Exception as e:
            logger.error(f"Configuration error: {e}")
            ten_env.on_configure_done()
            
    def on_start(self, ten_env: TenEnv) -> None:
        """Start extension"""
        logger.info(f"Starting Piper TTS with voice: {self.voice}")
        
        # Check if piper is installed
        try:
            subprocess.run(["piper", "--version"], capture_output=True, check=True)
            logger.info("Piper TTS is available")
        except subprocess.CalledProcessError:
            logger.warning("Piper not found. Please install: brew install piper-tts")
            
        ten_env.on_start_done()
        
    def on_stop(self, ten_env: TenEnv) -> None:
        """Stop extension"""
        ten_env.on_stop_done()
        
    def on_data(self, ten_env: TenEnv, data: Data) -> None:
        """Handle incoming text data"""
        try:
            if data.get_name() == "text":
                text = data.get_property_string("text")
                
                if text:
                    logger.info(f"Synthesizing: {text[:50]}...")
                    
                    # Process with Piper
                    asyncio.create_task(
                        self._synthesize_speech(ten_env, text)
                    )
                    
        except Exception as e:
            logger.error(f"Error handling data: {e}")
            
    async def _synthesize_speech(self, ten_env: TenEnv, text: str):
        """Synthesize speech with Piper"""
        try:
            # Create temporary file
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
                tmp_path = tmp_file.name
            
            # Run Piper
            cmd = [
                "piper",
                "--model", self.voice,
                "--output_file", tmp_path,
                "--length_scale", str(1.0 / self.speed)
            ]
            
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            # Send text to Piper
            stdout, stderr = await proc.communicate(input=text.encode())
            
            if proc.returncode != 0:
                logger.error(f"Piper error: {stderr.decode()}")
                return
            
            # Read generated audio
            with wave.open(tmp_path, 'rb') as wav_file:
                # Get audio info
                channels = wav_file.getnchannels()
                sample_width = wav_file.getsampwidth()
                framerate = wav_file.getframerate()
                frames = wav_file.readframes(wav_file.getnframes())
                
                # Convert to numpy array
                audio_data = np.frombuffer(frames, dtype=np.int16)
                
                # Convert to mono if stereo
                if channels == 2:
                    audio_data = audio_data.reshape(-1, 2).mean(axis=1).astype(np.int16)
                
                # Resample to 16kHz if needed
                if framerate != 16000:
                    # Simple resampling (for better quality, use scipy.signal.resample)
                    resample_ratio = 16000 / framerate
                    new_length = int(len(audio_data) * resample_ratio)
                    x = np.linspace(0, len(audio_data) - 1, new_length)
                    audio_data = np.interp(x, np.arange(len(audio_data)), audio_data).astype(np.int16)
                
                # Send audio in chunks
                chunk_size = 1600  # 100ms at 16kHz
                for i in range(0, len(audio_data), chunk_size):
                    chunk = audio_data[i:i+chunk_size]
                    
                    # Create audio frame
                    audio_frame = AudioFrame.create(self.name)
                    audio_frame.set_data(chunk.tobytes())
                    audio_frame.set_sample_rate(16000)
                    audio_frame.set_number_of_channels(1)
                    
                    # Send to output
                    ten_env.send_data(audio_frame.to_data())
                    
                    # Small delay to prevent overwhelming
                    await asyncio.sleep(0.05)
            
            # Clean up
            os.unlink(tmp_path)
            logger.info("Speech synthesis completed")
            
        except Exception as e:
            logger.error(f"Error synthesizing speech: {e}")
            

def register_extension():
    """Register extension with TEN framework"""
    return PiperTTSExtension("piper_tts")
```

## Step 5: Setup Scripts

### `scripts/setup.sh`
```bash
#!/bin/bash

echo "🚀 Setting up TEN Local Agent..."

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✓${NC} $1 is installed"
    else
        echo -e "${RED}✗${NC} $1 is not installed"
        exit 1
    fi
}

echo "📋 Checking prerequisites..."
check_command node
check_command python3
check_command docker
check_command ollama

# Install Node dependencies
echo -e "\n📦 Installing Node dependencies..."
npm install

# Install Python dependencies
echo -e "\n🐍 Installing Python dependencies..."
pip3 install --user -r requirements.txt

# Install Piper TTS on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo -e "\n🔊 Installing Piper TTS..."
    if ! command -v piper &> /dev/null; then
        brew install piper-tts
    else
        echo -e "${GREEN}✓${NC} Piper TTS already installed"
    fi
fi

# Start LiveKit
echo -e "\n🐳 Starting LiveKit..."
docker-compose up -d

# Check if LiveKit is running
sleep 3
if docker ps | grep -q livekit; then
    echo -e "${GREEN}✓${NC} LiveKit is running"
else
    echo -e "${RED}✗${NC} LiveKit failed to start"
    exit 1
fi

# Pull Ollama model
echo -e "\n🤖 Checking Ollama model..."
if ! ollama list | grep -q "llama3.2"; then
    echo "Pulling llama3.2 model..."
    ollama pull llama3.2
else
    echo -e "${GREEN}✓${NC} llama3.2 model already available"
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo -e "\n📝 Creating .env file..."
    cat > .env << EOF
# LiveKit Configuration
LIVEKIT_URL=http://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret

# Ollama Configuration
OLLAMA_MODEL=llama3.2
OLLAMA_BASE_URL=http://localhost:11434

# Extension Settings
WHISPER_MODEL=base
PIPER_VOICE=en_US-amy-medium
EOF
fi

echo -e "\n${GREEN}✅ Setup complete!${NC}"
echo -e "\nTo run the agent:"
echo "1. Make sure Ollama is running: ollama serve"
echo "2. Run: npm run dev"
echo "3. Open http://localhost:3000 in your browser"
```

### `docker-compose.yml`
```yaml
version: '3.8'

services:
  livekit:
    image: livekit/livekit-server:latest
    ports:
      - "7880:7880"
      - "7881:7881"
      - "7882:7882/udp"
    environment:
      - LIVEKIT_KEYS=devkey:secret
      - LIVEKIT_LOG_LEVEL=info
      - LIVEKIT_RTC_UDP_PORT=7882
    command: --dev --bind 0.0.0.0
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --save "" --appendonly no
    restart: unless-stopped
```

### `requirements.txt`
```
# TEN Framework Python SDK
ten-framework-python>=0.1.0

# Extension dependencies
livekit
openai-whisper
numpy
scipy
aiohttp

# Development dependencies
python-dotenv
```

### `.gitignore`
```
# Dependencies
node_modules/
venv/
__pycache__/
*.pyc

# Environment
.env
.env.local

# Logs
*.log
logs/

# TEN build artifacts
.ten/
build/
dist/

# Models
models/
*.bin
*.onnx

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
```

## Step 6: Run the Agent

```bash
# Install and setup
npm run setup

# Start Ollama (in another terminal)
ollama serve

# Run the agent
npm run dev

# The agent will be available at http://localhost:3000
```

## Benefits of This Approach

1. **Clean Project Structure** - Only your code, no framework mess
2. **TEN as Dependency** - Use npm/pip to manage TEN framework
3. **Proper Extension Pattern** - Following TEN's extension architecture
4. **Easy to Maintain** - Update TEN framework with `npm update`
5. **Git-Friendly** - Small repo with only your custom code

## Project Structure Explained

- **extensions/** - Your custom extensions following TEN patterns
- **property.json** - Graph configuration defining connections
- **app/** - Application manifest
- **scripts/** - Setup and utility scripts
- **No framework code** - TEN framework is installed as dependency

This gives you a clean, maintainable project that uses TEN framework properly without dealing with their complex repository structure!