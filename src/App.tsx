import { useState } from 'react';
import EnterpriseQuantumVisualizer from './components/EnterpriseQuantumVisualizer';
import UnifiedSystemComponent from './components/UnifiedSystemComponent';
import PhiPipelineSimulator from './components/PhiPipelineSimulator';
import './index.css';

type View = 'visualizer' | 'unified' | 'pipeline';

function App() {
  const [view, setView] = useState<View>('visualizer');

  return (
    <div className="relative min-h-screen bg-slate-950">
      {/* A sticky bar on phones so it cannot cover page headers; floating top-right from md up. */}
      <nav className="sticky top-0 md:fixed md:top-3 md:right-3 z-50 flex justify-center md:justify-start gap-1 p-1 bg-slate-900/90 backdrop-blur border-b md:border border-slate-700 md:rounded-lg shadow-xl">
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
      </nav>

      {view === 'visualizer' && <EnterpriseQuantumVisualizer />}
      {view === 'unified' && <UnifiedSystemComponent />}
      {view === 'pipeline' && <PhiPipelineSimulator />}
    </div>
  );
}

export default App;
