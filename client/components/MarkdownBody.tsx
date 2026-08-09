import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/** Lightweight markdown-ish renderer for blog / library bodies (with internal links). */
export function MarkdownBody({ source }: { source: string }) {
  const blocks = source.trim().split(/\n{2,}/);
  return (
    <div className="space-y-4 leading-relaxed text-[var(--color-ink)]">
      {blocks.map((block, index) => {
        const trimmed = block.trim();
        if (trimmed.startsWith("### ")) {
          return (
            <h3
              key={index}
              className="font-display text-lg text-[var(--color-ink)]"
            >
              {formatInline(trimmed.slice(4))}
            </h3>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h2
              key={index}
              className="font-display text-xl text-[var(--color-ink)]"
            >
              {formatInline(trimmed.slice(3))}
            </h2>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h2
              key={index}
              className="font-display text-2xl text-[var(--color-ink)]"
            >
              {formatInline(trimmed.slice(2))}
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
        if (/^[-*] /.test(trimmed) || trimmed.includes("\n- ") || trimmed.includes("\n* ")) {
          const items = trimmed
            .split("\n")
            .map((l) => l.replace(/^[-*]\s+/, "").trim())
            .filter(Boolean);
          return (
            <ul
              key={index}
              className="list-disc space-y-2 pl-5 text-[var(--color-ink-muted)]"
            >
              {items.map((item, i) => (
                <li key={i}>{formatInline(item)}</li>
              ))}
            </ul>
          );
        }
        if (/^\d+\.\s/.test(trimmed) || /\n\d+\.\s/.test(trimmed)) {
          const items = trimmed
            .split("\n")
            .map((l) => l.replace(/^\d+\.\s+/, "").trim())
            .filter(Boolean);
          return (
            <ol
              key={index}
              className="list-decimal space-y-2 pl-5 text-[var(--color-ink-muted)]"
            >
              {items.map((item, i) => (
                <li key={i}>{formatInline(item)}</li>
              ))}
            </ol>
          );
        }
        return (
          <p
            key={index}
            className="whitespace-pre-wrap text-[var(--color-ink-muted)]"
          >
            {formatInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

function formatInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Links first, then bold/italic inside remaining text segments.
  const linkRe = /\[([^\]]+)\]\((\/[^)\s]+|https?:\/\/[^)\s]+)\)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = linkRe.exec(text))) {
    if (match.index > last) {
      nodes.push(...formatBoldItalic(text.slice(last, match.index), key));
      key += 20;
    }
    const label = match[1]!;
    const href = match[2]!;
    if (href.startsWith("/")) {
      nodes.push(
        <Link
          key={key++}
          to={href}
          className="font-medium text-[var(--color-green)] underline underline-offset-2"
        >
          {label}
        </Link>,
      );
    } else {
      nodes.push(
        <a
          key={key++}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[var(--color-blue)] underline underline-offset-2"
        >
          {label}
        </a>,
      );
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    nodes.push(...formatBoldItalic(text.slice(last), key));
  }
  return nodes;
}

function formatBoldItalic(text: string, startKey: number): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|_([^_\n]+)_/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = startKey;
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
