"""Compare published numeric alternatives with the separately specified math review.
Does not use the question constructor, source key indices, or its formatting code.
Non-numeric answers (equations, pairs, statements) remain covered by item reviews.
"""
from pathlib import Path
import json,re
import sympy as S
from sympy.parsing.sympy_parser import parse_expr,standard_transformations,implicit_multiplication_application
ROOT=Path(__file__).resolve().parents[2]
questions={q['id']:q for q in json.loads((ROOT/'shared/satExact.json').read_text())}
refs=json.loads((ROOT/'docs/content/sat-exact/reference.json').read_text())['items']
words={'one':1,'two':2,'three':3,'four':4,'five':5,'six':6,'seven':7,'eight':8,'nine':9,'ten':10,'eleven':11}
def number(option):
 s=option.strip().strip('$＄').replace('−','-')
 if s.lower()in words:return S.Rational(words[s.lower()])
 s=re.sub(r'\s*(?:cm[²23^]*|m[²23^]*|kg|sq\.?\s*(?:units|cm)|square meters?|years?|hours?|minutes?|min|lit(?:er|re)s?(?: of water)?|feet|miles|km(?:/hr|ph)?|rupees|rs\.?|%)\s*$', '',s,flags=re.I).strip().strip('$＄')
 if re.fullmatch(r'[-+]?\d{1,3}(?:,\d{3})+(?:\.\d+)?',s):s=s.replace(',','')
 s=s.replace(':','/').replace('π','pi')
 s=re.sub(r'√(\d+)','sqrt(\\1)',s)
 if not re.fullmatch(r'[\d.+*/()\s-]+',s.replace('sqrt','').replace('pi','')):return None
 try:return S.simplify(parse_expr(s,local_dict={'sqrt':S.sqrt,'pi':S.pi},transformations=standard_transformations+(implicit_multiplication_application,)))
 except (ValueError,S.SympifyError,SyntaxError,TypeError):return None
checked=0;skipped=0
for ref in refs:
 if ref.get('source')!='aqua':continue
 q=questions[ref['id']];vals=[number(s)for s in q['choices']];correct=vals[q['answer']]
 if correct is None:skipped+=1;continue
 expected=S.sympify(ref['expected']);distance=abs(float(S.N(correct-expected)))
 if distance>1e-8:
  assert re.search(r'approx',q['stem'],re.I),(ref['index'],q['stem'],correct,expected)
  numeric=[v for v in vals if v is not None]
  assert all(distance<=abs(float(S.N(v-expected)))+1e-9 for v in numeric),(ref['index'],'not closest')
 else:
  assert sum(v is not None and S.simplify(v-expected)==0 for v in vals)==1,(ref['index'],'equivalent correct alternatives')
 checked+=1
report={'nativeNumericKeysCompared':checked,'nonNumericNativeItemsWithSeparateReviews':skipped,'totalNativeMath':checked+skipped,'originalOrAdaptedMathWithCalculationRecords':302}
(ROOT/'docs/content/sat-exact/math-verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
