// From Athena IDE (src/lib/i18n.ts).
// Tiny typed i18n: the English text is the key, `{name}` marks variables, a missing translation falls back to English.
// Plurals use Intl.PluralRules (Russian needs one/few/many/other; Kazakh has one/other).
import { ru } from "./locales/ru";

export type Lang = "en" | "ru" | "kk";
export const LANGS: { id: Lang; short: string; name: string }[] = [
  { id: "en", short: "EN", name: "English" },
  { id: "ru", short: "RU", name: "Русский" },
  { id: "kk", short: "KZ", name: "Қазақша" },
];

type Forms = Partial<Record<Intl.LDMLPluralRule, string>>;
export type Dict = Record<string, string | Forms>;
type Vars = Record<string, string | number>;

// Росток speaks Russian: the Kazakh dictionary is not bundled, Russian is the fixed language.
const DICTS: Partial<Record<Lang, Dict>> = { ru };
let current: Lang = "ru";
const STORAGE_KEY = "athena-lang";

export const getLang = () => current;

export function setLang(l: Lang) {
  current = l;
  try { localStorage.setItem(STORAGE_KEY, l); } catch { /* private mode */ }
  if (typeof document !== "undefined") document.documentElement.lang = l;
}

/** Saved choice, else the browser language, else English. */
export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "ru" || saved === "kk") return saved;
  } catch { /* ignore */ }
  const nav = (typeof navigator !== "undefined" ? navigator.language : "en").toLowerCase();
  return nav.startsWith("ru") ? "ru" : nav.startsWith("kk") ? "kk" : "en";
}

const fill = (tpl: string, vars?: Vars) => (vars ? tpl.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : tpl);

/** Translate a string. `key` is the English source text. */
export function t(key: string, vars?: Vars): string {
  const e = DICTS[current]?.[key];
  return fill(typeof e === "string" ? e : key, vars);
}

/** Plural-aware: `one`/`other` are the English forms; other languages are looked up by the `other` text. */
export function tn(n: number, one: string, other: string, vars?: Vars): string {
  const v = { n, ...vars };
  const e = DICTS[current]?.[other];
  if (e && typeof e === "object") return fill(e[new Intl.PluralRules(current).select(n)] ?? e.other ?? other, v);
  if (typeof e === "string") return fill(e, v);
  return fill(n === 1 ? one : other, v);
}
