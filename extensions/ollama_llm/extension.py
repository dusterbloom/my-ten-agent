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
        self.model = "llama3.2:3b"
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