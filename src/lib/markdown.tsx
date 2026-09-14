import type { ReactNode } from "react";

/**
 * A deliberately tiny Markdown renderer for task notes.
 *
 * It never emits raw HTML: the source is parsed into React elements, so anything
 * a user writes (`<script>`, `<img onerror=...>`) is rendered as text by React's
 * own escaping. That is why there is no sanitizer dependency here.
 *
 * Supported: # headings, - / 1. lists, > quotes, ``` fences, --- rules,
 * **bold**, _italic_, ~~strike~~, `code`, [label](https://…).
 *
 * Keys are index-based, so the same input always produces the same tree on the
 * server and on the client (no hydration churn, no module-level counters).
 */

const CODE = /`([^`\n]+)`/g;
const BOLD = /\*\*([^*\n]+)\*\*|__([^_\n]+)__/g;
const ITALIC = /\*([^*\n]+)\*|_([^_\n]+)_/g;
const STRIKE = /~~([^~\n]+)~~/g;
const LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;

const HEADING = /^(#{1,3})\s+(.*)$/;
const UNORDERED_ITEM = /^\s*[-*]\s+(.*)$/;
const ORDERED_ITEM = /^\s*\d+[.)]\s+(.*)$/;
const QUOTE = /^\s*>\s?(.*)$/;
const DIVIDER = /^\s*(?:---|___|\*\*\*)\s*$/;
const FENCE = /^\s*```/;

const SAFE_LINK = /^(https?:|mailto:)/i;

function matchAll(pattern: RegExp, text: string) {
  pattern.lastIndex = 0;

  const matches: Array<RegExpExecArray> = [];
  let match = pattern.exec(text);

  while (match) {
    matches.push(match);
    match = pattern.exec(text);
  }

  return matches;
}

function renderLinks(text: string, keyPrefix: string): ReactNode[] {
  const matches = matchAll(LINK, text);

  if (matches.length === 0) {
    return [text];
  }

  const nodes: ReactNode[] = [];
  let cursor = 0;

  matches.forEach((match, index) => {
    nodes.push(...renderEmphasis(text.slice(cursor, match.index), `${keyPrefix}.${index}a`));

    const label = match[1];
    const href = match[2];
    const key = `${keyPrefix}.${index}link`;

    nodes.push(
      SAFE_LINK.test(href) ? (
        <a
          key={key}
          href={href}
          rel="noopener noreferrer nofollow"
          target={href.startsWith("http") ? "_blank" : undefined}
          className="text-[var(--accent)] underline decoration-[var(--accent)]/40 underline-offset-2 hover:decoration-[var(--accent)]"
        >
          {label}
        </a>
      ) : (
        // Dangerous schemes (javascript:, data:) are demoted to inert text.
        <span key={key}>{`${label} (${href})`}</span>
      ),
    );

    cursor = match.index + match[0].length;
  });

  nodes.push(...renderEmphasis(text.slice(cursor), `${keyPrefix}z`));

  return nodes;
}

function findEmphasis(text: string) {
  for (const [pattern, tag] of [
    [BOLD, "strong"],
    [STRIKE, "del"],
    [ITALIC, "em"],
  ] as const) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);

    if (match) {
      return { match, tag };
    }
  }

  return null;
}

function renderEmphasis(text: string, keyPrefix: string): ReactNode[] {
  const found = findEmphasis(text);

  if (!found) {
    return renderLinks(text, keyPrefix);
  }

  const { match, tag } = found;
  const before = text.slice(0, match.index);
  const after = text.slice(match.index + match[0].length);
  const content = match[1] ?? match[2] ?? "";
  const inner = renderEmphasis(content, `${keyPrefix}i`);

  return [
    ...renderEmphasis(before, `${keyPrefix}b`),
    tag === "strong" ? (
      <strong key={`${keyPrefix}s`}>{inner}</strong>
    ) : tag === "del" ? (
      <del key={`${keyPrefix}s`}>{inner}</del>
    ) : (
      <em key={`${keyPrefix}s`}>{inner}</em>
    ),
    ...renderEmphasis(after, `${keyPrefix}a`),
  ];
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const codeMatches = matchAll(CODE, text);

  if (codeMatches.length === 0) {
    return renderEmphasis(text, keyPrefix);
  }

  const nodes: ReactNode[] = [];
  let cursor = 0;

  codeMatches.forEach((match, index) => {
    const before = text.slice(cursor, match.index);

    if (before) {
      nodes.push(...renderEmphasis(before, `${keyPrefix}.${index}b`));
    }

    nodes.push(
      <code
        key={`${keyPrefix}.${index}c`}
        className="rounded bg-[var(--surface-sunken)] px-1 py-px font-mono text-[0.85em]"
      >
        {match[1]}
      </code>,
    );

    cursor = match.index + match[0].length;
  });

  const tail = text.slice(cursor);

  if (tail) {
    nodes.push(...renderEmphasis(tail, `${keyPrefix}t`));
  }

  return nodes;
}

const HEADING_STYLES: Record<number, string> = {
  1: "text-sm font-semibold text-[var(--text)]",
  2: "text-xs font-semibold uppercase tracking-wide text-[var(--text)]",
  3: "text-xs font-semibold uppercase tracking-wider text-[var(--muted)]",
};

export function renderMarkdown(source: string): ReactNode {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];

  const paragraph: string[] = [];
  const listItems: ReactNode[] = [];
  const quoteLines: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let codeLines: string[] | null = null;

  function push(block: ReactNode) {
    blocks.push(block);
  }

  function flushParagraph() {
    if (paragraph.length === 0) {
      return;
    }

    const text = paragraph.join(" ");
    paragraph.length = 0;

    push(
      <p key={`p-${blocks.length}`} className="leading-relaxed">
        {renderInline(text, `p${blocks.length}`)}
      </p>,
    );
  }

  function flushList() {
    if (listType === null || listItems.length === 0) {
      return;
    }

    const items = [...listItems];
    const type = listType;
    listItems.length = 0;
    listType = null;

    push(
      type === "ul" ? (
        <ul key={`ul-${blocks.length}`} className="list-disc space-y-1 pl-5">
          {items}
        </ul>
      ) : (
        <ol key={`ol-${blocks.length}`} className="list-decimal space-y-1 pl-5">
          {items}
        </ol>
      ),
    );
  }

  function flushQuote() {
    if (quoteLines.length === 0) {
      return;
    }

    const text = quoteLines.join(" ");
    quoteLines.length = 0;

    push(
      <blockquote
        key={`q-${blocks.length}`}
        className="border-l-2 border-[var(--line-strong)] pl-3 italic text-[var(--muted)]"
      >
        {renderInline(text, `q${blocks.length}`)}
      </blockquote>,
    );
  }

  function flushCode() {
    if (codeLines === null) {
      return;
    }

    push(
      <pre
        key={`pre-${blocks.length}`}
        className="overflow-x-auto rounded-xl bg-[var(--surface-sunken)] p-3 text-xs"
      >
        <code className="font-mono">{codeLines.join("\n")}</code>
      </pre>,
    );
    codeLines = null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (codeLines !== null) {
      if (FENCE.test(line)) {
        flushCode();
      } else {
        codeLines.push(line);
      }
      continue;
    }

    if (FENCE.test(line)) {
      flushParagraph();
      flushList();
      flushQuote();
      codeLines = [];
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      flushList();
      flushQuote();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      flushQuote();
      push(
        <p key={`h-${blocks.length}`} className={HEADING_STYLES[heading[1].length]}>
          {renderInline(heading[2], `h${blocks.length}`)}
        </p>,
      );
      continue;
    }

    if (DIVIDER.test(line)) {
      flushParagraph();
      flushList();
      flushQuote();
      push(<hr key={`hr-${blocks.length}`} className="border-[var(--line)]" />);
      continue;
    }

    const unordered = UNORDERED_ITEM.exec(line);
    const ordered = ORDERED_ITEM.exec(line);

    if (unordered || ordered) {
      flushParagraph();
      flushQuote();

      const wanted: "ul" | "ol" = unordered ? "ul" : "ol";

      if (listType !== null && listType !== wanted) {
        flushList();
      }

      listType = wanted;
      listItems.push(
        <li key={`li-${blocks.length}-${listItems.length}`}>
          {renderInline((unordered ?? ordered)![1], `li${blocks.length}-${listItems.length}`)}
        </li>,
      );
      continue;
    }

    const quote = QUOTE.exec(line);
    if (quote) {
      flushParagraph();
      flushList();
      quoteLines.push(quote[1]);
      continue;
    }

    paragraph.push(line.trim());
  }

  // An unterminated fence still shows its content rather than losing it.
  flushCode();
  flushParagraph();
  flushList();
  flushQuote();

  return blocks;
}

/** Single-line, marker-free text for list previews (no React, no HTML). */
export function stripMarkdown(source: string): string {
  return source
    .replace(/\r\n?/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .split("\n")
    .map((line) =>
      line
        .replace(LINK, "$1")
        .replace(/[#>*_~`-]+/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .join(" · ");
}
