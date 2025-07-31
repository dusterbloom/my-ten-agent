import React from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { RootState } from '../../store'
import { 
  setCurrentLanguage, 
  setCurrentVoice, 
  setCurrentGraph,
  setMobileActiveTab,
  EMobileActiveTab
} from '../../store/slices/globalSlice'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { 
  Settings, 
  Globe, 
  Mic, 
  Bot, 
  Github,
  Zap,
  MessageSquare,
  Video
} from 'lucide-react'
import { cn } from '../../lib/utils'

interface HeaderProps {
  className?: string
  onLog?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void
}

const LANGUAGE_OPTIONS = [
  { label: "English", value: "en-US" },
  { label: "Chinese", value: "zh-CN" },
  { label: "Korean", value: "ko-KR" },
  { label: "Japanese", value: "ja-JP" },
]

const VOICE_OPTIONS = [
  { label: "Female", value: "female" },
  { label: "Male", value: "male" },
]

const GRAPH_OPTIONS = [
  { label: "Voice Agent - Local LLM + Local TTS", value: "va_local" },
  { label: "Voice Agent with Vision - Local LLM + Local TTS", value: "camera_va_local" },
]

export const Header: React.FC<HeaderProps> = ({ className, onLog }) => {
  const dispatch = useDispatch()
  const { 
    currentLanguage, 
    currentVoice, 
    currentGraph,
    mobileActiveTab,
    connected 
  } = useSelector((state: RootState) => state.global)

  const handleLanguageChange = (language: string) => {
    dispatch(setCurrentLanguage(language))
    onLog?.(`Language changed to: ${LANGUAGE_OPTIONS.find(l => l.value === language)?.label}`, 'info')
  }

  const handleVoiceChange = (voice: string) => {
    dispatch(setCurrentVoice(voice))
    onLog?.(`Voice changed to: ${voice}`, 'info')
  }

  const handleGraphChange = (graph: string) => {
    dispatch(setCurrentGraph(graph))
    onLog?.(`Graph changed to: ${GRAPH_OPTIONS.find(g => g.value === graph)?.label}`, 'info')
  }

  return (
    <Card className={cn("mb-6", className)}>
      <div className="p-4">
        {/* Top Section - Title and GitHub */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                TEN Agent Playground
              </h1>
              <p className="text-sm text-gray-600">
                Voice and text AI agent with local services
              </p>
            </div>
          </div>
          
          <Button
            variant="outline"
            onClick={() => window.open('https://github.com/TEN-framework/TEN-Agent', '_blank')}
            className="flex items-center gap-2"
          >
            <Github className="w-4 h-4" />
            GitHub
          </Button>
        </div>

        {/* Mobile Tab Selector */}
        <div className="md:hidden mb-4">
          <div className="flex rounded-lg bg-gray-100 p-1">
            <button
              onClick={() => dispatch(setMobileActiveTab(EMobileActiveTab.AGENT))}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-colors",
                mobileActiveTab === EMobileActiveTab.AGENT
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600"
              )}
            >
              <Video className="w-4 h-4" />
              Agent
            </button>
            <button
              onClick={() => dispatch(setMobileActiveTab(EMobileActiveTab.CHAT))}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-colors",
                mobileActiveTab === EMobileActiveTab.CHAT
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600"
              )}
            >
              <MessageSquare className="w-4 h-4" />
              Chat
            </button>
          </div>
        </div>

        {/* Configuration Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Language Selection */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Globe className="w-4 h-4" />
              Language
            </label>
            <select
              value={currentLanguage}
              onChange={(e) => handleLanguageChange(e.target.value)}
              disabled={connected}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Voice Selection */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Mic className="w-4 h-4" />
              Voice
            </label>
            <select
              value={currentVoice}
              onChange={(e) => handleVoiceChange(e.target.value)}
              disabled={connected}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              {VOICE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Graph Selection */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Bot className="w-4 h-4" />
              Agent Type
            </label>
            <select
              value={currentGraph}
              onChange={(e) => handleGraphChange(e.target.value)}
              disabled={connected}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              {GRAPH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Bar */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <span className="text-gray-600">Status:</span>
              <span className={cn(
                "px-2 py-1 rounded-full text-xs font-medium",
                connected ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"
              )}>
                {connected ? "Connected" : "Disconnected"}
              </span>
            </div>
            
            <div className="flex items-center gap-4 text-gray-600">
              <span>Language: {LANGUAGE_OPTIONS.find(l => l.value === currentLanguage)?.label}</span>
              <span>Voice: {currentVoice}</span>
            </div>
          </div>
        </div>

        {connected && (
          <div className="mt-2 text-xs text-center text-amber-600 bg-amber-50 py-2 rounded">
            ⚠️ Configuration is locked while connected to agent
          </div>
        )}
      </div>
    </Card>
  )
}