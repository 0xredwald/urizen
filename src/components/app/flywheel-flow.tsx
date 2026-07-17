"use client";

import { useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { UrizenMark } from "@/components/brand/marks";

// The flagship $URI flywheel as a clean React-Flow graph. A "How it works" walkthrough steps through
// the nodes and explains each one, so the page stays uncluttered by default.

type NData = {
  title: string;
  sub?: string;         // small live value under the title (e.g. the LP's pooled USD)
  logo?: string;
  mark?: boolean;
  group: number;        // which walkthrough step this node belongs to
  active?: boolean;     // highlighted during the walkthrough
  dim?: boolean;        // dimmed while another step is active
};

const fmtUsd = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toFixed(0)}`);

// walkthrough content, in order
const STEPS = [
  { text: "Fees are claimed from Bankr." },
  { text: "Agents analyse opportunities and determine the optimal strategy." },
  { text: "ETH is swapped into $CASHCAT and $SPCX stock tokens." },
  { text: "Agents create a novel onchain market — the first CASHCAT/SPCX LP on Uniswap v4." },
  { text: "The position captures volume generated from volatility and arbitrage." },
  { text: "Profits from the strategy buy back $URI." },
];

const H = (pos: Position) => (
  <Handle type={pos === Position.Left ? "target" : "source"} position={pos} className="!h-1 !w-1 !border-0 !bg-transparent" />
);

function FlyNode({ data: d }: NodeProps<Node<NData>>) {
  const border = d.active ? "border-signal shadow-[0_0_26px_rgba(52,240,3,0.28)]" : d.mark ? "border-signal/50" : "border-white/12";
  return (
    <div className={`flex items-center gap-2.5 rounded-[3px] border ${border} bg-[#0d0d0f] px-3.5 py-2.5 transition-all duration-300 ${d.dim ? "opacity-35" : "opacity-100"}`} style={{ minWidth: 148 }}>
      {H(Position.Left)}
      {d.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={d.logo} alt="" width={24} height={24} className="shrink-0 rounded-full object-cover ring-1 ring-white/10" />
      ) : d.mark ? (
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[3px] bg-signal/15"><UrizenMark className="h-3.5 w-auto text-signal" /></span>
      ) : (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />
      )}
      <div className="min-w-0">
        <div className="truncate font-display text-[0.9rem] leading-tight text-foreground">{d.title}</div>
        {d.sub && <div className="font-mono text-[0.68rem] leading-tight text-signal tabular-nums">{d.sub}</div>}
      </div>
      {H(Position.Right)}
    </div>
  );
}

const nodeTypes = { fly: FlyNode };

// static layout — one node (or pair) per walkthrough step
const LAYOUT: { id: string; x: number; y: number; group: number; d: Omit<NData, "group"> }[] = [
  { id: "bankr", x: 0, y: 92, group: 0, d: { title: "Bankr fees", logo: "/logos/tokens/bankr.png" } },
  { id: "agents", x: 236, y: 92, group: 1, d: { title: "Agents", logo: undefined } },
  { id: "cashcat", x: 476, y: 30, group: 2, d: { title: "$CASHCAT", logo: "/logos/tokens/cashcat.jpg" } },
  { id: "spcx", x: 476, y: 154, group: 2, d: { title: "$SPCX", logo: "/logos/tokens/spcx.ico" } },
  { id: "lp", x: 724, y: 92, group: 3, d: { title: "CASHCAT / SPCX LP", logo: "/logos/tokens/uniswap.png" } },
  { id: "capture", x: 980, y: 92, group: 4, d: { title: "Volume + arbitrage" } },
  { id: "uri", x: 1224, y: 92, group: 5, d: { title: "$URI buyback", mark: true } },
];
const EDGES: [string, string][] = [
  ["bankr", "agents"], ["agents", "cashcat"], ["agents", "spcx"], ["cashcat", "lp"], ["spcx", "lp"], ["lp", "capture"], ["capture", "uri"],
];

export function FlywheelFlow({ lpUsd }: { lpUsd?: number | null }) {
  const [step, setStep] = useState<number | null>(null); // null = not presenting

  const nodes = useMemo<Node<NData>[]>(
    () => LAYOUT.map((l) => ({
      id: l.id, type: "fly", position: { x: l.x, y: l.y }, draggable: false,
      data: {
        ...l.d, group: l.group, active: step === l.group, dim: step !== null && step !== l.group,
        sub: l.id === "lp" && lpUsd ? `${fmtUsd(lpUsd)} pooled` : undefined,
      },
    })),
    [step, lpUsd],
  );
  const edges = useMemo<Edge[]>(
    () => EDGES.map(([s, t]) => ({
      id: `${s}-${t}`, source: s, target: t, type: "smoothstep",
      style: { stroke: "rgba(52,240,3,0.4)", strokeWidth: 1.4 },
    })),
    [],
  );

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[4px] border border-white/[0.08] bg-[#0a0a0b]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.16 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll={false}
        zoomOnPinch={false}
        preventScrolling={false}
        minZoom={0.3}
        maxZoom={1.4}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="rgba(255,255,255,0.04)" />
      </ReactFlow>

      {/* how it works */}
      {step === null ? (
        <button onClick={() => setStep(0)} className="absolute right-4 top-4 rounded-full border border-signal/40 bg-[#0d0d0f]/80 px-3.5 py-1.5 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-signal backdrop-blur transition-colors hover:bg-signal/10">
          How it works
        </button>
      ) : (
        <div className="absolute inset-x-4 bottom-4 flex items-center gap-4 rounded-[4px] border border-signal/25 bg-[#0d0d0f]/95 px-5 py-3.5 backdrop-blur-xl">
          <span className="font-mono text-[0.8rem] tabular-nums text-signal">{String(step + 1).padStart(2, "0")}<span className="text-muted-foreground">/{String(STEPS.length).padStart(2, "0")}</span></span>
          <p className="flex-1 text-[0.95rem] leading-snug text-foreground/90">{STEPS[step].text}</p>
          <div className="flex shrink-0 items-center gap-2">
            {step > 0 && <button onClick={() => setStep(step - 1)} className="rounded-md border border-white/10 px-2.5 py-1.5 font-mono text-[0.68rem] uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground">Back</button>}
            {step < STEPS.length - 1 ? (
              <button onClick={() => setStep(step + 1)} className="rounded-md border border-signal/50 bg-signal/10 px-3 py-1.5 font-mono text-[0.68rem] uppercase tracking-widest text-signal transition-colors hover:bg-signal/20">Next</button>
            ) : (
              <button onClick={() => setStep(null)} className="rounded-md border border-signal/50 bg-signal/10 px-3 py-1.5 font-mono text-[0.68rem] uppercase tracking-widest text-signal transition-colors hover:bg-signal/20">Done</button>
            )}
            <button onClick={() => setStep(null)} className="px-1 text-muted-foreground transition-colors hover:text-foreground" aria-label="close">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
