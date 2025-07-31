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