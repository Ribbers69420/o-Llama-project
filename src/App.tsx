import { useState } from 'react';
import EnterpriseQuantumVisualizer from './components/EnterpriseQuantumVisualizer';
import UnifiedSystemComponent from './components/UnifiedSystemComponent';
import PhiPipelineSimulator from './components/PhiPipelineSimulator';
import VidEoMTVisualizer from './components/VidEoMTVisualizer';
import './index.css';

type View = 'visualizer' | 'unified' | 'pipeline' | 'videomt';

function App() {
  const [view, setView] = useState<View>('visualizer');

  return (
    <div className="relative min-h-screen bg-slate-950">
      {/* A full-width sticky bar, so the four views fit without covering any page header.
          The safe-area inset keeps it below a phone's status bar when the page runs edge to edge. */}
      <nav className="sticky top-[env(safe-area-inset-top,0px)] z-50 flex flex-wrap justify-center gap-1 px-4 py-1 bg-slate-900/90 backdrop-blur border-b border-slate-700">
        <button
          type="button"
          onClick={() => setView('visualizer')}
          className={`px-3 py-1.5 text-[11px] font-mono rounded transition-colors ${
            view === 'visualizer'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          VISUALIZER
        </button>
        <button
          type="button"
          onClick={() => setView('unified')}
          className={`px-3 py-1.5 text-[11px] font-mono rounded transition-colors ${
            view === 'unified'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          UNIFIED SYSTEM
        </button>
        <button
          type="button"
          onClick={() => setView('pipeline')}
          className={`px-3 py-1.5 text-[11px] font-mono rounded transition-colors ${
            view === 'pipeline'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          Φ PIPELINE
        </button>
        <button
          type="button"
          onClick={() => setView('videomt')}
          className={`px-3 py-1.5 text-[11px] font-mono rounded transition-colors ${
            view === 'videomt'
              ? 'bg-cyan-600 text-white'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          VIDEOMT EXPLORER
        </button>
      </nav>

      {view === 'visualizer' && <EnterpriseQuantumVisualizer />}
      {view === 'unified' && <UnifiedSystemComponent />}
      {view === 'pipeline' && <PhiPipelineSimulator />}
      {view === 'videomt' && <VidEoMTVisualizer />}
    </div>
  );
}

export default App;
