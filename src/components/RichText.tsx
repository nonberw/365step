import { Fragment, useMemo } from "react";
import katex from "katex";
import { cn } from "@/lib/utils";
import { mathTextParts } from "@/lib/mathText";

/**
 * Renders question text: $LaTeX$ through KaTeX, **bold**, __underline__, line breaks and
 * simple pipe tables (used by the data questions).
 */
export function RichText({ text, className, math = false }: { text: string; className?: string; math?: boolean }) {
  const blocks = useMemo(() => splitBlocks(text), [text]);
  return (
    <div className={cn("rich-text space-y-2 leading-relaxed", className)}>
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
                          <Inline text={cell} math={math} />
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
            <Inline text={b.text} math={math} />
          </h3>
        ) : (
          <p key={i} className="whitespace-pre-line">
            <Inline text={b.text} math={math} />
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

function Formula({ tex, display = false }: { tex: string; display?: boolean }) {
  const html = useMemo(() => katex.renderToString(tex, { throwOnError: false, trust: false, displayMode: display, maxExpand: 1000 }), [tex, display]);
  return <span className={display ? "math-display" : "math-inline"} dangerouslySetInnerHTML={{ __html: html }} />;
}

function Plain({ text, math }: { text: string; math: boolean }) {
  if (!math) return <>{text}</>;
  return <>{mathTextParts(text).map((part, i) => part.kind === "math" ? <Formula key={i} tex={part.tex} /> : <Fragment key={i}>{part.text}</Fragment>)}</>;
}

export function Inline({ text, math = false }: { text: string; math?: boolean }) {
  // Recognize answer blanks before __underline__ delimiters. Otherwise six
  // underscores are recursively consumed as empty underline markup.
  const parts = text.split(/(`[^`]+`|\$\$[\s\S]+?\$\$|\$[^$\n]+\$(?!\d)|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]|\*\*[^*]+\*\*|_{3,}|__(?!_)[\s\S]+?(?<!_)__(?!_))/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("$$") && p.endsWith("$$") && p.length > 4) return <Formula key={i} tex={p.slice(2, -2)} display />;
        if ((p.startsWith("\\(") && p.endsWith("\\)")) || (p.startsWith("\\[") && p.endsWith("\\]"))) return <Formula key={i} tex={p.slice(2, -2)} display={p.startsWith("\\[")} />;
        if (p.startsWith("$") && p.endsWith("$") && p.length > 2) {
          return <Formula key={i} tex={p.slice(1, -1)} />;
        }
        if (/^_{3,}$/.test(p)) return <Fragment key={i}>{p}</Fragment>;
        if (p.startsWith("__") && p.endsWith("__") && p.length > 4) return <u key={i}><Inline text={p.slice(2, -2)} math={math} /></u>;
        if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}><Inline text={p.slice(2, -2)} math={math} /></strong>;
        if (p.startsWith("`") && p.endsWith("`") && p.length > 2) {
          if (math && mathTextParts(p.slice(1, -1)).some(part => part.kind === "math")) return <Plain key={i} text={p.slice(1, -1)} math />;
          return (
            <code key={i} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.9em]">
              {p.slice(1, -1)}
            </code>
          );
        }
        return <Plain key={i} text={p} math={math} />;
      })}
    </>
  );
}
