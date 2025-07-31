"""
Whisper STT Extension for TEN Framework
"""

from ten import (
    Extension,
    TenEnv,
    Data,
    AudioFrame,
    Cmd,
    CmdResult,
    StatusCode,
)
import whisper
import numpy as np
import threading
import queue
import time
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class WhisperSTTExtension(Extension):
    """Whisper Speech-to-Text extension for TEN framework"""
    
    def __init__(self, name: str) -> None:
        super().__init__(name)
        self.model = None
        self.model_name = "base"
        self.language = "en"
        self.audio_buffer = []
        self.buffer_duration = 3.0  # seconds
        self.sample_rate = 16000
        self.processing_thread = None
        self.running = False
        self.lock = threading.Lock()
        
    def on_configure(self, ten_env: TenEnv) -> None:
        """Configure extension"""
        logger.info("Whisper STT: on_configure")
        
        try:
            # Get configuration from property.json
            self.model_name = ten_env.get_property_string("model") or "base"
            self.language = ten_env.get_property_string("language") or "en"
            
            logger.info(f"Configured with model: {self.model_name}, language: {self.language}")
            ten_env.on_configure_done()
            
        except Exception as e:
            logger.error(f"Failed to configure: {e}")
            ten_env.on_configure_done()
            
    def on_start(self, ten_env: TenEnv) -> None:
        """Start extension and load Whisper model"""
        logger.info("Whisper STT: on_start")
        
        try:
            # Load Whisper model
            logger.info(f"Loading Whisper model: {self.model_name}")
            self.model = whisper.load_model(self.model_name)
            logger.info("Whisper model loaded successfully")
            
            # Start processing thread
            self.running = True
            self.processing_thread = threading.Thread(target=self._processing_loop)
            self.processing_thread.start()
            
            ten_env.on_start_done()
            
        except Exception as e:
            logger.error(f"Failed to start: {e}")
            ten_env.on_start_done()
            
    def on_stop(self, ten_env: TenEnv) -> None:
        """Stop extension"""
        logger.info("Whisper STT: on_stop")
        
        try:
            self.running = False
            
            if self.processing_thread:
                self.processing_thread.join(timeout=5)
                
            ten_env.on_stop_done()
            
        except Exception as e:
            logger.error(f"Error during stop: {e}")
            ten_env.on_stop_done()
            
    def on_data(self, ten_env: TenEnv, data: Data) -> None:
        """Handle incoming audio data"""
        try:
            if data.get_name() == "audio_frame":
                # Get audio frame
                audio_frame = AudioFrame.from_data(data)
                
                # Convert to numpy array
                audio_data = np.frombuffer(audio_frame.get_data(), dtype=np.int16)
                audio_data = audio_data.astype(np.float32) / 32768.0  # Normalize
                
                # Add to buffer
                with self.lock:
                    self.audio_buffer.extend(audio_data)
                    
                # Check if we have enough audio
                buffer_length = len(self.audio_buffer) / self.sample_rate
                if buffer_length >= self.buffer_duration:
                    self._process_audio(ten_env)
                    
        except Exception as e:
            logger.error(f"Error handling audio data: {e}")
            
    def _process_audio(self, ten_env: TenEnv) -> None:
        """Process audio buffer with Whisper"""
        try:
            with self.lock:
                if len(self.audio_buffer) < self.sample_rate:  # At least 1 second
                    return
                    
                # Get audio data
                audio_data = np.array(self.audio_buffer, dtype=np.float32)
                self.audio_buffer.clear()
                
            # Transcribe with Whisper
            if self.model:
                result = self.model.transcribe(
                    audio_data,
                    language=self.language,
                    fp16=False
                )
                
                text = result["text"].strip()
                
                if text:
                    logger.info(f"Transcribed: {text}")
                    
                    # Create output data
                    output_data = Data.create("text")
                    output_data.set_property_string("text", text)
                    
                    # Send to next extension
                    ten_env.send_data(output_data)
                    
        except Exception as e:
            logger.error(f"Error processing audio: {e}")
            
    def _processing_loop(self) -> None:
        """Background processing loop"""
        while self.running:
            try:
                # Process any remaining audio periodically
                time.sleep(0.1)
                
            except Exception as e:
                logger.error(f"Error in processing loop: {e}")
                
    def on_cmd(self, ten_env: TenEnv, cmd: Cmd) -> None:
        """Handle commands"""
        cmd_name = cmd.get_name()
        
        if cmd_name == "flush":
            # Flush audio buffer
            with self.lock:
                self.audio_buffer.clear()
                
            result = CmdResult.create(StatusCode.OK)
            result.set_property_string("message", "Audio buffer flushed")
            ten_env.return_result(result, cmd)
            
        else:
            result = CmdResult.create(StatusCode.ERROR)
            result.set_property_string("message", f"Unknown command: {cmd_name}")
            ten_env.return_result(result, cmd)


def register_extension():
    """Register extension with TEN framework"""
    return WhisperSTTExtension("whisper_stt")