import "dotenv/config";
import { aiMode, vibe, review } from "../server/ai";
import { LESSONS } from "../shared/content";

const lesson = LESSONS.find((l) => l.id === "l2-quiz")!;
console.log("mode:", aiMode);
const t0 = Date.now();
try {
  const out = await vibe(lesson, lesson.starter, "Сделай первый вопрос про Марс с 4 вариантами ответа и подсчётом очков", []);
  console.log("vibe ok in", ((Date.now() - t0) / 1000).toFixed(1), "s; mode:", out.mode);
  console.log("explanation:", out.explanation);
  console.log("html length:", out.html.length, "| has <script>:", out.html.includes("<script"), "| mentions Марс:", out.html.includes("Марс"));
  const t1 = Date.now();
  const r = await review(lesson, out.html, [{ at: Date.now(), text: "Сделай первый вопрос про Марс с 4 вариантами ответа и подсчётом очков", reply: out.explanation, mode: "ai" }]);
  console.log("review ok in", ((Date.now() - t1) / 1000).toFixed(1), "s:", JSON.stringify(r, null, 1));
} catch (e: any) {
  console.log("ERROR:", e?.constructor?.name, e?.status ?? "", String(e?.message ?? e).slice(0, 400));
}
