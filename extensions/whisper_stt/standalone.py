#!/usr/bin/env python3
"""
Standalone Whisper STT script for TEN Agent
Usage: python standalone.py <audio_file>
"""

import sys
import os
import whisper
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def transcribe_audio(audio_file_path):
    """Transcribe audio file using Whisper"""
    try:
        # Check if file exists
        if not os.path.exists(audio_file_path):
            logger.error(f"Audio file not found: {audio_file_path}")
            return None
            
        # Load Whisper model (using base model for speed)
        logger.info("Loading Whisper model...")
        model = whisper.load_model("base")
        
        # Transcribe audio
        logger.info(f"Transcribing audio file: {audio_file_path}")
        result = model.transcribe(
            audio_file_path,
            language="en",
            fp16=False,
            verbose=False
        )
        
        # Get transcribed text
        text = result["text"].strip()
        
        if text:
            print(text)  # Output to stdout for the server to capture
            return text
        else:
            logger.warning("No text transcribed from audio")
            return None
            
    except Exception as e:
        logger.error(f"Error transcribing audio: {e}")
        return None

def main():
    """Main function"""
    if len(sys.argv) != 2:
        print("Usage: python standalone.py <audio_file>", file=sys.stderr)
        sys.exit(1)
        
    audio_file = sys.argv[1]
    result = transcribe_audio(audio_file)
    
    if result is None:
        sys.exit(1)
    
    sys.exit(0)

if __name__ == "__main__":
    main()