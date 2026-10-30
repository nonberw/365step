// Human text for a simulator condition (shared by the teacher's page and the student's simulator panel).
import { t } from "../i18n";
import { CONDITIONS, type SimCondition } from "./checks";

export function conditionText(c: SimCondition): string {
  const label = CONDITIONS.find((x) => x.kind === c.kind)?.label ?? c.kind;
  return t(label, { ms: c.kind === "blink" ? c.periodMs : "", cm: c.kind === "alarm-below" ? c.cm : "", text: c.kind === "serial" ? c.text : "" });
}
