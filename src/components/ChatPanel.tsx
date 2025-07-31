import React, { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { ChatMessage } from './ChatMessage'
import { MessageCircle, Send, Trash2 } from 'lucide-react'

interface Message {
  id: string
  text: string
  type: 'user' | 'assistant' | 'system'
  timestamp: Date
}

interface ChatPanelProps {
  onLog: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void
}

export function ChatPanel({ onLog }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Welcome to TEN Agent! I can help you with questions and tasks. Try typing a message or use voice input.',
      type: 'system',
      timestamp: new Date()
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      text: message,
      type: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)
    
    onLog(`Sending message: "${message}"`, 'info')

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      })

      const result = await response.json()
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: result.response || 'Sorry, I could not process your message.',
        type: 'assistant',
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
      onLog('Response received', 'success')
      
      // Handle audio response if available
      if (result.audio) {
        const audio = new Audio(result.audio)
        audio.play().catch(error => {
          onLog(`Audio playback failed: ${error}`, 'warning')
        })
      }
    } catch (error) {
      onLog(`Chat failed: ${error}`, 'error')
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I encountered an error processing your message. Please try again.',
        type: 'assistant',
        timestamp: new Date()
      }
      
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(inputValue)
    }
  }

  const clearChat = () => {
    setMessages([{
      id: 'welcome',
      text: 'Chat cleared. How can I help you?',
      type: 'system',
      timestamp: new Date()
    }])
    onLog('Chat cleared', 'info')
  }

  const addMessage = (text: string, type: 'user' | 'assistant' | 'system' = 'user') => {
    const message: Message = {
      id: Date.now().toString(),
      text,
      type,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, message])
    
    if (type === 'user') {
      sendMessage(text)
    }
  }

  // Expose addMessage for external use (like from voice input)
  React.useImperativeHandle(React.createRef(), () => ({
    addMessage
  }))

  return (
    <Card className="flex flex-col h-[600px]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Conversation
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={clearChat}
            className="flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 p-4">
        <div className="flex-1 overflow-y-auto space-y-2 mb-4 p-2 border rounded-lg bg-muted/30">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message.text}
              type={message.type}
              timestamp={message.timestamp}
            />
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted text-muted-foreground p-3 rounded-lg animate-pulse">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message or use voice input..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={() => sendMessage(inputValue)}
            disabled={!inputValue.trim() || isLoading}
            size="icon"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Export the component with a ref for external access
export const ChatPanelRef = React.forwardRef<
  { addMessage: (text: string, type?: 'user' | 'assistant' | 'system') => void },
  ChatPanelProps
>((props, ref) => {
  const [component, setComponent] = useState<any>(null)
  
  React.useImperativeHandle(ref, () => ({
    addMessage: component?.addMessage || (() => {})
  }))
  
  return <ChatPanel {...props} ref={setComponent} />
})