"""Assemble the explicit additions. Fails rather than padding a deficient topic."""
from common import *
import shutil
parts=['reading','vocabulary','grammar','rhetoric','paired','math']
questions=[];references=[]
# The source PDFs used dropped capitals. Repair only these exact, documented
# fragments; all original context and the replacement remain in the audit.
REPAIRS={'utism is a developmental':'Autism is a developmental','nasal spray laced with':'A nasal spray laced with','surprising finding, however,':'A surprising finding, however,','long with new names,':'Along with new names,','n octopus has made':'An octopus has made','s engineers put the':'As engineers put the','major international disagreement':'A major international disagreement','he major problems the':'The major problems the'}
def display(s):
 for a,b in REPAIRS.items():s=re.sub(r"(?<![A-Za-z])(?<!A )(?<!a )"+re.escape(a),lambda _:b,s)
 return s
for part in parts:
 bundle=json.loads((SOURCES/(part+'-candidates.json')).read_text());byid={r['id']:r for r in bundle['references']}
 for q in bundle['questions']:
  ref=byid[q['id']];changed=[]
  for field in ['passage','stem','explanation']:
   if field in q:
    updated=display(q[field])
    if updated!=q[field]:changed.append(field);q[field]=updated
  if q.get('choices'):
   opts=[display(c)for c in q['choices']]
   if opts!=q['choices']:changed.append('choices');q['choices']=opts
  if changed:
   ref['displayRepairs']=changed
   q['attribution']['changes']+=' Восстановлена пропущенная в оцифрованном источнике начальная буква/артикль; исходник и точная правка сохранены в аудите.'
  ref['questionSha256']=sha(json.dumps(q,ensure_ascii=False,sort_keys=True,separators=(',',':')))
  questions.append(q);references.append(ref)
assert len(questions)==1417
assert len(set(q['id']for q in questions))==len(questions)
counts=collections.Counter(topicof(q)for q in questions)
for t,need in NEED.items():assert counts[t]==need,(t,counts[t],need)
active=[*OLD,*questions];total=collections.Counter(q['section']for q in active)
assert dict(total)=={'rw':1517,'math':1234}
manifest=dict(version=1,date='2026-11-05',baseline='satCurated.json',baselineSha256=sha((ROOT/'shared/satCurated.json').read_text()),active=dict(total=len(active),rw=total['rw'],math=total['math']),additions=dict(total=len(questions),rw=967,math=450),ids=[q['id']for q in active],addedIds=[q['id']for q in questions],topics={t:BEFORE[t]+counts[t]for t in TARGET})
def write(path,data):path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
write(ROOT/'shared/satExact.json',questions);write(ROOT/'shared/satExactManifest.json',manifest)
write(ROOT/'docs/content/sat-exact/reference.json',dict(displayRepairs=REPAIRS,items=references))
sources=[]
for path in ['onestop.zip','onestop-english.zip','aqua-train.json','college-readiness-math.zip','squad-train-v2.0.json','openstax-2026-08.zip']:
 f=SOURCES/path;sources.append(dict(file=path,sha256=hashlib.sha256(f.read_bytes()).hexdigest()))
write(ROOT/'docs/content/sat-exact/source-snapshots.json',sources)
licenses=ROOT/'public/content/sat-exact-licenses';licenses.mkdir(parents=True,exist_ok=True)
shutil.copyfile(SOURCES/'onestop-qa-master/LICENSE.md',licenses/'CC-BY-SA-4.0.txt')
shutil.copyfile(ROOT/'docs/content/licenses/openstax-2026-08-CC-BY-4.0.txt',licenses/'CC-BY-4.0.txt')
shutil.copyfile(ROOT/'docs/content/licenses/Apache-2.0.txt',licenses/'Apache-2.0.txt')
shutil.copyfile(SOURCES/'aqua-license.txt',licenses/'AQuA-NOTICE.txt')
notice='''365step SAT additions, 2026-11-05\n\nThese are independent practice materials, not official SAT questions.\n\nOneStopQA / STARC: Yevgeni Berzak, Jonathan Malmaud, Roger Levy (ACL 2020).\nText: Guardian / OneStopEnglish contributors; OneStopEnglish corpus: Sowmya Vajjala and Ivana Lucic (2018).\nOneStopQA commit: 7a058755e1ff0d3f835a67109c669c7e294d4239.\nOneStopEnglish commit: 37f8db3945cd2f3cc0caafe45674147b224349be.\nOriginal texts, questions and 365step adaptations: CC BY-SA 4.0.\nhttps://github.com/berzak/onestop-qa\nhttps://github.com/nishkalavallabhi/OneStopEnglishCorpus\n\nSQuAD 2.0: Pranav Rajpurkar, Jian Zhang, Konstantin Lopyrev, Percy Liang, Robin Jia and contributors.\nSource Wikipedia article title/link is given per item; original context is preserved in the reference records.\nText and adaptations: CC BY-SA 4.0. https://rajpurkar.github.io/SQuAD-explorer/\n\nAQuA: Copyright 2017 Google Inc. Apache License 2.0.\n148 individually selected records, adapted to four choices, with reviewed solutions.\nOriginal records, keys, edits and calculations are included in the reference records.\nhttps://github.com/google-deepmind/AQuA\n\nCollege Readiness Math Questions Dataset: The Learning Agency Lab and contributors. CC BY 4.0.\nFour adapted models/data records (315,340,510,629); answers independently recalculated.\nhttps://www.kaggle.com/datasets/k5m1th/college-readiness-math-questions-dataset\nhttps://the-learning-agency.com/guides-resources/datasets/\n\n365step: 298 separately specified original math exercises, plus the four College Readiness adaptations.\nOpenStax College Algebra / Algebra and Trigonometry, Jay Abramson and contributing authors, Rice University,\nCC BY edition commit 4922e46ebc04326979e19392ccc2384cb8b9076c, is the conceptual curriculum reference.\nThese original 365step exercises are not represented as verbatim OpenStax exercises.\n365step original math exercises and explanations: CC BY 4.0.\n\nNo source author endorses these adaptations. Preliminary difficulty labels are editorial,\nnot psychometrically calibrated SAT ratings. License documents are included in this directory.\n'''
(licenses/'NOTICE.txt').write_text(notice)
write(ROOT/'public/content/sat-exact-2026.json',dict(title='365step additional SAT practice — 2026-11-05',notice=notice,licenses=['/content/sat-exact-licenses/'+p.name for p in sorted(licenses.iterdir())],questions=questions,references=references))
report=dict(active=manifest['active'],additions=manifest['additions'],topics=[dict(id=t,before=BEFORE[t],added=counts[t],active=BEFORE[t]+counts[t],target=TARGET[t])for t in TARGET],sources=dict(collections.Counter(q['attribution']['sourceId']for q in questions)))
write(ROOT/'docs/content/sat-exact/report.json',report)
print(json.dumps(report,ensure_ascii=False))
