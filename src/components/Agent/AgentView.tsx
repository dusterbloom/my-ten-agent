import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { RootState } from '../../store'
import { 
  setConnected, 
  setConnecting, 
  setRemoteUserConnected, 
  setLocalMicOn,
  setLocalCameraOn,
  addChatItem,
  IChatItem,
  EMessageType,
  EMessageDataType
} from '../../store/slices/globalSlice'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Mic, MicOff, Video, VideoOff, Phone, PhoneOff } from 'lucide-react'
import { cn } from '../../lib/utils'

interface AgentViewProps {
  className?: string
  onLog?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void
}

export const AgentView: React.FC<AgentViewProps> = ({ className, onLog }) => {
  const dispatch = useDispatch()
  const { 
    connected, 
    connecting, 
    localMicOn, 
    localCameraOn, 
    remoteUserConnected,
    currentLanguage,
    currentVoice,
    currentGraph 
  } = useSelector((state: RootState) => state.global)
  
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [ws, setWs] = useState<WebSocket | null>(null)
  const [audioSessionId, setAudioSessionId] = useState<string | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const streamingStateRef = useRef<boolean>(false) // Use ref for streaming state to avoid React timing issues

  const generateUserId = () => Math.random().toString(36).substr(2, 9)

  useEffect(() => {
    // Initialize local media on component mount
    initializeLocalMedia()
    
    // Initialize WebSocket connection
    initializeWebSocket()

    return () => {
      // Cleanup
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop())
      }
      if (ws) {
        ws.close()
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  const initializeWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}`
    
    console.log('Attempting WebSocket connection to:', wsUrl)
    
    try {
      const websocket = new WebSocket(wsUrl)
      
      websocket.onopen = () => {
        console.log('WebSocket connected successfully!')
        setWs(websocket)
        onLog?.('WebSocket connected', 'success')
      }
      
      websocket.onmessage = (event) => {
        const data = JSON.parse(event.data)
        handleWebSocketMessage(data)
      }
      
      websocket.onclose = () => {
        console.log('WebSocket disconnected')
        setWs(null)
        setAudioSessionId(null)
        setIsStreaming(false)
      }
      
      websocket.onerror = (error) => {
        console.error('WebSocket error:', error)
        onLog?.('WebSocket connection failed', 'error')
      }
    } catch (error) {
      console.error('Failed to create WebSocket:', error)
      onLog?.('Failed to initialize real-time audio', 'error')
    }
  }

  const handleWebSocketMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'session_started':
        setAudioSessionId(data.sessionId)
        onLog?.('Audio session started', 'success')
        break
        
      case 'transcription':
        onLog?.(`User: ${data.text}`, 'info')
        // Add to chat
        dispatch(addChatItem({
          id: Date.now().toString(),
          type: EMessageType.USER,
          text: data.text,
          time: Date.now(),
          dataType: EMessageDataType.TEXT
        }))
        break
        
      case 'llm_response':
        onLog?.(`Agent: ${data.text}`, 'success')
        // Add to chat
        dispatch(addChatItem({
          id: Date.now().toString(),
          type: EMessageType.AGENT,
          text: data.text,
          time: Date.now(),
          dataType: EMessageDataType.TEXT
        }))
        break
        
      case 'tts_audio':
        // Play TTS audio (legacy single audio message)
        playAudioFromBase64(data.audio)
        break
        
      case 'tts_audio_chunk':
        // Handle streaming audio chunk
        handleStreamingAudioChunk(data.audio)
        break
        
      case 'tts_audio_end':
        // Finalize streaming audio playback
        finalizeStreamingAudio()
        break
        
      case 'session_ended':
        setAudioSessionId(null)
        setIsStreaming(false)
        onLog?.('Audio session ended', 'info')
        break
        
      case 'vad_result':
        // Handle Voice Activity Detection results
        onLog?.(`VAD: ${data.is_speech ? 'Speech' : 'Silence'} (${(data.confidence * 100).toFixed(1)}%)`, 'info')
        break
        
      case 'turn_result':
        // Handle Turn Detection results  
        onLog?.(`Turn Detection: ${data.state} (${(data.confidence * 100).toFixed(1)}%)`, 'info')
        break
        
      case 'error':
        onLog?.(`Audio error: ${data.message}`, 'error')
        break
        
      default:
        console.log('Unknown WebSocket message:', data)
    }
  }, [dispatch, onLog])

  const playAudioFromBase64 = (base64Audio: string) => {
    try {
      const audioData = atob(base64Audio)
      const arrayBuffer = new ArrayBuffer(audioData.length)
      const view = new Uint8Array(arrayBuffer)
      
      for (let i = 0; i < audioData.length; i++) {
        view[i] = audioData.charCodeAt(i)
      }
      
      const audioBlob = new Blob([arrayBuffer], { type: 'audio/wav' })
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      
      audio.play().catch(error => {
        console.error('Failed to play TTS audio:', error)
      })
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl)
      }
    } catch (error) {
      console.error('Failed to decode TTS audio:', error)
    }
  }

  // Streaming audio state
  const streamingAudioRef = useRef<{
    audioContext: AudioContext | null
    sourceBuffer: AudioBufferSourceNode | null
    audioChunks: Uint8Array[]
    isPlaying: boolean
    nextStartTime: number
  }>({
    audioContext: null,
    sourceBuffer: null,
    audioChunks: [],
    isPlaying: false,
    nextStartTime: 0
  })

  const handleStreamingAudioChunk = (base64Audio: string) => {
    try {
      const audioData = atob(base64Audio)
      const rawAudioChunk = new Uint8Array(audioData.length)
      
      for (let i = 0; i < audioData.length; i++) {
        rawAudioChunk[i] = audioData.charCodeAt(i)
      }
      
      streamingAudioRef.current.audioChunks.push(rawAudioChunk)
      
      // Start playback immediately if not already playing
      if (!streamingAudioRef.current.isPlaying) {
        startStreamingAudioPlayback()
      }
    } catch (error) {
      console.error('Failed to handle streaming audio chunk:', error)
    }
  }

  const startStreamingAudioPlayback = async () => {
    try {
      if (!streamingAudioRef.current.audioContext) {
        streamingAudioRef.current.audioContext = new AudioContext()
      }
      
      const audioContext = streamingAudioRef.current.audioContext
      streamingAudioRef.current.isPlaying = true
      streamingAudioRef.current.nextStartTime = audioContext.currentTime
      
      // Process audio chunks as they arrive
      processAudioChunks()
      
    } catch (error) {
      console.error('Failed to start streaming audio playback:', error)
    }
  }

  const processAudioChunks = async () => {
    const streaming = streamingAudioRef.current
    if (!streaming.audioContext || streaming.audioChunks.length === 0) return
    
    try {
      // Combine available chunks into a buffer
      const totalLength = streaming.audioChunks.reduce((sum, chunk) => sum + chunk.length, 0)
      const combinedAudio = new Uint8Array(totalLength)
      let offset = 0
      
      for (const chunk of streaming.audioChunks) {
        combinedAudio.set(chunk, offset)
        offset += chunk.length
      }
      
      // Convert raw audio to AudioBuffer (assuming 16kHz 16-bit mono from Piper)
      const audioBuffer = streaming.audioContext.createBuffer(1, combinedAudio.length / 2, 16000)
      const channelData = audioBuffer.getChannelData(0)
      
      // Convert 16-bit PCM to float32
      for (let i = 0; i < channelData.length; i++) {
        const sample = (combinedAudio[i * 2] | (combinedAudio[i * 2 + 1] << 8))
        channelData[i] = sample < 32768 ? sample / 32767 : (sample - 65536) / 32768
      }
      
      // Create and play the audio buffer
      const source = streaming.audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(streaming.audioContext.destination)
      source.start(streaming.nextStartTime)
      
      streaming.nextStartTime += audioBuffer.duration
      
      // Clear processed chunks
      streaming.audioChunks = []
      
      console.log(`Playing streaming audio chunk: ${audioBuffer.duration.toFixed(2)}s`)
      
    } catch (error) {
      console.error('Failed to process audio chunks:', error)
    }
  }

  const finalizeStreamingAudio = () => {
    const streaming = streamingAudioRef.current
    
    // Process any remaining chunks
    if (streaming.audioChunks.length > 0) {
      processAudioChunks()
    }
    
    // Reset streaming state
    setTimeout(() => {
      streaming.isPlaying = false
      streaming.nextStartTime = 0
      console.log('Streaming audio playback completed')
    }, 100)
  }

  const initializeLocalMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      })
      
      setLocalStream(stream)
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }
      
      onLog?.('Local media initialized', 'success')
    } catch (error) {
      onLog?.(`Failed to initialize local media: ${error}`, 'error')
    }
  }

  const handleConnect = async () => {
    if (connected) {
      handleDisconnect()
      return
    }

    dispatch(setConnecting(true))
    onLog?.('Connecting to agent...', 'info')

    try {
      // Start the agent session
      const startResponse = await fetch('/api/livekit/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_name: `ten_agent_${Date.now()}`,
          user_uid: Math.floor(Math.random() * 10000),
          graph_name: currentGraph,
          language: currentLanguage,
          voice_type: currentVoice,
        })
      })

      if (!startResponse.ok) {
        throw new Error('Failed to start agent session')
      }

      const result = await startResponse.json()
      onLog?.('Agent session started successfully', 'success')
      
      dispatch(setConnected(true))
      dispatch(setRemoteUserConnected(true))
      
    } catch (error) {
      onLog?.(`Connection failed: ${error}`, 'error')
    } finally {
      dispatch(setConnecting(false))
    }
  }

  const handleDisconnect = () => {
    dispatch(setConnected(false))
    dispatch(setRemoteUserConnected(false))
    onLog?.('Disconnected from agent', 'info')
  }

  const startAudioStreaming = async () => {
    if (!ws || !localStream) {
      onLog?.('WebSocket or audio stream not ready', 'error')
      return
    }

    try {
      console.log('Starting audio streaming...')
      
      // Set up audio processing first
      const audioContext = new AudioContext({ sampleRate: 16000 })
      
      // Resume audio context if suspended (required by browsers)
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
        console.log('Audio context resumed')
      }
      
      audioContextRef.current = audioContext
      console.log('Audio context created, state:', audioContext.state)
      
      const source = audioContext.createMediaStreamSource(localStream)
      sourceRef.current = source
      
      // Create processor for real-time audio chunks
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor
      
      processor.onaudioprocess = (event) => {
        // console.log('🔥 AUDIO PROCESS TRIGGERED!')
        
        if (!ws || ws.readyState !== WebSocket.OPEN || !streamingStateRef.current) {
          console.log('❌ Skipping audio process:', { ws: !!ws, wsState: ws?.readyState, streaming: streamingStateRef.current })
          return
        }
        
        const inputBuffer = event.inputBuffer.getChannelData(0)
        // console.log('✅ Processing audio buffer, length:', inputBuffer.length)
        
        // Check for silence (basic voice activity detection)
        let sum = 0
        for (let i = 0; i < inputBuffer.length; i++) {
          sum += Math.abs(inputBuffer[i])
        }
        const average = sum / inputBuffer.length
        
        // Debug: Log all audio levels (even silence)
        // console.log(`Audio level: ${average.toFixed(6)} (threshold: 0.001)`)
        
        // Only send if there's some audio activity (very low threshold: 0.001)
        if (average < 0.001) return
        
        // console.log(`🎤 Audio activity detected: ${average.toFixed(4)}`)
        
        // Convert float32 to int16
        const int16Buffer = new Int16Array(inputBuffer.length)
        for (let i = 0; i < inputBuffer.length; i++) {
          int16Buffer[i] = Math.max(-32768, Math.min(32767, inputBuffer[i] * 32768))
        }
        
        // Send audio chunk as base64
        const audioChunk = Array.from(new Uint8Array(int16Buffer.buffer))
        const base64Chunk = btoa(String.fromCharCode(...audioChunk))
        
        // console.log(`Sending audio chunk: ${audioChunk.length} bytes`)
        
        ws.send(JSON.stringify({
          type: 'audio_chunk',
          audio: base64Chunk
        }))
      }
      
      source.connect(processor)
      processor.connect(audioContext.destination)
      
      console.log('🔗 Audio nodes connected')
      
      // Set streaming state using ref to avoid React timing issues
      streamingStateRef.current = true
      dispatch(setLocalMicOn(true))
      
      // Start audio session after setup
      ws.send(JSON.stringify({
        type: 'start_audio_session'
      }))
      
      console.log('🟢 Audio streaming setup complete')
      onLog?.('Voice streaming started - speak now!', 'success')
      
    } catch (error) {
      console.error('Failed to start audio streaming:', error)
      onLog?.('Failed to start voice streaming', 'error')
    }
  }

  const stopAudioStreaming = () => {
    // Set streaming state to false first
    streamingStateRef.current = false
    
    if (ws && audioSessionId) {
      ws.send(JSON.stringify({
        type: 'end_audio_session'
      }))
    }
    
    // Clean up audio processing with proper error handling
    try {
      if (processorRef.current) {
        processorRef.current.disconnect()
        processorRef.current = null
      }
      
      if (sourceRef.current) {
        sourceRef.current.disconnect()
        sourceRef.current = null
      }
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
    } catch (error) {
      console.error('Error during audio cleanup:', error)
    }
    
    dispatch(setLocalMicOn(false))
    onLog?.('Voice streaming stopped', 'info')
  }

  const toggleMic = () => {
    console.log('Microphone button clicked! Current streaming state:', streamingStateRef.current)
    console.log('WebSocket state:', ws?.readyState)
    console.log('Local stream available:', !!localStream)
    
    if (!streamingStateRef.current) {
      console.log('Starting audio streaming...')
      startAudioStreaming()
    } else {
      console.log('Stopping audio streaming...')
      stopAudioStreaming()
    }
  }

  const toggleCamera = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !localCameraOn
        // dispatch(setLocalCameraOn(!localCameraOn)) // This would need to be implemented
        onLog?.(`Camera ${!localCameraOn ? 'enabled' : 'disabled'}`, 'info')
      }
    }
  }

  return (
    <Card className={cn("flex flex-col h-full", className)}>
      <div className="flex-1 relative bg-gray-900 rounded-t-lg overflow-hidden">
        {/* Remote Video (Agent) */}
        <div className="absolute inset-0 flex items-center justify-center">
          {remoteUserConnected ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-white">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4">
                <span className="text-2xl font-bold">AI</span>
              </div>
              <p className="text-lg font-medium">TEN Agent</p>
              <p className="text-sm text-gray-300 mt-1">
                {connected ? 'Connected' : 'Ready to connect'}
              </p>
            </div>
          )}
        </div>

        {/* Local Video (User) - Picture in Picture */}
        <div className="absolute bottom-4 right-4 w-32 h-24 bg-gray-800 rounded-lg overflow-hidden border-2 border-white">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }} // Mirror local video
          />
        </div>

        {/* Connection Status */}
        <div className="absolute top-4 left-4">
          <div className={cn(
            "px-3 py-1 rounded-full text-sm font-medium",
            connected 
              ? "bg-green-500 text-white" 
              : connecting 
                ? "bg-yellow-500 text-white"
                : "bg-gray-500 text-white"
          )}>
            {connecting ? 'Connecting...' : connected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="p-4 bg-gray-50 rounded-b-lg">
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleMic}
            className={cn(
              "w-12 h-12 rounded-full p-0",
              localMicOn ? "bg-green-500 text-white animate-pulse" : "bg-gray-500 text-white"
            )}
          >
            {localMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </Button>

          <Button
            onClick={handleConnect}
            disabled={connecting}
            className={cn(
              "px-6 py-3 rounded-full",
              connected 
                ? "bg-red-500 hover:bg-red-600" 
                : "bg-green-500 hover:bg-green-600"
            )}
          >
            {connecting ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Connecting...
              </div>
            ) : connected ? (
              <div className="flex items-center gap-2">
                <PhoneOff className="w-5 h-5" />
                Disconnect
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Connect
              </div>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={toggleCamera}
            className={cn(
              "w-12 h-12 rounded-full p-0",
              localCameraOn ? "bg-blue-500 text-white" : "bg-red-500 text-white"
            )}
          >
            {localCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </Button>
        </div>
      </div>
    </Card>
  )
}