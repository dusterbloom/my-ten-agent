import React, { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Button } from './ui/Button'
import { Download, Trash2, Terminal } from 'lucide-react'
import { formatTime } from '../lib/utils'
import { cn } from '../lib/utils'

interface LogEntry {
  id: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  timestamp: Date
}

interface SystemLogsProps {
  className?: string
}

export function SystemLogs({ className }: SystemLogsProps) {
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: '1',
      message: 'System initialized',
      type: 'info',
      timestamp: new Date()
    }
  ])
  const logsEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [logs])

  const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const logEntry: LogEntry = {
      id: Date.now().toString(),
      message,
      type,
      timestamp: new Date()
    }
    
    setLogs(prev => [...prev, logEntry])
  }

  const clearLogs = () => {
    setLogs([{
      id: Date.now().toString(),
      message: 'Logs cleared',
      type: 'info',
      timestamp: new Date()
    }])
  }

  const downloadLogs = () => {
    const logText = logs.map(log => 
      `[${formatTime(log.timestamp)}] ${log.type.toUpperCase()}: ${log.message}`
    ).join('\n')
    
    const blob = new Blob([logText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ten-agent-logs-${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
    
    addLog('Logs downloaded', 'info')
  }

  // Expose addLog function for external use
  React.useImperativeHandle(React.createRef(), () => ({
    addLog
  }))

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            System Logs
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={downloadLogs}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearLogs}
              className="flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm max-h-64 overflow-y-auto">
          {logs.map((log) => (
            <div key={log.id} className="flex gap-2 mb-1">
              <span className="text-gray-400 shrink-0">
                [{formatTime(log.timestamp)}]
              </span>
              <span className={cn(
                'font-medium',
                {
                  'text-blue-400': log.type === 'info',
                  'text-green-400': log.type === 'success',
                  'text-yellow-400': log.type === 'warning',
                  'text-red-400': log.type === 'error'
                }
              )}>
                {log.type.toUpperCase()}:
              </span>
              <span className="break-words">{log.message}</span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </CardContent>
    </Card>
  )
}

// Export with ref for external access
export const SystemLogsRef = React.forwardRef<
  { addLog: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void },
  SystemLogsProps
>((props, ref) => {
  const [component, setComponent] = useState<any>(null)
  
  React.useImperativeHandle(ref, () => ({
    addLog: component?.addLog || (() => {})
  }))
  
  return <SystemLogs {...props} ref={setComponent} />
})