import { useLocation } from "react-router-dom";
import messages from "./examUi.en.json";
const dictionary: Record<string, string> = messages;
export function isEnglishExamRoute(pathname: string, search = "", course?: string) {
  if (/^\/(sat|ielts)(\/|$)/.test(pathname)) return true;
  if (/^\/learn\/(sat-math|sat-rw|ielts-reading)(\/|$)/.test(pathname)) return true;
  if (pathname !== "/learn") return false;
  let selected = course ?? new URLSearchParams(search).get("course");
  if (!selected && typeof window !== "undefined") {
    try { selected = localStorage.getItem("nc-course"); } catch { /* storage may be disabled */ }
  }
  return ["sat-math", "sat-rw", "ielts-reading"].includes(selected ?? "");
}
export function useExamCopy(course?: string) {
  const { pathname, search } = useLocation();
  const english = isEnglishExamRoute(pathname, search, course);
  return (text: string) => english ? dictionary[text] ?? text : text;
}
