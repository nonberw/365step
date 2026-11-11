import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RichText } from "../src/components/RichText";
import { mathTextParts } from "../src/lib/mathText";
import { SAT_ACTIVE_BANK } from "../shared/sat";

const render = (text: string, math = true) => renderToStaticMarkup(createElement(RichText, { text, math }));
const formulas = (text: string) => mathTextParts(text).filter(p => p.kind === "math").map(p => p.tex);

assert.deepEqual(formulas("What is the least integer x that satisfies (2/3)x − 4 > 6?"), ["x", "\\frac{2}{3} x - 4 > 6"]);
assert.deepEqual(formulas("The function f is defined by f(x) = 80 − 6x. What is the value of f(7)?"), ["f", "f(x) = 80 - 6 x", "f(7)"]);
for (const text of ["x² + y² − 6x + 4y − 12 = 0", "sqrt(12)", "5√3", "(x + 1)/(x − 2)", "2^(-3)", "x <= 4", "72π", "3 : 4"]) {
  const html = render(text);
  assert.match(html, /class="katex"/, text);
  assert.doesNotMatch(html, /katex-error/, text);
}
assert.match(render("(2/3)x − 4 > 6"), /<mfrac>/);
assert.match(render("x²"), /<msup>/);
assert.match(render("√12"), /<msqrt>/);
assert.equal(formulas("A line is parallel to a road in Almaty. I have a plan.").length, 0);
assert.equal(formulas("SAT IELTS Math width ratio sinuous").length, 0);
assert.equal(formulas("A 20 dollar item costs $20 and another costs $30.").length, 0);
assert.doesNotMatch(render("print(x + 1)", false), /class="katex"/);
assert.match(render("`x + 1`", false), /<code/);
assert.doesNotMatch(render("`x + 1`", true), /<code/);
assert.match(render("The function $f$ is defined by $f(x) = 80 - 6x$."), /class="katex"/);
assert.equal((render("$x^2$").match(/class="katex"/g) ?? []).length, 1);
assert.match(render("**x + 1**"), /<strong><span class="math-inline"/);
assert.match(render("__x + 1__"), /<u><span class="math-inline"/);
assert.match(render("Fill ______ with a word.", false), /______/);
assert.doesNotMatch(render("<img src=x onerror=alert(1)>"), /<img/);
assert.match(render("\\(x^2\\)"), /class="katex"/);
assert.match(render("$$\\frac{1}{2}$$"), /math-display/);
assert.deepEqual(formulas("A line follows y = 2x + 1 in the xy-plane."), ["y = 2 x + 1", "xy"]);
assert.deepEqual(formulas("(x + 1)(x − 1)/2"), ["\\frac{(x + 1) (x - 1)}{2}"]);
assert.deepEqual(formulas("(3, 4)"), ["(3, 4)"]);
assert.match(render("$20 and $30"), /\$20 and \$30/);
assert.match(render("$20 x$"), /class="katex"/);
assert.match(render("print(x + 1)", false), /print\(x \+ 1\)/);
let texts = 0;
for (const question of SAT_ACTIVE_BANK) {
  for (const text of [question.stem, question.passage, question.explanation, ...(question.choices ?? [])].filter((s): s is string => !!s)) {
    assert.doesNotMatch(render(text, question.section === "math"), /katex-error/, `${question.id}: ${text}`);
    texts++;
  }
}
console.log(`Math typography regression checks passed; ${texts} texts across all ${SAT_ACTIVE_BANK.length} active SAT questions render without errors`);
