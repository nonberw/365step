from common import *
import xml.etree.ElementTree as ET
from nltk import Tree
CORPUS=SOURCES/'OneStopEnglishCorpus-master'
corpus=json.loads((SOURCES/'corpus-paragraphs.json').read_text())
byfile=collections.defaultdict(list)
for f,p in corpus:byfile[f].append(p)
bank=Bank();audit=[];verb_counts=collections.Counter();profiles=collections.Counter()
def source_attr(f,rule):
 from urllib.parse import quote
 return attribution('onestop-syntax-exact',f'{f}; {rule}', 'https://github.com/nishkalavallabhi/OneStopEnglishCorpus/blob/37f8db3945cd2f3cc0caafe45674147b224349be/Texts-SeparatedByReadingLevel/Adv-Txt/'+quote(f),'365step: новый вопрос на основе полного Advanced-абзаца; заменён один синтаксический фрагмент, остальной текст сохранён. Исходная форма, синтаксический разбор и правило проверки записаны отдельно. Не официальный SAT; предварительная сложность.')
def locate(f,tokens,start,end):
 before=[t['word']for t in tokens[max(0,start-4):start]if re.fullmatch('[A-Za-z]+',t['word'])][-3:]
 after=[t['word']for t in tokens[end+1:end+5]if re.fullmatch('[A-Za-z]+',t['word'])][:3]
 target=' '.join(t['word']for t in tokens[start:end+1])
 if len(before)<2 or len(after)<2:return None
 # Match exact target with punctuation-tolerant neighboring lexical anchors.
 fragment=r'\s*'.join(re.escape(t['word'])for t in tokens[start:end+1])
 pat=r'\b'+r'\W+'.join(map(re.escape,before))+r'\W*(?P<target>'+fragment+r')\W*'+r'\W+'.join(map(re.escape,after))+r'\b'
 for p in byfile[f]:
  matches=list(re.finditer(pat,p,re.I))
  if len(matches)==1:
   m=matches[0];return p,m.start('target'),m.end('target')
 return None
def put(topic,f,tokens,i,j,rule,options,reasons,ref,profile):
 found=locate(f,tokens,i,j)
 if not found:return
 p,a,b=found;original=p[a:b]
 if ref.get('subject'):
  # CoreNLP's old processed files split some contractions/ligatures into fake
  # noun heads (e.g. Hes, ts). A grammatical explanation must name a real head
  # visible in the original source before the edited finite verb.
  head=ref['subject']
  if not re.search(r"(?<![\w’'])"+re.escape(head)+r"(?![\w’'])",p[max(0,a-350):a],re.I):return
 if norm(original)!=norm(options[0]):return
 if profiles[profile]>=(44 if profile.startswith('coordinated-')else 24):return
 passage=p[:a]+'______'+p[b:]
 stem='Which choice completes the text so that it conforms to the conventions of Standard English?'
 q=make(topic,f+':'+str(a)+':'+rule+':'+p,passage,stem,options,reasons,source_attr(f,rule),family='exact:syntax:'+sha(profile+':'+p)[:20])
 if bank.put(topic,q,dict(source='onestop-syntax',file=f,originalContext=p,originalSlot=original,start=a,end=b,rule=rule,**ref)):
  profiles[profile]+=1;audit.append(dict(id=q['id'],rule=rule,profile=profile,context=passage,choices=q['choices']))
def gerund(base):
 if base=='be':return 'being'
 if base.endswith('ie'):return base[:-2]+'ying'
 if base.endswith('e')and not base.endswith(('ee','ye')):return base[:-1]+'ing'
 return base+'ing'
files=sorted((CORPUS/'Processed-AllLevels-AllFiles/corenlp-annotated').glob('*adv.txt.out'))
for file in files:
 f=file.name.removesuffix('.out')
 if f not in byfile:continue
 root=ET.parse(file)
 for sent in root.findall('.//sentence'):
  ts=[dict(word=t.findtext('word'),lemma=t.findtext('lemma'),pos=t.findtext('POS'))for t in sent.findall('./tokens/token')]
  deps=sent.find('./dependencies[@type="basic-dependencies"]')
  if deps is None:continue
  for dep in deps.findall('dep'):
   if dep.get('type')!='nsubj':continue
   vi=int(dep.find('governor').get('idx'))-1;si=int(dep.find('dependent').get('idx'))-1
   v,sub=ts[vi],ts[si]
   # Copular and perfect/passive auxiliaries carry agreement with the same parsed subject.
   if v['pos'] not in {'VBZ','VBP','VBD'}:
    aux=[int(d.find('dependent').get('idx'))-1 for d in deps.findall('dep') if int(d.find('governor').get('idx'))-1==vi and d.get('type')in{'cop','aux','auxpass'}]
    aux=[j for j in aux if ts[j]['pos']in{'VBZ','VBP','VBD'} and ts[j]['lemma'].lower()in{'be','have'}]
    if not aux:continue
    vi=aux[0];v=ts[vi]
   lemma=v['lemma'].lower();is_aux=lemma in {'be','have'}
   if lemma in {'do','say','get'} or (not is_aux and (len(lemma)<4 or verb_counts[lemma]>=3)):continue
   if is_aux and verb_counts[lemma]>=60:continue
   agreement=(v['pos']=='VBZ'and sub['pos']=='NN'or v['pos']=='VBP'and sub['pos']=='NNS')
   if v['word'].lower() in {'was','were'} and not any(t['lemma'].lower()in{'if','wish'} for t in ts[:vi]):
    agreement=(v['word'].lower()=='was'and sub['pos']=='NN'or v['word'].lower()=='were'and sub['pos']=='NNS')
   if not agreement or not 4<=vi-si<=35:continue
   attract=[t for t in ts[si+1:vi]if t['pos']in {'NN','NNS'}and t['pos']!=sub['pos']]
   if not attract:continue
   base=lemma;sing=base+'es'if base.endswith(('s','x','z','ch','sh'))else base[:-1]+'ies'if base.endswith('y')and base[-2]not in'aeiou'else base+'s'
   original=v['word']
   if lemma=='be':opposite={'is':'are','are':'is','was':'were','were':'was'}.get(original.lower())
   elif lemma=='have':opposite={'has':'have','have':'has'}.get(original.lower())
   else:opposite=base if v['pos']=='VBZ'else sing
   if not opposite:continue
   opts=[original,opposite,gerund(base),'to '+base]
   if len(set(opts))!=4:continue
   rule='complex-subject-agreement-'+('copula'if lemma=='be'else'perfect'if lemma=='have'else'lexical')
   reasons=[f'Личную форму определяет главное слово подлежащего «{sub["word"]}» ({"единственное" if sub["pos"]=="NN"else"множественное"} число), а не стоящее ближе к глаголу «{attract[-1]["word"]}». Поэтому нужна исходная форма «{original}».',f'«{opposite}» согласовано с другим числом. Вложенная именная группа с «{attract[-1]["word"]}» не заменяет главное подлежащее «{sub["word"]}».',f'«{opts[2]}» — неличная форма; она не образует требуемого самостоятельного сказуемого в этой позиции.',f'«{opts[3]}» — инфинитив, который не может заменить здесь личное сказуемое при «{sub["word"]}».']
   profile=rule+':'+v['pos']+':'+str(min(3,len(attract)))+':'+('relative'if any(t['pos']in{'WDT','WP'}for t in ts[si:vi])else'preposition')
   n=bank.count['form-structure-sense'];put('form-structure-sense',f,ts,vi,vi,rule,opts,reasons,dict(subject=sub['word'],subjectPOS=sub['pos'],verbPOS=v['pos'],lemma=lemma,attractor=attract[-1]['word']),profile)
   if bank.count['form-structure-sense']>n:verb_counts[lemma]+=1
  parse=sent.findtext('parse')
  if not parse:continue
  try:tree=Tree.fromstring(parse)
  except ValueError:continue
  def walk(t,start=0):
   if not isinstance(t,Tree):return
   yield t,start
   j=start
   for c in t:
    if isinstance(c,Tree):yield from walk(c,j);j+=len(c.leaves())
    else:j+=1
  for node,offset in walk(tree):
   labels=[c.label()if isinstance(c,Tree)else''for c in node]
   starts=[];k=offset
   for c in node:starts.append(k);k+=len(c.leaves())if isinstance(c,Tree)else 1
   if node.label()=='NP'and labels.count(',')>=2:
    commas=[i for i,x in enumerate(labels)if x==',']
    for left,right in zip(commas,commas[1:]):
     inner=labels[left+1:right]
     if right!=len(labels)-1:continue # Do not mistake a list separator for a paired appositive.
     if not any(x in {'SBAR','NP'}for x in inner)or not inner:continue
     ix=starts[right]
     if ix>=len(ts)or ts[ix]['word']!=',':continue
     rule='paired-nonrestrictive-relative'if 'SBAR'in inner else'paired-appositive'
     reasons=['Запятая закрывает вставленную пояснительную конструкцию, которая уже открыта запятой. После неё продолжается основная структура исходного предложения.','Точка с запятой разорвёт основную структуру предложения вместо закрытия пояснения.','Двоеточие не закрывает начатую запятой вставленную конструкцию.','Без второй запятой пояснение не будет отделено от продолжения основной структуры.']
     put('boundaries',f,ts,ix,ix,rule,[',',';',':','(no punctuation)'],reasons,dict(parse=node.pformat(margin=100000)),rule+':'+str(min(4,len(inner))))
   if node.label()=='S':
    for i in range(1,len(labels)-1):
     if labels[i]==':'and ts[starts[i]]['word']==';'and labels[i-1]=='S'and labels[i+1]=='S':
      ix=starts[i];reasons=['Точка с запятой разделяет две самостоятельные части. У каждой есть собственные подлежащее и сказуемое.','Одна запятая без союза создаёт comma splice между самостоятельными частями.','Последовательность двоеточия и запятой не является допустимым знаком границы.','Без разделительного знака самостоятельные части сливаются в run-on sentence.']
      put('boundaries',f,ts,ix,ix,'independent-clause-semicolon',[';',',',':,','(no punctuation)'],reasons,dict(parse=node.pformat(margin=100000)),'independent-clause-semicolon')
     if labels[i]==','and i+2<len(labels)and labels[i+1]=='CC'and labels[i-1]=='S'and labels[i+2]=='S':
      ix=starts[i];jx=starts[i+1];cc=ts[jx]['word'];opts=[', '+cc,', however,',cc+',','; although,']
      reasons=[f'Самостоятельные части соединяются запятой и сочинительным союзом «{cc}».','However — вводное наречие, а не сочинительный союз: одна запятая перед ним не разделяет самостоятельные части.','Запятая ошибочно поставлена после союза вместо нужной границы перед ним.','Although вводит зависимую часть; комбинация с точкой с запятой и немедленной запятой не создаёт корректного соединения.']
      put('boundaries',f,ts,ix,jx,'coordinated-independent-clauses',opts,reasons,dict(parse=node.pformat(margin=100000)),'coordinated-independent-clauses:'+cc)
bank.dump('grammar-candidates');(SOURCES/'grammar-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2));print('profiles',dict(profiles),'verb lemmas',len(verb_counts))
