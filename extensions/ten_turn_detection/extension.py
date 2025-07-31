"""
TEN Turn Detection Extension for TEN Framework
Provides intelligent turn-taking detection for natural conversation flow
"""

from ten import (
    Extension,
    TenEnv,
    Data,
    Cmd,
    CmdResult,
    StatusCode,
)
import threading
import time
import logging
from typing import Optional, List, Dict
import queue
import re

# Try to import transformers for TEN Turn Detection model
try:
    from transformers import AutoTokenizer, AutoModelForCausalLM
    import torch
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False

logger = logging.getLogger(__name__)


class SimpleTurnDetector:
    """Simple rule-based turn detection fallback"""
    
    def __init__(self):
        # Common turn-ending patterns
        self.end_patterns = [
            r'\?$',  # Questions
            r'\.$',  # Statements ending with period
            r'!$',   # Exclamations
            r'thanks?\b',  # Thanks
            r'\bbye\b|\bgoodbye\b',  # Goodbyes
            r'\bok\b|\bokay\b|\balright\b',  # Confirmations
        ]
        
        # Wait/stop patterns
        self.wait_patterns = [
            r'\bstop\b|\bwait\b|\bhold\b',
            r'\bshut up\b|\bstop talking\b',
            r'\bquiet\b|\bsilence\b',
        ]
        
        # Unfinished patterns
        self.unfinished_patterns = [
            r'\band\s*$',  # Ending with "and"
            r'\bbut\s*$',  # Ending with "but"
            r'\bso\s*$',   # Ending with "so"
            r',\s*$',      # Ending with comma
            r'\bi\s*$',    # Just "I"
            r'\bthe\s*$',  # Just "the"
            r'\ba\s*$',    # Just "a"
        ]
        
    def detect(self, text: str) -> tuple:
        """Detect turn state: finished, unfinished, or wait"""
        text = text.strip().lower()
        
        if not text:
            return "unfinished", 0.1
            
        # Check for wait patterns first
        for pattern in self.wait_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return "wait", 0.9
        
        # Check for unfinished patterns
        for pattern in self.unfinished_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return "unfinished", 0.8
                
        # Check for finished patterns
        for pattern in self.end_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return "finished", 0.9
        
        # Default: if text is short and doesn't match patterns, likely unfinished
        if len(text.split()) < 3:
            return "unfinished", 0.6
            
        # Longer text without clear ending, moderate confidence it's finished
        return "finished", 0.7


class TenTurnDetectionExtension(Extension):
    """TEN Turn Detection Extension for intelligent conversation management"""
    
    def __init__(self, name: str) -> None:
        super().__init__(name)
        self.model = None
        self.tokenizer = None
        self.model_path = "TEN-framework/TEN_Turn_Detection"
        self.system_prompt = ""
        self.max_history_length = 5
        
        # Conversation state
        self.conversation_history: List[str] = []
        self.current_text = ""
        self.last_vad_state = False  # Track VAD state
        self.text_buffer = ""
        self.last_turn_time = time.time()
        
        # Processing queue
        self.processing_queue = queue.Queue()
        self.processing_thread = None
        self.running = False
        
        # Lock for thread safety
        self.lock = threading.Lock()
        
        # Fallback detector
        self.simple_detector = SimpleTurnDetector()
        
    def on_configure(self, ten_env: TenEnv) -> None:
        """Configure extension"""
        logger.info("Turn Detection: on_configure")
        
        try:
            # Get configuration
            self.model_path = ten_env.get_property_string("model_path") or "TEN-framework/TEN_Turn_Detection"
            self.system_prompt = ten_env.get_property_string("system_prompt") or ""
            self.max_history_length = ten_env.get_property_int("max_history_length") or 5
            
            logger.info(f"Configured turn detection - model: {self.model_path}")
            
            ten_env.on_configure_done()
            
        except Exception as e:
            logger.error(f"Failed to configure turn detection: {e}")
            ten_env.on_configure_done()
            
    def on_start(self, ten_env: TenEnv) -> None:
        """Start extension and load model"""
        logger.info("Turn Detection: on_start")
        
        try:
            # Try to load TEN Turn Detection model
            if TRANSFORMERS_AVAILABLE:
                try:
                    logger.info(f"Loading TEN Turn Detection model: {self.model_path}")
                    self.tokenizer = AutoTokenizer.from_pretrained(
                        self.model_path, 
                        trust_remote_code=True
                    )
                    self.model = AutoModelForCausalLM.from_pretrained(
                        self.model_path,
                        trust_remote_code=True,
                        torch_dtype=torch.bfloat16 if torch.cuda.is_available() else torch.float32
                    )
                    
                    if torch.cuda.is_available():
                        self.model = self.model.cuda()
                        
                    self.model.eval()
                    logger.info("TEN Turn Detection model loaded successfully")
                    
                except Exception as e:
                    logger.warning(f"Failed to load TEN model: {e}, using simple detector")
                    self.model = None
                    self.tokenizer = None
            else:
                logger.info("Transformers not available, using simple turn detector")
                
            # Start processing thread
            self.running = True
            self.processing_thread = threading.Thread(target=self._processing_loop)
            self.processing_thread.start()
            
            ten_env.on_start_done()
            
        except Exception as e:
            logger.error(f"Failed to start turn detection: {e}")
            ten_env.on_start_done()
            
    def on_stop(self, ten_env: TenEnv) -> None:
        """Stop extension"""
        logger.info("Turn Detection: on_stop")
        
        try:
            self.running = False
            
            if self.processing_thread:
                self.processing_thread.join(timeout=5)
                
            ten_env.on_stop_done()
            
        except Exception as e:
            logger.error(f"Error during turn detection stop: {e}")
            ten_env.on_stop_done()
            
    def on_data(self, ten_env: TenEnv, data: Data) -> None:
        """Handle incoming data"""
        try:
            data_name = data.get_name()
            
            if data_name == "text":
                # Handle transcribed text
                text = data.get_property_string("text")
                if text:
                    with self.lock:
                        self.text_buffer = text
                        self.current_text = text
                        
                    # Queue for processing
                    self.processing_queue.put(("text", text, ten_env))
                    
            elif data_name == "vad_result":
                # Handle VAD results
                is_speech = data.get_property_bool("is_speech")
                confidence = data.get_property_float("confidence")
                
                with self.lock:
                    prev_vad_state = self.last_vad_state
                    self.last_vad_state = is_speech
                    
                # Detect speech-to-silence transition
                if prev_vad_state and not is_speech and self.current_text:
                    # User stopped speaking, analyze the text
                    self.processing_queue.put(("vad_end", self.current_text, ten_env))
                    
        except Exception as e:
            logger.error(f"Error handling data in turn detection: {e}")
            
    def _processing_loop(self) -> None:
        """Background processing loop"""
        while self.running:
            try:
                # Process queue with timeout
                try:
                    event_type, text, ten_env = self.processing_queue.get(timeout=1.0)
                    
                    if event_type == "text":
                        # Process text immediately for real-time feedback
                        self._process_turn_detection(ten_env, text, immediate=True)
                    elif event_type == "vad_end":
                        # Process when user stops speaking
                        self._process_turn_detection(ten_env, text, immediate=False)
                        
                except queue.Empty:
                    continue
                    
            except Exception as e:
                logger.error(f"Error in turn detection processing loop: {e}")
                
    def _process_turn_detection(self, ten_env: TenEnv, text: str, immediate: bool = False) -> None:
        """Process text for turn detection"""
        try:
            if not text.strip():
                return
                
            # Use TEN Turn Detection model if available
            if self.model and self.tokenizer:
                state, confidence = self._detect_with_model(text)
            else:
                # Use simple fallback detector
                state, confidence = self.simple_detector.detect(text)
                
            # Determine if agent should respond
            should_respond = self._should_agent_respond(state, confidence, immediate)
            
            # Send turn detection result
            self._send_turn_result(ten_env, state, confidence, text, should_respond)
            
            # Update conversation history
            if not immediate and state == "finished":
                with self.lock:
                    self.conversation_history.append(text)
                    if len(self.conversation_history) > self.max_history_length:
                        self.conversation_history.pop(0)
                        
        except Exception as e:
            logger.error(f"Error in turn detection processing: {e}")
            
    def _detect_with_model(self, text: str) -> tuple:
        """Use TEN Turn Detection model for inference"""
        try:
            # Prepare messages for the model
            messages = [
                {"role": "system", "content": self.system_prompt}
            ] if self.system_prompt else []
            
            messages.append({"role": "user", "content": text})
            
            # Apply chat template
            input_ids = self.tokenizer.apply_chat_template(
                messages,
                add_generation_prompt=True,
                return_tensors="pt"
            )
            
            if torch.cuda.is_available():
                input_ids = input_ids.cuda()
                
            # Generate prediction
            with torch.no_grad():
                outputs = self.model.generate(
                    input_ids,
                    max_new_tokens=1,
                    do_sample=True,
                    top_p=0.1,
                    temperature=0.1,
                    pad_token_id=self.tokenizer.eos_token_id
                )
                
            # Decode response
            response = outputs[0][input_ids.shape[-1]:]
            output = self.tokenizer.decode(response, skip_special_tokens=True).strip()
            
            # Map output to state and confidence
            if output.lower() in ['f', 'finished']:
                return "finished", 0.9
            elif output.lower() in ['w', 'wait']:
                return "wait", 0.9
            elif output.lower() in ['u', 'unfinished']:
                return "unfinished", 0.9
            else:
                # Fallback to simple detector if model output is unclear
                return self.simple_detector.detect(text)
                
        except Exception as e:
            logger.error(f"Error using TEN Turn Detection model: {e}")
            # Fallback to simple detector
            return self.simple_detector.detect(text)
            
    def _should_agent_respond(self, state: str, confidence: float, immediate: bool) -> bool:
        """Determine if the agent should respond based on turn state"""
        current_time = time.time()
        
        # Always respond when user explicitly asks to wait
        if state == "wait":
            return False
            
        # For finished utterances with high confidence
        if state == "finished" and confidence > 0.7:
            return True
            
        # For unfinished utterances, don't respond immediately
        if state == "unfinished":
            return False
            
        # For immediate processing (real-time), be more conservative
        if immediate:
            return state == "finished" and confidence > 0.8
            
        # Default: respond for finished statements
        return state == "finished"
        
    def _send_turn_result(self, ten_env: TenEnv, state: str, confidence: float, text: str, should_respond: bool) -> None:
        """Send turn detection result"""
        try:
            # Create output data
            output_data = Data.create("turn_result")
            output_data.set_property_string("state", state)
            output_data.set_property_float("confidence", confidence)
            output_data.set_property_string("text", text)
            output_data.set_property_bool("should_respond", should_respond)
            
            # Send to next extension
            ten_env.send_data(output_data)
            
            logger.info(f"Turn detection: '{text}' -> {state} (conf: {confidence:.2f}, respond: {should_respond})")
            
        except Exception as e:
            logger.error(f"Error sending turn result: {e}")
            
    def on_cmd(self, ten_env: TenEnv, cmd: Cmd) -> None:
        """Handle commands"""
        cmd_name = cmd.get_name()
        
        if cmd_name == "reset_conversation":
            # Reset conversation history
            with self.lock:
                self.conversation_history.clear()
                self.current_text = ""
                self.text_buffer = ""
                
            result = CmdResult.create(StatusCode.OK)
            result.set_property_string("message", "Conversation history reset")
            ten_env.return_result(result, cmd)
            
        else:
            result = CmdResult.create(StatusCode.ERROR)
            result.set_property_string("message", f"Unknown command: {cmd_name}")
            ten_env.return_result(result, cmd)


def register_extension():
    """Register extension with TEN framework"""
    return TenTurnDetectionExtension("ten_turn_detection")