import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import curated from "../shared/satCurated.json";
import { CURATION_TARGETS, curationSkeleton, selectCuratedBank } from "../shared/satCuration";
import assert from "node:assert/strict";
import { SAT_BANK, SAT_ACTIVE_BANK, SAT_BY_ID, rng } from "../shared/sat";
import { fingerprint, normaliseText, selectAssessment } from "../shared/satQuality";
import { BANK_TOPICS, topicFor } from "../shared/satBankCatalog";

// Keep the first cleanup snapshot independently reproducible. Additions have
// their own exact-topic manifest and provenance checker.
const legacyBank = SAT_BANK.filter(q => !q.id.startsWith("exact-"));
const legacyActive = SAT_ACTIVE_BANK.filter(q => !q.id.startsWith("exact-"));
assert.ok(legacyActive.every(q => q.difficulty >= 2), "basic items must leave the active bank");
assert.ok(legacyActive.every(q => !q.id.startsWith("rw-scale-") && !q.id.startsWith("scale-deepmind-")), "bulk general English and mechanical math imports must be archived");
assert.equal(new Set(legacyActive.map(fingerprint)).size, legacyActive.length);
for (const t of BANK_TOPICS) assert.ok(legacyActive.some(q => topicFor(q)?.id === t.id), `${t.id}: coverage retained`);
for (const q of legacyActive) assert.equal(SAT_BY_ID.get(q.id), q, "keys and IDs retain original objects");
for (const section of ["rw", "math"] as const) {
  for (let seed = 1; seed <= 6; seed++) {
    const pool = legacyActive.filter(q => q.section === section), size = section === "rw" ? 27 : 22;
    const first = selectAssessment(pool, size, [], [], rng(seed));
    const second = selectAssessment(pool, size, first, [], rng(seed + 20));
    assert.equal(first.length + second.length, size * 2, "two complete assessment modules");
    assert.equal(new Set([...first, ...second].map(fingerprint)).size, size * 2);
    if (section === "rw") assert.equal(new Set([...first, ...second].map(q => normaliseText(q.passage!))).size, size * 2);
  }
}
const regenerated = selectCuratedBank(legacyBank);
assert.deepEqual(regenerated.selected.map(q => q.id), curated.ids, "allowlist is reproducible from source archive");
assert.deepEqual(legacyActive.map(q => q.id), curated.ids);
assert.equal(new Set(legacyActive.map(curationSkeleton)).size, legacyActive.length, "numeric-only variants cannot inflate inventory");
const families = new Map<string, number>(), passages = new Map<string, number>();
for (const q of legacyActive) {
  const family = q.familyId!; families.set(family, (families.get(family) ?? 0) + 1);
  if (q.section === "rw") { const text = normaliseText(q.passage!); passages.set(text, (passages.get(text) ?? 0) + 1); }
}
assert.ok([...families.values(), ...passages.values()].every(n => n <= 2));
for (const t of BANK_TOPICS) assert.ok(legacyActive.filter(q => topicFor(q)?.id === t.id).length <= CURATION_TARGETS[t.id]!);
assert.equal(createHash("sha256").update(JSON.stringify(legacyBank.map(q => [q.id, q.passage, q.stem, q.choices, q.answer]))).digest("hex"), curated.archiveSha256, "archive wording/options/keys untouched");
const report = JSON.parse(readFileSync("docs/content/sat-curation-report.json", "utf8"));
const excludedIds = report.archive.flatMap((g: { ids: string[] }) => g.ids);
assert.equal(new Set([...curated.ids, ...excludedIds]).size, legacyBank.length, "every archive item has one explicit decision");
assert.equal(curated.ids.length + excludedIds.length, legacyBank.length);
assert.equal(legacyActive.filter(q => q.section === "rw").length, curated.active.rw);
assert.equal(legacyActive.filter(q => q.section === "math").length, curated.active.math);
assert.equal(legacyBank.length, 8386, "complete pre-cleanup archive retained");
assert.equal(curated.active.total, 1334, "reviewed curation snapshot");
console.log(`Curation verified: ${legacyActive.length} active items`);
