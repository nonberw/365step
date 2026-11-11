import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { SAT_BANK } from "../shared/sat";
import { BANK_TOPICS, topicFor } from "../shared/satBankCatalog";
import { CURATION_REASONS, CURATION_TARGETS, selectCuratedBank } from "../shared/satCuration";

// Rebuild only the frozen cleanup, never erase the reviewed exact-topic additions.
const legacyBank = SAT_BANK.filter(q => !q.id.startsWith("exact-"));
const { selected, excluded } = selectCuratedBank(legacyBank);
const before = legacyBank.filter(q => q.canonicalId === q.id);
const count = (items: typeof selected) => ({ total: items.length, rw: items.filter(q => q.section === "rw").length, math: items.filter(q => q.section === "math").length });
const manifest = { version: 1, date: "2026-11-04", before: count(before), active: count(selected),
  archiveSha256: createHash("sha256").update(JSON.stringify(legacyBank.map(q => [q.id, q.passage, q.stem, q.choices, q.answer]))).digest("hex"),
  ids: selected.map(q => q.id) };
writeFileSync("shared/satCurated.json", JSON.stringify(manifest, null, 2) + "\n");
const topics = BANK_TOPICS.map(t => ({ id: t.id, section: t.section, title: t.title, reference: CURATION_TARGETS[t.id]!,
  before: before.filter(q => topicFor(q)?.id === t.id).length, active: selected.filter(q => topicFor(q)?.id === t.id).length }));
const archive = Object.entries(CURATION_REASONS).map(([reason, description]) => ({ reason, description, ids: Object.keys(excluded).filter(id => excluded[id] === reason).sort() }));
writeFileSync("docs/content/sat-curation-report.json", JSON.stringify({ ...manifest, ids: undefined, topics, archive }, null, 2) + "\n");
writeFileSync("docs/content/sat-curation-report.md", `# SAT bank curation — ${manifest.date}\n\nActive bank: **${manifest.active.total}** (Reading & Writing **${manifest.active.rw}**, Math **${manifest.active.math}**). Previous active bank: ${manifest.before.total}. Archived from new practice: **${manifest.before.total - manifest.active.total}**.\n\nThe screenshot reference totals are 1,517 R&W and 1,234 Math. They are ceilings rather than a requirement to retain weak questions. Topics below those counts need new, independently reviewed questions; none were padded during this cleanup.\n\nScreening uses preliminary editorial ratings, import provenance, wording/algebraic skeletons and template/passage limits. It is not a full independent manual or psychometric validation of every remaining item. General reading imports and automatic grammar/transition exercises were excluded as collections after reviewing their format and sample questions. Mathematical templates retain only distinct structural representatives.\n\nThe complete archive, IDs, keys, attribution, downloads and historical manifests remain intact. Old question URLs, attempts, bookmarks, mistake review and in-progress tests still resolve. Archive items no longer count toward the active catalogue or new practice. No student data was modified.\n\n| Topic | Before | Active | Screenshot reference |\n|---|---:|---:|---:|\n${topics.map(t => `| ${t.title} | ${t.before} | ${t.active} | ${t.reference} |`).join("\n")}\n\n## Exclusions (complete archive, including 29 already-suppressed exact copies)\n\n${archive.map(a => `- ${a.description}: ${a.ids.length}`).join("\n")}\n\nPer-ID reasons and source-content checksum: [JSON report](sat-curation-report.json). Rebuild with \`node --import tsx scripts/curate-sat-bank.ts\`; check with \`node --import tsx scripts/check-sat-curation.ts\`.\n`);
console.log(JSON.stringify({ before: manifest.before, active: manifest.active, removed: manifest.before.total - manifest.active.total, reasons: archive.map(a => [a.reason, a.ids.length]) }));
