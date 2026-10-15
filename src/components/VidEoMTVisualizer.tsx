import React from 'react';
import { Zap, Layers, Play, BarChart3, FlaskConical } from 'lucide-react';
import SimplificationTable from './videomt/SimplificationTable';
import ArchitectureDiagram from './videomt/ArchitectureDiagram';
import QueryPropagationDemo from './videomt/QueryPropagationDemo';
import PerformanceChart from './videomt/PerformanceChart';
import Analyses from './videomt/Analyses';
import { ABLATION_TABLE } from './videomt/data';

const CAVIS_ROW = ABLATION_TABLE[0];
const VIDEOMT_ROW = ABLATION_TABLE[ABLATION_TABLE.length - 1];
const PARAMS_SAVED_M = parseInt(CAVIS_ROW.params, 10) - parseInt(VIDEOMT_ROW.params, 10);

const Section: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}> = ({ icon, title, subtitle, children }) => (
  <section className="bg-slate-900/50 rounded-xl border border-slate-800 p-6 shadow-2xl">
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 rounded-lg bg-slate-800 text-cyan-400">{icon}</div>
      <div>
        <h2 className="text-base font-semibold text-slate-200">{title}</h2>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>
    </div>
    {children}
  </section>
);

const VidEoMTVisualizer: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <header className="text-center space-y-3 pb-4">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            <span className="text-cyan-400">VidEoMT</span>
            <span className="text-slate-400 font-normal"> Architecture Explorer</span>
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Your ViT is Secretly Also a Video Segmentation Model — an encoder-only architecture
            that unifies segmentation and temporal tracking within a single Vision Transformer,
            achieving up to <span className="text-cyan-400 font-mono">10x</span> speedup (5x&ndash;10x across benchmarks) at competitive accuracy.
          </p>
          <div className="flex items-center justify-center gap-4 text-[10px] font-mono text-slate-400">
            <span>arxiv:2602.17807</span>
            <span className="text-slate-600" aria-hidden="true">|</span>
            <span>Norouzi, Zulfikar, Cavagnero et al.</span>
            <span className="text-slate-600" aria-hidden="true">|</span>
            <span>TU Eindhoven & RWTH Aachen</span>
          </div>
        </header>

        {/* Key insight banner */}
        <div className="bg-gradient-to-r from-cyan-950/40 via-cyan-900/20 to-cyan-950/40 rounded-xl border border-cyan-800/30 p-4 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 text-center">
          <div>
            <div className="text-3xl font-bold font-mono text-cyan-400">{VIDEOMT_ROW.fps}</div>
            <div className="text-[10px] uppercase tracking-wider text-cyan-300">FPS</div>
          </div>
          <div className="text-slate-400 text-lg">vs</div>
          <div>
            <div className="text-3xl font-bold font-mono text-slate-500">{CAVIS_ROW.fps}</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">FPS (CAVIS)</div>
          </div>
          <div className="w-px h-10 bg-slate-700 hidden md:block" />
          <div>
            <div className="text-lg font-bold font-mono text-cyan-400">{VIDEOMT_ROW.ap} <span className="text-sm text-slate-400">AP</span></div>
            <div className="text-[10px] text-slate-400">vs {CAVIS_ROW.ap} AP (CAVIS)</div>
          </div>
          <div className="w-px h-10 bg-slate-700 hidden md:block" />
          <div>
            <div className="text-lg font-bold font-mono text-emerald-400">−{PARAMS_SAVED_M}M</div>
            <div className="text-[10px] text-slate-400">fewer params</div>
          </div>
        </div>

        <p className="-mt-3 text-center text-[11px] leading-relaxed text-slate-400">
          Banner: YouTube-VIS 2019 val, ViT-L (DINOv2). FPS measured on an H100 with FlashAttention-2 and torch.compile
          (paper Table 1 and &sect;4). Speed-ups on the other benchmarks are below.
        </p>

        {/* Section 1: Simplification Table */}
        <Section
          icon={<Layers className="w-4 h-4" />}
          title="From CAVIS to VidEoMT"
          subtitle="YouTube-VIS 2019 val (paper Table 1). Remove specialised modules (steps 1–4), then add query propagation and fusion (5–6). Select a step for details."
        >
          <SimplificationTable />
        </Section>

        {/* Section 2: Architecture Diagram */}
        <Section
          icon={<Zap className="w-4 h-4" />}
          title="Encoder-Only Architecture"
          subtitle="Hover, focus or tap a block to read what the paper says about it"
        >
          <ArchitectureDiagram />
        </Section>

        {/* Section 3: Query Propagation Demo */}
        <Section
          icon={<Play className="w-4 h-4" />}
          title="Query Propagation in Action"
          subtitle="Each query slot keeps following the same object from frame to frame"
        >
          <QueryPropagationDemo />
        </Section>

        {/* Section 4: Performance Charts */}
        <Section
          icon={<BarChart3 className="w-4 h-4" />}
          title="Benchmark Performance"
          subtitle="Accuracy vs speed on 6 video segmentation benchmarks (paper Tables 2–5)"
        >
          <PerformanceChart />
        </Section>

        {/* Section 5: Further analyses */}
        <Section
          icon={<FlaskConical className="w-4 h-4" />}
          title="Further Analyses"
          subtitle="The paper's own ablations on pre-training, model size, propagation strategy and where the temporal trick lives (§5.3 and Appendix B)"
        >
          <Analyses />
        </Section>

        {/* Footer */}
        <footer className="text-center text-[10px] text-slate-400 font-mono pt-4 pb-8 leading-relaxed">
          Interactive visualization of VidEoMT (Norouzi et al., 2026, arXiv:2602.17807).
          The ablation and benchmark numbers are transcribed from the paper&rsquo;s Tables 1&ndash;5.
          <br />
          The query-propagation demo is a schematic: its objects and confidences are made up.
        </footer>
      </div>
    </div>
  );
};

export default VidEoMTVisualizer;
