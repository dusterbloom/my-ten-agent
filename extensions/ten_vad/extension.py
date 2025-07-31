"""
TEN VAD Extension for TEN Framework
Provides real-time voice activity detection using TEN VAD
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
import numpy as np
import threading
import time
import logging
from typing import Optional
import sys
import os

# Add the path to include directory for TEN VAD
sys.path.append(os.path.join(os.path.dirname(__file__), '../../include'))

# Try to import TEN VAD - fallback to simple threshold-based VAD if not available
try:
    import ten_vad
    TEN_VAD_AVAILABLE = True
except ImportError:
    TEN_VAD_AVAILABLE = False
    import struct

logger = logging.getLogger(__name__)


class SimpleVAD:
    """Simple threshold-based VAD fallback"""
    
    def __init__(self, threshold=0.5, sample_rate=16000, frame_size=160):
        self.threshold = threshold
        self.sample_rate = sample_rate
        self.frame_size = frame_size
        
    def process(self, audio_data):
        """Process audio and return VAD result"""
        # Convert to float if needed
        if audio_data.dtype == np.int16:
            audio_data = audio_data.astype(np.float32) / 32768.0
            
        # Calculate RMS energy
        rms = np.sqrt(np.mean(audio_data ** 2))
        
        # Simple threshold-based detection
        is_speech = rms > self.threshold
        confidence = min(rms / self.threshold, 1.0) if is_speech else 0.0
        
        return is_speech, confidence


class TenVADExtension(Extension):
    """TEN VAD Extension for real-time voice activity detection"""
    
    def __init__(self, name: str) -> None:
        super().__init__(name)
        self.vad_engine = None
        self.threshold = 0.5
        self.sample_rate = 16000
        self.frame_size = 160  # 10ms at 16kHz
        self.min_silence_duration = 0.3  # seconds
        self.min_speech_duration = 0.1   # seconds
        
        # State tracking
        self.current_state = False  # False = silence, True = speech
        self.state_start_time = time.time()
        self.last_detection_time = time.time()
        
        # Threading
        self.lock = threading.Lock()
        self.running = False
        
    def on_configure(self, ten_env: TenEnv) -> None:
        """Configure extension"""
        logger.info("TEN VAD: on_configure")
        
        try:
            # Get configuration from property.json
            self.threshold = ten_env.get_property_float("threshold") or 0.5
            self.sample_rate = ten_env.get_property_int("sample_rate") or 16000
            self.frame_size = ten_env.get_property_int("frame_size") or 160
            self.min_silence_duration = ten_env.get_property_float("min_silence_duration") or 0.3
            self.min_speech_duration = ten_env.get_property_float("min_speech_duration") or 0.1
            
            logger.info(f"Configured VAD - threshold: {self.threshold}, sample_rate: {self.sample_rate}")
            logger.info(f"Frame size: {self.frame_size}, min_silence: {self.min_silence_duration}s")
            
            ten_env.on_configure_done()
            
        except Exception as e:
            logger.error(f"Failed to configure VAD: {e}")
            ten_env.on_configure_done()
            
    def on_start(self, ten_env: TenEnv) -> None:
        """Start extension and initialize VAD"""
        logger.info("TEN VAD: on_start")
        
        try:
            # Initialize VAD engine
            if TEN_VAD_AVAILABLE:
                logger.info("Using TEN VAD engine")
                self.vad_engine = ten_vad.TenVAD(
                    sample_rate=self.sample_rate,
                    frame_size=self.frame_size
                )
            else:
                logger.info("TEN VAD not available, using simple threshold-based VAD")
                self.vad_engine = SimpleVAD(
                    threshold=self.threshold,
                    sample_rate=self.sample_rate,
                    frame_size=self.frame_size
                )
            
            self.running = True
            logger.info("VAD engine initialized successfully")
            
            ten_env.on_start_done()
            
        except Exception as e:
            logger.error(f"Failed to start VAD: {e}")
            ten_env.on_start_done()
            
    def on_stop(self, ten_env: TenEnv) -> None:
        """Stop extension"""
        logger.info("TEN VAD: on_stop")
        
        try:
            self.running = False
            ten_env.on_stop_done()
            
        except Exception as e:
            logger.error(f"Error during VAD stop: {e}")
            ten_env.on_stop_done()
            
    def on_data(self, ten_env: TenEnv, data: Data) -> None:
        """Handle incoming audio data for VAD processing"""
        try:
            if not self.running:
                return
                
            if data.get_name() == "audio_frame":
                # Get audio frame
                audio_frame = AudioFrame.from_data(data)
                
                # Convert to numpy array
                audio_data = np.frombuffer(audio_frame.get_data(), dtype=np.int16)
                
                # Process with VAD
                self._process_vad(ten_env, audio_data)
                    
        except Exception as e:
            logger.error(f"Error handling audio data in VAD: {e}")
            
    def _process_vad(self, ten_env: TenEnv, audio_data: np.ndarray) -> None:
        """Process audio with VAD and send results"""
        try:
            with self.lock:
                current_time = time.time()
                
                # Run VAD detection
                if TEN_VAD_AVAILABLE:
                    # Use TEN VAD engine
                    is_speech, confidence = self.vad_engine.process(audio_data)
                else:
                    # Use simple VAD fallback
                    is_speech, confidence = self.vad_engine.process(audio_data)
                
                # Apply temporal smoothing to avoid rapid state changes
                state_changed = False
                
                if is_speech != self.current_state:
                    state_duration = current_time - self.state_start_time
                    
                    # Check minimum duration requirements
                    if self.current_state and state_duration >= self.min_speech_duration:
                        # Was speech, now silence - require minimum speech duration
                        self.current_state = False
                        self.state_start_time = current_time
                        state_changed = True
                    elif not self.current_state and state_duration >= self.min_silence_duration:
                        # Was silence, now speech - require minimum silence duration
                        self.current_state = True
                        self.state_start_time = current_time
                        state_changed = True
                else:
                    # State hasn't changed, update start time
                    if is_speech == self.current_state:
                        self.state_start_time = current_time
                
                # Always send VAD results for real-time processing
                self._send_vad_result(ten_env, self.current_state, confidence, int(current_time * 1000))
                
                # Log state changes
                if state_changed:
                    logger.info(f"VAD state change: {'SPEECH' if self.current_state else 'SILENCE'} (confidence: {confidence:.3f})")
                    
        except Exception as e:
            logger.error(f"Error processing VAD: {e}")
            
    def _send_vad_result(self, ten_env: TenEnv, is_speech: bool, confidence: float, timestamp: int) -> None:
        """Send VAD result to next extension"""
        try:
            # Create output data
            output_data = Data.create("vad_result")
            output_data.set_property_bool("is_speech", is_speech)
            output_data.set_property_float("confidence", confidence)
            output_data.set_property_int("timestamp", timestamp)
            
            # Send to next extension
            ten_env.send_data(output_data)
            
        except Exception as e:
            logger.error(f"Error sending VAD result: {e}")
            
    def on_cmd(self, ten_env: TenEnv, cmd: Cmd) -> None:
        """Handle commands"""
        cmd_name = cmd.get_name()
        
        if cmd_name == "reset":
            # Reset VAD state
            with self.lock:
                self.current_state = False
                self.state_start_time = time.time()
                
            result = CmdResult.create(StatusCode.OK)
            result.set_property_string("message", "VAD state reset")
            ten_env.return_result(result, cmd)
            
        elif cmd_name == "set_threshold":
            # Update threshold
            try:
                new_threshold = cmd.get_property_float("threshold")
                self.threshold = new_threshold
                
                if hasattr(self.vad_engine, 'threshold'):
                    self.vad_engine.threshold = new_threshold
                    
                result = CmdResult.create(StatusCode.OK)
                result.set_property_string("message", f"Threshold updated to {new_threshold}")
                ten_env.return_result(result, cmd)
                
            except Exception as e:
                result = CmdResult.create(StatusCode.ERROR)
                result.set_property_string("message", f"Failed to update threshold: {e}")
                ten_env.return_result(result, cmd)
            
        else:
            result = CmdResult.create(StatusCode.ERROR)
            result.set_property_string("message", f"Unknown command: {cmd_name}")
            ten_env.return_result(result, cmd)


def register_extension():
    """Register extension with TEN framework"""
    return TenVADExtension("ten_vad")