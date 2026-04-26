import { useState } from 'react';
import EnterpriseQuantumVisualizer from './components/EnterpriseQuantumVisualizer';
import UnifiedSystemComponent from './components/UnifiedSystemComponent';
import './index.css';

type View = 'visualizer' | 'unified';

function App() {
  const [view, setView] = useState<View>('visualizer');

  return (
    <div className="relative min-h-screen bg-slate-950">
      <nav className="fixed top-3 right-3 z-50 flex gap-1 p-1 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg shadow-xl">
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
      </nav>

      {view === 'visualizer' ? <EnterpriseQuantumVisualizer /> : <UnifiedSystemComponent />}
    </div>
  );
}

export default App;
