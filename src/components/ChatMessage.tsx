import React from 'react'
import { cn } from '../lib/utils'
import { formatTime } from '../lib/utils'

interface ChatMessageProps {
  message: string
  type: 'user' | 'assistant' | 'system'
  timestamp: Date
}

export function ChatMessage({ message, type, timestamp }: ChatMessageProps) {
  return (
    <div className={cn(
      'flex mb-4',
      {
        'justify-end': type === 'user',
        'justify-start': type === 'assistant',
        'justify-center': type === 'system'
      }
    )}>
      <div className={cn(
        'max-w-[80%] p-3 rounded-lg',
        {
          'bg-primary text-primary-foreground': type === 'user',
          'bg-muted text-muted-foreground': type === 'assistant',
          'bg-yellow-50 text-yellow-800 border border-yellow-200 text-sm italic': type === 'system'
        }
      )}>
        <p className="whitespace-pre-wrap break-words">{message}</p>
        <p className={cn(
          'text-xs mt-1 opacity-70',
          {
            'text-primary-foreground/70': type === 'user',
            'text-muted-foreground/70': type === 'assistant',
            'text-yellow-600': type === 'system'
          }
        )}>
          {formatTime(timestamp)}
        </p>
      </div>
    </div>
  )
}