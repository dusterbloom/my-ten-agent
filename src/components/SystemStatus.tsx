import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { StatusIndicator } from './StatusIndicator'
import { Button } from './ui/Button'
import { RefreshCw, Activity } from 'lucide-react'

interface SystemStatusProps {
  onLog: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void
}

interface ServiceStatus {
  ollama: 'online' | 'offline' | 'loading'
  livekit: 'online' | 'offline' | 'loading'
  whisper: 'online' | 'offline' | 'loading'
  piper: 'online' | 'offline' | 'loading'
}

export function SystemStatus({ onLog }: SystemStatusProps) {
  const [status, setStatus] = useState<ServiceStatus>({
    ollama: 'offline',
    livekit: 'offline',
    whisper: 'offline',
    piper: 'offline'
  })
  
  const [isChecking, setIsChecking] = useState(false)

  const checkServices = async () => {
    setIsChecking(true)
    onLog('Checking all services...', 'info')
    
    // Set all to loading
    setStatus({
      ollama: 'loading',
      livekit: 'loading',
      whisper: 'loading',
      piper: 'loading'
    })

    const newStatus: ServiceStatus = {
      ollama: 'offline',
      livekit: 'offline',
      whisper: 'offline',
      piper: 'offline'
    }

    // Check Ollama
    try {
      const ollamaResponse = await fetch('http://localhost:11434/api/tags')
      if (ollamaResponse.ok) {
        newStatus.ollama = 'online'
        onLog('Ollama service: Online', 'success')
      }
    } catch (error) {
      newStatus.ollama = 'offline'
      onLog('Ollama service: Offline', 'error')
    }

    // Check LiveKit
    try {
      const livekitResponse = await fetch('http://localhost:7880')
      if (livekitResponse.ok) {
        newStatus.livekit = 'online'
        onLog('LiveKit service: Online', 'success')
      }
    } catch (error) {
      newStatus.livekit = 'offline'
      onLog('LiveKit service: Offline', 'error')
    }

    // Test extensions via our API
    try {
      const response = await fetch('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'all' })
      })
      
      const result = await response.json()
      
      // Assume extensions are working if API responds
      if (response.ok) {
        newStatus.whisper = 'online'
        newStatus.piper = 'online'
        onLog('Extensions tested successfully', 'success')
      }
    } catch (error) {
      onLog(`Extension test failed: ${error}`, 'warning')
    }

    setStatus(newStatus)
    setIsChecking(false)
  }

  useEffect(() => {
    checkServices()
  }, [])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            System Status
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={checkServices}
            disabled={isChecking}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <StatusIndicator status={status.ollama} label="Ollama LLM" />
        <StatusIndicator status={status.livekit} label="LiveKit RTC" />
        <StatusIndicator status={status.whisper} label="Whisper STT" />
        <StatusIndicator status={status.piper} label="Piper TTS" />
      </CardContent>
    </Card>
  )
}