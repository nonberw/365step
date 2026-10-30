import "dotenv/config";
import fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { INTENTS } from "../../shared/cadIntent";

// Step 1 of training the school's own request-understanding model (knowledge distillation):
// Claude, the "teacher", writes varied requests a student might type for each kind of part, in Russian, Kazakh
// and English, with typos and slang. The labelled set goes to data/cad-intent.jsonl and is committed with the code.
// Run once (paid API calls): npx tsx scripts/cad-intent/gen-data.ts

const client = new Anthropic();
const PER_CALL = 40;
const CALLS = 3;
const out: { text: string; label: string }[] = [];

for (const intent of INTENTS) {
  for (let c = 0; c < CALLS; c++) {
    const res = await client.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 8000,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: { type: "object", properties: { items: { type: "array", items: { type: "string" } } }, required: ["items"], additionalProperties: false } },
      },
      messages: [
        {
          role: "user",
          content: `Ты помогаешь собрать датасет для классификатора запросов в школьном CAD-конструкторе.
Категория: «${intent.title}» — ${intent.describe}.
Напиши ${PER_CALL} разных запросов, которые школьник мог бы ввести, чтобы получить такую деталь. Разнообразь: длина (от 3 слов до 2 предложений), с размерами и без, разные синонимы, разговорный стиль, опечатки в 10 % случаев; ${c === 0 ? "только по-русски" : c === 1 ? "половина по-русски, половина по-казахски" : "треть по-английски, остальное по-русски"}. Не повторяйся. Верни JSON {"items": [...]}`,
        },
      ],
    } as Anthropic.MessageCreateParamsNonStreaming);
    const text = res.content.find((b) => b.type === "text");
    const items = text && text.type === "text" ? (JSON.parse(text.text) as { items: string[] }).items : [];
    for (const t of items) out.push({ text: t.trim(), label: intent.id });
    console.log(intent.id, c, items.length);
  }
}
fs.mkdirSync("data-train", { recursive: true });
fs.writeFileSync("data-train/cad-intent.jsonl", out.map((r) => JSON.stringify(r)).join("\n") + "\n");
console.log(`${out.length} examples → data-train/cad-intent.jsonl`);
