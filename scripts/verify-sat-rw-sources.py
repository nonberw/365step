#!/usr/bin/env python3
"""Independent comparison to original source files; imports no builder code."""
import argparse, hashlib, html, json, re
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--belebele',type=Path,required=True);p.add_argument('--squad',type=Path,required=True);a=p.parse_args()
data=json.loads(Path('shared/satRwScaleData.json').read_text());refs={q['id']:q for q in json.loads(Path('scripts/sat-rw-scale-reference.json').read_text())};manifest=json.loads(Path('docs/content/sat-rw-scale/import.json').read_text())
def sha(s):return hashlib.sha256(s.encode()).hexdigest()
def restore(s):return s.replace('＄','$')
def clean(s):return re.sub(r'\s+',' ',html.unescape(s)).strip()
for name,file in [('belebele',a.belebele),('squad',a.squad)]:assert hashlib.sha256(file.read_bytes()).hexdigest()==manifest['inputs'][name]['sha256']
bb={}
for line in a.belebele.read_text().splitlines():
 r=json.loads(line);bb[(sha(clean(r['flores_passage'])),clean(r['question']))]=r
sq=json.loads(a.squad.read_text());articles={r['title']:r for r in sq['data']};checks=0;paragraphs=set()
for q in data:
 ref=refs[q['id']];key=q['choices'][q['answer']]
 if ref['source']=='belebele':
  source=bb[(ref['contextHash'],restore(q['stem']))]
  assert restore(q['passage'])==clean(source['flores_passage'])
  assert [restore(c)for c in q['choices']]==[clean(source[f'mc_answer{i}'])for i in range(1,5)]
  assert q['answer']==int(source['correct_answer_num'])-1
  assert source['link']==q['attribution']['sourceUrl']
  checks+=4
 else:
  source=articles[ref['article']]['paragraphs'][ref['paragraph']]['context']
  assert sha(source)==ref['contextHash']
  assert ref['contextHash']not in paragraphs,'one practice question per original paragraph'
  paragraphs.add(ref['contextHash'])
  if ref['source']=='squad-vocabulary':
   assert restore(q['passage']).replace('**','')==source
   assert key==ref['answerText']
   start=ref['blankStart'];assert source[start:start+len(ref['word'])].lower()==ref['word']
  else:
   assert restore(q['passage']).replace('______',key)==source
   start=ref['blankStart'];assert source[start:start+len(key)]==key
   assert key==ref['answerText']
  checks+=5
assert len(data)==3191 and len(paragraphs)==2480
print(f'{checks} independent original-source checks passed; {len(data)} records; {len(paragraphs)} distinct practice paragraphs')
