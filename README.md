# o-Llama-project (`quantum-viz`)

A Vite + React 19 + TypeScript + Tailwind CSS v4 prototype with three interactive views, together with the
**Unified Quantum-Cognitive Framework (UQCF)** whitepaper and a few supporting documents.

> **Status.** The paper ([`UQCF.tex`](./UQCF.tex)) is the design and theory document.
> The **Φ Pipeline** view is a working prototype of its operational pipeline. It runs a real numerical
> simulation, but on a toy state space, and its eight glyph operators are stand-ins: the paper names
> them without defining them. The **Visualizer** and **Unified System** views run on sample data.

## What is in the repo

| Path | What it is |
|------|------------|
| `src/App.tsx` | Nav that switches between the three views |
| `src/components/PhiPipelineSimulator.tsx`, `PipelineCharts.tsx` | **Φ Pipeline** view, described below |
| `src/uqcf/` | Simulation core for the Φ Pipeline view: complex linear algebra, the pipeline, and their tests |
| `src/assets/fonts/` | Two small subsets of Noto Sans Symbols / Noto Sans Math, so the glyphs render on any device (OFL-1.1, see `OFL.txt`) |
| `src/components/EnterpriseQuantumVisualizer.tsx` | **Visualizer** view: a collapsible tree rooted at |Ψ₀⟩ (Security Substrate, Operations Fabric, Cognitive Engine, and their sub-components). Nodes show performance bars (efficiency, scalability, resilience), a security profile (integrity, risk mitigation) and superposition / entanglement indicators. A placeholder "Ethical Constraint Module" is deliberately flagged as an integrity gap. All values are sample data. |
| `src/components/UnifiedSystemComponent.tsx` | **Unified System** view: a validated form for Domain / Constraints / Objectives / Advantages. Runs in memory unless an `onSubmit` prop is supplied. |
| `src/monicaAIInstructions.ts` | Monica AI assistant system instructions plus TypeScript interfaces for ethical / quantum validation. Not imported by the UI. |
| [`UQCF.tex`](./UQCF.tex) | The UQCF whitepaper (LaTeX source) |
| `docs/realtime-api-guide.md`, `python/realtime_session.py` | De-duplicated OpenAI Realtime API guide and a cleaned-up Python session-manager example |
| `scripts/quality-check.mjs`, [`QUALITY_REPORT.md`](./QUALITY_REPORT.md) | Dataset analyser (paragraph de-duplication and code lints) and the report on the dataset it was used to clean up |

## Run the app

Requires Node.js 20.19+ or 22.12+ (a Vite 7 requirement; tested on Node 22).

```bash
npm install
npm run dev        # Vite dev server with HMR
npm run build      # type-check (tsc -b) and production build into dist/
npm run preview    # serve the production build
npm run lint       # ESLint
npm test           # Vitest: simulation-core tests
```

Dataset analyser: `node scripts/quality-check.mjs <file>`.

## The Φ Pipeline view

The view runs the paper's operational pipeline (§4) on a 16-dimensional density operator for
H = H_P ⊗ H_C ⊗ H_R:

- P is the prompt (1 qubit).
- C is the context (1 qubit).
- R is the response (4 candidates, r₀–r₃).
- r₃ spans the disallowed subspace.

It recomputes every step whenever a parameter changes:

1. **QuantumMetaPrompt** (§4.2): the initial state is |0⟩_P ⊗ |0⟩_C ⊗ |s⟩_R, with a uniform (neutral) response.
2. **Glyph chain** 🜂 → 🜄 → 🝞 → ⟠ → ⦾ → 🜿 → 🝏 → 🝪 (§3.6): eight unitaries. Each has a slider for its
   coupling θ and is the identity at θ = 0, so any layer can be ablated. Optional dephasing after
   every layer models decoherence (§2.6).
3. **Ethical projector** (§4.4): if p_unsafe = Tr(Ê_block ρ) exceeds ε, the state is either projected
   into the allowed subspace or the pipeline fails closed.
4. **Metrics** (§5) at every step: H_R and confidence, S_ent(P), I(C;R), purity γ, fidelity F, D_KL,
   p_unsafe, and the control functional J.
5. **Control logic** (§4.7, §5.1): threshold signals, and a decision to collapse to an answer, run
   another iteration, or refuse.

What is a prototype choice rather than the paper's definition:

- The eight operators: the Codex Harmonicus names and functions are shown next to each, but the matrices are stand-ins.
- The fidelity target: the same run without decoherence.
- The D_KL baseline: the previous step.
- All thresholds, and the J weights (all 1).
- The default couplings: found by a seeded search for a run that exercises every stage. They carry no other meaning.

The view also has a table of every metric at every step, with definitions.

## Build the whitepaper (optional)

`UQCF.tex` needs a Unicode TeX engine: **LuaLaTeX or XeLaTeX** (not pdfLaTeX). Both were tested on
TeX Live 2023 (babel 24.1) and produce a 34-page PDF. Run it three times so the table of contents and
cross-references settle, or use `latexmk`:

```bash
lualatex UQCF.tex                  # run 3x, or: latexmk -lualatex UQCF.tex
xelatex  UQCF.tex                  # also works
```

Fonts used (Debian / Ubuntu package in brackets):

- **Noto Serif**: body text (`fonts-noto-core`)
- **Noto Sans Symbols**: the alchemical operator glyphs 🜂 🜄 🝞 🜿 🝏 🝪 (`fonts-noto-extra`)
- **Noto Sans Math**: the glyphs ⟠ and ⦾ (`fonts-noto-core`)

If a glyph font is missing the document still compiles; those glyphs then appear as missing-character boxes.
LaTeX build by-products are git-ignored. The build is not part of the app build.
