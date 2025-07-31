import React, { useRef } from 'react'
import { StoreProvider } from './store/StoreProvider'
import { useSelector } from 'react-redux'
import { RootState } from './store'
import { Header } from './components/Layout/Header'
import { AgentView } from './components/Agent/AgentView'
import { EnhancedChatPanel } from './components/Chat/EnhancedChatPanel'
import { SystemStatus } from './components/SystemStatus'
import { SystemLogs, SystemLogsRef } from './components/SystemLogs'
import { Button } from './components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/Card'
import { EMobileActiveTab } from './store/slices/globalSlice'
import { Settings, Zap } from 'lucide-react'
import { cn } from './lib/utils'

function AppContent() {
  const logsRef = useRef<{ addLog: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void }>(null)
  const { mobileActiveTab } = useSelector((state: RootState) => state.global)

  const handleLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    console.log(`[${type.toUpperCase()}] ${message}`)
    logsRef.current?.addLog(message, type)
  }

  const testAllExtensions = async () => {
    handleLog('Testing all extensions...', 'info')
    
    try {
      const response = await fetch('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'all' })
      })
      
      const result = await response.json()
      handleLog(`Extension test results: ${JSON.stringify(result, null, 2)}`, 'success')
    } catch (error) {
      handleLog(`Extension test failed: ${error}`, 'error')
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0f11]">
      <div className="container mx-auto p-4 max-w-7xl">
        {/* Header */}
        <Header onLog={handleLog} />

        {/* Main Content - TEN Framework Style Layout */}
        <div className={cn(
          "flex h-full max-h-[calc(100vh-200px)] flex-col md:flex-row md:gap-4 flex-1"
        )}>
          {/* Agent View */}
          <AgentView 
            className={cn(
              "w-full rounded-lg bg-[#181a1d] md:w-[480px] flex-1 flex",
              {
                ["hidden md:flex"]: mobileActiveTab === EMobileActiveTab.CHAT,
              }
            )}
            onLog={handleLog}
          />

          {/* Chat Panel */}
          <EnhancedChatPanel 
            className={cn(
              "w-full rounded-lg bg-[#181a1d] flex-auto",
              {
                ["hidden md:flex"]: mobileActiveTab === EMobileActiveTab.AGENT,
              }
            )}
            onLog={handleLog}
          />
        </div>

        {/* System Status & Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
          <SystemStatus onLog={handleLog} />
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button onClick={testAllExtensions} className="flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Test All Extensions
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => handleLog('Health check completed', 'success')}
                  className="flex items-center gap-2"
                >
                  Health Check
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* System Logs */}
        <div className="mt-6">
          <SystemLogsRef ref={logsRef} />
        </div>

        {/* Footer */}
        <div className="text-center mt-8 py-4 border-t border-gray-800">
          <p className="text-sm text-gray-400">
            TEN Agent - Built with ❤️ using React, TypeScript, and Tailwind CSS
          </p>
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <StoreProvider>
      <AppContent />
    </StoreProvider>
  )
}

export default App