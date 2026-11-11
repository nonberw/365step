from common import *
import sympy as S
from sympy.parsing.sympy_parser import parse_expr,standard_transformations,rationalize
from authored_math import items
TRANS=standard_transformations+(rationalize,)
def expr(s):return parse_expr(s,transformations=TRANS,local_dict={'sqrt':S.sqrt,'pi':S.pi})
def numeric(s):
 v=S.simplify(s)
 if not v.is_finite or not v.is_real:raise ValueError('Not a finite real answer '+str(v))
 return v
PIN='4922e46ebc04326979e19392ccc2384cb8b9076c'
MODULES={'linear-functions':'m49324','linear-equations-one-variable':'m51253','linear-equations-two-variables':'m51253','linear-inequalities':'m51259','linear-systems':'m49420','equivalent-expressions':'m51248','area-volume':'m51254','lines-angles-triangles':'m51283','right-triangles-trigonometry':'m51284','two-variable-data':'m49327'}
bank=Bank()
def construct(topic,key,stem,expected,reason,attr,options=None,level=2):
 t=TOPICS[topic];q=dict(id=qid('math',key),section='math',source='bank',domain=t['domain'],skill=t['skills'][0],difficulty=level,purpose='assessment',familyId='exact:math:'+sha(key)[:20],stem=stem,explanation=reason,attribution=attr)
 if options:
  assert len(options)==4 and len(set(norm(o)for o in options))==4
  perm=list(range(4));random.Random(sha(key)).shuffle(perm)
  q.update(choices=[options[j]for j in perm],answer=perm.index(0))
 else:
  assert expected.is_Rational, (key,expected)
  q.update(answer=str(expected),numericRule={'kind':'exact'})
 return q
for r in items:
 topic=r['topic'];key=r['key'];stem=r['stem'];expected=numeric(expr(r['calculation']));proof=dict(source='365step-oer-aligned',**r)
 if 'equations'in r:
  eqs=[expr(e)for e in r['equations']];variables=sorted(set().union(*(e.free_symbols for e in eqs)),key=str)
  assert len(variables)==2
  sols=S.solve(eqs,variables,dict=True);assert len(sols)==1
  sol=sols[0];assert set(sol)==set(variables)
  assert all(S.simplify(e.subs(sol))==0 for e in eqs)
  expected=numeric(expr(r['target']).subs(sol));proof['solution']={str(v):str(numeric(k))for v,k in sol.items()}
  r['reason']+=' Independent substitution check: '+', '.join(str(v)+'='+str(numeric(sol[v]))for v in variables)+'.'
 proof['expected']=str(expected)
 module=MODULES[topic]
 attr=dict(sourceId='365step-oer-exact',locator='365step authored practice '+key+'; OpenStax conceptual reference '+module+'; pinned CC BY edition '+PIN,sourceUrl='https://github.com/openstax/osbooks-college-algebra-bundle/tree/'+PIN+'/modules/'+module,changes='Авторское задание 365step с новым условием, не перепечатка упражнения OpenStax. Открытый учебник указан как методический источник темы; расчёт и условия сохранены в проверяемом аудите. Адаптация — CC BY 4.0. Не официальный SAT; сложность предварительная.',license='CC BY 4.0',licenseUrl='https://creativecommons.org/licenses/by/4.0/',download='/content/sat-exact-2026.json')
 if key in {'heart-rate-residual','plant-residual','fit-two-model-points','predictor-unit-meaning'}:
  sourceIdx={'heart-rate-residual':510,'plant-residual':315,'fit-two-model-points':629,'predictor-unit-meaning':340}[key]
  attr.update(sourceId='college-readiness-exact',locator='College Readiness Math Questions Dataset; idx '+str(sourceIdx)+'; adapted and independently checked',sourceUrl='https://www.kaggle.com/datasets/k5m1th/college-readiness-math-questions-dataset',changes='365step: сохранена модель или данные исходного задания, уточнена формулировка либо изменён целевой расчёт; добавлено проверенное решение. Источник и адаптация — CC BY 4.0. Не официальный SAT; сложность предварительная.')
 q=construct(topic,key,stem,expected,r['reason'],attr,r.get('options'),r['level'])
 assert bank.put(topic,q,proof),(topic,key)
# Native AQuA records have a separately authored review; original five-choice keys
# are preserved in provenance and remapped after dropping one incorrect alternative.
raw=[json.loads(line)for line in (SOURCES/'aqua-train.json').read_text().splitlines()]
for line in (ROOT/'scripts/sat-exact/aqua_review.tsv').read_text().splitlines():
 index,topic,calculation,review=line.split('|',3);index=int(index);r=raw[index];expected=numeric(expr(calculation));stem=r['question'];originalKey='ABCDE'.index(r['correct'])
 opts=[re.sub(r'^\s*[A-E][).]\s*','',v).strip()for v in r['options']]
 # Correct source typography and adaptation targets identified in the review.
 replacements={27:(' Is there a way to solve this using weighted average concept instead of doing tedious calculations?',''),168:('11â\u0081„2','1.5'),825:('Find the area of the path and the cost of constructing it at Rs.2 per sq m?','What is the cost of constructing the path at Rs.2 per square meter?'),1793:('Find the perimeter and the diagonal of a square which is equal in area to these two combined?','What is the diagonal of a square whose area equals the combined area of those two squares?')}
 if index in replacements:stem=stem.replace(*replacements[index])
 if index==642:stem=stem.replace('What should be the run rate','Approximately what run rate is needed')
 if index==19772:stem=stem.replace('what is the value of x ?', 'which of the following could be the value of x?')
 if index==168:stem='A boat covers the same distance downstream in 1 hour and upstream in 1.5 hours. If the stream speed is 3 kilometers per hour, what is the boat speed in still water?'
 if index==181:opts[1]=r'$\frac{160}{3}-x$'
 if index==890:stem=stem.replace('two concrete crossroads','two perpendicular concrete roads of equal width')
 if index==1374:stem+=' Use A=rs, where r is the inradius and s is the semiperimeter.';opts[0]='40 cm^2'
 if index==413:assert expected==S.Rational(117,4)
 # Remove obvious duplicated labels and typographic artifacts without changing math.
 def clean(v):
  v=re.sub(r'^\s*[a-eA-E][.):-]\s*','',v).replace('Â°','°').replace('â€“','–').replace('âˆ’','−')
  return safe(re.sub(r'\s+',' ',v).strip())
 stem=clean(stem);opts=[clean(o)for o in opts]
 correct=opts[originalKey]
 # Select three distinct alternatives; skip a duplicate, None, or exact aggregate.
 wrong=[]
 for j,o in enumerate(opts):
  if j==originalKey or norm(o)==norm(correct)or norm(o)in{norm(w)for w in wrong}or re.fullmatch(r'none(?: of (?:these|the above))?',o,re.I):continue
  if o:wrong.append(o)
 if len(wrong)<3:raise ValueError(('Too few distinct distractors',index,opts))
 choices=[correct,*wrong[:3]]
 attr=dict(sourceId='aqua-exact',locator='AQuA train.json; zero-based record '+str(index)+'; source SHA256 35b70c7cb1660c34d302bb932dfd3656ce3d05e8c982c797767fec31d7d1e0ba',sourceUrl='https://github.com/google-deepmind/AQuA/blob/master/train.json',changes='365step: выбран поштучно; 5 вариантов сокращены до 4 без удаления верного ответа; позиции перемешаны; исправления формата или целевого вопроса указаны в аудите. Добавлено независимое решение. Источник и адаптация — Apache 2.0. Не официальный SAT; сложность предварительная.',license='Apache 2.0',licenseUrl='https://www.apache.org/licenses/LICENSE-2.0',download='/content/sat-exact-2026.json')
 key='aqua:'+str(index)
 explanation=review+'\n\nChecked calculation: '+calculation+' = '+str(expected)+'.'
 q=construct(topic,key,stem,expected,explanation,attr,choices)
 assert bank.put(topic,q,dict(source='aqua',index=index,original=r,review=review,calculation=calculation,expected=str(expected),correctOriginalIndex=originalKey,adaptedChoices=choices))
assert len(bank.items)==450,(len(bank.items),dict(bank.count))
for topic,n in NEED.items():
 if TOPICS[topic]['section']=='math':assert bank.count[topic]==n,(topic,n,bank.count[topic])
bank.dump('math-candidates')
