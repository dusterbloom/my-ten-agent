import React from 'react'
import { Badge } from './ui/Badge'
import { cn } from '../lib/utils'

interface StatusIndicatorProps {
  status: 'online' | 'offline' | 'loading'
  label: string
  className?: string
}

export function StatusIndicator({ status, label, className }: StatusIndicatorProps) {
  return (
    <div className={cn('flex items-center justify-between p-3 rounded-lg border', className)}>
      <span className="font-medium">{label}</span>
      <Badge
        variant={
          status === 'online' 
            ? 'success' 
            : status === 'offline' 
            ? 'destructive' 
            : 'secondary'
        }
      >
        <div className={cn(
          'w-2 h-2 rounded-full mr-2',
          {
            'bg-green-400': status === 'online',
            'bg-red-400': status === 'offline',
            'bg-yellow-400 animate-pulse': status === 'loading'
          }
        )} />
        {status === 'loading' ? 'Connecting...' : status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    </div>
  )
}