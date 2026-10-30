import { all, run } from "./db";

// The school's own CAD knowledge base. Every part the AI designer builds without errors and whose measured size matches
// the size the model announced is stored as a verified (prompt → code) pair. New requests retrieve the most similar
// verified designs and send them to the model as examples (retrieval-augmented few-shot), so the designer gets better
// at the parts students actually ask for. The same pairs export as a JSONL dataset in chat format — ready to fine-tune
// an open code model (for example Qwen-Coder with LoRA, as in the Text-to-CadQuery project) when the school has enough.

/** Rough Russian/English stemming: lowercase words, numbers kept, words cut to 6 letters. */
const tokens = (s: string) =>
  (
    s
      .toLowerCase()
      .replace(/ё/g, "е")
      .match(/[a-zа-яәіңғүұқөһ]+|\d+/g) ?? []
  )
    .filter((w) => w.length > 2 || /\d/.test(w))
    .map((w) => (/\d/.test(w) ? w : w.slice(0, 6)));

function tf(words: string[]) {
  const m = new Map<string, number>();
  for (const w of words) m.set(w, (m.get(w) ?? 0) + 1);
  return m;
}

/** TF-IDF cosine similarity of the request to every verified design; returns the top `k` above a minimum score. */
export async function similarDesigns(prompt: string, k = 3) {
  const rows = await all<{ prompt: string; code: string }>("SELECT prompt, code FROM cad_designs WHERE verified = 1 ORDER BY id DESC LIMIT 400");
  if (!rows.length) return [];
  const docs = rows.map((r) => tf(tokens(r.prompt)));
  const df = new Map<string, number>();
  for (const d of docs) for (const w of d.keys()) df.set(w, (df.get(w) ?? 0) + 1);
  const idf = (w: string) => Math.log((1 + docs.length) / (1 + (df.get(w) ?? 0))) + 1;
  const vec = (d: Map<string, number>) => new Map([...d].map(([w, n]) => [w, n * idf(w)]));
  const norm = (v: Map<string, number>) => Math.sqrt([...v.values()].reduce((a, x) => a + x * x, 0)) || 1;
  const q = vec(tf(tokens(prompt)));
  const qn = norm(q);
  return rows
    .map((r, i) => {
      const v = vec(docs[i]);
      let dot = 0;
      for (const [w, x] of q) dot += x * (v.get(w) ?? 0);
      return { ...r, score: dot / (qn * norm(v)) };
    })
    .filter((r) => r.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

export async function saveDesign(userId: string, prompt: string, code: string, bbox: number[], volume: number, verified: boolean) {
  await run(
    "INSERT INTO cad_designs (user_id, prompt, code, bbox, volume, verified, at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    userId,
    prompt.slice(0, 1500),
    code.slice(0, 20000),
    JSON.stringify(bbox),
    volume,
    verified ? 1 : 0,
    Date.now(),
  );
}

/** Chat-format JSONL of verified designs for fine-tuning an open model. */
export async function datasetJsonl() {
  const rows = await all<{ prompt: string; code: string; bbox: string }>("SELECT prompt, code, bbox FROM cad_designs WHERE verified = 1 ORDER BY id");
  return rows
    .map((r) =>
      JSON.stringify({
        messages: [
          { role: "system", content: "Ты пишешь параметрические CAD-модели на replicad (OpenCascade). Верни код с function main(r)." },
          { role: "user", content: r.prompt },
          { role: "assistant", content: r.code },
        ],
        meta: { bbox: JSON.parse(r.bbox) },
      }),
    )
    .join("\n");
}
