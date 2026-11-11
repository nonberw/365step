from pathlib import Path
import json,re,hashlib,random,collections,os
ROOT=Path(__file__).resolve().parents[2]
SOURCES=Path(os.environ.get('SAT_EXACT_SOURCES',ROOT/'.cache/sat-exact-sources'))
BASE=json.loads((SOURCES/'baseline.json').read_text())
TOPICS={x['id']:x for x in BASE['topics']}
TARGET=BASE['targets']
OLD=BASE['active']
def topicof(q):
 return next(t['id']for t in BASE['topics']if q['section']==t['section']and q['domain']==t['domain']and q['skill'].lower()in[s.lower()for s in t['skills']])
BEFORE=collections.Counter(topicof(q)for q in OLD)
NEED={k:v-BEFORE[k]for k,v in TARGET.items()}
def sha(s):return hashlib.sha256(s.encode()).hexdigest()
def norm(s):return re.sub(r'\s+',' ',s.lower()).strip()
def safe(s):return s.replace('$','＄').strip()
def qid(kind,key):return f'exact-{kind}-{sha(key)[:20]}'
def sentence_spans(s):
 # Keep abbreviations and decimal points within sentences.
 return [(m.start(),m.end(),m.group().strip())for m in re.finditer(r'.+?(?:[.!?](?=[”\"\']?\s+[A-Z“\"])|$)',s,re.S)if m.group().strip()]
def excerpt(words,spans):
 return ' … '.join(' '.join(words[spans[i]:spans[i+1]+1])for i in range(0,len(spans),2))
def attribution(sourceId,locator,url,changes):return dict(sourceId=sourceId,locator=locator,sourceUrl=url,changes=changes,license='CC BY-SA 4.0',licenseUrl='https://creativecommons.org/licenses/by-sa/4.0/',download='/content/sat-exact-2026.json')
def make(topic,identity,passage,stem,options,reasons,attr,family=None,level=2):
 t=TOPICS[topic];perm=list(range(4));random.Random(sha(identity)).shuffle(perm)
 assert len(options)==4 and all(x.strip() for x in options) and len(set(norm(x)for x in options))==4
 correct=perm.index(0)
 expl='\n\n'.join(f'{"ABCD"[j]} — {"верно" if k==0 else "неверно"}: {reasons[k]}'for j,k in enumerate(perm))
 return dict(id=qid('rw',identity),section='rw',source='bank',domain=t['domain'],skill=t['skills'][0],difficulty=level,purpose='assessment',familyId=family or'exact:'+sha(identity)[:24],passage=safe(passage),stem=safe(stem),choices=[safe(options[k])for k in perm],answer=correct,explanation=safe(expl),attribution=attr)
class Bank:
 def __init__(self):self.items=[];self.refs=[];self.count=collections.Counter();self.seen={norm(q.get('passage','')+'|'+q['stem'])for q in BASE['bank']};self.contexts=collections.Counter()
 def put(self,topic,q,ref):
  key=norm(q.get('passage','')+'|'+q['stem'])
  if self.count[topic]>=NEED[topic]or key in self.seen:return False
  if q.get('passage')and self.contexts[norm(q['passage'])]>=3:return False
  self.seen.add(key);self.items.append(q);self.refs.append(dict(id=q['id'],**ref));self.count[topic]+=1
  if q.get('passage'):self.contexts[norm(q['passage'])]+=1
  return True
 def dump(self,name):
  (SOURCES/(name+'.json')).write_text(json.dumps(dict(questions=self.items,references=self.refs,counts=dict(self.count)),ensure_ascii=False,indent=2)+'\n')
  print(name,len(self.items),dict(self.count));print('remaining',{k:v-self.count[k]for k,v in NEED.items()if TOPICS[k]['section']=='rw'and v>self.count[k]})
