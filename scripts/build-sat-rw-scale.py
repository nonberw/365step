#!/usr/bin/env python3
"""Offline import. No model/API, no rotations counted as additional questions.

Belebele retains native MC options/keys. SQuAD-based controlled
language transformations are explicitly reinforcement, not calibrated
SAT assessment. Original context and annotated answer remain auditable.
"""
import argparse, collections, hashlib, html, json, random, re
from functools import lru_cache
from pathlib import Path
from urllib.parse import quote

p=argparse.ArgumentParser()
p.add_argument('--belebele',type=Path,required=True)
p.add_argument('--squad',type=Path,required=True)
p.add_argument('--total',type=int,default=3191)
p.add_argument('--vocabulary',type=int,default=600)
p.add_argument('--transitions',type=int,default=400)
a=p.parse_args()
out=Path.cwd(); records=[]; references=[]; excluded=collections.Counter(); seen=set()
II='Information and Ideas'; CS='Craft and Structure'; SEC='Standard English Conventions'
LICENSE='https://creativecommons.org/licenses/by-sa/4.0/'
DOWNLOAD='/content/sat-rw-scale-2026.json'
def digest(s):return hashlib.sha256(s.encode()).hexdigest()
@lru_cache(maxsize=100000)
def norm(s):return re.sub(r'\s+',' ',s.casefold()).strip()
def clean(s):return re.sub(r'\s+',' ',html.unescape(s)).strip()
def usable(s):
 quotations=re.findall(r'["“]([^"”]+)["”]',s)
 return 25<=len(s.split())<=150 and sum(len(q.split())for q in quotations)<=25 and not re.search(r'\[citation needed\]|\[clarification needed\]|\{\{|<[^>]+>|\\(?:frac|begin|text)|\b(?:pornographic|pornography)\b',s,re.I) and s.count('$')%2==0
def safe_rich(s):return s.replace('$','＄')
def put(q,ref):
 key=norm(q['passage'])+'|'+norm(q['stem'])
 if key in seen:excluded['duplicate-condition']+=1;return False
 if len(q['choices'])!=4 or len(set(norm(x)for x in q['choices']))!=4:excluded['options']+=1;return False
 assert 0<=q['answer']<4
 q['section']='rw';q['source']='bank';q['difficulty']=2
 q['passage']=safe_rich(q['passage']);q['stem']=safe_rich(q['stem']);q['choices']=[safe_rich(x)for x in q['choices']]
 q['attribution']['license']='CC BY-SA 4.0';q['attribution']['licenseUrl']=LICENSE;q['attribution']['download']=DOWNLOAD
 seen.add(key);records.append(q);references.append({'id':q['id'],**ref});return True
def interleave(rows,key):
 groups=collections.defaultdict(list)
 for r in rows:groups[key(r)].append(r)
 result=[]
 for i in range(max(map(len,groups.values()),default=0)):
  for group in groups.values():
   if i<len(group):result.append(group[i])
 return result

# Only the 900-row English evaluation set. The NC training assembly is excluded.
bb_raw=a.belebele.read_bytes();bb_rows=[json.loads(s)for s in bb_raw.decode().splitlines()if s.strip()]
for row in bb_rows:
 passage=clean(row['flores_passage']);stem=clean(row['question'])
 if not usable(passage):excluded['belebele-context-length-or-markup']+=1;continue
 if row['link'].endswith('Accordion/Right_hand') and row['question_number']==2:excluded['ambiguous-force-versus-bellows']+=1;continue
 if re.search(r'following (?:figure|diagram|table)|shown (?:above|below)',stem,re.I):excluded['missing-visual']+=1;continue
 options=[clean(row[f'mc_answer{i}'])for i in range(1,5)];answer=int(row['correct_answer_num'])-1
 identity=digest(row['link']+'|'+passage+'|'+str(row['question_number']))[:18]
 skill='Central Ideas and Details';domain=II
 if re.search(r'\b(?:infer|inferred|inference|conclude|imply|implies|suggests|most likely)\b',stem,re.I):skill='Inferences'
 elif re.search(r'\bmeaning\b|word .{1,25} mean',stem,re.I):skill='Words in Context';domain=CS
 elif re.search(r'\b(?:main purpose|author.s purpose|function of)\b',stem,re.I):skill='Text Structure and Purpose';domain=CS
 q=dict(id='rw-scale-bb-'+identity,domain=domain,skill=skill,passage=passage,stem=stem,choices=options,answer=answer,purpose='assessment',familyId='rw-scale:passage:'+digest(passage)[:18],
  explanation=f'Опубликованный ключ Belebele: {"ABCD"[answer]} — «{options[answer]}». Вопрос относится только к данному отрывку. Полный текст и порядок вариантов сохранены. Источник публикует ключ, но не развёрнутый разбор всех вариантов; такой разбор здесь не приписывается авторам. Сопоставь выбранный ответ с формулировкой вопроса и условиями отрывка.',
  attribution=dict(sourceId='belebele-sat-en',locator=f'English evaluation set; question {row["question_number"]}; passage SHA-256 {digest(passage)}',sourceUrl=row['link'],changes='Оригинальный английский отрывок, вопрос, четыре варианта и опубликованный ключ Belebele сохранены; 365step добавил форматирование, предварительную метку сложности и комментарий к ключу. Не официальный SAT. Не импортирован NC-набор для обучения моделей.'))
 put(q,dict(source='belebele',originalQuestion=stem,originalChoices=options,originalAnswer=answer,contextHash=digest(passage),sourceUrl=row['link']))
native_count=len(records)

# SQuAD contributes complete licensed English paragraphs, not auto-generated
# multiple-choice distractors. Language questions use controlled rules below.
sq_raw=a.squad.read_bytes();sq=json.loads(sq_raw);paragraphs=[]
for article in sq['data']:
 for number,para in enumerate(article['paragraphs']):
  text=para['context']
  if not usable(text):excluded['squad-context-length-or-markup']+=1;continue
  paragraphs.append(dict(title=article['title'],index=number,text=text,hash=digest(text)))
used_contexts=set();reading_count=0

# Fixed-meaning academic vocabulary: sense selection is curated rather than
# inferred automatically for polysemous nouns/verbs. Each source paragraph is
# used once, and lexical families remain visible as reinforcement.
VOCAB={
 'approximately':('roughly','exactly','primarily','previously'),
 'primarily':('mainly','exclusively','occasionally','previously'),
 'predominantly':('mainly','entirely','rarely','temporarily'),
 'subsequently':('afterward','previously','simultaneously','by chance'),
 'initially':('at first','in the end','without exception','by comparison'),
 'formerly':('previously','currently','immediately','exclusively'),
 'simultaneously':('at the same time','one after another','at irregular intervals','for that reason'),
 'concurrently':('at the same time','in reverse order','without exception','as a consequence'),
 'respectively':('in the order given','at the same time','by chance','without exception'),
 'solely':('exclusively','mainly but not entirely','occasionally','previously'),
 'exclusively':('only','mostly','previously','approximately'),
 'occasionally':('sometimes','always','never','exclusively'),
 'invariably':('without exception','from time to time','approximately','in the opposite order'),
 'comparatively':('by comparison','without comparison','in a previous period','with absolute certainty'),
 'relatively':('in comparison with something else','in every possible respect','through family inheritance','at exactly the same time'),
 'largely':('mainly','entirely','rarely','temporarily'),
 'substantially':('considerably','barely at all','exclusively','by chance'),
 'partially':('in part','completely','previously','without exception'),
 'gradually':('by degrees','all at once','by chance','without exception'),
 'temporarily':('for a limited time','permanently','by comparison','exclusively'),
 'permanently':('on a lasting basis','for a short time','occasionally','in the given order'),
 'annually':('every year','every month','every week','every day'),
 'considerably':('to a substantial extent','barely at all','for a short time','in the same order'),
 'subsequent':('later','earlier','simultaneous','unrelated'),
 'prior':('earlier','later','simultaneous','permanent'),
 'inherent':('existing as an essential feature','introduced from outside','temporary','purely accidental'),
 'intrinsic':('inherent','external','temporary','unrelated'),
 'extrinsic':('external','inherent','permanent','unavoidable'),
 'inevitable':('unavoidable','optional','impossible','temporary'),
 'feasible':('practicable','impossible in practice','required by law','already completed'),
 'scarce':('in short supply','plentiful','unchanging','easily visible'),
 'abundant':('plentiful','rare','temporary','unavoidable'),
 'pervasive':('widespread','confined to one isolated case','short-lived','unintentional'),
 'ubiquitous':('found throughout','extremely rare','temporary','uncertain'),
 'conspicuous':('easily noticeable','almost impossible to notice','unavoidable','unintentional'),
 'imperceptible':('too slight to notice','impossible to avoid','extremely widespread','required by law'),
 'ambiguous':('open to more than one interpretation','stated with only one possible meaning','completely absent','unavoidable'),
 'explicit':('stated directly','left unstated','temporary','unintentional'),
 'implicit':('implied without being stated directly','stated directly','completely unrelated','required by law'),
 'prevalent':('widespread','rare','temporary','unavoidable'),
 'sporadic':('occasional and irregular','constant and continuous','required by law','unchanging'),
 'consecutive':('following one another without gaps','occurring at the same time','unrelated in order','occurring only by chance'),
 'simultaneous':('occurring at the same time','occurring one after another','temporary','inexact'),
 'transient':('temporary','permanent','mandatory','unintentional'),
 'permanent':('lasting','temporary','occasional','uncertain'),
 'provisional':('temporary pending final confirmation','permanent and final','widely distributed','required by tradition'),
 'tentative':('not yet final or certain','fully settled','impossible in principle','lasting forever'),
 'compulsory':('required','optional','temporary','unintentional'),
 'obligatory':('mandatory','optional','impossible','uncertain'),
 'voluntary':('undertaken by choice','required by force','unintentional','unavoidable'),
 'indispensable':('essential','unnecessary','temporary','unintentional'),
 'autonomous':('self-governing','controlled entirely from outside','temporary','unintentional'),
 'disparate':('markedly different','identical','temporary','unavoidable'),
 'homogeneous':('uniform in composition','varied in composition','temporary','unintentional'),
 'heterogeneous':('varied in composition','uniform in composition','permanent','unavoidable'),
 'contiguous':('adjoining','widely separated','earlier in time','unintentional'),
 'adjacent':('next to','far from','earlier in time','wholly overlapping'),
 'plausible':('apparently reasonable','clearly impossible','conclusively proved','required by law'),
 'dubious':('doubtful','beyond all doubt','mandatory','permanent'),
 'inadvertent':('unintentional','deliberate','unavoidable','permanent'),
 'unprecedented':('without an earlier parallel','identical to every earlier case','required by law','temporary'),
 'conventional':('customary','unprecedented','impossible','unintentional'),
 'empirical':('based on observation or experience','true by definition alone','imaginary and untestable','required by law'),
 'hypothetical':('supposed for purposes of reasoning','conclusively established','required by law','unchanging forever'),
 'preliminary':('initial rather than final','conclusive and final','unintentional','unavoidable'),
 'definitive':('conclusive or authoritative','temporary and unsettled','barely noticeable','unintentional'),
 'cumulative':('built up through successive additions','fully present at the start','unrelated to earlier stages','purely accidental'),
 'unilaterally':('by one side only','jointly by all sides','at irregular intervals','in reverse order'),
 'collectively':('as a group','separately one by one','by chance','for a short time'),
 'individually':('separately','as one group','in reverse order','without exception'),
 'explicitly':('directly and clearly','only by implication','by chance','for a short time'),
 'implicitly':('without direct statement','in direct and explicit words','by chance','in reverse order'),
 'ostensibly':('apparently or nominally','beyond every possible doubt','unintentionally','permanently'),
 'allegedly':('as claimed but not established','beyond every possible doubt','unintentionally','permanently'),
 'purportedly':('as claimed but not established','with conclusive proof','unintentionally','without exception'),
 'erroneously':('incorrectly','accurately','deliberately','temporarily'),
 'inadvertently':('unintentionally','deliberately','inevitably','permanently'),
 'deliberately':('intentionally','accidentally','inevitably','temporarily'),
 'unequivocally':('unambiguously','with uncertainty','accidentally','temporarily'),
 'radically':('fundamentally','only superficially','temporarily','accidentally'),
 'fundamentally':('at a basic level','only on the surface','for a short time','by chance'),
 'increasingly':('more and more','less and less','without any change','at the same time'),
 'intermittently':('at intervals rather than continuously','without interruption','permanently','in the same order'),
 'frequently':('often','rarely','never','only once'),
 'seldom':('rarely','often','always','continuously'),
 'rarely':('infrequently','often','always','continuously'),
 'typically':('usually','without any exception','never','accidentally'),
 'generally':('usually','without any exception','never','accidentally'),
 'negligible':('too small to be significant','of overwhelming importance','impossible to avoid','required by law'),
 'discrete':('separate and distinct','continuous without divisions','temporary','impossible to observe'),
 'intricate':('complex and detailed','simple and undeveloped','temporary','unintentional'),
 'rudimentary':('basic or undeveloped','highly elaborate','permanent','unavoidable'),
 'obsolete':('outdated','newly developed','mandatory','temporary'),
 'nascent':('just beginning to develop','fully mature','no longer in use','unchanging'),
 'widespread':('broadly distributed','confined to one spot','unintentional','temporary'),
}
vocab_candidates=[]
for entry in paragraphs:
 if entry['hash']in used_contexts:continue
 for match in re.finditer(r'\b('+'|'.join(VOCAB)+r')\b',entry['text'],re.I):vocab_candidates.append((entry,match[0].lower(),match.start(),match.end()))
random.Random(365204).shuffle(vocab_candidates);vocab_count=0;vocab_families=collections.Counter()
for entry,word,start,end in interleave(vocab_candidates,lambda row:row[1]):
 if entry['hash']in used_contexts or vocab_families[word]>=20:continue
 options=list(VOCAB[word][1:]);answer=int(digest(entry['hash']+word)[:8],16)%4;options.insert(answer,VOCAB[word][0])
 original=entry['text'];passage=original[:start]+'**'+original[start:end]+'**'+original[end:]
 explanation='\n\n'.join(f'{"ABCD"[i]} — '+(f'верно: «{word}» в этом употреблении означает «{value}». Сохрани именно это отношение времени, порядка, частоты или степени при чтении предложения.'if i==answer else f'неверно: «{value}» передаёт другое отношение времени, порядка, частоты или степени. Здесь «{word}» означает «{VOCAB[word][0]}», а не «{value}».')for i,value in enumerate(options))
 q=dict(id='rw-scale-vc-'+digest(entry['hash']+word)[:20],domain=CS,skill='Words in Context',passage=passage,stem=f'As used in the text, what does “{word}” most nearly mean?',choices=options,answer=answer,purpose='reinforcement',familyId='rw-scale:vocabulary:'+word,explanation=explanation,
  attribution=dict(sourceId='squad-sat-en',sourceUrl='https://en.wikipedia.org/wiki/'+quote(entry['title']),locator=f'SQuAD 2.0 train; article {entry["title"]}; paragraph {entry["index"]}; word {word}; context SHA-256 {entry["hash"]}',changes='Исходный абзац сохранён; выделено одно слово. 365step создал вопрос и варианты по заранее заданному однозначному значению слова в академическом английском. Это целевая тренировка лексики в разных контекстах, не исходный вопрос SQuAD или SAT и не контрольный пробник.'))
 if put(q,dict(source='squad-vocabulary',article=entry['title'],paragraph=entry['index'],contextHash=entry['hash'],word=word,blankStart=start,answerText=VOCAB[word][0])):vocab_count+=1;vocab_families[word]+=1;used_contexts.add(entry['hash'])
 if vocab_count>=a.vocabulary:break
assert vocab_count==a.vocabulary

TRANSITIONS={
 'however':('contrast','противопоставление'), 'nevertheless':('contrast','уступку или противопоставление'), 'in contrast':('contrast','противопоставление'),
 'therefore':('consequence','следствие'), 'consequently':('consequence','следствие'),
 'for example':('example','конкретный пример'), 'for instance':('example','конкретный пример'),
 'in addition':('addition','добавление'), 'furthermore':('addition','добавление'), 'moreover':('addition','добавление'),
 'similarly':('analogy','сходство'),
}
ROLE_WORDS={'contrast':'However','consequence':'Therefore','example':'For example','addition':'Furthermore','analogy':'Similarly'}
transition_candidates=[]
for entry in paragraphs:
 if entry['hash']in used_contexts:continue
 for match in re.finditer(r'\b('+'|'.join(sorted(TRANSITIONS,key=len,reverse=True))+r')(?=,\s)',entry['text'],re.I):
  transition_candidates.append((entry,match[0],match.start(),match.end()))
random.Random(365205).shuffle(transition_candidates);transition_count=0;transition_families=collections.Counter()
ROLE_GOAL={'contrast':'marks a contrast or concession between the ideas','consequence':'presents the following idea as a consequence','example':'introduces the following idea as a concrete illustration','addition':'adds a further point without presenting it as a consequence or example','analogy':'emphasizes a similarity between the ideas'}
for entry,target,start,end in interleave(transition_candidates,lambda row:TRANSITIONS[row[1].lower()][0]):
 role,reason=TRANSITIONS[target.lower()]
 if entry['hash']in used_contexts or transition_families[role]>=max(60,a.transitions//3):continue
 wrong=[word for key,word in ROLE_WORDS.items()if key!=role][:3]
 if target[0].islower():wrong=[word[0].lower()+word[1:]for word in wrong]
 answer=int(digest(entry['hash']+target)[:8],16)%4;options=wrong[:];options.insert(answer,target)
 original=entry['text'];passage=original[:start]+'______'+original[end:]
 explanation='\n\n'.join(f'{"ABCD"[i]} — '+(f'верно: «{target}» выражает {reason}, как требуется в условии и в исходном переходе.'if i==answer else f'неверно: «{value}» выражает другой тип связи. Вопрос просит передать {reason}; в оригинале здесь стоит «{target}».')for i,value in enumerate(options))
 q=dict(id='rw-scale-tr-'+digest(entry['hash']+str(start))[:20],domain='Expression of Ideas',skill='Transitions',passage=passage,stem=f'Which transition {ROLE_GOAL[role]} and preserves the relationship expressed in the original text?',choices=options,answer=answer,purpose='reinforcement',familyId='rw-scale:transition:'+role,explanation=explanation,
  attribution=dict(sourceId='squad-sat-en',sourceUrl='https://en.wikipedia.org/wiki/'+quote(entry['title']),locator=f'SQuAD 2.0 train; article {entry["title"]}; paragraph {entry["index"]}; transition exercise; context SHA-256 {entry["hash"]}',changes='Исходный абзац сохранён, кроме одного перехода. 365step создал упражнение с явно заданным типом логической связи; правильный переход совпадает с оригиналом. Это целевая тренировка переходов, не независимый контрольный SAT-вопрос.'))
 if put(q,dict(source='squad-transition',article=entry['title'],paragraph=entry['index'],contextHash=entry['hash'],blankStart=start,answerText=target,rule=role)):transition_count+=1;transition_families[role]+=1;used_contexts.add(entry['hash'])
 if transition_count>=a.transitions:break
assert transition_count==a.transitions,(transition_count,transition_families)

# Explicit finite/nonfinite morphology. Contexts remain source paragraphs;
# unlike a parameter generator, each paragraph is used at most once here.
VERBS={
 'be':('is','being','been'),'have':('has','having','had'),'do':('does','doing','done'),
 'make':('makes','making','made'),'take':('takes','taking','taken'),'give':('gives','giving','given'),
 'become':('becomes','becoming','become'),'begin':('begins','beginning','begun'),'see':('sees','seeing','seen'),
 'write':('writes','writing','written'),'build':('builds','building','built'),'find':('finds','finding','found'),
 'show':('shows','showing','shown'),'know':('knows','knowing','known'),'go':('goes','going','gone'),
 'use':('uses','using','used'),'provide':('provides','providing','provided'),'develop':('develops','developing','developed'),
 'produce':('produces','producing','produced'),'require':('requires','requiring','required'),'include':('includes','including','included'),
 'explain':('explains','explaining','explained'),'support':('supports','supporting','supported'),'affect':('affects','affecting','affected'),
 'increase':('increases','increasing','increased'),'reduce':('reduces','reducing','reduced'),'create':('creates','creating','created'),
 'establish':('establishes','establishing','established'),'consider':('considers','considering','considered'),
 'represent':('represents','representing','represented'),'allow':('allows','allowing','allowed'),'change':('changes','changing','changed'),
 'receive':('receives','receiving','received'),'remain':('remains','remaining','remained'),'continue':('continues','continuing','continued'),
 'form':('forms','forming','formed'),'work':('works','working','worked'),'serve':('serves','serving','served'),
 'occur':('occurs','occurring','occurred'),'exist':('exists','existing','existed'),'result':('results','resulting','resulted'),
 'perform':('performs','performing','performed'),'obtain':('obtains','obtaining','obtained'),'describe':('describes','describing','described'),
 'offer':('offers','offering','offered'),'determine':('determines','determining','determined'),'develop':('develops','developing','developed'),
}
base_pattern='|'.join(sorted(VERBS,key=len,reverse=True))
past={forms[2]:(base,forms)for base,forms in VERBS.items()if forms[2]!=base}
ing={forms[1]:(base,forms)for base,forms in VERBS.items()}
def grammar_candidates(entry):
 text=entry['text']
 for match in re.finditer(r',\s+(?:which|who|whose)\b[^,;.!?]{12,110}(,)(?=\s)',text):
  yield ('boundary-relative',match.start(1),match.end(1),[';',':','(no punctuation)'],'Неограничительное относительное придаточное открывается запятой и должно закрываться второй запятой. Точка с запятой или двоеточие не могут заменить закрывающую запятую, а отсутствие знака оставит придаточное незакрытым.')
 for match in re.finditer(r'(;\s*(?:however|therefore|nevertheless|consequently),)(?=\s)',text,re.I):
  target=match[1];marker=re.search(r'[A-Za-z]+',target)[0]
  yield ('boundary-discourse',match.start(1),match.end(1),[f', {marker},',f' {marker},',f'; {marker}'],'Самостоятельные части соединены точкой с запятой, а связующее наречие отделено запятой. Одна запятая с however/therefore не соединяет самостоятельные предложения; отсутствие границы или завершающей запятой нарушает эту структуру.')
 for match in re.finditer(r'(,\s+(?:but|yet))(?=\s+(?:it|they|he|she|this|these|those|we)\s+(?:is|are|was|were|has|have|had|can|could|will|would|may|might|must|should)\b)',text,re.I):
  target=match[1];conjunction=re.search(r'[A-Za-z]+',target)[0]
  yield ('boundary-compound',match.start(1),match.end(1),[', however',f' {conjunction},','; although'],'Сочинительный союз после запятой соединяет две самостоятельные части. However не выполняет эту функцию после одной запятой; запятая после but/yet стоит не на границе, а although после точки с запятой оставляет зависимый фрагмент.')
 for match in re.finditer(r'\b(can|could|may|might|must|should|would|will)\s+('+base_pattern+r')\b',text,re.I):
  key=match[2].lower();forms=VERBS[key]
  wrong=list(dict.fromkeys(forms))
  if key in wrong or len(wrong)!=3:continue
  yield ('modal-'+('be'if key=='be'else'have'if key=='have'else'lexical'),match.start(2),match.end(2),wrong,f'После модального глагола «{match[1]}» требуется базовая форма «{key}», без -s, -ing или формы прошедшего времени.')
 for match in re.finditer(r'\b(has|have|had)\s+(?:(?:already|never|also|previously|recently|just|since)\s+)?('+'|'.join(past)+r')\b',text,re.I):
  key=match[2].lower();base,forms=past[key];wrong=[base,forms[0],forms[1]]
  if len(set(wrong+[key]))!=4:continue
  # Avoid have + adjective + noun, where an -ing adjective could also be
  # grammatical (e.g. "has developed technology" / "has developing technology").
  tail=text[match.end(2):]
  if key!='been' and not re.match(r'\s*(?:[.,;:!?]|$)|\s+(?:to|in|on|at|from|by|with|as|for|since|before|after|over|under|during|around|between|without|through|that|which|because|and|or)\b',tail,re.I):continue
  yield ('perfect-'+('been'if key=='been'else'irregular'if not key.endswith('ed')else'regular'),match.start(2),match.end(2),wrong,f'В конструкции «{match[1]} + past participle» требуется причастие «{key}». Базовая форма, форма на -s и -ing не завершают это перфектное сказуемое.')
 for match in re.finditer(r'\b(by|without)\s+('+'|'.join(ing)+r')\s+(?:the|a|an|its|their|this|these|his|her|it|them)\b',text,re.I):
  key=match[2].lower();base,forms=ing[key];wrong=[base,forms[0],forms[2]]
  if len(set(wrong+[key]))!=4:continue
  yield ('gerund-'+match[1].lower(),match.start(2),match.end(2),wrong,f'После предлога «{match[1]}» действие с последующим дополнением оформляется герундием «{key}», а не личной формой или инфинитивом без to.')
 for match in re.finditer(r'\b(in order to|able to|required to|intended to|designed to)\s+('+base_pattern+r')\b',text,re.I):
  key=match[2].lower();forms=list(dict.fromkeys(VERBS[key]))
  if key in forms or len(forms)!=3:continue
  yield ('infinitive-'+match[1].lower().replace(' ','-'),match.start(2),match.end(2),forms,f'После конструкции «{match[1]}» требуется базовая форма глагола «{key}». Окончания -s, -ing и причастная форма здесь не подходят.')
 for match in re.finditer(r'\b(whose)\s+(?:[a-z]+\s+){0,2}(?:is|are|was|were|has|have|had)\b',text,re.I):
  yield ('relative-possessive',match.start(1),match.end(1),["who's",'whom','who'],'Whose выражает отношение принадлежности к следующей именной группе. Who и whom не определяют эту группу, а who\'s означает who is/has и создало бы лишнее сказуемое.')

grammar_goal=a.total-native_count-reading_count-vocab_count-transition_count;grammar_count=0;rule_counts=collections.Counter()
candidate_rows=[]
for entry in paragraphs:
 if entry['hash']in used_contexts:continue
 for rule,start,end,wrong,reason in grammar_candidates(entry):
  candidate_rows.append((entry,rule,start,end,wrong,reason))
random.Random(36520261104).shuffle(candidate_rows)
for entry,rule,start,end,wrong,reason in interleave(candidate_rows,lambda row:row[1]):
 if entry['hash']in used_contexts:continue
 if rule_counts[rule]>=max(170,grammar_goal//4):continue
 original=entry['text'];target=original[start:end]
 # Preserve capitalization exactly while keeping distractors visually comparable.
 if target[:1].isupper():wrong=[x[:1].upper()+x[1:]for x in wrong]
 identity=digest(entry['hash']+'|'+str(start)+'|'+rule)[:20];answer=int(identity[:8],16)%4;options=wrong[:];options.insert(answer,target)
 passage=original[:start]+'______'+original[end:]
 explanation='\n\n'.join(f'{"ABCD"[i]} — '+('верно: 'if i==answer else f'неверно: форма «{value}» не соответствует проверяемой конструкции. ')+reason for i,value in enumerate(options))
 explanation+=f'\n\nВ исходном английском тексте в этом месте стоит «{target}». Это целевая тренировка грамматической формы; контекст источника сохранён, кроме одного пропуска.'
 q=dict(id='rw-scale-gr-'+identity,domain=SEC,skill='Boundaries'if rule.startswith('boundary-')else'Form, Structure, and Sense',passage=passage,stem='Which choice completes the text so that it conforms to the conventions of Standard English?',choices=options,answer=answer,purpose='reinforcement',familyId='rw-scale:grammar:'+rule,explanation=explanation,
  attribution=dict(sourceId='squad-sat-en',sourceUrl='https://en.wikipedia.org/wiki/'+quote(entry['title']),locator=f'SQuAD 2.0 train; article {entry["title"]}; paragraph {entry["index"]}; grammar {rule}; original context SHA-256 {entry["hash"]}',changes='Исходный абзац SQuAD сохранён, кроме одного грамматического пропуска. 365step создал вопрос и варианты ответов; правильная форма совпадает с оригиналом. Автоматически построенное упражнение для закрепления; не оригинальный вопрос SQuAD или SAT, не входит в пробник.'))
 if put(q,dict(source='squad-grammar',article=entry['title'],paragraph=entry['index'],contextHash=entry['hash'],blankStart=start,answerText=target,rule=rule)):
  grammar_count+=1;used_contexts.add(entry['hash']);rule_counts[rule]+=1
 if grammar_count>=grammar_goal:break
assert grammar_count==grammar_goal,(grammar_count,grammar_goal,rule_counts,'not enough validated grammar contexts')
assert len(records)==a.total

# Interleave source/skill/rule families for a useful first page.
records=interleave(records,lambda q:(q['attribution']['sourceId'],q['familyId'].split(':grammar:')[-1]if ':grammar:'in q['familyId']else q['skill']))
(out/'shared/satRwScaleData.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
(out/'scripts/sat-rw-scale-reference.json').write_text(json.dumps(references,ensure_ascii=False,indent=2)+'\n')
manifest=dict(added=len(records),nativeReading=native_count,adaptedReadingPractice=reading_count,vocabularyPractice=vocab_count,transitionPractice=transition_count,grammarPractice=grammar_count,vocabularyFamilies=dict(vocab_families),transitionFamilies=dict(transition_families),grammarFamilies=dict(rule_counts),uniquePassages=len(set(q['passage']for q in records)),sourceParagraphs=len(set(r['contextHash']for r in references)),articleCount=len(set(r['article']for r in references if 'article'in r)),excluded=dict(excluded),inputs={
 'belebele':dict(file=a.belebele.name,sha256=hashlib.sha256(bb_raw).hexdigest(),bytes=len(bb_raw),url='https://huggingface.co/datasets/facebook/belebele/resolve/main/eng_Latn.jsonl',license='CC BY-SA 4.0',licenseEvidence='https://github.com/facebookresearch/belebele/blob/918890beb2290a8d3ef2d7a90369925959e1bacf/LICENSE_CC-BY-SA4.0'),
 'squad':dict(file=a.squad.name,sha256=hashlib.sha256(sq_raw).hexdigest(),bytes=len(sq_raw),url='https://rajpurkar.github.io/SQuAD-explorer/dataset/train-v2.0.json',license='CC BY-SA 4.0',licenseEvidence='https://rajpurkar.github.io/SQuAD-explorer/'),
})
(out/'docs/content/sat-rw-scale/import.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in manifest.items()if k!='inputs'},ensure_ascii=False,indent=2))
