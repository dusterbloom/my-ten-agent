import React, { useState, useRef } from 'react'
import { Button } from './ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Mic, MicOff, Square } from 'lucide-react'

interface AudioControlsProps {
  onTranscriptionComplete: (text: string) => void
  onLog: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void
}

export function AudioControls({ onTranscriptionComplete, onLog }: AudioControlsProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      
      const audioChunks: BlobPart[] = []
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data)
      }
      
      mediaRecorder.onstop = async () => {
        setIsProcessing(true)
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' })
        const formData = new FormData()
        formData.append('audio', audioBlob, 'recording.wav')
        
        try {
          const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData
          })
          
          const result = await response.json()
          if (result.text) {
            onTranscriptionComplete(result.text)
            onLog(`Transcription: "${result.text}"`, 'success')
          } else {
            onLog('No speech detected in recording', 'warning')
          }
        } catch (error) {
          onLog(`Transcription failed: ${error}`, 'error')
        } finally {
          setIsProcessing(false)
        }
      }
      
      mediaRecorder.start()
      setIsRecording(true)
      onLog('Recording started', 'info')
    } catch (error) {
      onLog(`Failed to start recording: ${error}`, 'error')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      streamRef.current?.getTracks().forEach(track => track.stop())
      setIsRecording(false)
      onLog('Recording stopped, processing...', 'info')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="w-5 h-5" />
          Voice Input
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          {!isRecording ? (
            <Button 
              onClick={startRecording} 
              disabled={isProcessing}
              className="flex items-center gap-2"
            >
              <Mic className="w-4 h-4" />
              Start Recording
            </Button>
          ) : (
            <Button 
              onClick={stopRecording}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <Square className="w-4 h-4" />
              Stop Recording
            </Button>
          )}
        </div>
        
        <div className={`
          p-4 rounded-lg border-2 border-dashed text-center text-sm
          ${isRecording 
            ? 'border-red-300 bg-red-50 text-red-700' 
            : isProcessing
            ? 'border-yellow-300 bg-yellow-50 text-yellow-700'
            : 'border-muted-foreground/25 text-muted-foreground'
          }
        `}>
          {isRecording ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              Recording... Click "Stop Recording" when done
            </div>
          ) : isProcessing ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
              Processing audio...
            </div>
          ) : (
            'Click "Start Recording" to begin voice input'
          )}
        </div>
      </CardContent>
    </Card>
  )
}