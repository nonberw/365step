import type { CodeLang, CodingProblem } from "@shared/types";
import { sameAnswer } from "@shared/answer";

// Student code runs in a Web Worker, never on the server: an infinite loop
// only freezes the worker, which we terminate after the time limit.
// Python runs on Pyodide (CPython compiled to WebAssembly) loaded from jsDelivr.

const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.27.2/full/";
const TIME_LIMIT_MS = { javascript: 4000, python: 8000 };

export interface TestResult {
  index: number;
  passed: boolean;
  got: unknown;
  expected: unknown;
  error?: string;
  ms: number;
}

export interface RunOutput {
  results: TestResult[];
  logs: string[];
  error?: string;
}

const WORKER_SRC = `
let pyodide = null;
self.onmessage = async (e) => {
  const { lang, code, fn, tests } = e.data;
  const logs = [];
  const results = [];
  try {
    if (lang === "javascript") {
      const log = (...a) => logs.push(a.map((x) => typeof x === "string" ? x : JSON.stringify(x)).join(" "));
      const make = new Function("console", code + "\\n;return typeof " + fn + " === 'function' ? " + fn + " : undefined;");
      const f = make({ log, error: log, warn: log, info: log });
      if (typeof f !== "function") throw new Error("Не найдена функция " + fn);
      tests.forEach((t, i) => {
        const s = performance.now();
        try {
          const got = f(...structuredClone(t.args));
          results.push({ index: i, got: got === undefined ? null : got, ms: performance.now() - s });
        } catch (err) {
          results.push({ index: i, got: null, error: String(err && err.message || err), ms: performance.now() - s });
        }
      });
    } else {
      if (!pyodide) {
        importScripts("${PYODIDE}pyodide.js");
        pyodide = await loadPyodide({ indexURL: "${PYODIDE}" });
      }
      pyodide.setStdout({ batched: (s) => logs.push(s) });
      pyodide.setStderr({ batched: (s) => logs.push(s) });
      const ns = pyodide.globals.get("dict")();
      pyodide.runPython(code, { globals: ns });
      const f = ns.get(fn);
      if (!f) throw new Error("Не найдена функция " + fn);
      tests.forEach((t, i) => {
        const s = performance.now();
        try {
          const args = t.args.map((a) => pyodide.toPy(a));
          const out = f(...args);
          const got = out && out.toJs ? out.toJs({ dict_converter: Object.fromEntries }) : out;
          results.push({ index: i, got: got === undefined ? null : got, ms: performance.now() - s });
        } catch (err) {
          const msg = String(err && err.message || err).split("\\n").filter(Boolean).slice(-2).join(" ");
          results.push({ index: i, got: null, error: msg, ms: performance.now() - s });
        }
      });
    }
    self.postMessage({ results, logs });
  } catch (err) {
    const msg = String(err && err.message || err).split("\\n").filter(Boolean).slice(-3).join(" ");
    self.postMessage({ results, logs, error: msg });
  }
};
`;

let pyWorker: Worker | null = null;

function makeWorker() {
  return new Worker(URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" })));
}

export function warmPython() {
  pyWorker ??= makeWorker();
}

export function runTests(lang: CodeLang, code: string, problem: CodingProblem, tests: CodingProblem["tests"]): Promise<RunOutput> {
  const worker = lang === "python" ? (pyWorker ??= makeWorker()) : makeWorker();
  const fn = lang === "python" ? problem.fn.py : problem.fn.js;
  return new Promise((resolve) => {
    // Python's first run downloads Pyodide (~10 MB), so it gets a longer first deadline.
    const limit = TIME_LIMIT_MS[lang] + (lang === "python" ? 20000 : 0);
    const timer = window.setTimeout(() => {
      worker.terminate();
      if (lang === "python") pyWorker = null;
      resolve({ results: [], logs: [], error: `Превышено время выполнения (${Math.round(TIME_LIMIT_MS[lang] / 1000)} с). Проверь, нет ли бесконечного цикла.` });
    }, limit);
    worker.onmessage = (e: MessageEvent<{ results: { index: number; got: unknown; error?: string; ms: number }[]; logs: string[]; error?: string }>) => {
      window.clearTimeout(timer);
      if (lang === "javascript") worker.terminate();
      const results = e.data.results.map((r) => ({
        ...r,
        expected: tests[r.index]!.expected,
        passed: !r.error && sameAnswer(r.got, tests[r.index]!.expected, problem.unordered, problem.unorderedInner),
      }));
      resolve({ results, logs: e.data.logs, error: e.data.error });
    };
    worker.postMessage({ lang, code, fn, tests });
  });
}
