import React, { useState } from 'react';
import { BENCHMARK_RESULTS, DATASET_LABELS } from './data';
import type { DatasetKey } from './types';

const DATASETS: DatasetKey[] = ['ytvis19', 'ytvis21', 'ytvis22', 'ovis', 'vipseg', 'vspw'];

const ScatterPlot: React.FC = () => {
  const [hovered, setHovered] = useState<string | null>(null);

  // Use YouTube-VIS 2019 for scatter
  const data = BENCHMARK_RESULTS.filter((r) => r.dataset === 'ytvis19');
  const minAP = 40;
  const maxAP = 75;
  const minFPS = 8;
  const maxFPS = 200;

  const toX = (fps: number) => {
    const logMin = Math.log10(minFPS);
    const logMax = Math.log10(maxFPS);
    return ((Math.log10(fps) - logMin) / (logMax - logMin)) * 100;
  };
  const toY = (ap: number) => 100 - ((ap - minAP) / (maxAP - minAP)) * 100;

  return (
    <div className="relative bg-slate-800/30 rounded-lg border border-slate-700 p-4">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-3 font-mono">
        AP vs FPS — YouTube-VIS 2019 (ViT-L)
      </div>
      <div className="relative w-full" style={{ paddingBottom: '50%' }}>
        <div className="absolute inset-0">
          {/* Grid lines */}
          {[50, 55, 60, 65, 70].map((ap) => (
            <div key={ap} className="absolute w-full border-t border-slate-700/50" style={{ top: `${toY(ap)}%` }}>
              <span className="absolute -left-1 -translate-x-full text-[8px] font-mono text-slate-600 -translate-y-1/2">
                {ap}
              </span>
            </div>
          ))}
          {[10, 20, 50, 100, 160].map((fps) => (
            <div key={fps} className="absolute h-full border-l border-slate-700/50" style={{ left: `${toX(fps)}%` }}>
              <span className="absolute bottom-0 translate-y-full text-[8px] font-mono text-slate-600 -translate-x-1/2">
                {fps}
              </span>
            </div>
          ))}

          {/* Data points */}
          {data.map((d) => {
            const isHovered = hovered === d.method;
            return (
              <div
                key={d.method}
                className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-200 cursor-pointer"
                style={{ left: `${toX(d.fps)}%`, top: `${toY(d.metric)}%` }}
                onMouseEnter={() => setHovered(d.method)}
                onMouseLeave={() => setHovered(null)}
              >
                <div
                  className={`rounded-full transition-all duration-200 ${
                    d.isVidEoMT
                      ? 'bg-cyan-400 shadow-lg shadow-cyan-400/40'
                      : 'bg-slate-400'
                  } ${isHovered ? 'scale-150' : ''}`}
                  style={{
                    width: d.isVidEoMT ? 14 : 8,
                    height: d.isVidEoMT ? 14 : 8,
                  }}
                />
                {(isHovered || d.isVidEoMT) && (
                  <div className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-mono ${
                    d.isVidEoMT ? '-top-5 text-cyan-400 font-bold' : '-top-4 text-slate-300'
                  }`}>
                    {d.method}
                    {isHovered && (
                      <span className="text-slate-500"> AP:{d.metric} FPS:{d.fps}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Axis labels */}
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] font-mono text-slate-500">
            FPS (log scale)
          </div>
          <div className="absolute -left-8 top-1/2 -translate-y-1/2 -rotate-90 text-[9px] font-mono text-slate-500">
            AP
          </div>
        </div>
      </div>
    </div>
  );
};

const BarChart: React.FC = () => {
  const [activeDataset, setActiveDataset] = useState<DatasetKey>('ytvis19');

  const data = BENCHMARK_RESULTS
    .filter((r) => r.dataset === activeDataset)
    .sort((a, b) => b.metric - a.metric);

  const maxMetric = Math.max(...data.map((d) => d.metric));

  return (
    <div className="bg-slate-800/30 rounded-lg border border-slate-700 p-4">
      {/* Dataset toggle */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {DATASETS.map((ds) => (
          <button
            key={ds}
            onClick={() => setActiveDataset(ds)}
            className={`px-2.5 py-1 rounded text-[10px] font-mono transition-colors ${
              activeDataset === ds
                ? 'bg-cyan-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
          >
            {DATASET_LABELS[ds]}
          </button>
        ))}
      </div>

      {/* Bars */}
      <div className="space-y-2">
        {data.map((d) => (
          <div key={d.method} className="flex items-center gap-3">
            <div className={`w-20 text-right text-xs font-mono shrink-0 ${d.isVidEoMT ? 'text-cyan-400 font-bold' : 'text-slate-400'}`}>
              {d.method}
            </div>
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 h-5 bg-slate-800 rounded overflow-hidden">
                <div
                  className={`h-full rounded transition-all duration-500 flex items-center justify-end pr-2 ${
                    d.isVidEoMT ? 'bg-cyan-500' : 'bg-slate-600'
                  }`}
                  style={{ width: `${(d.metric / maxMetric) * 100}%` }}
                >
                  <span className="text-[9px] font-mono text-white/90">{d.metric}</span>
                </div>
              </div>
              <div className={`w-16 text-right text-[10px] font-mono shrink-0 ${
                d.isVidEoMT ? 'text-cyan-400' : 'text-slate-500'
              }`}>
                {d.fps} FPS
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Metric label */}
      <div className="text-[9px] font-mono text-slate-600 mt-3 text-center">
        {data[0]?.metricName} — {DATASET_LABELS[activeDataset]}
      </div>
    </div>
  );
};

const PerformanceChart: React.FC = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ScatterPlot />
      <BarChart />
    </div>
  );
};

export default PerformanceChart;
