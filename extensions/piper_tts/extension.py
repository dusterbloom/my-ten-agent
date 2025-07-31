"""
Piper TTS Extension for TEN Framework
"""
import asyncio
import os
import subprocess
import tempfile
import wave
import numpy as np
from typing import Optional
from ten import (
    Extension,
    TenEnv,
    Data,
    AudioFrame,
    StatusCode,
    CmdResult,
)
import logging

logger = logging.getLogger(__name__)


class PiperTTSExtension(Extension):
    """Piper TTS extension for text-to-speech synthesis"""
    
    def __init__(self, name: str):
        super().__init__(name)
        self.voice = "en_US-amy-medium"
        self.speed = 1.0
        
    def on_configure(self, ten_env: TenEnv) -> None:
        """Configure extension with properties"""
        logger.info("Configuring Piper TTS extension")
        
        try:
            # Get configuration
            self.voice = ten_env.get_property_string("voice") or self.voice
            self.speed = ten_env.get_property_float("speed") or self.speed
            
            logger.info(f"Configured with voice: {self.voice}, speed: {self.speed}")
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
                # Get text to synthesize
                text = data.get_property_string("text")
                
                if text:
                    logger.info(f"Synthesizing text: {text}")
                    
                    # Process text asynchronously
                    asyncio.create_task(
                        self._synthesize_speech(ten_env, text)
                    )
                    
        except Exception as e:
            logger.error(f"Error handling data: {e}")
            
    async def _synthesize_speech(self, ten_env: TenEnv, text: str):
        """Synthesize text to speech using Piper"""
        try:
            # Create temporary file for audio output
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_file:
                tmp_path = tmp_file.name
                
            try:
                # Build Piper command
                cmd = [
                    "piper",
                    "--model", self.voice,
                    "--output_file", tmp_path
                ]
                
                # Add speed parameter if not default
                if self.speed != 1.0:
                    cmd.extend(["--length_scale", str(1.0 / self.speed)])
                
                # Run Piper
                process = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                
                stdout, stderr = await process.communicate(input=text.encode('utf-8'))
                
                if process.returncode != 0:
                    logger.error(f"Piper error: {stderr.decode()}")
                    return
                
                # Read and process the audio file
                with wave.open(tmp_path, 'rb') as wav_file:
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
                # Clean up on error
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
                raise e
                
        except Exception as e:
            logger.error(f"Error synthesizing speech: {e}")


def register_extension():
    """Register extension with TEN framework"""
    return PiperTTSExtension("piper_tts")