import React, { useCallback, useState } from 'react';
import {
  AlertTriangle,
  Layers,
  Plus,
  Send,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react';

// --- TYPES ---

export type Priority = 'high' | 'medium' | 'low';

export interface Constraint {
  id: string;
  type: string;
  value: string;
}

export interface Objective {
  id: string;
  name: string;
  priority: Priority;
}

export interface Advantage {
  id: string;
  advantage: string;
  timeframe?: string;
}

export interface UnifiedSystem {
  domain: string;
  constraints: Constraint[];
  objectives: Objective[];
  advantages: {
    immediate: Advantage[];
    longTerm: Advantage[];
  };
}

export interface UnifiedSystemSubmitResult {
  ok: boolean;
  message?: string;
}

export interface UnifiedSystemComponentProps {
  /**
   * Optional submit hook. When omitted, the component runs purely in-memory
   * (no network call). Useful for embedding inside a larger app without a
   * dedicated `/api/unified-system` endpoint.
   */
  onSubmit?: (system: UnifiedSystem) => Promise<UnifiedSystemSubmitResult> | UnifiedSystemSubmitResult;
}

// --- HELPERS ---

const DOMAINS: { value: string; label: string }[] = [
  { value: 'system_optimization', label: 'System Optimization' },
  { value: 'network_management', label: 'Network Management' },
  { value: 'security_enhancement', label: 'Security Enhancement' },
];

const PRIORITY_STYLES: Record<Priority, string> = {
  high: 'border-red-500/40 text-red-300 bg-red-900/20',
  medium: 'border-amber-500/40 text-amber-300 bg-amber-900/20',
  low: 'border-emerald-500/40 text-emerald-300 bg-emerald-900/20',
};

const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const emptySystem = (): UnifiedSystem => ({
  domain: '',
  constraints: [],
  objectives: [],
  advantages: { immediate: [], longTerm: [] },
});

// --- PRIMITIVES ---

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
      {label}
    </span>
    {children}
  </label>
);

const TextInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...rest }) => (
  <input
    {...rest}
    className={`w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors ${className}`}
  />
);

const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({
  className = '',
  children,
  ...rest
}) => (
  <select
    {...rest}
    className={`w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors ${className}`}
  >
    {children}
  </select>
);

const IconButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'danger' | 'neutral' }
> = ({ tone = 'neutral', className = '', children, ...rest }) => {
  const toneClass =
    tone === 'danger'
      ? 'border-red-700/60 text-red-400 hover:bg-red-900/30 hover:border-red-500'
      : 'border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200';
  return (
    <button
      type="button"
      {...rest}
      className={`p-2 rounded border bg-slate-900 transition-colors ${toneClass} ${className}`}
    >
      {children}
    </button>
  );
};

// --- SECTION HEADER ---

const SectionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  count: number;
  onAdd: () => void;
  addLabel: string;
}> = ({ icon, title, count, onAdd, addLabel }) => (
  <div className="flex items-center justify-between mb-3">
    <h3 className="flex items-center gap-2 text-sm font-bold text-slate-200">
      <span className="text-indigo-400">{icon}</span>
      {title}
      <span className="text-xs font-mono text-slate-500">[{count}]</span>
    </h3>
    <button
      type="button"
      onClick={onAdd}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 hover:bg-indigo-900/40 border border-slate-700 hover:border-indigo-500/50 rounded font-mono text-slate-300 transition-colors"
    >
      <Plus size={12} />
      {addLabel}
    </button>
  </div>
);

// --- MAIN ---

const UnifiedSystemComponent: React.FC<UnifiedSystemComponentProps> = ({ onSubmit }) => {
  const [system, setSystem] = useState<UnifiedSystem>(emptySystem);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // --- Constraint handlers ---
  const addConstraint = useCallback(() => {
    setSystem((prev) => ({
      ...prev,
      constraints: [...prev.constraints, { id: newId(), type: '', value: '' }],
    }));
  }, []);

  const updateConstraint = useCallback((id: string, patch: Partial<Constraint>) => {
    setSystem((prev) => ({
      ...prev,
      constraints: prev.constraints.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }, []);

  const removeConstraint = useCallback((id: string) => {
    setSystem((prev) => ({
      ...prev,
      constraints: prev.constraints.filter((c) => c.id !== id),
    }));
  }, []);

  // --- Objective handlers ---
  const addObjective = useCallback(() => {
    setSystem((prev) => ({
      ...prev,
      objectives: [...prev.objectives, { id: newId(), name: '', priority: 'medium' }],
    }));
  }, []);

  const updateObjective = useCallback((id: string, patch: Partial<Objective>) => {
    setSystem((prev) => ({
      ...prev,
      objectives: prev.objectives.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    }));
  }, []);

  const removeObjective = useCallback((id: string) => {
    setSystem((prev) => ({
      ...prev,
      objectives: prev.objectives.filter((o) => o.id !== id),
    }));
  }, []);

  // --- Advantage handlers ---
  type AdvantageBucket = 'immediate' | 'longTerm';

  const addAdvantage = useCallback((bucket: AdvantageBucket) => {
    setSystem((prev) => ({
      ...prev,
      advantages: {
        ...prev.advantages,
        [bucket]: [
          ...prev.advantages[bucket],
          { id: newId(), advantage: '', ...(bucket === 'longTerm' ? { timeframe: '' } : {}) },
        ],
      },
    }));
  }, []);

  const updateAdvantage = useCallback(
    (bucket: AdvantageBucket, id: string, patch: Partial<Advantage>) => {
      setSystem((prev) => ({
        ...prev,
        advantages: {
          ...prev.advantages,
          [bucket]: prev.advantages[bucket].map((a) => (a.id === id ? { ...a, ...patch } : a)),
        },
      }));
    },
    []
  );

  const removeAdvantage = useCallback((bucket: AdvantageBucket, id: string) => {
    setSystem((prev) => ({
      ...prev,
      advantages: {
        ...prev.advantages,
        [bucket]: prev.advantages[bucket].filter((a) => a.id !== id),
      },
    }));
  }, []);

  // --- Validation ---
  const validate = (s: UnifiedSystem): string | null => {
    if (!s.domain) return 'Select a domain before submitting.';
    if (s.constraints.some((c) => !c.type.trim() || !c.value.trim()))
      return 'Every constraint needs a type and a value.';
    if (s.objectives.some((o) => !o.name.trim()))
      return 'Every objective needs a name.';
    if (
      s.advantages.immediate.some((a) => !a.advantage.trim()) ||
      s.advantages.longTerm.some((a) => !a.advantage.trim())
    )
      return 'Every advantage needs a description.';
    return null;
  };

  const handleSubmit = useCallback(async () => {
    setError(null);
    setSuccess(null);

    const validationError = validate(system);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      if (onSubmit) {
        const result = await onSubmit(system);
        if (!result.ok) {
          setError(result.message ?? 'Submission rejected by handler.');
          return;
        }
        setSuccess(result.message ?? 'Unified system submitted.');
      } else {
        // No backend wired — confirm in-memory acceptance.
        setSuccess('Unified system captured (no submit handler configured).');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected submission error.');
    } finally {
      setLoading(false);
    }
  }, [onSubmit, system]);

  const handleReset = useCallback(() => {
    setSystem(emptySystem());
    setError(null);
    setSuccess(null);
  }, []);

  // --- Render ---
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <header className="mb-6 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20">
              <Layers size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                Unified <span className="text-indigo-400">System</span>
              </h1>
              <p className="text-slate-500 font-mono text-[11px]">
                Cot System &times; PurposeEngine &bull; Domain / Constraints / Objectives / Advantages
              </p>
            </div>
          </div>
        </header>

        <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-6 shadow-2xl space-y-8">
          {/* Domain */}
          <Field label="Domain">
            <Select
              value={system.domain}
              onChange={(e) => setSystem((prev) => ({ ...prev, domain: e.target.value }))}
            >
              <option value="" disabled>
                Select domain&hellip;
              </option>
              {DOMAINS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
          </Field>

          {/* Constraints */}
          <section>
            <SectionHeader
              icon={<AlertTriangle size={14} />}
              title="Constraints"
              count={system.constraints.length}
              onAdd={addConstraint}
              addLabel="Add Constraint"
            />
            <div className="space-y-2">
              {system.constraints.length === 0 && (
                <p className="text-xs text-slate-600 font-mono italic">No constraints defined.</p>
              )}
              {system.constraints.map((c) => (
                <div key={c.id} className="flex gap-2 items-center">
                  <TextInput
                    placeholder="Type (e.g. latency)"
                    value={c.type}
                    onChange={(e) => updateConstraint(c.id, { type: e.target.value })}
                  />
                  <TextInput
                    placeholder="Value (e.g. < 200ms)"
                    value={c.value}
                    onChange={(e) => updateConstraint(c.id, { value: e.target.value })}
                  />
                  <IconButton
                    tone="danger"
                    aria-label="Remove constraint"
                    onClick={() => removeConstraint(c.id)}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </div>
              ))}
            </div>
          </section>

          {/* Objectives */}
          <section>
            <SectionHeader
              icon={<Target size={14} />}
              title="Objectives"
              count={system.objectives.length}
              onAdd={addObjective}
              addLabel="Add Objective"
            />
            <div className="space-y-2">
              {system.objectives.length === 0 && (
                <p className="text-xs text-slate-600 font-mono italic">No objectives defined.</p>
              )}
              {system.objectives.map((o) => (
                <div key={o.id} className="flex gap-2 items-center">
                  <TextInput
                    placeholder="Objective name"
                    value={o.name}
                    onChange={(e) => updateObjective(o.id, { name: e.target.value })}
                  />
                  <div className="w-36 shrink-0">
                    <Select
                      value={o.priority}
                      onChange={(e) =>
                        updateObjective(o.id, { priority: e.target.value as Priority })
                      }
                      className={`${PRIORITY_STYLES[o.priority]}`}
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </Select>
                  </div>
                  <IconButton
                    tone="danger"
                    aria-label="Remove objective"
                    onClick={() => removeObjective(o.id)}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </div>
              ))}
            </div>
          </section>

          {/* Advantages */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-200 mb-4">
              <span className="text-indigo-400">
                <TrendingUp size={14} />
              </span>
              Advantages
            </h3>

            <div className="space-y-6">
              <div>
                <SectionHeader
                  icon={<TrendingUp size={12} />}
                  title="Immediate"
                  count={system.advantages.immediate.length}
                  onAdd={() => addAdvantage('immediate')}
                  addLabel="Add Immediate"
                />
                <div className="space-y-2">
                  {system.advantages.immediate.length === 0 && (
                    <p className="text-xs text-slate-600 font-mono italic">
                      No immediate advantages.
                    </p>
                  )}
                  {system.advantages.immediate.map((a) => (
                    <div key={a.id} className="flex gap-2 items-center">
                      <TextInput
                        placeholder="Advantage"
                        value={a.advantage}
                        onChange={(e) =>
                          updateAdvantage('immediate', a.id, { advantage: e.target.value })
                        }
                      />
                      <IconButton
                        tone="danger"
                        aria-label="Remove immediate advantage"
                        onClick={() => removeAdvantage('immediate', a.id)}
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <SectionHeader
                  icon={<TrendingUp size={12} />}
                  title="Long-Term"
                  count={system.advantages.longTerm.length}
                  onAdd={() => addAdvantage('longTerm')}
                  addLabel="Add Long-Term"
                />
                <div className="space-y-2">
                  {system.advantages.longTerm.length === 0 && (
                    <p className="text-xs text-slate-600 font-mono italic">
                      No long-term advantages.
                    </p>
                  )}
                  {system.advantages.longTerm.map((a) => (
                    <div key={a.id} className="flex gap-2 items-center">
                      <TextInput
                        placeholder="Advantage"
                        value={a.advantage}
                        onChange={(e) =>
                          updateAdvantage('longTerm', a.id, { advantage: e.target.value })
                        }
                      />
                      <TextInput
                        placeholder="Timeframe (optional)"
                        value={a.timeframe ?? ''}
                        onChange={(e) =>
                          updateAdvantage('longTerm', a.id, { timeframe: e.target.value })
                        }
                        className="max-w-xs"
                      />
                      <IconButton
                        tone="danger"
                        aria-label="Remove long-term advantage"
                        onClick={() => removeAdvantage('longTerm', a.id)}
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Status / Submit */}
          {error && (
            <div className="p-3 bg-red-900/20 border border-red-500/40 rounded text-xs text-red-300 font-mono">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-emerald-900/20 border border-emerald-500/40 rounded text-xs text-emerald-300 font-mono">
              {success}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              <Send size={14} />
              {loading ? 'Submitting…' : 'Submit Unified System'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={loading}
              className="px-4 py-2.5 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm text-slate-300 transition-colors disabled:opacity-50"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnifiedSystemComponent;
