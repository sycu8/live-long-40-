import type { ReactNode } from "react";

/** Lightweight markdown-ish renderer for blog bodies. */
export function MarkdownBody({ source }: { source: string }) {
  const blocks = source.trim().split(/\n{2,}/);
  return (
    <div className="space-y-4 leading-relaxed text-[var(--color-ink)]">
      {blocks.map((block, index) => {
        const trimmed = block.trim();
        if (trimmed.startsWith("## ")) {
          return (
            <h2 key={index} className="font-display text-xl text-[var(--color-ink)]">
              {trimmed.slice(3)}
            </h2>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h2 key={index} className="font-display text-2xl text-[var(--color-ink)]">
              {trimmed.slice(2)}
            </h2>
          );
        }
        if (trimmed.includes("|") && trimmed.includes("\n")) {
          return (
            <pre
              key={index}
              className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-[var(--color-green-soft)]/40 p-3 text-sm"
            >
              {trimmed}
            </pre>
          );
        }
        return (
          <p key={index} className="whitespace-pre-wrap text-[var(--color-ink-muted)]">
            {formatInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

function formatInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|_([^_\n]+)_/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text))) {
    if (match.index > last) {
      nodes.push(<span key={key++}>{text.slice(last, match.index)}</span>);
    }
    if (match[1]) {
      nodes.push(
        <strong key={key++} className="font-semibold text-[var(--color-ink)]">
          {match[1]}
        </strong>,
      );
    } else if (match[2]) {
      nodes.push(
        <em key={key++} className="italic">
          {match[2]}
        </em>,
      );
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    nodes.push(<span key={key++}>{text.slice(last)}</span>);
  }
  return nodes;
}
