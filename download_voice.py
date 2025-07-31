#!/usr/bin/env python3
"""
Download a Piper TTS voice model
"""

from piper import download_voices
import os

def main():
    # Create voices directory
    voices_dir = "voices"
    os.makedirs(voices_dir, exist_ok=True)
    
    # Download a simple English voice
    # Let's try a basic English voice
    try:
        print("Downloading English voice...")
        
        # Try to download amy voice
        download_voices.download_voice("en_US-amy-medium", voices_dir)
        print("Downloaded en_US-amy-medium successfully!")
        
    except Exception as e:
        print(f"Failed to download amy: {e}")
        try:
            # Try a different voice
            print("Trying different voice...")
            download_voices.download_voice("en_US-lessac-medium", voices_dir)
            print("Downloaded en_US-lessac-medium successfully!")
        except Exception as e2:
            print(f"Failed to download lessac: {e2}")
            
            # List available voices
            try:
                voices = download_voices.get_voices()
                print("Available voices:")
                for voice in voices:
                    if "en_US" in voice:
                        print(f"  {voice}")
            except Exception as e3:
                print(f"Failed to list voices: {e3}")

if __name__ == "__main__":
    main()