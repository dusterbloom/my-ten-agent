import React, { useState, useRef, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { RootState } from '../../store'
import { 
  addChatItem, 
  clearChatItems, 
  IChatItem, 
  EMessageType, 
  EMessageDataType 
} from '../../store/slices/globalSlice'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Send, Trash2, MessageSquare, Bot, User } from 'lucide-react'
import { cn } from '../../lib/utils'

interface EnhancedChatPanelProps {
  className?: string
  onLog?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void
}

export const EnhancedChatPanel: React.FC<EnhancedChatPanelProps> = ({ 
  className, 
  onLog 
}) => {
  const dispatch = useDispatch()
  const { chatItems, connected } = useSelector((state: RootState) => state.global)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollToBottom()
  }, [chatItems])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const generateUserId = () => Math.random().toString(36).substr(2, 9)

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return

    const userMessage: IChatItem = {
      userId: generateUserId(),
      userName: 'You',
      text: inputValue.trim(),
      type: EMessageType.USER,
      data_type: EMessageDataType.TEXT,
      time: Date.now(),
    }

    dispatch(addChatItem(userMessage))
    const messageText = inputValue.trim()
    setInputValue('')
    setIsLoading(true)

    onLog?.(`Sending message: ${messageText}`, 'info')

    try {
      // Send to chat API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: messageText,
          history: chatItems.slice(-10) // Send last 10 messages for context
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      
      const agentMessage: IChatItem = {
        userId: generateUserId(),
        userName: 'TEN Agent',
        text: result.response || 'Sorry, I couldn\'t process that request.',
        type: EMessageType.AGENT,
        data_type: EMessageDataType.TEXT,
        time: Date.now(),
      }

      dispatch(addChatItem(agentMessage))
      onLog?.('Received response from agent', 'success')

    } catch (error) {
      const errorMessage: IChatItem = {
        userId: generateUserId(),
        userName: 'System',
        text: `Error: ${error}`,
        type: EMessageType.SYSTEM,
        data_type: EMessageDataType.TEXT,
        time: Date.now(),
      }
      
      dispatch(addChatItem(errorMessage))
      onLog?.(`Chat error: ${error}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleClearChat = () => {
    dispatch(clearChatItems())
    onLog?.('Chat history cleared', 'info')
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const renderMessage = (message: IChatItem, index: number) => {
    const isUser = message.type === EMessageType.USER
    const isAgent = message.type === EMessageType.AGENT
    const isSystem = message.type === EMessageType.SYSTEM

    return (
      <div
        key={`${message.userId}-${index}`}
        className={cn(
          "flex gap-3 mb-4",
          isUser && "flex-row-reverse"
        )}
      >
        {/* Avatar */}
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
          isUser && "bg-blue-500",
          isAgent && "bg-purple-500", 
          isSystem && "bg-gray-500"
        )}>
          {isUser && <User className="w-4 h-4 text-white" />}
          {isAgent && <Bot className="w-4 h-4 text-white" />}
          {isSystem && <MessageSquare className="w-4 h-4 text-white" />}
        </div>

        {/* Message Bubble */}
        <div className={cn(
          "max-w-[70%] rounded-lg px-4 py-2",
          isUser && "bg-blue-500 text-white",
          isAgent && "bg-gray-100 text-gray-900",
          isSystem && "bg-yellow-100 text-yellow-800 border border-yellow-200"
        )}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium opacity-70">
              {message.userName}
            </span>
            <span className="text-xs opacity-50">
              {formatTime(message.time)}
            </span>
          </div>
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.text}
          </p>
        </div>
      </div>
    )
  }

  return (
    <Card className={cn("flex flex-col h-full", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Chat with TEN Agent
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearChat}
            disabled={chatItems.length === 0}
            className="text-red-500 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto mb-4 border rounded-lg p-4 bg-gray-50 min-h-[300px]">
          {chatItems.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Start a conversation with the TEN Agent</p>
                <p className="text-xs mt-1 opacity-75">
                  Type a message below or use voice commands
                </p>
              </div>
            </div>
          ) : (
            <div>
              {chatItems.map(renderMessage)}
              {isLoading && (
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-gray-100 rounded-lg px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={connected ? "Type your message..." : "Connect to agent first..."}
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="px-4"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Status */}
        <div className="mt-2 text-xs text-gray-500 text-center">
          {connected ? (
            <span className="text-green-600">● Connected - Ready to chat</span>
          ) : (
            <span className="text-red-500">● Disconnected - Connect to start chatting</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}