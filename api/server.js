const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test all extensions
app.post('/api/test', async (req, res) => {
    const results = {
        ollama: false,
        whisper: false,
        piper: false,
        livekit: false
    };

    try {
        // Test Ollama
        const ollama = spawn('curl', ['-s', 'http://localhost:11434/api/tags']);
        ollama.on('close', (code) => {
            results.ollama = code === 0;
        });

        // Test Whisper
        const whisper = spawn('python3', ['-c', 'import whisper; print("OK")']);
        whisper.on('close', (code) => {
            results.whisper = code === 0;
        });

        // Test Piper
        const piper = spawn('piper', ['--help']);
        piper.on('close', (code) => {
            results.piper = code === 0;
        });

        // Test LiveKit
        const livekit = spawn('curl', ['-s', 'http://localhost:7880']);
        livekit.on('close', (code) => {
            results.livekit = code === 0;
            res.json(results);
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
        const whisper = spawn('python3', [
            'extensions/whisper_stt/extension.py',
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
            'http://localhost:11434/api/generate',
            '-d',
            JSON.stringify({
                model: 'llama2',
                prompt: message,
                stream: false
            })
        ]);

        let response = '';
        ollama.stdout.on('data', (data) => {
            response += data.toString();
        });

        ollama.on('close', (code) => {
            if (code === 0) {
                try {
                    const result = JSON.parse(response);
                    
                    // Generate audio response using Piper
                    const audioFile = `uploads/response_${Date.now()}.wav`;
                    const piper = spawn('piper', [
                        '--model', 'en_US-amy-medium',
                        '--output_file', audioFile
                    ]);
                    
                    piper.stdin.write(result.response);
                    piper.stdin.end();
                    
                    piper.on('close', (code) => {
                        if (code === 0) {
                            res.json({
                                response: result.response,
                                audio: audioFile
                            });
                        } else {
                            res.json({ response: result.response });
                        }
                    });
                } catch (parseError) {
                    res.status(500).json({ error: 'Failed to parse response' });
                }
            } else {
                res.status(500).json({ error: 'Ollama request failed' });
            }
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// LiveKit WebRTC signaling
app.post('/api/livekit/join', async (req, res) => {
    const { room, identity } = req.body;
    
    try {
        // This would integrate with LiveKit server
        res.json({
            room,
            identity,
            token: 'mock-token',
            wsUrl: 'ws://localhost:7880'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`TEN Agent API server running on port ${PORT}`);
    console.log(`Playground: http://localhost:${PORT}/playground.html`);
});