import { Fragment, useMemo } from "react";
import katex from "katex";
import { cn } from "@/lib/utils";

/**
 * Renders question text: $LaTeX$ through KaTeX, **bold**, line breaks and
 * simple pipe tables (used by the data questions).
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = useMemo(() => splitBlocks(text), [text]);
  return (
    <div className={cn("space-y-2 leading-relaxed", className)}>
      {blocks.map((b, i) =>
        b.kind === "table" ? (
          <div key={i} className="overflow-x-auto">
            <table className="min-w-[280px] border-collapse text-sm">
              <tbody>
                {b.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, c) => {
                      const Tag = r === 0 || c === 0 ? "th" : "td";
                      return (
                        <Tag key={c} className={cn("border border-border px-3 py-1.5 text-left", Tag === "th" && "bg-muted font-semibold")}>
                          <Inline text={cell} />
                        </Tag>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : b.kind === "h" ? (
          <h3 key={i} className="pt-2 font-display text-lg font-semibold">
            <Inline text={b.text} />
          </h3>
        ) : (
          <p key={i} className="whitespace-pre-line">
            <Inline text={b.text} />
          </p>
        ),
      )}
    </div>
  );
}

type Block = { kind: "text"; text: string } | { kind: "h"; text: string } | { kind: "table"; rows: string[][] };

function splitBlocks(text: string): Block[] {
  const out: Block[] = [];
  let table: string[][] | null = null;
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push({ kind: "text", text: para.join("\n") });
    para = [];
  };
  for (const line of text.split("\n")) {
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flush();
      if (/^\s*\|[\s|:-]+\|\s*$/.test(line)) continue; // separator row
      table ??= [];
      table.push(line.trim().slice(1, -1).split("|").map((c) => c.trim()));
      continue;
    }
    if (table) {
      out.push({ kind: "table", rows: table });
      table = null;
    }
    if (line.startsWith("## ")) {
      flush();
      out.push({ kind: "h", text: line.slice(3) });
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    para.push(line);
  }
  if (table) out.push({ kind: "table", rows: table });
  flush();
  return out;
}

export function Inline({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\$[^$]+\$|\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("$") && p.endsWith("$") && p.length > 2) {
          const html = katex.renderToString(p.slice(1, -1), { throwOnError: false });
          return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
        }
        if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
        if (p.startsWith("`") && p.endsWith("`") && p.length > 2)
          return (
            <code key={i} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.9em]">
              {p.slice(1, -1)}
            </code>
          );
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}
