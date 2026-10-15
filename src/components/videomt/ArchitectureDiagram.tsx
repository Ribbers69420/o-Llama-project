import React, { useState } from 'react';

// Colours used by the diagram. The page-level data colours live in ../vizTokens; a diagram
// needs a few more, so they are named here once instead of being scattered through the SVG.
const C = {
  block: '#0f172a',
  ghostFill: '#1e1e2e',
  neutral: '#64748b',
  text: '#e2e8f0',
  textSoft: '#94a3b8',
  removed: '#f87171',
  vit: '#3b82f6',
  query: '#06b6d4',
  queryText: '#67e8f9',
  head: '#a855f7',
  out: '#10b981',
  fuse: '#f59e0b',
  fuseText: '#fbbf24',
} as const;

interface Tip {
  label: string;
  text: string;
}

// Every statement below is either read off the paper (section in brackets) or a Table 1 number.
const TIPS: Record<string, Tip> = {
  adapter: {
    label: 'ViT-Adapter (removed)',
    text: 'Replaced, together with the Mask2Former pixel and Transformer decoders, by EoMT. The paper calls the adapter inefficient [§3.3]. Step 1: 68.9 → 68.1 AP, 15 → 42 FPS.',
  },
  pixel: {
    label: 'Pixel decoder (removed)',
    text: 'Part of the Mask2Former segmenter that EoMT replaces. It turned the ViT-Adapter features into the enriched multi-scale feature maps [§3.2].',
  },
  decoder: {
    label: 'Transformer decoder (removed)',
    text: 'Refined N learnable queries through cross- and self-attention [§3.2]. In VidEoMT the queries are processed inside the last L₂ ViT blocks instead.',
  },
  context: {
    label: 'Context-aware features (removed)',
    text: 'From CAVIS: pools smoothed features at each object’s boundary. The paper hypothesises that a strong pre-trained ViT makes this redundant [§3.3]. Step 2: 68.1 → 68.4 AP.',
  },
  reid: {
    label: 'Re-identification layers (removed)',
    text: 'A 3-layer MLP trained with a contrastive loss. The paper hypothesises that large-scale pre-training already gives instance-level features [§3.3]. Step 3: 68.4 → 68.0 AP.',
  },
  tracker: {
    label: 'Transformer tracker (removed)',
    text: 'Cross- and self-attention blocks that match each frame’s queries to the previous frame’s [§3.2]. Removing it alone costs a lot (step 4: 68.0 → 61.3 AP); query propagation and fusion win it back.',
  },
  input: {
    label: 'Input frame',
    text: 'Frames are processed one at a time, online: a prediction may depend only on the current and earlier frames [§3.1].',
  },
  backbone: {
    label: 'ViT backbone (DINOv2)',
    text: 'The first L₁ blocks see patch tokens only. The paper hypothesises that large-scale pre-training lets the ViT take over segmentation and tracking; the gap to CAVIS grows with weaker pre-training and smaller ViTs [§5.3].',
  },
  l2: {
    label: 'Last L₂ ViT blocks',
    text: 'Patch tokens and query tokens are processed jointly (L₂ is usually 4, D = 1024). The output queries give the predictions and are also the track queries that become Q_prev for the next frame [§3.3–3.4].',
  },
  cls: {
    label: 'Class head',
    text: 'A linear layer on each query predicts its class [§3.2].',
  },
  mask: {
    label: 'Mask head',
    text: 'An MLP on each query, then a dot product with the feature map, gives its binary mask (as described for the segmenter in §3.2).',
  },
  pred: {
    label: 'Predictions',
    text: 'A mask and a class per query. Training matches each object to the query it first appeared in and keeps it there, so the same query slot follows the same object over time [§3.4].',
  },
  learned: {
    label: 'Q_learned',
    text: 'N = 200 learnable queries (D = 1024), the same in every frame. They keep the model able to find objects that appear later [§3.4, App. A.4].',
  },
  prev: {
    label: 'Q_prev',
    text: 'The output queries of the previous frame (the track queries). Frame 0 has none and uses the learned queries alone [§3.4].',
  },
  linear: {
    label: 'Linear',
    text: 'A lightweight linear layer applied to the previous frame’s queries before they are added to Q_learned (Table 1: 316M → 318M parameters).',
  },
  add: {
    label: 'Element-wise addition',
    text: 'Possible because the training supervision keeps the query order the same across frames [§3.4].',
  },
  fused: {
    label: 'Q_fused',
    text: 'Q_fused = Linear(Q_prev) + Q_learned: past context plus the ability to detect new objects. It enters the last L₂ ViT blocks in place of the learned queries [§3.4].',
  },
};

interface BlockProps {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  sublabel?: string;
  note?: string;
  fill?: string;
  stroke: string;
  ghosted?: boolean;
  activeId: string | null;
  onActivate: (id: string) => void;
}

const handlers = (id: string, onActivate: (id: string) => void) => ({
  tabIndex: 0,
  role: 'img' as const,
  'aria-label': `${TIPS[id].label}. ${TIPS[id].text}`,
  onPointerEnter: () => onActivate(id),
  onFocus: () => onActivate(id),
  onClick: () => onActivate(id),
});

const Block: React.FC<BlockProps> = ({
  id, x, y, width, height, label, sublabel, note, fill = C.block, stroke, ghosted, activeId, onActivate,
}) => {
  const cx = x + width / 2;
  const cy = y + height / 2;
  // Two-line blocks centre the pair; short blocks tighten the gap so both lines stay inside.
  const gap = Math.min(12, height / 2 - 6);
  const lines = note ? [cy - 14, cy + 1, cy + 15] : sublabel ? [cy - 4, cy + gap] : [cy];
  return (
    <g {...handlers(id, onActivate)} className="cursor-pointer">
      {activeId === id && (
        <rect x={x - 3} y={y - 3} width={width + 6} height={height + 6} rx={8} fill="none" stroke={C.text} strokeWidth={1.5} opacity={0.8} />
      )}
      {/* A removed block is faded by its fill and border only, so its text stays readable. */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={6}
        fill={fill}
        stroke={stroke}
        strokeWidth={ghosted ? 1 : 1.5}
        strokeDasharray={ghosted ? '4 3' : undefined}
        opacity={ghosted ? 0.55 : 1}
      />
      {ghosted && <line x1={x} y1={y} x2={x + width} y2={y + height} stroke={C.removed} strokeWidth={1.5} opacity={0.35} />}
      <text x={cx} y={lines[0]} textAnchor="middle" dominantBaseline="central" fill={ghosted ? C.textSoft : C.text} fontSize={11} fontFamily="monospace" fontWeight="600">
        {label}
      </text>
      {sublabel && (
        <text x={cx} y={lines[1]} textAnchor="middle" dominantBaseline="central" fill={C.textSoft} fontSize={9} fontFamily="monospace">
          {sublabel}
        </text>
      )}
      {note && (
        <text x={cx} y={lines[2]} textAnchor="middle" dominantBaseline="central" fill={C.textSoft} fontSize={9} fontFamily="monospace">
          {note}
        </text>
      )}
    </g>
  );
};

const Arrow: React.FC<{ x1: number; y1: number; x2: number; y2: number; flow?: boolean }> = ({ x1, y1, x2, y2, flow }) => (
  <line
    x1={x1}
    y1={y1}
    x2={x2}
    y2={y2}
    stroke={flow ? C.query : C.neutral}
    strokeWidth={1.5}
    strokeDasharray={flow ? '6 4' : undefined}
    markerEnd={flow ? 'url(#arrow-cyan)' : 'url(#arrow)'}
    className={flow ? 'dash-flow' : undefined}
  />
);

const ArchitectureDiagram: React.FC = () => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const tip = activeId ? TIPS[activeId] : null;
  const b = { activeId, onActivate: setActiveId };

  return (
    <div>
      {/* The diagram keeps a readable size and scrolls sideways on narrow screens. */}
      <div className="overflow-x-auto">
        <svg viewBox="0 0 820 365" role="group" aria-label="VidEoMT architecture diagram" className="w-full min-w-[900px]">
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill={C.neutral} />
            </marker>
            <marker id="arrow-cyan" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill={C.query} />
            </marker>
          </defs>

          {/* What VidEoMT removes from CAVIS */}
          <text x={410} y={17} textAnchor="middle" fill={C.removed} fontSize={10} fontFamily="monospace">
            REMOVED FROM CAVIS
          </text>
          <rect x={20} y={24} width={780} height={58} rx={8} fill="#450a0a" opacity={0.2} stroke={C.removed} strokeWidth={0.5} strokeDasharray="6 4" />
          <Block id="adapter" x={30} y={32} width={110} height={42} label="ViT-Adapter" sublabel="CNN multi-scale" fill={C.ghostFill} stroke={C.removed} ghosted {...b} />
          <Block id="pixel" x={160} y={32} width={130} height={42} label="Pixel decoder" sublabel="Mask2Former" fill={C.ghostFill} stroke={C.removed} ghosted {...b} />
          <Block id="decoder" x={310} y={32} width={130} height={42} label="TF decoder" sublabel="cross/self-attn" fill={C.ghostFill} stroke={C.removed} ghosted {...b} />
          <Block id="context" x={460} y={32} width={100} height={42} label="Context-aware" sublabel="boundary pool" fill={C.ghostFill} stroke={C.removed} ghosted {...b} />
          <Block id="reid" x={580} y={32} width={90} height={42} label="Re-ID MLP" sublabel="contrastive" fill={C.ghostFill} stroke={C.removed} ghosted {...b} />
          <Block id="tracker" x={690} y={32} width={100} height={42} label="Tracker" sublabel="TF blocks" fill={C.ghostFill} stroke={C.removed} ghosted {...b} />

          {/* The encoder-only pipeline */}
          <text x={410} y={108} textAnchor="middle" fill={C.queryText} fontSize={11} fontFamily="monospace" fontWeight="bold">
            VidEoMT ENCODER-ONLY PIPELINE
          </text>

          <rect x={35} y={120} width={80} height={4} rx={2} fill="#1e293b" stroke={C.neutral} strokeWidth={0.5} />
          <rect x={38} y={117} width={74} height={4} rx={2} fill="#1e293b" stroke={C.neutral} strokeWidth={0.5} />
          <Block id="input" x={30} y={125} width={90} height={55} label="Input" sublabel="frame I_t" stroke={C.neutral} {...b} />
          <Arrow x1={120} y1={152} x2={148} y2={152} />
          <Block id="backbone" x={150} y={125} width={120} height={55} label="ViT backbone" sublabel="DINOv2 · L₁ blocks" fill="#0c1629" stroke={C.vit} {...b} />
          <Arrow x1={270} y1={152} x2={298} y2={152} />
          <Block id="l2" x={300} y={118} width={200} height={70} label="Last L₂ ViT blocks" sublabel="patch + query tokens" note="joint self-attention" fill="#06202e" stroke={C.query} {...b} />
          <Arrow x1={500} y1={152} x2={528} y2={152} />
          <Block id="cls" x={530} y={120} width={100} height={30} label="Class head" sublabel="Linear" stroke={C.head} {...b} />
          <Block id="mask" x={530} y={158} width={100} height={30} label="Mask head" sublabel="MLP + dot product" stroke={C.head} {...b} />
          <Arrow x1={630} y1={135} x2={668} y2={152} />
          <Arrow x1={630} y1={173} x2={668} y2={152} />
          <Block id="pred" x={670} y={125} width={120} height={55} label="Predictions" sublabel="masks + classes" stroke={C.out} {...b} />

          {/* Query fusion */}
          <text x={250} y={225} textAnchor="middle" fill={C.fuseText} fontSize={10} fontFamily="monospace" fontWeight="bold">
            QUERY FUSION
          </text>
          <Block id="learned" x={100} y={240} width={110} height={40} label="Q_learned" sublabel="N = 200 queries" fill="#1a1520" stroke={C.head} {...b} />
          <Block id="prev" x={100} y={295} width={110} height={40} label="Q_prev" sublabel="from frame t−1" fill="#0a1520" stroke={C.query} {...b} />
          <Arrow x1={210} y1={315} x2={248} y2={315} />
          <Block id="linear" x={250} y={295} width={80} height={40} label="Linear" sublabel="transform" fill="#1a1a10" stroke={C.fuse} {...b} />

          <Arrow x1={210} y1={260} x2={359} y2={283} />
          <Arrow x1={330} y1={315} x2={362} y2={297} />
          <g {...handlers('add', setActiveId)} className="cursor-pointer">
            <circle cx={375} cy={285} r={22} fill="transparent" />
            {activeId === 'add' && <circle cx={375} cy={285} r={20} fill="none" stroke={C.text} strokeWidth={1.5} opacity={0.8} />}
            <circle cx={375} cy={285} r={16} fill="#1a1a10" stroke={C.fuse} strokeWidth={1.5} />
            <text x={375} y={286} textAnchor="middle" dominantBaseline="central" fill={C.fuseText} fontSize={16} fontWeight="bold">
              +
            </text>
          </g>
          <text x={375} y={256} textAnchor="middle" fill={C.textSoft} fontSize={9} fontFamily="monospace">
            element-wise add
          </text>

          <Arrow x1={391} y1={285} x2={438} y2={285} />
          <Block id="fused" x={440} y={265} width={100} height={40} label="Q_fused" sublabel="past + new" fill="#0a1a1a" stroke={C.query} {...b} />
          <Arrow x1={490} y1={265} x2={402} y2={190} flow />

          {/* Track queries leave the last L2 blocks and become Q_prev for the next frame. */}
          <circle cx={500} cy={170} r={3} fill={C.query} />
          <path
            d="M 500 170 L 515 170 L 515 215 L 590 215 L 590 352 L 155 352 L 155 337"
            fill="none"
            stroke={C.query}
            strokeWidth={1.5}
            strokeDasharray="6 4"
            markerEnd="url(#arrow-cyan)"
            className="dash-flow-slow"
            opacity={0.85}
          />
          <text x={598} y={245} fill={C.queryText} fontSize={9} fontFamily="monospace">
            track queries Q_t
          </text>
          <text x={598} y={258} fill={C.queryText} fontSize={9} fontFamily="monospace">
            → next frame
          </text>
        </svg>
      </div>

      {/* The text lives below the diagram, in normal flow, so it never covers the block it describes.
          Each block also carries the same text as its accessible name. */}
      <div
        aria-hidden="true"
        className="mt-3 min-h-[6.5rem] rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-xs leading-relaxed text-slate-300 sm:min-h-[4.25rem]"
      >
        {tip ? (
          <>
            <span className="font-semibold text-slate-100">{tip.label}.</span> {tip.text}
          </>
        ) : (
          'Hover, focus or tap a block to read what it does. Dashed red blocks are what VidEoMT removes from CAVIS.'
        )}
      </div>
    </div>
  );
};

export default ArchitectureDiagram;
