"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { StockLogo } from "@/components/brand/stock-logo";
import { STRATEGIES } from "@/lib/strategies";

/* ---------- custom node ---------- */

type NData = {
  kind: "signal" | "brain" | "mandate" | "exec" | "asset" | "profit" | "buyback" | "token";
  title: string;
  sub?: string;
  status?: "live" | "arming";
  symbol?: string;
};

const H = (pos: Position) => (
  <Handle type={pos === Position.Left ? "target" : "source"} position={pos} className="!h-1 !w-1 !border-0 !bg-white/20" />
);

function EngineNode({ data }: NodeProps<Node<NData>>) {
  const d = data;
  const live = d.status === "live";
  const accent =
    d.kind === "token" || d.kind === "buyback" ? "border-signal/60" : "border-white/12";
  const glow = d.kind === "token" ? "shadow-[0_0_24px_rgba(52,240,3,0.25)]" : "";

  return (
    <div
      className={`flex items-center gap-2.5 rounded-[3px] border ${accent} ${glow} bg-[#0d0d0f]/95 px-3 py-2 backdrop-blur-xl`}
      style={{ minWidth: d.kind === "asset" ? 132 : 150 }}
    >
      {H(Position.Left)}
      {d.symbol ? (
        <StockLogo symbol={d.symbol} size={26} />
      ) : (
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            d.kind === "signal" ? "bg-signal anim-node-pulse" : live ? "bg-signal" : "bg-white/30"
          }`}
        />
      )}
      <div className="min-w-0">
        <div className="truncate font-display text-[0.9rem] leading-tight text-foreground">{d.title}</div>
        {d.sub && (
          <div className="mt-0.5 truncate text-[0.72rem] text-muted-foreground">{d.sub}</div>
        )}
      </div>
      {d.status && (
        <span className={`ml-auto shrink-0 text-[0.68rem] ${live ? "text-signal" : "text-muted-foreground"}`}>
          {live ? "Live" : "Arming"}
        </span>
      )}
      {H(Position.Right)}
    </div>
  );
}

const nodeTypes = { engine: EngineNode };

/* ---------- graph ---------- */

const ASSETS = ["NVDA", "PLTR", "META", "MU", "QQQ"];

function build(): { nodes: Node<NData>[]; edges: Edge[] } {
  const n: Node<NData>[] = [];
  const e: Edge[] = [];
  const node = (id: string, x: number, y: number, data: NData) =>
    n.push({ id, type: "engine", position: { x, y }, data, draggable: false });
  const edge = (s: string, t: string, dashed = false) =>
    e.push({
      id: `${s}-${t}`,
      source: s,
      target: t,
      animated: true,
      style: { stroke: dashed ? "rgba(52,240,3,0.35)" : "rgba(52,240,3,0.55)", strokeWidth: 1.4, strokeDasharray: dashed ? "4 4" : undefined },
      markerEnd: { type: MarkerType.ArrowClosed, color: "rgba(52,240,3,0.55)", width: 14, height: 14 },
    });

  // signals
  node("oracle", 0, 40, { kind: "signal", title: "Chainlink oracle", sub: "prices · 24/7" });
  node("momo", 0, 150, { kind: "signal", title: "Momentum / RSI", sub: "candles" });

  // brain
  node("brain", 236, 95, { kind: "brain", title: "Autonomous allocator", sub: "rules engine" });
  edge("oracle", "brain");
  edge("momo", "brain");

  // mandates (from real strategy defs)
  const mandates = STRATEGIES.slice(0, 4);
  mandates.forEach((s, i) => {
    node(`m-${s.id}`, 484, i * 78, { kind: "mandate", title: s.name, sub: s.kind, status: s.status });
    edge("brain", `m-${s.id}`);
    edge(`m-${s.id}`, "exec");
  });

  // execution
  node("exec", 748, 95, { kind: "exec", title: "Doppler router", sub: "swap · onchain" });

  // assets
  ASSETS.forEach((sym, i) => {
    node(`a-${sym}`, 992, i * 62 - 30, { kind: "asset", title: sym, symbol: sym });
    edge("exec", `a-${sym}`);
    edge(`a-${sym}`, "profit");
  });

  // profit → buyback → token (flywheel)
  node("profit", 1240, 40, { kind: "profit", title: "Realized P&L", sub: "fees + gains" });
  node("buyback", 1240, 150, { kind: "buyback", title: "Buyback engine", sub: "scheduled", status: "live" });
  node("token", 1240, 250, { kind: "token", title: "$URI holders", sub: "value accrues" });
  edge("profit", "buyback");
  edge("buyback", "token");
  edge("token", "brain", true); // flywheel back

  return { nodes: n, edges: e };
}

export function StrategyFlow() {
  const { nodes, edges } = useMemo(build, []);
  return (
    <div className="relative h-full w-full flex-1 overflow-hidden rounded-[4px] border border-white/[0.08] bg-[#0a0a0b]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.12 }}
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
        <Background variant={BackgroundVariant.Dots} gap={26} size={1} color="rgba(255,255,255,0.05)" />
      </ReactFlow>
      <div className="pointer-events-none absolute left-5 top-4 text-sm text-muted-foreground">
        Live routing
      </div>
    </div>
  );
}
