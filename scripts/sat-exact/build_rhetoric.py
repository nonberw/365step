from common import *
from urllib.parse import quote
C=SOURCES/'OneStopEnglishCorpus-master/Texts-SeparatedByReadingLevel/Adv-Txt'
blocks=[]
for file in sorted(C.glob('*.txt')):
 lines=[re.sub(r'\s+',' ',s).strip()for s in file.read_text(encoding='utf-8-sig').splitlines()if s.strip()]
 for i,line in enumerate(lines):
  for start in [i,max(0,i-1)]:
   p=' '.join(lines[start:i+1])
   if 45<=len(p.split())<=170:blocks.append((file.name,start,p))
# Additional licensed academic paragraphs provide different topics and avoid exhausting a small news set.
SQ=SOURCES/'squad-train-v2.0.json'
for article in json.loads(SQ.read_text())['data']:
 for pi,para in enumerate(article['paragraphs']):
  context=re.sub(r'\s+',' ',para['context']).strip()
  if 45<=len(context.split())<=170 and not re.search(r'\[citation needed\]|\[clarification needed\]|\{\{|<[^>]+>|\b(?:pornography|pornographic)\b',context,re.I):
   blocks.append(('squad:'+article['title'],pi,context))

rejected=json.loads((ROOT/'scripts/sat-exact/rejected_rhetoric_contexts.json').read_text())
blocks=[(f,i,p)for f,i,p in blocks if not any(row['context']in p for row in rejected)and re.search(r'[.!?][”\"\']?$',p.rstrip())]
bank=Bank();used=set();articles=collections.Counter();roles=collections.Counter()
def attr(f,i,rule):
 if f.startswith('squad:'):
  title=f[6:]
  return attribution('squad-rhetoric-exact',f'{title}; training paragraph {i+1}; {rule}', 'https://en.wikipedia.org/wiki/'+quote(title),'365step: новый вопрос о структуре, переходе или синтезе заметок на основе полного абзаца SQuAD/Wikipedia. Факты сохранены; изменения и исходная формулировка доступны в аудите. Не официальный SAT; предварительный уровень.')
 return attribution('onestop-rhetoric-exact',f'{f}; source paragraph {i+1}; {rule}', 'https://github.com/nishkalavallabhi/OneStopEnglishCorpus/blob/37f8db3945cd2f3cc0caafe45674147b224349be/Texts-SeparatedByReadingLevel/Adv-Txt/'+quote(f),'365step: новый вопрос к Advanced-тексту; исходные факты сохранены, конкретные изменения и правильный вариант воспроизводятся в аудите. Уровень предварительный; не официальный SAT.')

relations=[('contrast',r'However|Nevertheless|Nonetheless|In contrast|On the other hand', 'Nevertheless', 'ограничение или противопоставление'),('result',r'Therefore|Consequently|As a result|Thus', 'Consequently', 'следствие из предыдущей мысли'),('example',r'For example|For instance', 'For example', 'конкретный пример предыдущей мысли'),('addition',r'Furthermore|Moreover|In addition|Additionally|Also', 'Moreover', 'добавление согласующегося аргумента')]
functions={
 'contrast':('To qualify the preceding point by introducing a contrasting consideration.','To supply a concrete instance that illustrates the preceding generalization.','To describe how the preceding investigation collected its measurements.','To draw a necessary causal conclusion from the preceding observation.'),
 'result':('To explain a consequence of the situation described immediately before it.','To introduce an exception that limits the preceding generalization.','To describe an alternative explanation that competes with the preceding account.','To give background about how a source obtained the preceding measurements.'),
 'example':('To make the preceding general point concrete by presenting a particular case.','To restrict the preceding claim by identifying a case it does not explain.','To replace the preceding explanation with a competing causal mechanism.','To describe a new method proposed for testing the preceding claim.'),
 'addition':('To extend the preceding argument with another consideration supporting the same line of thought.','To introduce an exception that narrows the preceding claim.','To explain a consequence established by the preceding observation.','To replace the preceding account with a competing interpretation.')}
# Function questions remove the overt transition cue; students must read the actual relation.
for role,pattern,_,ru in relations:
 for f,i,p in blocks:
  if norm(p)in used or articles[(f,'function')]>=2 or roles[('function',role)]>={'contrast':25,'result':20,'example':20,'addition':19}[role]:continue
  for match in re.finditer(r'(?<=[.!?])\s+('+pattern+r'),\s+',p):
   later=p[match.end():];sent=sentence_spans(later)
   if not sent or len(sent[0][2].split())<10:continue
   end=match.end()+sent[0][1];target=sent[0][2]
   if not target[0].isupper():target=target[0].upper()+target[1:]
   passage=p[:match.start()]+' __'+target+'__'+p[end:]
   opts=list(functions[role]);prev=sentence_spans(p[:match.start()])[-1][2]
   reasons=[f'Предыдущая мысль: «{prev}». Подчёркнутый фрагмент «{target}» выполняет функцию «{ru}». В источнике связь дополнительно была обозначена переходом «{match.group(1)}»; в упражнении он убран, чтобы оценивалось понимание структуры.']+[f'Эта функция не соответствует связи между «{prev}» и «{target}»: исходная логическая связь здесь — {ru}, а не предложенная в варианте роль.'for _ in range(3)]
   q=make('text-structure-purpose',f+':'+str(i)+':function:'+p,passage,'Which choice best describes the function of the underlined sentence in the text?',opts,reasons,attr(f,i,'function-'+role))
   if bank.put('text-structure-purpose',q,dict(source='onestop-rhetoric',kind='function',originalContext=p,sourceConnector=match.group(1),role=role,target=target,previous=prev)):
    used.add(norm(p));articles[(f,'function')]+=1;roles[('function',role)]+=1
   break
# Transition slots retain original wording apart from the connector itself.
for role,pattern,_,ru in relations:
 for f,i,p in blocks:
  if norm(p)in used or articles[(f,'transition')]>=1 or roles[('transition',role)]>={'contrast':13,'result':10,'example':11,'addition':10}[role]:continue
  for match in re.finditer(r'(?<=[.!?])\s+('+pattern+r'),\s+',p):
   if len(p[match.end():].split())<10:continue
   original=match.group(1);a,b=match.span(1);passage=p[:a]+'______'+p[b:]
   opts=[original,*[entry[2]for entry in relations if entry[0]!=role]]
   before=sentence_spans(p[:a])[-1][2];after=sentence_spans(p[b:].lstrip(', '))[0][2]
   reasons=[f'Связь между «{before}» и «{after}» — {ru}. «{original}» передаёт именно эту связь и восстанавливает исходный переход.']+[f'«{entry[2]}» обозначает {entry[3]}, тогда как в этом контексте требуется {ru}. Сопоставь содержание обеих соседних мыслей, а не только отдельное слово.'for entry in relations if entry[0]!=role]
   q=make('transitions',f+':'+str(i)+':transition:'+p,passage,'Which choice completes the text with the most logical transition?',opts,reasons,attr(f,i,'transition-'+role))
   if bank.put('transitions',q,dict(source='onestop-rhetoric',kind='transition',originalContext=p,sourceConnector=original,start=a,end=b,role=role)):
    used.add(norm(p));articles[(f,'transition')]+=1;roles[('transition',role)]+=1
   break
# Source-adjacent statements become notes. Goals explicitly require both facts.
goals={'contrast':'state the two contrasting observations','result':'identify a situation and the consequence described for it','example':'state a general observation and illustrate it with the specific case','addition':'present both complementary observations'}
for role,pattern,_,ru in relations:
 for f,i,p in blocks:
  if norm(p)in used or articles[(f,'synthesis')]>=2 or roles[('synthesis',role)]>={'contrast':25,'result':20,'example':20,'addition':20}[role]:continue
  for match in re.finditer(r'(?<=[.!?])\s+('+pattern+r'),\s+',p):
   prevs=sentence_spans(p[:match.start()]);laters=sentence_spans(p[match.end():])
   if not prevs or not laters:continue
   first=prevs[-1][2];second=laters[0][2];original_second=second
   if not 10<=len(first.split())<=55 or not 10<=len(second.split())<=55 or any(c in first+second for c in ['“','”','"']):continue
   first=first[0].upper()+first[1:];second=second[0].upper()+second[1:]
   connector=match.group(1)
   notes='While researching a topic, a student has taken the following notes:\n• '+first+'\n• '+second
   correct=first+' '+connector+', '+original_second
   wrong_connector='As a result'if role!='result'else'In contrast'
   opts=[correct,first,second,first+' '+wrong_connector+', '+original_second]
   reasons=[f'Вариант использует обе заметки — «{first}» и «{second}» — и сохраняет исходную связь: {ru}. Это выполняет указанную цель.',f'Вариант сообщает только первую заметку и не включает «{second}», хотя цель требует оба факта.',f'Вариант сообщает только вторую заметку и опускает «{first}», необходимую для выполнения цели.',f'Переход «{wrong_connector}» подменяет исходную связь. Заметки передают {ru}; альтернативный переход не подтверждается этим сопоставлением.']
   q=make('rhetorical-synthesis',f+':'+str(i)+':synthesis:'+role+':'+p,notes,'The student wants to '+goals[role]+'. Which choice most effectively uses relevant information from the notes to accomplish this goal?',opts,reasons,attr(f,i,role+'-synthesis'))
   if bank.put('rhetorical-synthesis',q,dict(source='onestop-rhetoric',kind='synthesis',originalContext=p,first=first,second=second,role=role,sourceConnector=connector)):
    used.add(norm(p));articles[(f,'synthesis')]+=1;roles[('synthesis',role)]+=1
   break
bank.dump('rhetoric-candidates');print('role distribution',dict(roles))
