const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const WebSocket = require('ws');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

// Serve static files from both public and built frontend
app.use(express.static('public'));

// Serve the built Vite assets correctly
app.use('/assets', express.static(path.join(__dirname, '../public/dist/assets')));
app.use('/dist', express.static(path.join(__dirname, '../public/dist')));

// Route for the new React playground
app.get('/new', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/dist/index.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug endpoint to check service paths
app.get('/api/debug', (req, res) => {
    const debug = {
        python_venv: fs.existsSync('./venv/bin/python'),
        python_system: true, // We can assume python3 exists
        piper_venv: fs.existsSync('./venv/bin/piper'),
        whisper_extension: fs.existsSync('./extensions/whisper_stt/extension.py'),
        piper_extension: fs.existsSync('./extensions/piper_tts/extension.py'),
        uploads_dir: fs.existsSync('./uploads'),
        working_directory: process.cwd(),
        node_version: process.version
    };
    
    res.json(debug);
});

// Extensions endpoint for the old UI
app.get('/api/extensions', (req, res) => {
    const extensions = [
        {
            name: 'LiveKit RTC',
            manifest: {
                description: 'Real-time communication via WebRTC',
                type: 'rtc'
            }
        },
        {
            name: 'Whisper STT',
            manifest: {
                description: 'Speech-to-text transcription',
                type: 'stt'
            }
        },
        {
            name: 'TEN VAD',
            manifest: {
                description: 'Real-time voice activity detection',
                type: 'vad'
            }
        },
        {
            name: 'TEN Turn Detection',
            manifest: {
                description: 'Intelligent turn-taking detection',
                type: 'turn_detection'
            }
        },
        {
            name: 'Ollama LLM',
            manifest: {
                description: 'Large language model processing',
                type: 'llm'
            }
        },
        {
            name: 'Piper TTS',
            manifest: {
                description: 'Text-to-speech synthesis',
                type: 'tts'
            }
        }
    ];
    res.json(extensions);
});

// Test all extensions
app.post('/api/test', async (req, res) => {
    const results = {
        ollama: false,
        whisper: false,
        piper: false,
        livekit: false,
        vad: false,
        turn_detection: false
    };

    let testsCompleted = 0;
    const totalTests = 6;

    const checkComplete = () => {
        testsCompleted++;
        if (testsCompleted === totalTests) {
            res.json(results);
        }
    };

    try {
        // Test Ollama
        const ollama = spawn('curl', ['-s', 'http://localhost:11434/api/tags']);
        ollama.on('close', (code) => {
            results.ollama = code === 0;
            checkComplete();
        });
        ollama.on('error', () => {
            results.ollama = false;
            checkComplete();
        });

        // Test Whisper - Use venv python if available
        const pythonCmd = fs.existsSync('./venv/bin/python') ? './venv/bin/python' : 'python3';
        const whisper = spawn(pythonCmd, ['-c', 'import whisper; print("OK")']);
        whisper.on('close', (code) => {
            results.whisper = code === 0;
            checkComplete();
        });
        whisper.on('error', () => {
            results.whisper = false;
            checkComplete();
        });

        // Test Piper - Check venv first, then system
        let piperCmd = 'piper';
        if (fs.existsSync('./venv/bin/piper')) {
            piperCmd = './venv/bin/piper';
        }
        
        const piper = spawn(piperCmd, ['--help']);
        piper.on('close', (code) => {
            results.piper = code === 0;
            checkComplete();
        });
        piper.on('error', () => {
            results.piper = false;
            checkComplete();
        });

        // Test LiveKit
        const livekit = spawn('curl', ['-s', 'http://localhost:7880']);
        livekit.on('close', (code) => {
            results.livekit = code === 0;
            checkComplete();
        });
        livekit.on('error', () => {
            results.livekit = false;
            checkComplete();
        });

        // Test VAD extension
        const vadTest = spawn(pythonCmd, ['-c', 'import numpy; print("VAD OK")']);
        vadTest.on('close', (code) => {
            results.vad = code === 0 && fs.existsSync('./extensions/ten_vad/extension.py');
            checkComplete();
        });
        vadTest.on('error', () => {
            results.vad = false;
            checkComplete();
        });

        // Test Turn Detection extension 
        const turnTest = spawn(pythonCmd, ['-c', 'print("Turn Detection OK")']);
        turnTest.on('close', (code) => {
            results.turn_detection = code === 0 && fs.existsSync('./extensions/ten_turn_detection/extension.py');
            checkComplete();
        });
        turnTest.on('error', () => {
            results.turn_detection = false;
            checkComplete();
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Transcribe audio using Whisper
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided' });
    }

    try {
        const pythonCmd = fs.existsSync('./venv/bin/python') ? './venv/bin/python' : 'python3';
        const whisper = spawn(pythonCmd, [
            'extensions/whisper_stt/standalone.py',
            req.file.path
        ]);

        let transcript = '';
        whisper.stdout.on('data', (data) => {
            transcript += data.toString();
        });

        whisper.on('close', (code) => {
            // Clean up uploaded file
            fs.unlinkSync(req.file.path);
            
            if (code === 0) {
                res.json({ text: transcript.trim() });
            } else {
                res.status(500).json({ error: 'Transcription failed' });
            }
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Chat endpoint using Ollama
app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    
    if (!message) {
        return res.status(400).json({ error: 'No message provided' });
    }

    try {
        const ollama = spawn('curl', [
            '-s',
            '-H', 'Content-Type: application/json',
            'http://localhost:11434/api/generate',
            '-d',
            JSON.stringify({
                model: 'llama3.2:3b',
                prompt: message,
                stream: true
            })
        ]);

        let response = '';
        ollama.stdout.on('data', (data) => {
            response += data.toString();
        });

        ollama.on('close', (code) => {
            console.log('Ollama exit code:', code);
            console.log('Raw response length:', response.length);
            console.log('Raw response (first 200 chars):', response.substring(0, 200));
            
            if (code === 0) {
                try {
                    // Parse streaming response - each line is a JSON object
                    const lines = response.trim().split('\n');
                    let fullResponse = '';
                    
                    console.log('Number of lines:', lines.length);
                    
                    for (const line of lines) {
                        if (line.trim()) {
                            try {
                                const parsed = JSON.parse(line);
                                if (parsed.response) {
                                    fullResponse += parsed.response;
                                }
                            } catch (lineParseError) {
                                console.log('Failed to parse line:', line);
                            }
                        }
                    }
                    
                    console.log('Full response:', fullResponse);
                    
                    if (!fullResponse) {
                        return res.status(500).json({ error: 'No response from Ollama' });
                    }
                    
                    // Generate audio response using Piper
                    const audioFile = `uploads/response_${Date.now()}.wav`;
                    const piperCmd = fs.existsSync('./venv/bin/piper') ? './venv/bin/piper' : 'piper';
                    const voiceModel = './venv/voices/en_US-lessac-medium.onnx';
                    const piper = spawn(piperCmd, [
                        '--model', voiceModel,
                        '--output_file', audioFile
                    ]);
                    
                    piper.stdin.write(fullResponse);
                    piper.stdin.end();
                    
                    piper.on('close', (code) => {
                        if (code === 0) {
                            res.json({
                                response: fullResponse,
                                audio: audioFile
                            });
                        } else {
                            res.json({ response: fullResponse });
                        }
                    });
                } catch (parseError) {
                    console.error('Parse error:', parseError);
                    console.error('Raw response:', response);
                    res.status(500).json({ error: 'Failed to parse streaming response' });
                }
            } else {
                res.status(500).json({ error: 'Ollama request failed' });
            }
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// VAD endpoint - Test voice activity detection
app.post('/api/vad', upload.single('audio'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided' });
    }

    try {
        const pythonCmd = fs.existsSync('./venv/bin/python') ? './venv/bin/python' : 'python3';
        const vad = spawn(pythonCmd, [
            '-c',
            `
import numpy as np
import sys
import struct
import wave

def simple_vad(audio_file, threshold=0.01):
    try:
        with wave.open(audio_file, 'rb') as wf:
            frames = wf.readframes(wf.getnframes())
            audio_data = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
            
        # Calculate RMS energy
        rms = np.sqrt(np.mean(audio_data ** 2))
        
        # Simple threshold-based VAD
        is_speech = rms > threshold
        confidence = min(rms / threshold, 1.0) if is_speech else 0.0
        
        print(f"{{\\\"is_speech\\\": {str(is_speech).lower()}, \\\"confidence\\\": {confidence:.3f}, \\\"rms\\\": {rms:.3f}}}")
        
    except Exception as e:
        print(f"{{\\\"error\\\": \\\"{str(e)}\\\"}}")
        sys.exit(1)

simple_vad("${req.file.path}")
            `
        ]);

        let vadResult = '';
        vad.stdout.on('data', (data) => {
            vadResult += data.toString();
        });

        vad.on('close', (code) => {
            // Clean up uploaded file
            fs.unlinkSync(req.file.path);
            
            if (code === 0) {
                try {
                    const result = JSON.parse(vadResult.trim());
                    res.json(result);
                } catch (parseError) {
                    res.status(500).json({ error: 'Failed to parse VAD result' });
                }
            } else {
                res.status(500).json({ error: 'VAD processing failed' });
            }
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Turn detection endpoint - Analyze conversation state
app.post('/api/turn-detection', async (req, res) => {
    const { text } = req.body;
    
    if (!text) {
        return res.status(400).json({ error: 'No text provided' });
    }

    try {
        const pythonCmd = fs.existsSync('./venv/bin/python') ? './venv/bin/python' : 'python3';
        const turnDetection = spawn(pythonCmd, [
            '-c',
            `
import re
import sys
import json

def simple_turn_detection(text):
    text = text.strip().lower()
    
    if not text:
        return {"state": "unfinished", "confidence": 0.1}
    
    # Wait/stop patterns
    wait_patterns = [
        r'\\bstop\\b|\\bwait\\b|\\bhold\\b',
        r'\\bshut up\\b|\\bstop talking\\b',
        r'\\bquiet\\b|\\bsilence\\b',
    ]
    
    # Unfinished patterns  
    unfinished_patterns = [
        r'\\band\\s*$',  # Ending with "and"
        r'\\bbut\\s*$',  # Ending with "but"
        r'\\bso\\s*$',   # Ending with "so"
        r',\\s*$',       # Ending with comma
        r'\\bi\\s*$',    # Just "I"
        r'\\bthe\\s*$',  # Just "the"
        r'\\ba\\s*$',    # Just "a"
    ]
    
    # Finished patterns
    end_patterns = [
        r'\\?$',  # Questions
        r'\\.$',  # Statements ending with period
        r'!$',    # Exclamations
        r'thanks?\\b',  # Thanks
        r'\\bbye\\b|\\bgoodbye\\b',  # Goodbyes
        r'\\bok\\b|\\bokay\\b|\\balright\\b',  # Confirmations
    ]
    
    # Check for wait patterns first
    for pattern in wait_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            return {"state": "wait", "confidence": 0.9}
    
    # Check for unfinished patterns
    for pattern in unfinished_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            return {"state": "unfinished", "confidence": 0.8}
            
    # Check for finished patterns
    for pattern in end_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            return {"state": "finished", "confidence": 0.9}
    
    # Default: if text is short and doesn't match patterns, likely unfinished
    if len(text.split()) < 3:
        return {"state": "unfinished", "confidence": 0.6}
        
    # Longer text without clear ending, moderate confidence it's finished
    return {"state": "finished", "confidence": 0.7}

result = simple_turn_detection("${text.replace(/"/g, '\\"')}")
result["text"] = "${text.replace(/"/g, '\\"')}"
result["should_respond"] = result["state"] == "finished"
print(json.dumps(result))
            `
        ]);

        let turnResult = '';
        turnDetection.stdout.on('data', (data) => {
            turnResult += data.toString();
        });

        turnDetection.on('close', (code) => {
            if (code === 0) {
                try {
                    const result = JSON.parse(turnResult.trim());
                    res.json(result);
                } catch (parseError) {
                    res.status(500).json({ error: 'Failed to parse turn detection result' });
                }
            } else {
                res.status(500).json({ error: 'Turn detection failed' });
            }
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// LiveKit WebRTC signaling - Enhanced for TEN Framework compatibility
app.post('/api/livekit/join', async (req, res) => {
    const { 
        channel_name, 
        user_uid, 
        graph_name = 'va_local',
        language = 'en-US',
        voice_type = 'female'
    } = req.body;
    
    try {
        console.log(`Starting agent session: ${graph_name} for user ${user_uid} in channel ${channel_name}`);
        
        // Start the agent with local services
        const agentConfig = {
            channel: channel_name,
            user_id: user_uid,
            graph: graph_name,
            language: language,
            voice: voice_type,
            services: {
                stt: 'whisper_local',
                llm: 'ollama_local',
                tts: 'piper_local',
                rtc: 'livekit_local'
            }
        };

        // In a real implementation, this would:
        // 1. Generate LiveKit token
        // 2. Initialize agent services
        // 3. Set up WebRTC connections
        
        res.json({
            code: "0",
            data: {
                channel_name: channel_name,
                user_uid: user_uid,
                token: `mock-token-${Date.now()}`,
                livekit_url: 'ws://localhost:7880',
                app_id: 'ten-agent-local',
                agent_uid: Math.floor(Math.random() * 10000),
                config: agentConfig
            },
            msg: "Agent session started successfully"
        });
    } catch (error) {
        console.error('LiveKit join error:', error);
        res.status(500).json({ 
            code: "1",
            data: null,
            msg: error.message 
        });
    }
});

// Agent start endpoint - TEN Framework compatible
app.post('/api/agents/start', async (req, res) => {
    const {
        request_id,
        channel_name,
        user_uid,
        graph_name,
        language,
        voice_type,
        properties
    } = req.body;

    try {
        console.log(`Starting TEN Agent: ${graph_name} in channel ${channel_name}`);
        
        // Start local services based on graph configuration
        let services = [];
        
        switch (graph_name) {
            case 'va_local':
                services = ['whisper_stt', 'ollama_llm', 'piper_tts', 'livekit_rtc'];
                break;
            case 'camera_va_local':
                services = ['whisper_stt', 'ollama_llm', 'piper_tts', 'livekit_rtc', 'vision'];
                break;
            default:
                services = ['whisper_stt', 'ollama_llm', 'piper_tts', 'livekit_rtc'];
        }

        // Simulate agent initialization
        const agentData = {
            request_id: request_id,
            channel_name: channel_name,
            user_uid: user_uid,
            agent_uid: Math.floor(Math.random() * 10000),
            graph_name: graph_name,
            services: services,
            status: 'running',
            created_at: new Date().toISOString()
        };

        res.json({
            code: "0",
            data: agentData,
            msg: "Agent started successfully"
        });

    } catch (error) {
        console.error('Agent start error:', error);
        res.status(500).json({
            code: "1",
            data: null,
            msg: error.message
        });
    }
});

// Agent stop endpoint
app.post('/api/agents/stop', async (req, res) => {
    const { channel_name, user_uid } = req.body;

    try {
        console.log(`Stopping agent in channel ${channel_name} for user ${user_uid}`);
        
        res.json({
            code: "0",
            data: {
                channel_name: channel_name,
                user_uid: user_uid,
                status: 'stopped'
            },
            msg: "Agent stopped successfully"
        });

    } catch (error) {
        console.error('Agent stop error:', error);
        res.status(500).json({
            code: "1",
            data: null,
            msg: error.message
        });
    }
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`TEN Agent API server running on port ${PORT}`);
    console.log(`Classic Playground: http://localhost:${PORT}/playground.html`);
    console.log(`New Modern Playground: http://localhost:${PORT}/new`);
});

// WebSocket server for real-time audio streaming
const wss = new WebSocket.Server({ server });

// Store active audio sessions with proper state management
const audioSessions = new Map();

wss.on('connection', (ws) => {
    console.log('🔌 WebSocket client connected from:', ws._socket.remoteAddress);
    let sessionId = null;
    let audioBuffer = [];
    let isProcessing = false;
    let conversationState = {
        userSpeaking: false,
        agentSpeaking: false,
        waitingForUserInput: true,
        silenceTimeout: null,
        lastActivity: Date.now()
    };
    
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message.toString());
            
            switch (data.type) {
                case 'start_audio_session':
                    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    audioSessions.set(sessionId, { ws, buffer: [] });
                    console.log(`Started audio session: ${sessionId}`);
                    
                    ws.send(JSON.stringify({
                        type: 'session_started',
                        sessionId: sessionId
                    }));
                    break;

                case 'audio_chunk':
                    // Skip if agent is currently speaking
                    if (conversationState.agentSpeaking) {
                        console.log('Ignoring audio while agent is speaking');
                        break;
                    }

                    if (!sessionId) {
                        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        audioSessions.set(sessionId, { ws, buffer: [], state: conversationState });
                        console.log(`Auto-created audio session: ${sessionId}`);
                        
                        ws.send(JSON.stringify({
                            type: 'session_started',
                            sessionId: sessionId
                        }));
                    }

                    // Mark user as speaking and update activity
                    conversationState.userSpeaking = true;
                    conversationState.waitingForUserInput = false;
                    conversationState.lastActivity = Date.now();

                    // Clear any existing silence timeout
                    if (conversationState.silenceTimeout) {
                        clearTimeout(conversationState.silenceTimeout);
                        conversationState.silenceTimeout = null;
                    }

                    // Convert base64 audio chunk to buffer
                    const audioChunk = Buffer.from(data.audio, 'base64');
                    audioBuffer.push(audioChunk);
                    
                    const totalLength = audioBuffer.reduce((sum, chunk) => sum + chunk.length, 0);
                    
                    // Set silence timeout to detect end of speech (1.5 seconds of silence)
                    conversationState.silenceTimeout = setTimeout(async () => {
                        if (conversationState.userSpeaking && audioBuffer.length > 0 && !isProcessing) {
                            console.log(`User stopped speaking, processing ${totalLength} bytes`);
                            conversationState.userSpeaking = false;
                            isProcessing = true;
                            await processAudioChunk(ws, [...audioBuffer], sessionId, conversationState);
                            audioBuffer = [];
                            isProcessing = false;
                        }
                    }, 1500); // 1.5 seconds of silence triggers processing
                    
                    break;

                case 'end_audio_session':
                    // Clear any pending timeouts
                    if (conversationState.silenceTimeout) {
                        clearTimeout(conversationState.silenceTimeout);
                        conversationState.silenceTimeout = null;
                    }
                    
                    if (sessionId && audioBuffer.length > 0 && !conversationState.agentSpeaking) {
                        // Process any remaining audio
                        await processAudioChunk(ws, audioBuffer, sessionId, conversationState);
                        audioBuffer = [];
                    }
                    
                    if (sessionId) {
                        audioSessions.delete(sessionId);
                        console.log(`Ended audio session: ${sessionId}`);
                    }
                    
                    ws.send(JSON.stringify({
                        type: 'session_ended',
                        sessionId: sessionId
                    }));
                    sessionId = null;
                    break;

                default:
                    console.log('Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('WebSocket message error:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: error.message
            }));
        }
    });
    
    ws.on('close', () => {
        console.log('WebSocket client disconnected');
        
        // Clean up timeouts
        if (conversationState.silenceTimeout) {
            clearTimeout(conversationState.silenceTimeout);
        }
        
        if (sessionId) {
            audioSessions.delete(sessionId);
        }
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// Process audio chunk through Whisper and generate response
async function processAudioChunk(ws, audioBuffer, sessionId, conversationState) {
    try {
        // Combine audio chunks into single buffer
        const combinedBuffer = Buffer.concat(audioBuffer);
        
        // Save to temporary file
        const tempFile = `uploads/audio_${sessionId}_${Date.now()}.wav`;
        
        // Create WAV header for 16kHz 16-bit mono audio
        const wavHeader = createWavHeader(combinedBuffer.length);
        const wavFile = Buffer.concat([wavHeader, combinedBuffer]);
        
        fs.writeFileSync(tempFile, wavFile);
        
        // Transcribe with Whisper using standalone script
        const pythonCmd = fs.existsSync('./venv/bin/python') ? './venv/bin/python' : 'python3';
        const whisper = spawn(pythonCmd, [
            'extensions/whisper_stt/standalone.py',
            tempFile
        ]);

        let transcript = '';
        whisper.stdout.on('data', (data) => {
            transcript += data.toString();
        });

        whisper.on('close', async (code) => {
            // Clean up temp file
            try {
                fs.unlinkSync(tempFile);
            } catch (e) {}
            
            if (code === 0 && transcript.trim()) {
                console.log('Transcription:', transcript.trim());
                
                // Send transcription to client
                ws.send(JSON.stringify({
                    type: 'transcription',
                    text: transcript.trim(),
                    sessionId: sessionId
                }));
                
                // Perform VAD analysis on the audio
                await performVADAnalysis(ws, combinedBuffer, sessionId);
                
                // Perform turn detection on the transcript
                const turnResult = await performTurnDetection(ws, transcript.trim(), sessionId);
                
                // Generate LLM response based on turn detection result
                if (turnResult && turnResult.should_respond) {
                    await generateLLMResponse(ws, transcript.trim(), sessionId, conversationState);
                } else {
                    console.log(`Turn detection: ${turnResult ? turnResult.state : 'unknown'} - not responding`);
                }
            } else {
                console.log('No transcription or transcription failed');
            }
        });

    } catch (error) {
        console.error('Audio processing error:', error);
        ws.send(JSON.stringify({
            type: 'error',
            message: `Audio processing failed: ${error.message}`,
            sessionId: sessionId
        }));
    }
}

// Generate LLM response and TTS
async function generateLLMResponse(ws, userMessage, sessionId, conversationState) {
    try {
        const ollama = spawn('curl', [
            '-s',
            '-H', 'Content-Type: application/json',
            'http://localhost:11434/api/generate',
            '-d',
            JSON.stringify({
                model: 'llama3.2:3b',
                prompt: userMessage,
                stream: true
            })
        ]);

        let response = '';
        ollama.stdout.on('data', (data) => {
            response += data.toString();
        });

        ollama.on('close', async (code) => {
            if (code === 0) {
                try {
                    // Parse streaming response
                    const lines = response.trim().split('\n');
                    let fullResponse = '';
                    
                    for (const line of lines) {
                        if (line.trim()) {
                            try {
                                const parsed = JSON.parse(line);
                                if (parsed.response) {
                                    fullResponse += parsed.response;
                                }
                            } catch (lineParseError) {
                                // Skip invalid lines
                            }
                        }
                    }
                    
                    if (fullResponse) {
                        console.log('LLM Response:', fullResponse);
                        
                        // Mark agent as speaking to prevent interruptions
                        conversationState.agentSpeaking = true;
                        conversationState.waitingForUserInput = false;
                        
                        // Send text response immediately
                        ws.send(JSON.stringify({
                            type: 'llm_response',
                            text: fullResponse,
                            sessionId: sessionId
                        }));
                        
                        // Stream TTS audio in real-time using raw output
                        const piperCmd = fs.existsSync('./venv/bin/piper') ? './venv/bin/piper' : 'piper';
                        const voiceModel = './venv/voices/en_US-lessac-medium.onnx';
                        
                        console.log(`Streaming TTS with Piper: ${piperCmd} --model ${voiceModel} --output-raw`);
                        
                        const piper = spawn(piperCmd, [
                            '--model', voiceModel,
                            '--output-raw'  // Stream raw audio to stdout
                        ]);
                        
                        // Send text to Piper
                        piper.stdin.write(fullResponse);
                        piper.stdin.end();
                        
                        let totalAudioBytes = 0;
                        let isFirstChunk = true;
                        
                        // Stream audio chunks as they're generated
                        piper.stdout.on('data', (audioChunk) => {
                            totalAudioBytes += audioChunk.length;
                            
                            if (isFirstChunk) {
                                console.log(`Starting TTS audio stream: first chunk ${audioChunk.length} bytes`);
                                isFirstChunk = false;
                            }
                            
                            // Convert raw audio to base64 and send immediately
                            const audioBase64 = audioChunk.toString('base64');
                            
                            ws.send(JSON.stringify({
                                type: 'tts_audio_chunk',
                                audio: audioBase64,
                                sessionId: sessionId
                            }));
                        });
                        
                        piper.on('close', (code) => {
                            console.log(`Piper TTS streaming completed: ${code}, total audio: ${totalAudioBytes} bytes`);
                            
                            // Send end signal
                            ws.send(JSON.stringify({
                                type: 'tts_audio_end',
                                sessionId: sessionId
                            }));
                            
                            if (code === 0) {
                                // Mark conversation complete and ready for next user input
                                setTimeout(() => {
                                    conversationState.agentSpeaking = false;
                                    conversationState.waitingForUserInput = true;
                                    console.log('Agent finished speaking, ready for user input');
                                }, 500); // Shorter buffer for streaming
                            } else {
                                console.error(`Piper TTS failed with exit code: ${code}`);
                                conversationState.agentSpeaking = false;
                                conversationState.waitingForUserInput = true;
                            }
                        });
                        
                        piper.on('error', (error) => {
                            console.error('Piper TTS process error:', error);
                            conversationState.agentSpeaking = false;
                            conversationState.waitingForUserInput = true;
                        });
                    }
                } catch (parseError) {
                    console.error('LLM response parse error:', parseError);
                }
            }
        });

    } catch (error) {
        console.error('LLM generation error:', error);
        ws.send(JSON.stringify({
            type: 'error',
            message: `LLM generation failed: ${error.message}`,
            sessionId: sessionId
        }));
    }
}

// Perform VAD analysis on audio buffer
async function performVADAnalysis(ws, audioBuffer, sessionId) {
    try {
        // Create temporary WAV file for VAD analysis
        const tempFile = `uploads/vad_${sessionId}_${Date.now()}.wav`;
        const wavHeader = createWavHeader(audioBuffer.length);
        const wavFile = Buffer.concat([wavHeader, audioBuffer]);
        
        fs.writeFileSync(tempFile, wavFile);
        
        const pythonCmd = fs.existsSync('./venv/bin/python') ? './venv/bin/python' : 'python3';
        const vad = spawn(pythonCmd, [
            '-c',
            `
import numpy as np
import wave
import json

def simple_vad(audio_file, threshold=0.01):
    try:
        with wave.open(audio_file, 'rb') as wf:
            frames = wf.readframes(wf.getnframes())
            audio_data = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
            
        # Calculate RMS energy
        rms = np.sqrt(np.mean(audio_data ** 2))
        
        # Simple threshold-based VAD
        is_speech = rms > threshold
        confidence = min(rms / threshold, 1.0) if is_speech else 0.0
        
        result = {
            "is_speech": bool(is_speech),
            "confidence": float(confidence),
            "rms": float(rms),
            "timestamp": ${Date.now()}
        }
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))

simple_vad("${tempFile}")
            `
        ]);

        let vadResult = '';
        vad.stdout.on('data', (data) => {
            vadResult += data.toString();
        });

        vad.on('close', (code) => {
            // Clean up temp file
            try {
                fs.unlinkSync(tempFile);
            } catch (e) {}
            
            if (code === 0) {
                try {
                    const result = JSON.parse(vadResult.trim());
                    console.log('VAD Result:', result);
                    
                    // Send VAD result to client
                    ws.send(JSON.stringify({
                        type: 'vad_result',
                        ...result,
                        sessionId: sessionId
                    }));
                    
                } catch (parseError) {
                    console.error('Failed to parse VAD result:', parseError);
                }
            }
        });

    } catch (error) {
        console.error('VAD analysis error:', error);
    }
}

// Perform turn detection on transcript
async function performTurnDetection(ws, text, sessionId) {
    return new Promise((resolve) => {
        try {
            const pythonCmd = fs.existsSync('./venv/bin/python') ? './venv/bin/python' : 'python3';
            const turnDetection = spawn(pythonCmd, [
                '-c',
                `
import re
import json

def simple_turn_detection(text):
    text = text.strip().lower()
    
    if not text:
        return {"state": "unfinished", "confidence": 0.1}
    
    # Wait/stop patterns
    wait_patterns = [
        r'\\bstop\\b|\\bwait\\b|\\bhold\\b',
        r'\\bshut up\\b|\\bstop talking\\b',
        r'\\bquiet\\b|\\bsilence\\b',
    ]
    
    # Unfinished patterns  
    unfinished_patterns = [
        r'\\band\\s*$',  # Ending with "and"
        r'\\bbut\\s*$',  # Ending with "but" 
        r'\\bso\\s*$',   # Ending with "so"
        r',\\s*$',       # Ending with comma
        r'\\bi\\s*$',    # Just "I"
        r'\\bthe\\s*$',  # Just "the"
        r'\\ba\\s*$',    # Just "a"
    ]
    
    # Finished patterns
    end_patterns = [
        r'\\?$',  # Questions
        r'\\.$',  # Statements ending with period
        r'!$',    # Exclamations
        r'thanks?\\b',  # Thanks
        r'\\bbye\\b|\\bgoodbye\\b',  # Goodbyes
        r'\\bok\\b|\\bokay\\b|\\balright\\b',  # Confirmations
    ]
    
    # Check for wait patterns first
    for pattern in wait_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            return {"state": "wait", "confidence": 0.9}
    
    # Check for unfinished patterns
    for pattern in unfinished_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            return {"state": "unfinished", "confidence": 0.8}
            
    # Check for finished patterns
    for pattern in end_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            return {"state": "finished", "confidence": 0.9}
    
    # Default: if text is short and doesn't match patterns, likely unfinished
    if len(text.split()) < 3:
        return {"state": "unfinished", "confidence": 0.6}
        
    # Longer text without clear ending, moderate confidence it's finished
    return {"state": "finished", "confidence": 0.7}

result = simple_turn_detection("${text.replace(/"/g, '\\"')}")
result["text"] = "${text.replace(/"/g, '\\"')}"
result["should_respond"] = result["state"] == "finished"
result["timestamp"] = ${Date.now()}
print(json.dumps(result))
                `
            ]);

            let turnResult = '';
            turnDetection.stdout.on('data', (data) => {
                turnResult += data.toString();
            });

            turnDetection.on('close', (code) => {
                if (code === 0) {
                    try {
                        const result = JSON.parse(turnResult.trim());
                        console.log('Turn Detection Result:', result);
                        
                        // Send turn detection result to client
                        ws.send(JSON.stringify({
                            type: 'turn_result',
                            ...result,
                            sessionId: sessionId
                        }));
                        
                        resolve(result);
                        
                    } catch (parseError) {
                        console.error('Failed to parse turn detection result:', parseError);
                        resolve(null);
                    }
                } else {
                    console.error('Turn detection process failed');
                    resolve(null);
                }
            });

        } catch (error) {
            console.error('Turn detection error:', error);
            resolve(null);
        }
    });
}

// Create WAV header for raw audio data
function createWavHeader(dataLength) {
    const sampleRate = 16000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    
    const header = Buffer.alloc(44);
    
    // RIFF header
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataLength, 4);
    header.write('WAVE', 8);
    
    // Format chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // Chunk size
    header.writeUInt16LE(1, 20);  // Audio format (PCM)
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    
    // Data chunk
    header.write('data', 36);
    header.writeUInt32LE(dataLength, 40);
    
    return header;
}