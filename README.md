# o-Llama-project (`quantum-viz`)

A Vite + React 19 + TypeScript + Tailwind CSS v4 prototype with two interactive views, together with the
**Unified Quantum-Cognitive Framework (UQCF)** whitepaper and a few supporting documents.

> **Status.** The UI runs on hard-coded sample data and does not compute any UQCF quantity yet. The paper
> ([`UQCF.tex`](./UQCF.tex)) is the design and theory document; the app shares its vocabulary
> (|Ψ₀⟩, superposition, entanglement) but does not implement the Φ-layers, the metrics, or the glyph chain.

## What is in the repo

| Path | What it is |
|------|------------|
| `src/App.tsx` | Floating nav that switches between the two views |
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
```

Dataset analyser: `node scripts/quality-check.mjs <file>`.

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
