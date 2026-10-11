import React, { useState } from 'react';

interface BlockProps {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  sublabel?: string;
  fill: string;
  stroke: string;
  ghosted?: boolean;
  tooltip: string;
  onHover: (tip: string | null) => void;
}

const Block: React.FC<BlockProps> = ({ x, y, width, height, label, sublabel, fill, stroke, ghosted, tooltip, onHover }) => (
  <g
    onMouseEnter={() => onHover(tooltip)}
    onMouseLeave={() => onHover(null)}
    className="cursor-pointer"
    opacity={ghosted ? 0.25 : 1}
  >
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      rx={6}
      fill={fill}
      stroke={stroke}
      strokeWidth={ghosted ? 1 : 1.5}
      strokeDasharray={ghosted ? '4 3' : 'none'}
    />
    {ghosted && (
      <line
        x1={x}
        y1={y}
        x2={x + width}
        y2={y + height}
        stroke="#ef4444"
        strokeWidth={1.5}
        opacity={0.6}
      />
    )}
    <text
      x={x + width / 2}
      y={y + height / 2 + (sublabel ? -4 : 0)}
      textAnchor="middle"
      dominantBaseline="central"
      fill={ghosted ? '#475569' : '#e2e8f0'}
      fontSize={11}
      fontFamily="monospace"
      fontWeight="600"
    >
      {label}
    </text>
    {sublabel && (
      <text
        x={x + width / 2}
        y={y + height / 2 + 12}
        textAnchor="middle"
        dominantBaseline="central"
        fill={ghosted ? '#334155' : '#94a3b8'}
        fontSize={8}
        fontFamily="monospace"
      >
        {sublabel}
      </text>
    )}
  </g>
);

const Arrow: React.FC<{ x1: number; y1: number; x2: number; y2: number; ghosted?: boolean; animated?: boolean }> = ({
  x1, y1, x2, y2, ghosted, animated,
}) => (
  <line
    x1={x1}
    y1={y1}
    x2={x2}
    y2={y2}
    stroke={ghosted ? '#334155' : animated ? '#06b6d4' : '#64748b'}
    strokeWidth={ghosted ? 1 : 1.5}
    strokeDasharray={ghosted ? '4 3' : animated ? '6 4' : 'none'}
    markerEnd={ghosted ? undefined : 'url(#arrowhead)'}
    opacity={ghosted ? 0.3 : 1}
  >
    {animated && (
      <animate
        attributeName="stroke-dashoffset"
        from="20"
        to="0"
        dur="1.5s"
        repeatCount="indefinite"
      />
    )}
  </line>
);

const ArchitectureDiagram: React.FC = () => {
  const [tooltip, setTooltip] = useState<string | null>(null);

  return (
    <div className="relative">
      <svg viewBox="0 0 820 340" className="w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#64748b" />
          </marker>
          <marker id="arrowhead-cyan" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#06b6d4" />
          </marker>
        </defs>

        {/* Background label: "REMOVED (CAVIS)" */}
        <text x={410} y={18} textAnchor="middle" fill="#ef4444" fontSize={9} fontFamily="monospace" opacity={0.5}>
          REMOVED FROM CAVIS
        </text>
        <rect x={20} y={24} width={780} height={58} rx={8} fill="#450a0a" opacity={0.15} stroke="#ef4444" strokeWidth={0.5} strokeDasharray="6 4" />

        {/* Ghosted removed modules */}
        <Block x={30} y={32} width={110} height={42} label="ViT-Adapter" sublabel="CNN multi-scale" fill="#1e1e2e" stroke="#ef4444" ghosted tooltip="ViT-Adapter: CNN-based module that augmented the ViT with multi-scale features. Removed because DINOv2 features are sufficient." onHover={setTooltip} />
        <Block x={160} y={32} width={130} height={42} label="Pixel Decoder" sublabel="Mask2Former" fill="#1e1e2e" stroke="#ef4444" ghosted tooltip="Mask2Former Pixel Decoder: Produced multi-scale feature maps. No longer needed with encoder-only design." onHover={setTooltip} />
        <Block x={310} y={32} width={130} height={42} label="TF Decoder" sublabel="9-layer cross-attn" fill="#1e1e2e" stroke="#ef4444" ghosted tooltip="Transformer Decoder: 9-layer decoder with cross/self-attention. Replaced by injecting queries directly into ViT." onHover={setTooltip} />
        <Block x={460} y={32} width={100} height={42} label="Context-Aware" sublabel="Boundary pool" fill="#1e1e2e" stroke="#ef4444" ghosted tooltip="Context-Aware Features: Laplacian boundary extraction + average pooling. Pre-trained ViT already captures this." onHover={setTooltip} />
        <Block x={580} y={32} width={90} height={42} label="Re-ID MLP" sublabel="Contrastive" fill="#1e1e2e" stroke="#ef4444" ghosted tooltip="Re-identification Layers: 3-layer MLP with contrastive loss. Instance-discriminative features are already in the ViT." onHover={setTooltip} />
        <Block x={690} y={32} width={100} height={42} label="Tracker" sublabel="TF blocks" fill="#1e1e2e" stroke="#ef4444" ghosted tooltip="Transformer Tracker: Cross/self-attention blocks for temporal association. Replaced by query propagation + fusion." onHover={setTooltip} />

        {/* Main VidEoMT pipeline */}
        <text x={410} y={108} textAnchor="middle" fill="#06b6d4" fontSize={10} fontFamily="monospace" fontWeight="bold">
          VidEoMT ENCODER-ONLY PIPELINE
        </text>

        {/* Input frames */}
        <Block x={30} y={125} width={90} height={55} label="Input" sublabel="Frame I_t" fill="#0f172a" stroke="#334155" tooltip="Input video frame at timestep t. Processed one frame at a time (online)." onHover={setTooltip} />
        {/* Stacked frame visual */}
        <rect x={35} y={120} width={80} height={4} rx={2} fill="#1e293b" stroke="#334155" strokeWidth={0.5} />
        <rect x={38} y={117} width={74} height={4} rx={2} fill="#1e293b" stroke="#334155" strokeWidth={0.5} />

        <Arrow x1={120} y1={152} x2={148} y2={152} />

        {/* ViT backbone - first L1 blocks */}
        <Block x={150} y={125} width={120} height={55} label="ViT Backbone" sublabel="DINOv2 · L₁ blocks" fill="#0c1629" stroke="#3b82f6" tooltip="DINOv2 pre-trained ViT encoder. First L₁ blocks process patch tokens only. The strong pre-training enables both segmentation and tracking." onHover={setTooltip} />

        <Arrow x1={270} y1={152} x2={298} y2={152} />

        {/* Last L2 blocks with queries */}
        <rect x={300} y={118} width={200} height={70} rx={8} fill="#06202e" stroke="#06b6d4" strokeWidth={1.5} opacity={0.9} />
        <text x={400} y={134} textAnchor="middle" fill="#06b6d4" fontSize={10} fontFamily="monospace" fontWeight="bold">
          Last L₂ ViT Blocks
        </text>
        <text x={400} y={148} textAnchor="middle" fill="#94a3b8" fontSize={8} fontFamily="monospace">
          Patch tokens + Query tokens
        </text>
        <text x={400} y={162} textAnchor="middle" fill="#64748b" fontSize={8} fontFamily="monospace">
          Joint self-attention
        </text>
        <text x={400} y={176} textAnchor="middle" fill="#64748b" fontSize={7} fontFamily="monospace">
          (L₂ = 4 layers, D = 1024)
        </text>

        <Arrow x1={500} y1={152} x2={528} y2={152} />

        {/* Prediction heads */}
        <Block x={530} y={120} width={100} height={30} label="Class Head" sublabel="Linear" fill="#0f172a" stroke="#a855f7" tooltip="Classification head: Linear layer on each query to predict class labels from C categories." onHover={setTooltip} />
        <Block x={530} y={158} width={100} height={30} label="Mask Head" sublabel="MLP + dot prod" fill="#0f172a" stroke="#a855f7" tooltip="Segmentation head: 3-layer MLP on queries, then dot product with patch features to produce binary masks." onHover={setTooltip} />

        <Arrow x1={630} y1={135} x2={668} y2={152} />
        <Arrow x1={630} y1={173} x2={668} y2={152} />

        {/* Output */}
        <Block x={670} y={125} width={120} height={55} label="Predictions" sublabel="Masks + Classes" fill="#0f172a" stroke="#10b981" tooltip="Final output: K segmentation masks with class labels and confidence scores. Temporally consistent through query propagation." onHover={setTooltip} />

        {/* Query Fusion Module */}
        <text x={250} y={225} textAnchor="middle" fill="#f59e0b" fontSize={9} fontFamily="monospace" fontWeight="bold">
          QUERY FUSION
        </text>

        {/* Learned queries */}
        <Block x={100} y={240} width={110} height={40} label="Q_learned" sublabel="N=200 queries" fill="#1a1520" stroke="#a855f7" tooltip="Learned queries: N=200 trainable query tokens initialized at start. Enable detection of new objects entering the scene." onHover={setTooltip} />

        {/* Previous frame queries */}
        <Block x={100} y={295} width={110} height={40} label="Q_prev" sublabel="From frame t-1" fill="#0a1520" stroke="#06b6d4" tooltip="Propagated queries: Output queries from the previous frame carry temporal context about tracked objects." onHover={setTooltip} />

        {/* Linear transform */}
        <Arrow x1={210} y1={315} x2={248} y2={315} />
        <Block x={250} y={295} width={80} height={40} label="Linear" sublabel="Transform" fill="#1a1a10" stroke="#f59e0b" tooltip="Linear transformation: Projects propagated queries into compatible space before fusion. The only new parameters added." onHover={setTooltip} />

        {/* Addition node */}
        <Arrow x1={155} y1={280} x2={375} y2={280} />
        <Arrow x1={330} y1={315} x2={360} y2={295} />

        <circle cx={375} cy={285} r={16} fill="#1a1a10" stroke="#f59e0b" strokeWidth={1.5} />
        <text x={375} y={287} textAnchor="middle" dominantBaseline="central" fill="#f59e0b" fontSize={16} fontWeight="bold">+</text>

        <text x={375} y={310} textAnchor="middle" fill="#64748b" fontSize={7} fontFamily="monospace">
          Element-wise add
        </text>

        {/* Fused output */}
        <Arrow x1={391} y1={285} x2={438} y2={285} />
        <Block x={440} y={265} width={100} height={40} label="Q_fused" sublabel="Temporal + New" fill="#0a1a1a" stroke="#06b6d4" tooltip="Fused queries: Q_fused = Linear(Q_prev) + Q_learned. Balances temporal continuity with adaptability to new objects." onHover={setTooltip} />

        {/* Arrow from Q_fused up to encoder */}
        <Arrow x1={490} y1={265} x2={400} y2={190} animated />

        {/* Temporal loop: from predictions back to Q_prev */}
        <path
          d="M 730 180 L 730 315 L 210 315"
          fill="none"
          stroke="#06b6d4"
          strokeWidth={1.5}
          strokeDasharray="6 4"
          markerEnd="url(#arrowhead-cyan)"
          opacity={0.7}
        >
          <animate
            attributeName="stroke-dashoffset"
            from="40"
            to="0"
            dur="3s"
            repeatCount="indefinite"
          />
        </path>
        <text x={740} y={250} fill="#06b6d4" fontSize={7} fontFamily="monospace" opacity={0.7}>
          Propagate
        </text>
        <text x={740} y={260} fill="#06b6d4" fontSize={7} fontFamily="monospace" opacity={0.7}>
          to next frame
        </text>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div className="absolute bottom-0 left-0 right-0 bg-slate-800/95 border border-slate-700 rounded-lg px-4 py-3 text-xs text-slate-300 leading-relaxed backdrop-blur-sm">
          {tooltip}
        </div>
      )}
    </div>
  );
};

export default ArchitectureDiagram;
