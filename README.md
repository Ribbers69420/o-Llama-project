# Quantum-Viz — Enterprise Quantum-Interface Visualizer

An interactive React + TypeScript visualizer for the **Unified Quantum-Cognitive
Framework (UQCF)**. The app renders the framework's layered architecture as an
explorable tree: each node is a system component carrying performance metrics
(computational efficiency, scalability, resilience), a security profile
(integrity, compliance, risk mitigation), and "quantum potential" indicators
(superposition capacity, entanglement coefficients, coherence). Components expand
to reveal detailed metric bars and use quantum notation such as $|\Psi_0\rangle$,
superposition, entanglement, and coherence throughout.

The visualizer is a concrete, interactive instantiation of the theory described
in [`UQCF.tex`](./UQCF.tex): the Φ-layer cascade, the prompt–context–response
subsystem structure, coherence-aware traversal, and governance-driven metrics all
have direct counterparts in the on-screen component hierarchy and its scoring.

## Theoretical Foundation

The whitepaper at [`UQCF.tex`](./UQCF.tex) is the design document for this
project. It develops a single synthesis in two registers:

- **A formal theory** of cognition-inspired state evolution in a Hilbert space —
  unitary Φ-layer transformations, controlled collapse, density-operator
  subsystems, interference as context-sensitive selection, and a suite of
  evaluation metrics (entanglement entropy, purity/coherence, response entropy,
  fidelity, mutual information, and an ethical risk index).
- **A systems architecture** — the quantum-fractal knowledge architecture:
  graph-structured memory, golden-ratio (φ) layer stratification,
  semantic-preserving compression, entanglement-inspired relationship scoring,
  adaptive resource allocation, and governance enforced at the substrate level.

The component layers shown in the visualizer (Core, Cognitive, Security,
Integration, Optimization) map onto the framework's functional families described
in §3 and §6 of the paper. Treat `UQCF.tex` as the source of truth for *why* the
interface is organised the way it is.

### Building the paper (optional)

`UQCF.tex` uses `fontspec` + `babel` with the Noto Serif font, so it must be
compiled with a Unicode engine (LuaLaTeX or XeLaTeX) rather than pdfLaTeX:

```bash
lualatex UQCF.tex      # or: xelatex UQCF.tex
```

This is not part of the app build — it is only needed if you want a typeset PDF
of the whitepaper.

## Running the app

Requires Node.js. Install dependencies and start the dev server:

```bash
npm install
npm run dev        # start Vite dev server with HMR
```

Other useful scripts:

```bash
npm run build      # type-check and produce a production build in dist/
npm run preview    # serve the production build locally
npm run lint       # run ESLint
```

## Project structure

```
.
├── UQCF.tex                                  # Unified Quantum-Cognitive Framework whitepaper (design doc)
├── index.html                                # Vite entry HTML
├── src/
│   ├── App.tsx                               # Renders the visualizer
│   ├── components/
│   │   └── EnterpriseQuantumVisualizer.tsx   # Core interactive tree visualization
│   └── monicaAIInstructions.ts               # AI assistant system instructions
└── ...                                       # Vite / TypeScript / ESLint config
```

## Stack

React 19, TypeScript, Vite, TailwindCSS, and lucide-react for icons.
