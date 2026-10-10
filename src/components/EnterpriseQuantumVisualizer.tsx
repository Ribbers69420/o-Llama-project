import React, { useState, useCallback, useMemo } from 'react';
import {
  Cpu,
  Network,
  Shield,
  Activity,
  Layers,
  Zap,
  Lock,
  GitBranch,
  BarChart3,
  AlertTriangle,
  Terminal
} from 'lucide-react';

// --- TYPES ---

type LayerClassification = 'Core' | 'Cognitive' | 'Security' | 'Integration' | 'Optimization';

interface PerformanceMetrics {
  computationalEfficiency: number;
  scalabilityIndex: number;
  resilience: number;
  adaptabilityFactor: number;
}

interface SecurityProfile {
  integrityScore: number;
  complianceLevel: number;
  riskMitigationCapacity: number;
}

interface FrameworkComponent {
  id: string;
  name: string;
  classification: LayerClassification;
  description: string;
  architecturalComplexity: number;
  performanceMetrics: PerformanceMetrics;
  securityProfile?: SecurityProfile;
  quantumPotential?: {
    superpositionCapacity: number;
    entanglementCoefficient: number;
  };
  subComponents?: FrameworkComponent[];
  dependencies?: string[];
  complianceStandards?: string[];
  status?: 'active' | 'standby' | 'optimizing';
}

interface FrameworkState {
  expandedComponents: string[];
  selectedComponent?: string;
  viewMode: 'detailed' | 'compact';
}

// --- DATA GENERATION ---

const generateFrameworkStructure = (): FrameworkComponent => ({
  id: 'ROOT-PSI-0',
  name: 'System State |\u03A8_0\u27E9',
  classification: 'Core',
  description: 'High-Availability Quantum-Cognitive Infrastructure initialized from DSL Input Vector.',
  architecturalComplexity: 0.88,
  status: 'active',
  performanceMetrics: {
    computationalEfficiency: 0.92,
    scalabilityIndex: 0.95,
    resilience: 0.98,
    adaptabilityFactor: 0.85
  },
  securityProfile: {
    integrityScore: 0.99,
    complianceLevel: 0.94,
    riskMitigationCapacity: 0.96
  },
  quantumPotential: {
    superpositionCapacity: 0.82,
    entanglementCoefficient: 0.78
  },
  complianceStandards: ['AES-256', 'JWT-MFA', 'K8S-HA'],
  subComponents: [
    {
      id: 'LAYER-SECURITY',
      name: 'Security Substrate (x)',
      classification: 'Security',
      description: 'Foundational security layer derived from input vector x {k, a, h}.',
      architecturalComplexity: 0.91,
      status: 'active',
      performanceMetrics: {
        computationalEfficiency: 0.85,
        scalabilityIndex: 0.90,
        resilience: 0.99,
        adaptabilityFactor: 0.80
      },
      securityProfile: {
        integrityScore: 1.0,
        complianceLevel: 0.98,
        riskMitigationCapacity: 0.99
      },
      subComponents: [
        {
          id: 'SEC-CRYPTO',
          name: 'Cryptographic Core',
          classification: 'Security',
          description: 'AES-256 implementation with key rotation.',
          architecturalComplexity: 0.4,
          performanceMetrics: { computationalEfficiency: 0.9, scalabilityIndex: 1.0, resilience: 1.0, adaptabilityFactor: 0.5 }
        },
        {
          id: 'SEC-IAM',
          name: 'Identity & Access (IAM)',
          classification: 'Security',
          description: 'Role-based access control with JWT and MFA enforcement.',
          architecturalComplexity: 0.6,
          performanceMetrics: { computationalEfficiency: 0.95, scalabilityIndex: 0.9, resilience: 0.95, adaptabilityFactor: 0.85 }
        }
      ]
    },
    {
      id: 'LAYER-OPS',
      name: 'Operations Fabric (ops)',
      classification: 'Integration',
      description: 'Orchestration and Observability layer derived from input vector ops {ha, mon}.',
      architecturalComplexity: 0.75,
      status: 'active',
      performanceMetrics: {
        computationalEfficiency: 0.90,
        scalabilityIndex: 0.98,
        resilience: 0.98,
        adaptabilityFactor: 0.92
      },
      subComponents: [
        {
          id: 'OPS-HA',
          name: 'High Availability Mesh',
          classification: 'Integration',
          description: '3-Replica Failover Cluster configuration.',
          architecturalComplexity: 0.8,
          performanceMetrics: { computationalEfficiency: 0.88, scalabilityIndex: 1.0, resilience: 1.0, adaptabilityFactor: 0.9 }
        },
        {
          id: 'OPS-MON',
          name: 'Observability Stack',
          classification: 'Optimization',
          description: 'Grafana/Prometheus telemetry integration.',
          architecturalComplexity: 0.6,
          performanceMetrics: { computationalEfficiency: 0.95, scalabilityIndex: 0.95, resilience: 0.9, adaptabilityFactor: 1.0 }
        }
      ]
    },
    {
      id: 'LAYER-COGNITIVE',
      name: 'Cognitive Engine (ml)',
      classification: 'Cognitive',
      description: 'Machine Learning processing unit derived from input vector ml {t, p, o}.',
      architecturalComplexity: 0.95,
      status: 'optimizing',
      performanceMetrics: {
        computationalEfficiency: 0.96,
        scalabilityIndex: 0.85,
        resilience: 0.80,
        adaptabilityFactor: 0.94
      },
      quantumPotential: {
        superpositionCapacity: 0.92,
        entanglementCoefficient: 0.88
      },
      subComponents: [
        {
          id: 'ML-TRAIN',
          name: 'Training Loop',
          classification: 'Cognitive',
          description: 'Continuous model training pipeline.',
          architecturalComplexity: 0.9,
          performanceMetrics: { computationalEfficiency: 0.8, scalabilityIndex: 0.85, resilience: 0.8, adaptabilityFactor: 0.9 }
        },
        {
          id: 'ML-INFERENCE',
          name: 'Prediction Service',
          classification: 'Cognitive',
          description: 'Low-latency inference endpoints.',
          architecturalComplexity: 0.7,
          performanceMetrics: { computationalEfficiency: 0.98, scalabilityIndex: 0.95, resilience: 0.9, adaptabilityFactor: 0.8 }
        },
        {
          id: 'ML-ETHICS-GAP',
          name: '\u26A0\uFE0F Ethical Constraint Module',
          classification: 'Core',
          description: 'MISSING in input vector. Placeholder injected for structural integrity.',
          architecturalComplexity: 0.0,
          status: 'standby',
          performanceMetrics: { computationalEfficiency: 0.0, scalabilityIndex: 0.0, resilience: 0.0, adaptabilityFactor: 0.0 },
          securityProfile: { integrityScore: 0.1, complianceLevel: 0.0, riskMitigationCapacity: 0.0 }
        }
      ]
    }
  ]
});

// --- COMPONENTS ---

const MetricBar: React.FC<{ label: string; value: number; colorClass: string }> = ({ label, value, colorClass }) => (
  <div className="mb-2">
    <div className="flex justify-between text-xs font-mono mb-1 text-slate-400">
      <span>{label}</span>
      <span>{(value * 100).toFixed(0)}%</span>
    </div>
    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-1000 ${colorClass}`}
        style={{ width: `${value * 100}%` }}
      />
    </div>
  </div>
);

const QuantumIndicator: React.FC<{ value: number; label: string }> = ({ value, label }) => (
  <div className="flex flex-col items-center justify-center p-3 bg-slate-800/50 rounded border border-slate-700">
    <div className="relative w-12 h-12 flex items-center justify-center mb-2">
      <div className="absolute inset-0 rounded-full border-2 border-indigo-500/30 animate-spin-slow"></div>
      <div
        className="absolute inset-0 rounded-full border-2 border-t-indigo-400 border-r-transparent border-b-transparent border-l-transparent"
        style={{ transform: `rotate(${value * 360}deg)` }}
      ></div>
      <span className="text-xs font-bold text-indigo-300">{(value * 100).toFixed(0)}</span>
    </div>
    <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
  </div>
);

const ComponentNode: React.FC<{
  component: FrameworkComponent;
  depth: number;
  expandedComponents: string[];
  toggleExpansion: (id: string) => void;
}> = ({ component, depth, expandedComponents, toggleExpansion }) => {
  const isExpanded = expandedComponents.includes(component.id);
  const isWarning = component.id === 'ML-ETHICS-GAP';

  const classificationColors: Record<LayerClassification, string> = {
    'Core': 'border-slate-500 text-slate-300',
    'Cognitive': 'border-violet-500 text-violet-300',
    'Security': 'border-emerald-500 text-emerald-300',
    'Integration': 'border-blue-500 text-blue-300',
    'Optimization': 'border-amber-500 text-amber-300'
  };

  const statusColors = {
    'active': 'bg-emerald-500',
    'standby': 'bg-amber-500',
    'optimizing': 'bg-blue-500'
  };

  return (
    <div className={`
      mb-3 transition-all duration-300
      ${depth > 0 ? 'ml-6 border-l-2 border-slate-700 pl-4' : ''}
    `}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onClick={() => toggleExpansion(component.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleExpansion(component.id);
          }
        }}
        className={`
          flex items-center p-3 rounded-lg cursor-pointer border
          hover:bg-slate-800/50 transition-colors
          focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
          ${isWarning ? 'bg-red-900/10 border-red-500/50 hover:bg-red-900/20' : 'bg-slate-900 border-slate-700'}
        `}
      >
        <div className={`p-2 rounded mr-3 border ${classificationColors[component.classification]} bg-slate-950`}>
          {component.classification === 'Security' && <Shield size={16} />}
          {component.classification === 'Cognitive' && <Cpu size={16} />}
          {component.classification === 'Integration' && <Network size={16} />}
          {component.classification === 'Optimization' && <Activity size={16} />}
          {component.classification === 'Core' && <Layers size={16} />}
        </div>

        <div className="flex-grow">
          <div className="flex items-center gap-2">
            <h3 className={`font-mono font-bold text-sm ${isWarning ? 'text-red-400' : 'text-slate-200'}`}>
              {component.name}
            </h3>
            {component.status && (
              <span
                role="img"
                aria-label={`Status: ${component.status}`}
                className={`w-2 h-2 shrink-0 rounded-full ${statusColors[component.status]} animate-pulse`}
              />
            )}
          </div>
          <p className="text-xs text-slate-500 line-clamp-1">{component.description}</p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-slate-500">
          <div className="hidden md:flex flex-col items-end">
            <span className="uppercase text-[10px]">Complexity</span>
            <span className={component.architecturalComplexity > 0.8 ? 'text-amber-400' : 'text-slate-400'}>
              {component.architecturalComplexity.toFixed(2)}
            </span>
          </div>
          <div aria-hidden="true" className={`transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
            &rarr;
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className={`mt-2 p-4 rounded-lg border ${isWarning ? 'bg-red-950/20 border-red-900/30' : 'bg-slate-800/30 border-slate-700/50'}`}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h4 className="text-xs font-bold uppercase text-slate-500 mb-3 flex items-center gap-2">
                <BarChart3 size={12} /> Performance Vector
              </h4>
              <MetricBar
                label="COMPUTATIONAL EFFICIENCY"
                value={component.performanceMetrics.computationalEfficiency}
                colorClass="bg-blue-500"
              />
              <MetricBar
                label="SCALABILITY INDEX"
                value={component.performanceMetrics.scalabilityIndex}
                colorClass="bg-emerald-500"
              />
              <MetricBar
                label="RESILIENCE"
                value={component.performanceMetrics.resilience}
                colorClass="bg-violet-500"
              />
            </div>

            <div className="space-y-4">
              {component.securityProfile && (
                <div>
                  <h4 className="text-xs font-bold uppercase text-slate-500 mb-3 flex items-center gap-2">
                    <Lock size={12} /> Security Profile
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-900 p-2 rounded text-center">
                      <div className="text-[10px] text-slate-500">INTEGRITY</div>
                      <div className="text-sm font-mono text-emerald-400">
                        {(component.securityProfile.integrityScore * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="bg-slate-900 p-2 rounded text-center">
                      <div className="text-[10px] text-slate-500">RISK MITIGATION</div>
                      <div className="text-sm font-mono text-blue-400">
                        {(component.securityProfile.riskMitigationCapacity * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {component.quantumPotential && (
                <div>
                  <h4 className="text-xs font-bold uppercase text-slate-500 mb-2 flex items-center gap-2">
                    <Zap size={12} /> Quantum Potential
                  </h4>
                  <div className="flex gap-2">
                    <QuantumIndicator value={component.quantumPotential.superpositionCapacity} label="SUPERPOS" />
                    <QuantumIndicator value={component.quantumPotential.entanglementCoefficient} label="ENTANGLE" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {isWarning && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded flex items-start gap-3">
              <AlertTriangle className="text-red-500 shrink-0" size={20} />
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-red-400">Integrity Gap Detected</h4>
                <p className="text-xs text-red-200/70 mt-1 break-words">
                  High capability ML modules detected (Training/Prediction/Optimization) without explicit Ethical Constraint definitions in the input vector. System may exhibit high-entropy behavior in edge cases.
                </p>
              </div>
            </div>
          )}

          {component.complianceStandards && (
            <div className="mt-4 flex flex-wrap gap-2">
              {component.complianceStandards.map(std => (
                <span key={std} className="px-2 py-1 bg-slate-700 text-slate-300 text-[10px] rounded font-mono border border-slate-600">
                  {std}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {component.subComponents && (
        <div className="mt-2">
          {component.subComponents.map(sub => (
            <ComponentNode
              key={sub.id}
              component={sub}
              depth={depth + 1}
              expandedComponents={expandedComponents}
              toggleExpansion={toggleExpansion}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// --- MAIN APP ---

const EnterpriseQuantumVisualizer: React.FC = () => {
  const [frameworkState, setFrameworkState] = useState<FrameworkState>({
    expandedComponents: ['ROOT-PSI-0', 'LAYER-COGNITIVE'],
    viewMode: 'detailed'
  });

  const structure = useMemo(() => generateFrameworkStructure(), []);

  const toggleExpansion = useCallback((id: string) => {
    setFrameworkState(prev => ({
      ...prev,
      expandedComponents: prev.expandedComponents.includes(id)
        ? prev.expandedComponents.filter(c => c !== id)
        : [...prev.expandedComponents, id]
    }));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans p-4 md:p-8">
      <div className="max-w-5xl mx-auto">

        <header className="mb-8 border-b border-slate-800 pb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20">
                  <Terminal size={24} className="text-white" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  Quantum-Interface <span className="text-indigo-400">Visualizer</span>
                </h1>
              </div>
              <p className="text-slate-500 font-mono text-xs">
                System State {'|\u03A8_0\u27E9'} &bull; AES-256 &bull; HA-3 &bull; ML-Optimized
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-emerald-400 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                SYSTEM ONLINE
              </div>
              <div className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-blue-400">
                v2.4.0
              </div>
            </div>
          </div>
        </header>

        <div className="mb-8 p-4 bg-gradient-to-r from-indigo-900/20 to-violet-900/20 border border-indigo-500/20 rounded-lg flex items-start gap-4">
          <GitBranch className="text-indigo-400 shrink-0 mt-1" size={20} />
          <div>
            <h2 className="text-sm font-bold text-indigo-300 mb-1">Architectural Alignment</h2>
            <p className="text-xs text-indigo-200/70 italic">
              "The asymptote is the only honest geometry. We optimize for truth, not just satisfaction."
            </p>
          </div>
        </div>

        <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Layers size={18} className="text-slate-400" />
              Architectural Topology
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFrameworkState(prev => ({ ...prev, expandedComponents: [] }))}
                className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors"
              >
                Collapse All
              </button>
            </div>
          </div>

          <ComponentNode
            component={structure}
            depth={0}
            expandedComponents={frameworkState.expandedComponents}
            toggleExpansion={toggleExpansion}
          />
        </div>

        <footer className="mt-12 text-center text-xs text-slate-600 font-mono">
          <p>ENTERPRISE QUANTUM FRAMEWORK &bull; RENDERED IN REACT &bull; UNITARY SEMANTIC SYSTEMS</p>
        </footer>
      </div>
    </div>
  );
};

export default EnterpriseQuantumVisualizer;
