from common import *
DATA=json.loads((SOURCES/'onestop-qa-master/data/onestop_qa.json').read_text())['data']
URL='https://github.com/berzak/onestop-qa/tree/7a058755e1ff0d3f835a67109c669c7e294d4239/annotations/annotated_articles'
bank=Bank();used=set();native=[]
for ai,a in enumerate(DATA):
 for pi,p in enumerate(a['paragraphs']):
  context=p['Adv']['context'];words=context.split()
  if not 35<=len(words)<=190:continue
  for qi,q in enumerate(p['qas']):
   spans=p['Adv']['a_spans'][qi];dist=p['Adv']['d_spans'][qi]
   if not spans or len(q['answers'])!=4:continue
   evidence=excerpt(words,spans);distractor=excerpt(words,dist)
   identity=f'ose:{ai}:{pi}:{qi}'
   score=len(q['answers'][0].split())+min(35,len(evidence.split()))
   if re.match(r'Who|Where|When|How (?:old|many|much)',q['question']):score-=12
   native.append(dict(ai=ai,pi=pi,qi=qi,identity=identity,context=context,raw=q,spans=spans,dist=dist,evidence=evidence,distractor=distractor,score=score,title=a['title']))
# Evidence questions retain the complete advanced text and use disjoint, real quotations.
seen_evidence=set()
for r in sorted(native,key=lambda r:(-r['score'],r['identity'])):
 text=r['context'];words=text.split();target=set(i for k in range(0,len(r['spans']),2)for i in range(r['spans'][k],r['spans'][k+1]+1))
 span_key=(r['ai'],r['pi'],tuple(r['spans']))
 if span_key in seen_evidence or len(target)<8 or len(r['raw']['answers'][0].split())<4:continue
 token_spans=list(re.finditer(r'\S+',text));forbidden=set(range(token_spans[min(target)].start(),token_spans[max(target)].end()))
 quotes=[]
 for start,end,s in sentence_spans(text):
  if len(s.split())>=6 and not forbidden.intersection(range(start,end)):quotes.append(s)
 if len(quotes)<3:continue
 # Longer, source-exact distractors reduce answer-length clues. Keep the
 # previously eligible context set; never add a quote crossing the critical span.
 spans=sentence_spans(text)
 for i in range(len(spans)):
  for j in range(i+2,min(i+4,len(spans))+1):
   a,b=spans[i][0],spans[j-1][1]
   if not forbidden.intersection(range(a,b)):
    group=text[a:b].strip()
    if len(group.split())>=6 and group not in quotes:quotes.append(group)
 # The source critical span, not lexical overlap with the key, determines support.
 quotes.sort(key=lambda s:abs(len(s.split())-len(r['evidence'].split())))
 opts=[f'“{r["evidence"]}”',*[f'“{s}”'for s in quotes[:3]]]
 claim=r['raw']['answers'][0]
 stem=f'A student answers the question “{r["raw"]["question"]}” with the interpretation “{claim}”. Which quotation from the text most directly supports this interpretation?'
 reasons=[f'В разметке STARC этот фрагмент указан как критическое основание ответа: «{r["evidence"]}». Он поддерживает именно интерпретацию «{claim}».']+[f'Цитата «{s}» находится вне критического основания STARC для этого вывода. Она сообщает другой факт, но не обосновывает ответ «{claim}» на поставленный вопрос.'for s in quotes[:3]]
 attr=attribution('onestop-qa-exact',f'{r["title"]}; Advanced paragraph {r["pi"]+1}; source question {r["qi"]+1}; STARC critical span',URL,'365step: новый вопрос на выбор текстового доказательства; исходный Advanced-отрывок и размеченное критическое основание сохранены; варианты — подлинные непересекающиеся цитаты. Не официальный SAT.')
 q=make('command-of-evidence',r['identity']+':evidence',text,stem,opts,reasons,attr,family=f'exact:ose:{r["ai"]}:{r["pi"]}')
 if bank.put('command-of-evidence',q,dict(source='onestop',kind='evidence',sourceQuestion=r['identity'],criticalSpans=r['spans'],originalContext=text,sourceAnswer=claim,criticalText=r['evidence'],quotedChoices=opts)):used.add(r['identity']);seen_evidence.add(span_key)
# New inference items evaluate an implication rather than a named-detail recall.
for line in (ROOT/'scripts/sat-exact/inference_choices.tsv').read_text().splitlines():
 coord,stem,*rest=line.split('|');opts=rest[:4];reason=rest[4];ai,pi=map(int,coord.split(':'))
 a=DATA[ai];text=a['paragraphs'][pi]['Adv']['context'];identity='infer:'+coord+':'+sha(stem)[:12]
 reasons=[reason]+[f'This alternative is not supported by the passage. {reason}'for _ in range(3)]
 attr=attribution('onestop-qa-exact',f'{a["title"]}; Advanced paragraph {pi+1}; 365step inference question',URL,'365step: новый вопрос на вывод по полному Advanced-отрывку OneStopQA, четыре авторских варианта и объяснение. Не официальный SAT.')
 q=make('inferences',identity,text,stem,opts,reasons,attr,family=f'exact:ose:{ai}:{pi}')
 assert bank.put('inferences',q,dict(source='onestop',kind='authored-inference',article=ai,paragraph=pi,originalContext=text,authoredChoices=opts,reason=reason))
used.update(['ose:24:5:1', 'ose:14:2:2', 'ose:3:2:2', 'ose:23:6:2', 'ose:11:1:2', 'ose:24:0:1', 'ose:28:0:0', 'ose:0:1:2', 'ose:14:5:2', 'ose:9:5:2', 'ose:28:4:2', 'ose:15:3:1', 'ose:29:4:2', 'ose:7:5:2', 'ose:20:1:2', 'ose:18:0:0', 'ose:26:2:1', 'ose:7:5:0', 'ose:8:3:2', 'ose:7:6:0', 'ose:28:0:2', 'ose:8:4:0', 'ose:21:2:0', 'ose:25:2:1', 'ose:10:3:2', 'ose:15:3:0', 'ose:21:3:0', 'ose:2:0:2', 'ose:10:2:2', 'ose:8:0:1', 'ose:0:0:2', 'ose:10:0:2', 'ose:21:0:1'])
# Native central/detail questions preserve the published alternatives and key.
for topic,pattern in [('central-ideas-details',r'.')]:
 for r in sorted(native,key=lambda r:(-r['score'],r['identity'])):
  if r['identity']in used or not re.search(pattern,r['raw']['question'],re.I):continue
  if topic=='inferences'and re.search(r'why (?:does|did) (?:the article|the author) mention',r['raw']['question'],re.I):continue
  if r['score']<22:continue
  opts=r['raw']['answers'];claim=opts[0]
  reasons=[f'Опубликованный ответ STARC подкреплён фрагментом: «{r["evidence"]}». Поэтому верна интерпретация «{claim}».',f'Этот вариант размечен STARC как ошибочное прочтение критического фрагмента «{r["evidence"]}»; он не передаёт опубликованный вывод «{claim}».',f'Вариант использует отвлекающую информацию «{r["distractor"]}», а не основание ответа на данный вопрос.',f'Для утверждения «{opts[3]}» в данном отрывке нет текстового основания: STARC помечает этот вариант как неподдержанный.']
  attr=attribution('onestop-qa-exact',f'{r["title"]}; Advanced paragraph {r["pi"]+1}; source question {r["qi"]+1}',URL,'Исходный Advanced-отрывок, вопрос, четыре ответа и опубликованный ключ сохранены; 365step переставил варианты без смены смысла, добавил объяснения по STARC A/D и тематическую навигацию. Перенос навыка чтения; не официальный SAT.')
  q=make(topic,r['identity']+':native',r['context'],r['raw']['question'],opts,reasons,attr,family=f'exact:ose:{r["ai"]}:{r["pi"]}')
  if bank.put(topic,q,dict(source='onestop',kind='native',sourceQuestion=r['identity'],originalQuestion=r['raw']['question'],originalChoices=opts,originalContext=r['context'],criticalText=r['evidence'],distractorText=r['distractor'])):used.add(r['identity'])
bank.dump('reading-candidates')
