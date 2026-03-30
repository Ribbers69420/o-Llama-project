import { useState } from 'react'
import EnterpriseQuantumVisualizer from './components/EnterpriseQuantumVisualizer'
import VidEoMTVisualizer from './components/VidEoMTVisualizer'
import './index.css'

function App() {
  const [view, setView] = useState<'quantum' | 'videomt'>('videomt')

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-sm border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 flex items-center h-10">
          <div className="flex gap-1">
            <button
              onClick={() => setView('quantum')}
              className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${
                view === 'quantum'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Quantum Visualizer
            </button>
            <button
              onClick={() => setView('videomt')}
              className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${
                view === 'videomt'
                  ? 'bg-cyan-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              VidEoMT Explorer
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      {view === 'quantum' ? <EnterpriseQuantumVisualizer /> : <VidEoMTVisualizer />}
    </div>
  )
}

export default App
