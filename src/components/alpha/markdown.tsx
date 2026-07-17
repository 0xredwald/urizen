"use client";

import { Fragment, type ReactNode } from "react";

// Lightweight, safe markdown → JSX. No dangerouslySetInnerHTML — every value is a React child,
// so it's auto-escaped. Handles the subset the agent actually emits: headings, bold/italic,
// inline code, fenced code blocks, bullet/numbered lists, links, blockquotes, and paragraphs.

function inline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // order matters: code first (so ** inside code isn't parsed), then links, bold, italic
  const re = /(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*]+\*)|(_[^_]+_)/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(<Fragment key={`${keyBase}-t${i}`}>{text.slice(last, m.index)}</Fragment>);
    const tok = m[0];
    if (tok.startsWith("`")) nodes.push(<code key={`${keyBase}-c${i}`} className="rounded bg-white/[0.08] px-1.5 py-0.5 font-mono text-[0.9em] text-signal">{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("[")) {
      const lm = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok)!;
      nodes.push(<a key={`${keyBase}-l${i}`} href={lm[2]} target="_blank" rel="noopener noreferrer" className="text-signal underline underline-offset-2 hover:opacity-80">{lm[1]}</a>);
    }
    else if (tok.startsWith("**") || tok.startsWith("__")) nodes.push(<strong key={`${keyBase}-b${i}`} className="font-semibold text-foreground">{tok.slice(2, -2)}</strong>);
    else nodes.push(<em key={`${keyBase}-i${i}`}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length; i++;
  }
  if (last < text.length) nodes.push(<Fragment key={`${keyBase}-tend`}>{text.slice(last)}</Fragment>);
  return nodes;
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0, k = 0;

  while (i < lines.length) {
    const line = lines[i];

    // fenced code block
    if (line.trimStart().startsWith("```")) {
      const lang = line.trim().slice(3);
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) { body.push(lines[i]); i++; }
      i++; // closing fence
      blocks.push(
        <pre key={k++} className="my-2 overflow-x-auto rounded-lg border border-border bg-[#08080a] p-3 font-mono text-[12.5px] leading-relaxed text-foreground/90">
          {lang && <div className="mb-1.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{lang}</div>}
          <code>{body.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // heading
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const lvl = h[1].length;
      const cls = lvl <= 1 ? "mt-3 text-[19px] font-semibold" : lvl === 2 ? "mt-3 text-[17px] font-semibold" : "mt-2 text-[15px] font-semibold";
      blocks.push(<div key={k++} className={`${cls} tracking-tight text-foreground`}>{inline(h[2], `h${k}`)}</div>);
      i++; continue;
    }

    // blockquote
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { quote.push(lines[i].replace(/^>\s?/, "")); i++; }
      blocks.push(<blockquote key={k++} className="my-2 border-l-2 border-signal/40 pl-3 text-muted-foreground">{inline(quote.join(" "), `q${k}`)}</blockquote>);
      continue;
    }

    // lists (bullet or numbered)
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, "")); i++;
      }
      const inner = items.map((it, j) => <li key={j} className="leading-relaxed">{inline(it, `li${k}-${j}`)}</li>);
      blocks.push(ordered
        ? <ol key={k++} className="my-1.5 ml-5 list-decimal space-y-1">{inner}</ol>
        : <ul key={k++} className="my-1.5 ml-5 list-disc space-y-1 marker:text-signal/60">{inner}</ul>);
      continue;
    }

    // blank line
    if (line.trim() === "") { i++; continue; }

    // paragraph (gather until blank/structural)
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^\s*([-*]|\d+\.)\s+/.test(lines[i]) && !/^(#{1,4})\s/.test(lines[i]) && !lines[i].trimStart().startsWith("```") && !/^>\s?/.test(lines[i])) {
      para.push(lines[i]); i++;
    }
    blocks.push(<p key={k++} className="leading-relaxed">{inline(para.join("\n"), `p${k}`)}</p>);
  }

  return <div className="space-y-2">{blocks}</div>;
}
