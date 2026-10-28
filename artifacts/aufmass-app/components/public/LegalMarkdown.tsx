import type { ReactNode } from "react";

// Conservative markdown subset for the legal texts: #/## headings,
// paragraphs, **bold**, bare https URLs. No raw HTML is ever emitted.
// Short lines (addresses, label rows) keep their line break; long
// wrapped prose lines are joined into flowing text.

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|(https:\/\/[^\s]+?)(?=[.,;)]?(?:\s|$))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(<strong key={`${key}b${i++}`} className="font-semibold text-schrift">{m[1]}</strong>);
    else out.push(<a key={`${key}a${i++}`} href={m[2]} className="break-all text-akzent underline underline-offset-2" rel="noopener noreferrer">{m[2]}</a>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function LegalMarkdown({ source }: { source: string }) {
  const blocks = source.replace(/\r\n/g, "\n").trim().split(/\n\s*\n/);
  return (
    <div className="space-y-4 text-[15px] leading-7 text-schrift-sekundaer">
      {blocks.map((block, b) => {
        const lines = block.split("\n");
        if (lines.length === 1 && lines[0].startsWith("# ")) {
          return <h1 key={b} className="text-3xl font-semibold tracking-tight text-schrift">{lines[0].slice(2)}</h1>;
        }
        if (lines.length === 1 && lines[0].startsWith("## ")) {
          return <h2 key={b} className="pt-4 text-lg font-semibold text-schrift">{lines[0].slice(3)}</h2>;
        }
        const parts: ReactNode[] = [];
        lines.forEach((line, l) => {
          if (l > 0) parts.push(lines[l - 1].length < 60 ? <br key={`br${l}`} /> : " ");
          parts.push(...inline(line, `${b}-${l}-`));
        });
        return <p key={b}>{parts}</p>;
      })}
    </div>
  );
}
