"use client";

import { useMemo } from "react";
import {
  ReactFlow, Background, BackgroundVariant, Handle, Position, MarkerType,
  type Node, type Edge, type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { StockLogo } from "@/components/brand/stock-logo";
import type { AgentConfig } from "@/lib/agent-graph";

export type BlockKind = "trigger" | "conditions" | "actions" | "instruments";

type BData = {
  kind: BlockKind;
  title: string;
  lines: string[];
  symbols?: string[];
  selected?: boolean;
};

const glyph: Record<BlockKind, string> = { trigger: "⌁", conditions: "⋔", actions: "⇉", instruments: "◈" };

const H = (pos: Position) => (
  <Handle type={pos === Position.Left ? "target" : "source"} position={pos} className="!h-1.5 !w-1.5 !border-0 !bg-signal/50" />
);

function Block({ data }: NodeProps<Node<BData>>) {
  const d = data;
  return (
    <div
      className={`grid gap-1.5 border bg-[#0c0c0e]/95 px-3 py-2.5 backdrop-blur-xl transition-colors ${
        d.selected ? "border-signal shadow-[0_0_20px_rgba(52,240,3,0.28)]" : "border-white/12 hover:border-signal/40"
      }`}
      style={{ width: 190 }}
    >
      {d.kind !== "trigger" && H(Position.Left)}
      <div className="flex items-center gap-2 border-b border-white/8 pb-1.5">
        <span className="text-signal">{glyph[d.kind]}</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{d.title}</span>
      </div>
      {d.symbols ? (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {d.symbols.map((s) => (
            <span key={s} className="flex items-center gap-1 border border-white/10 py-0.5 pl-0.5 pr-1">
              <StockLogo symbol={s} size={14} />
              <span className="font-mono text-[9px]">{s}</span>
            </span>
          ))}
        </div>
      ) : (
        <div className="grid gap-0.5">
          {d.lines.map((l, i) => (
            <span key={i} className="font-mono text-[10px] leading-snug text-foreground/90">{l}</span>
          ))}
        </div>
      )}
      {d.kind !== "instruments" && H(Position.Right)}
    </div>
  );
}

const nodeTypes = { block: Block };

function build(cfg: AgentConfig, selected: BlockKind | null): { nodes: Node<BData>[]; edges: Edge[] } {
  const opWord = (op: string) => op.replace("crosses_above", "×↑").replace("crosses_below", "×↓");
  const t = cfg.trigger;
  const trigLines = [
    t.kind === "interval" || t.kind === "session" ? `every ${t.every ?? "6h"}` : `${t.symbol ?? ""} ${t.indicator ?? ""} ${opWord(t.op ?? "")} ${t.value ?? ""}`.trim(),
    `kind · ${t.kind}`,
  ];
  const condLines = cfg.conditions.length
    ? cfg.conditions.map((c) => `${c.symbol ? c.symbol + " " : ""}${c.indicator} ${opWord(c.op)} ${c.value}`)
    : ["(always)"];
  const actLines = cfg.actions.length
    ? cfg.actions.map((a) => `${a.kind}${a.symbol ? " " + a.symbol : ""}${a.sizePct != null ? ` · ${a.sizePct}%` : ""}`)
    : ["hold"];

  const col = (kind: BlockKind, x: number, title: string, lines: string[], symbols?: string[]): Node<BData> => ({
    id: kind, type: "block", position: { x, y: 0 }, draggable: false,
    data: { kind, title, lines, symbols, selected: selected === kind },
  });

  const nodes: Node<BData>[] = [
    col("trigger", 0, "When", trigLines),
    col("conditions", 240, `Conditions · ${cfg.conditions.length}`, condLines),
    col("actions", 480, `Then · ${cfg.actions.length}`, actLines),
    col("instruments", 720, `Instruments · ${cfg.instruments.length}`, [], cfg.instruments),
  ];
  const edge = (s: string, t2: string): Edge => ({
    id: `${s}-${t2}`, source: s, target: t2, animated: true,
    style: { stroke: "rgba(52,240,3,0.5)", strokeWidth: 1.4 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "rgba(52,240,3,0.5)", width: 14, height: 14 },
  });
  const edges = [edge("trigger", "conditions"), edge("conditions", "actions"), edge("actions", "instruments")];
  return { nodes, edges };
}

export function ConfigGraph({
  config, selected, onSelect,
}: {
  config: AgentConfig;
  selected: BlockKind | null;
  onSelect: (k: BlockKind) => void;
}) {
  const { nodes, edges } = useMemo(() => build(config, selected), [config, selected]);
  return (
    <div className="relative h-[220px] w-full overflow-hidden border border-border bg-[#0a0a0b]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.14 }}
        nodesDraggable={false}
        nodesConnectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, n) => onSelect(n.id as BlockKind)}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="rgba(242,241,236,0.06)" />
      </ReactFlow>
      <span className="pointer-events-none absolute bottom-1.5 right-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        sleeve {config.sleevePct}% · {config.guards.length} guards
      </span>
    </div>
  );
}
