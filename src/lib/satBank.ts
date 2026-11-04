export const LIST_KEY = "bsts-sat-list";
export const BANK_CONTEXT_KEY = "bsts-sat-bank-context";
export interface BankContext { query: string; returnTo: string }
export function newBankSeed() { return Array.from(crypto.getRandomValues(new Uint32Array(2)), n => n.toString(36)).join("-"); }
export function readBankIds(): string[] {
  try { const value: unknown = JSON.parse(sessionStorage.getItem(LIST_KEY) ?? "[]"); return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []; } catch { return []; }
}
export function readBankContext(): BankContext | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(BANK_CONTEXT_KEY) ?? "null");
    return value && typeof value.query === "string" && typeof value.returnTo === "string" && value.returnTo.startsWith("/sat/bank?") ? value : null;
  } catch { return null; }
}
export function saveBankSequence(ids: string[], context: BankContext) {
  try { sessionStorage.setItem(LIST_KEY, JSON.stringify(ids)); sessionStorage.setItem(BANK_CONTEXT_KEY, JSON.stringify(context)); } catch { /* Practice remains usable when browser storage is disabled. */ }
}
