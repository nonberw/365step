"""Offline source import. Does not generate parameter variants or call provider APIs.
Input repositories and download files are read only; exact versions and hashes are audited.
"""
import argparse,collections,difflib,hashlib,json,re,shutil,unicodedata
from pathlib import Path
import pyarrow.parquet as pq

PINS={'kazqad':'ab8684a667109f2a7345f4f89ab3b123e8d78e1f','mera':'e9628afed9c1da102066e80e9e844621613fa3cf','include':'d2e1f6015f67a43c02a9a68db98e2298e2d6a660','belebele':'918890beb2290a8d3ef2d7a90369925959e1bacf','rubq':'fade3eae6a4807c35b19cfce20dfa805fc8c0cdf'}
records=[];seen=set();excluded=collections.Counter();input_hashes={};near_seen=collections.defaultdict(list);near_duplicates=[]
BLOCKED={r['id']:r['reason']for r in json.loads(Path('scripts/ent-content/source-exclusions.json').read_text())}
CORRECTIONS={r['id']:r for r in json.loads(Path('scripts/ent-content/source-corrections.json').read_text())}
def clean(s):return unicodedata.normalize('NFC',s).replace('\r\n','\n').replace('\r','').strip()
def norm(s):return re.sub(r'[^\w]+','',unicodedata.normalize('NFKC',s).casefold())
def mera_math(s):
 # Canonicalize source math delimiters to the application's inline format.
 s=re.sub(r'\$\$([\s\S]+?)\$\$',lambda m:'$'+m[1]+'$',s)
 s=re.sub(r'\\\[([\s\S]+?)\\\]',lambda m:'$'+m[1]+'$',s)
 s=re.sub(r'\\\(([\s\S]+?)\\\)',lambda m:'$'+m[1]+'$',s)
 if '\\'in s and '$'not in s and '\n'not in s and '```'not in s and not re.search('[А-Яа-я]',s):s='$'+s+'$'
 return s
def sid(s):return hashlib.sha256(s.encode()).hexdigest()[:16]
def near_same(a,b):
 if min(len(a),len(b))/max(len(a),len(b))<.8:return False
 ratio=difflib.SequenceMatcher(None,a,b,autojunk=False).ratio()
 return ratio>=.85
def read(path):
 data=path.read_bytes();input_hashes[str(path.relative_to(args.sources))]=hashlib.sha256(data).hexdigest();return data.decode('utf-8')
def verify_snapshots():
 # Downloaded HF objects must match the pinned repository, including LFS objects.
 checked=[]
 for repo in ['mera','include']:
  for path in sorted((args.sources/repo/'download').rglob('*')):
   if not path.is_file():continue
   relative=path.relative_to(args.sources/repo/'download');original=args.sources/repo/relative
   if not original.is_file():continue
   expected=original.read_bytes();data=path.read_bytes();pointer=re.fullmatch(rb'version https://git-lfs.github.com/spec/v1\noid sha256:([a-f0-9]{64})\nsize (\d+)\n?',expected)
   if pointer:assert hashlib.sha256(data).hexdigest()==pointer[1].decode()and len(data)==int(pointer[2]),f'LFS mismatch: {path}'
   else:assert data==expected,f'Snapshot mismatch: {path}'
   checked.append(str(path.relative_to(args.sources)))
 return checked
def jsonl(path):
 for i,line in enumerate(read(path).splitlines(),1):
  try:yield i,json.loads(line)
  except json.JSONDecodeError:excluded['malformed-json']+=1
def add(q):
 if q['id']in BLOCKED:excluded['review-exclusion']+=1;return
 if q['id']in CORRECTIONS:
  correction=CORRECTIONS[q['id']];assert q['stem']==correction['original'],'Changed source text requires renewed editorial review'
  q['stem']=correction['stem'];q['explanation']+=' '+correction['note']
 q['stem']=clean(q['stem']);q['topic']=q.get('topic')or'Общие вопросы источника';q['conditionId']=q.get('conditionId')or q['id']
 if q.get('evidence'):q['evidence']=clean(q['evidence'])
 if not 12<=len(q['stem'])<=5500:excluded['stem-length']+=1;return
 if q.get('passage') and len(q['passage'])>5000:excluded['long-passage']+=1;return
 if '\ufffd'in str(q):excluded['broken-unicode']+=1;return
 if q['kind']=='choice':
  q['options']=[clean(v) for v in q['options']]
  if len(q['options'])!=4 or len(set(re.sub(r'\s+','',o)for o in q['options']))!=4 or any(not o for o in q['options'])or q['answer']not in range(4):excluded['invalid-options-or-key']+=1;return
 else:
  q['accepted']=[clean(v)for v in q['accepted']if clean(v)]
  if not q['accepted']or any(len(v)>220 for v in q['accepted']):excluded['invalid-short-answer']+=1;return
 # One question in a passage cannot be multiplied by its alternate source records.
 key=(q['lang'],norm(q.get('passage','')+' '+q['stem']))
 if key in seen:excluded['duplicate-condition']+=1;return
 if q['sourceId']=='mera':
  # Same subject/language, exact numeric tokens and identical normalized key;
  # near-identical wording is not another distinct practice condition.
  fingerprint=norm(q['stem']).translate(str.maketrans({'х':'x','с':'c','е':'e','а':'a','о':'o','р':'p','у':'y','к':'k'}))
  answer=q['options'][q['answer']]if q['kind']=='choice'else'|'.join(q['accepted'])
  bucket=(q['subject'],q['lang'],tuple(re.findall(r'\d+(?:[.,]\d+)?',q['stem'])),norm(answer))
  duplicate=next((old for old_text,old in near_seen[bucket]if near_same(old_text,fingerprint)),None)
  if duplicate:excluded['near-duplicate-source-condition']+=1;near_duplicates.append({'removed':q['id'],'retained':duplicate});return
  near_seen[bucket].append((fingerprint,q['id']))
 if q['sourceId']=='belebele':
  # Dollar signs in this prose are currencies, not TeX math delimiters.
  for field in ['stem','passage','explanation']:
   if q.get(field):q[field]=q[field].replace('$','＄')
  q['options']=[v.replace('$','＄')for v in q['options']]
 seen.add(key);records.append(q)

def import_belebele():
 for code,lang,subject in [('rus_Cyrl','ru','reading'),('kaz_Cyrl','kk','reading'),('eng_Latn','en','english')]:
  for line,r in jsonl(args.sources/'belebele/download'/f'{code}.jsonl'):
   # Original parallel question ID; translations count as one condition.
   # ds is translation date, NOT a passage ID; it differs across languages.
   identity=r['link']+'#'+str(r['question_number']);key=int(r['correct_answer_num'])-1
   add(dict(id='es-bb-'+sid(identity)+'-'+lang,conditionId='bb-'+sid(identity),subject=subject,lang=lang,kind='choice',topic='Reading comprehension'if lang=='en'else'Чтение и понимание текста',stem=r['question'],passage=clean(r['flores_passage']),options=[r[f'mc_answer{i}']for i in range(1,5)],answer=key,sourceId='belebele',sourceRef=f'{code}.jsonl; row {line}; question {r["question_number"]}; {identity}',evidenceUrl=r['link'],explanation={'ru':'Ключ опубликованного набора Belebele. Ответ следует выбирать по данному отрывку; внешние сведения не заменяют информацию текста. Развёрнутое объяснение в исходном наборе не опубликовано.','kk':'Belebele ашық жинағының жауап кілті. Жауап берілген үзіндіге сүйенеді; сыртқы білім мәтіндегі ақпаратты алмастырмайды. Бастапқы жинақта толық түсіндірме берілмеген.','en':'Published Belebele answer key. Answer from the supplied passage; outside knowledge cannot replace information in the text. The source does not publish a worked explanation.'}[lang],review='published-key'))

DOMAINS={'high_school_biology':('biology','Школьная биология'),'high_school_chemistry':('chemistry','Школьная химия'),'high_school_physics':('physics','Школьная физика'),'conceptual_physics':('physics','Физические закономерности'),'high_school_mathematics':('math','Школьная математика'),'high_school_computer_science':('informatics','Алгоритмы и информатика'),'high_school_world_history':('world-history','Всемирная история'),'high_school_european_history':('world-history','История Европы'),'high_school_geography':('geography','География мира')}
MISSING=re.compile(r'рисунк|диаграмм|график[аеу]|таблиц[аеуы]|изображ[её]н|показан.*(?:ниже|выше)|привед[её]н.*(?:ниже|выше)|на эволюционном дереве|following (?:figure|diagram)',re.I)
def import_mera():
 for line,r in jsonl(args.sources/'mera/download/data/rummlu/train.jsonl'):
  domain=r['meta'].get('domain');mapping=DOMAINS.get(domain)
  if domain=='jurisprudence'and r['meta']['id']in {455,856,3862,4371,5608,5628,7367,7778,9605,9606}:mapping=('law','Теория государства и права: сравнительные вопросы')
  if not mapping:excluded['mera-off-syllabus-domain']+=1;continue
  inp=r['inputs'];stem=mera_math(clean(inp['text']));options=[mera_math(inp['option_'+c])for c in 'abcd']
  if any(o.strip()in ['0','None','null','nan']and not any(re.search(r'\d',other)for other in options if other!=o)for o in options):excluded['missing-or-placeholder-option']+=1;continue
  if re.search(r'\\(?:d?fra|l|r)"|E\s*=\s*m"|\^\\?"',stem+' '+' '.join(options)):excluded['corrupt-source-math']+=1;continue
  if mapping[0]=='math'and(any(v.count('"')%2 for v in [stem,*options])or re.search(r'[a-zA-Z]"|"\s*[<>=+^]',stem+' '+' '.join(options))):excluded['corrupt-source-math-variable']+=1;continue
  quote_words=sum(len(v.split())for v in re.findall(r'["«“]([^"»”]+)["»”]',stem))
  if quote_words>25 or len(stem.split())>110 and re.search('[«»“”"]|авторское право|copyright',stem,re.I):excluded['long-quoted-third-party-excerpt']+=1;continue
  if re.search(r'\)\d+(?!\d)|\\[А-Яа-яӘәҒғҚқҢңӨөҰұҮүҺһІі]',stem+' '+' '.join(options)):excluded['ambiguous-source-math-notation']+=1;continue
  if MISSING.search(stem):excluded['missing-figure-or-context']+=1;continue
  if domain=='high_school_computer_science'and re.search(r'java|class |public |private |int\[|static|c\+\+',stem,re.I):excluded['java-not-ent-python']+=1;continue
  if r.get('outputs')not in 'ABCD'or len(r.get('outputs',''))!=1:excluded['missing-key']+=1;continue
  # Unbalanced markup is not silently rendered as an incomplete formula.
  if any(t.count('$')%2 for t in [stem,*options]):excluded['unbalanced-math']+=1;continue
  stem=re.sub(r'^Q\s*:\s*','',stem)
  add(dict(id='es-me-'+str(r['meta']['id']),subject=mapping[0],topic=mapping[1],lang='ru',kind='choice',stem=stem,options=options,answer='ABCD'.index(r['outputs']),sourceId='mera',sourceRef=f'rummlu/train.jsonl; line {line}; id {r["meta"]["id"]}; domain {domain}',explanation='Ключ открытого набора MERA/ruMMLU. Перевод и ответ опубликованы составителями набора. Развёрнутое решение в источнике отсутствует; задание не выдаётся за официальный вопрос НЦТ.',review='published-key'))
 for line,r in jsonl(args.sources/'mera/download/data/mathlogicqa/train.jsonl'):
  stem=r['inputs']['text']
  if r['meta'].get('task')!='logic'or len(stem)<140 or len(re.findall(r'\d+(?:[.,]\d+)?',stem))<3:excluded['mathlogic-elementary-or-synthetic']+=1;continue
  if r.get('outputs')not in ['A','B','C','D']:continue
  add(dict(id='es-ml-'+str(r['meta']['id']),subject='math-lit',topic='Текстовые задачи и логика',lang='ru',kind='choice',stem=stem,options=[r['inputs']['option_'+c]for c in 'abcd'],answer='ABCD'.index(r['outputs']),sourceId='mera',sourceRef=f'mathlogicqa/train.jsonl; line {line}; id {r["meta"]["id"]}',explanation='Ключ опубликованного набора MathLogicQA. Условия проверялись составителями с участием аннотаторов. Это отбор текстовых задач, а не дополнительные числовые вариации 365step; развёрнутое решение в источнике не опубликовано.',review='published-key'))
 # Native Russian spelling/grammar exercises; exclude long literature passages.
 for split in ['train','dev']:
  for line,r in jsonl(args.sources/f'mera/download/data/use/{split}.jsonl'):
   task=str(r['meta'].get('id_task',''));inp=r['inputs'];answer=r.get('outputs','')
   if task not in {str(n)for n in range(4,22)}or len(inp.get('text',''))>100 or inp.get('additional_text',''):excluded['use-non-grammar-or-literary-context']+=1;continue
   if not isinstance(answer,str)or not answer or len(answer)>160:excluded['use-invalid-key']+=1;continue
   stem=inp.get('task','')
   if inp.get('choices'):stem+='\n\n'+inp['choices']
   if re.search(r'\b(?:[А-Яа-яЁё]+\.){2,}|По [А-ЯЁ]\.',stem)and len(stem.split())>90:excluded['use-quoted-long-excerpt']+=1;continue
   number_set=bool(re.fullmatch(r'\d+(?:\s*,\s*\d+)*',answer))
   topic='Орфография и нормы русского языка'if task in set(map(str,range(4,16)))else'Синтаксис и пунктуация'
   add(dict(id=f'es-use-{split}-{r["meta"]["id"]}',subject='russian',topic=topic,lang='ru',kind='short',stem=stem,**({'passage':clean(inp['text'])}if inp.get('text')else{}),accepted=[answer],responseRule='number-set'if number_set else'text',sourceId='mera',sourceRef=f'use/{split}.jsonl; line {line}; id {r["meta"]["id"]}; task {task}',explanation='Ответ взят из опубликованного ключа MERA/USE. Это дополнительная тренировка русского языка по открытым заданиям ЕГЭ, а не воспроизведение формата ЕНТ. Если требуется несколько номеров, укажите их через запятую; порядок номеров не важен.',review='published-key'))

def import_include():
 for path in sorted((args.sources/'include/download/Kazakh').glob('*.parquet')):
  read_bytes=path.read_bytes();input_hashes[str(path.relative_to(args.sources))]=hashlib.sha256(read_bytes).hexdigest()
  for index,r in enumerate(pq.read_table(path).to_pylist()):
   if r['subject']=='Literature':
    grammar=bool(re.search(r'орфоэпи|орфограф|дыбыс|буын|екпін|синоним|омоним|антоним|жұрнақ|жалғау|етістік|зат есім|сын есім|есімдік|шылау|сөйлем мүш|құрмалас|салалас|сабақтас',r['question'],re.I))
    subject='kazakh'if grammar else'kazakh-lit';topic='Қазақ тілі: ашық тесттер'if grammar else'Қазақ әдебиеті: деректер мен шығармалар'
   elif r['subject']=='History':
    # INCLUDE mixes world and Kazakhstan history; use explicit topic clues only.
    s=r['question']
    kz=bool(re.search(r'Қазақстан|қазақ|Қазақ|ҚазКСР|Казахстан|Алтын Орда|Керей|Жәнібек|Уәлиханов|Алаш|Абылай|Ботай|Сақтар|Түрік қаған|Тәуке|Жеті жарғы|Жоңғар|Кенесары|Ақ Орда|Оғыз|Қыпшақ|Найман|Қарлұқ|Үйсін|Қаңлы|Ғұн|Семей|Орынбор|Верный|Түркістан|КСРО|Алма.?Ата',s,re.I))
    kz=kz or bool(re.search(r'тас дәуір|қола дәуір|палеолит|мезолит|неолит|энеолит|алғашқы егінш|болыстық|уездік|Алпысбаев|Ш.Уәлихан',s,re.I))
    world=bool(re.search(r'Қытай|Рим|Франц|Англи|Герман|Еуроп|Америка|Үнді|БҰҰ|Біріккен Араб|Мысыр|Ұлыбрит|Итал|Жапон|Иран|Түркия|Ресей|Грек|Афина|Александр|Парсы|Византи|Крест|Колумб|Бисмарк|Гитлер|Наполеон|Маршалл',s,re.I))
    if not kz and not world:excluded['include-history-region-uncertain']+=1;continue
    subject='history-kz'if kz else'world-history';topic='Қазақстан тарихы: ашық сұрақтар'if kz else'Дүниежүзі тарихы: ашық сұрақтар'
   else:excluded['include-other-subject']+=1;continue
   if re.search(r'сурет|кестеде|сызбада',r['question'],re.I):excluded['include-missing-figure']+=1;continue
   add(dict(id='es-in-'+sid(path.name+str(index)),subject=subject,topic=topic,lang='kk',kind='choice',stem=r['question'],options=[r['option_'+c]for c in 'abcd'],answer=int(r['answer']),sourceId='include',sourceRef=f'Kazakh/{path.name}; row {index}; published level {r["level"]}',explanation='INCLUDE ашық жинағындағы жауап кілті сақталды. Түпнұсқада толық түсіндірме жоқ. Тарихи деректер мен шығарма атауларын берілген бастапқы сілтемемен салыстырып тексеруге болады.',review='published-key'))

PREFIX={'bio':'biology','geo':'geography','kzh':'history-kz','woh':'world-history','lit':'kazakh-lit'}
def import_kazqad():
 grouped=collections.defaultdict(list)
 for split in ['validation','test']:
  p=args.sources/f'kazqad/data/reading-comprehension/kazqad-reading-comprehension-v1.0-kk-{split}.jsonl'
  for line,r in jsonl(p):grouped[r['id'].split('#')[0]].append((split,line,r))
 for qid,versions in grouped.items():
  prefix=re.match('[a-z]+',qid);subject=PREFIX.get(prefix[0]if prefix else'')
  if not subject:excluded['kazqad-non-ent']+=1;continue
  viable=[]
  for split,line,r in versions:
   values=r.get('answers',{});texts=values.get('text',[]);starts=values.get('answer_start',[])
   if len(texts)!=1 or len(starts)!=1:continue
   answer=texts[0].strip();start=starts[0]
   if not answer or len(answer)>110 or r['context'][start:start+len(texts[0])]!=texts[0]:continue
   question=r['question']
   if re.search(r'кімдер|нелер|атаңыздар|сурет|сызба|кесте|берілген.*мәтін|қазіргі|бүгін|дегеніміз не',question,re.I):continue
   if ('қай жыл' in question or 'қашан'in question)and not re.search(r'\d|ғасыр|мың|бұрын|кейін|кез|соң|бас|орта|аяқ',answer,re.I):continue
   if len(question)<18 or '?'not in question:continue
   # Retain the whole answer-containing sentence as review evidence, not a generic explanation.
   before=r['context'].rfind('.',0,start);after=r['context'].find('.',start+len(texts[0]));evidence=r['context'][max(0,before+1):after+1 if after>=0 else len(r['context'])].strip()
   if not 60<=len(evidence)<=1300 or len(evidence.split())<8 or len(re.findall('[«»“”"]',evidence))>4:continue
   if re.search(r'жорамал|болжан|болар|мүмкін|сәйкес келмейді',evidence,re.I):continue
   # A span alone is insufficient: demand additional lexical support for the question.
   stop={'қандай','қалай','қайда','қашан','неше','кімнің','жылғы','жылы','аталады','болған','болды','кім','қай','деген','қалайша','нені','болады','қайсысы','есімі','жылдары','атаңыз','қанша'}
   anchors={w[:5]for w in re.findall(r'[А-Яа-яӘәҒғҚқҢңӨөҰұҮүҺһІі]{4,}',question)if w.casefold()not in stop};anchors={w.casefold()for w in anchors}
   support={w[:5].casefold()for w in re.findall(r'[А-Яа-яӘәҒғҚқҢңӨөҰұҮүҺһІі]{4,}',evidence)}
   if len(anchors&support)<2:continue
   viable.append((split,line,r,answer,evidence))
  if not viable:excluded['kazqad-ambiguous-or-insufficient-evidence']+=1;continue
  # Different annotated answers to the same question are not guessed to be synonyms.
  answers={norm(v[3])for v in viable}
  if len(answers)!=1:excluded['kazqad-disagreeing-answer-spans']+=1;continue
  split,line,r,answer,evidence=min(viable,key=lambda v:len(v[4]))
  accepted=[answer]
  # Controlled grammatical aliases for single proper names; never fuzzy entity matching.
  if re.fullmatch(r'[А-ЯӘҒҚҢӨҰҮҺІ][а-яәғқңөұүһі]{4,}(?:тың|тің|ның|нің|дың|дің)',answer):accepted.append(answer[:-3])
  year=re.fullmatch(r'(\d{3,4})\s*жылы?',answer)
  if year and 'қай жыл'in r['question']:accepted.append(year[1])
  add(dict(id='es-kq-'+qid,subject=subject,topic={'biology':'Биология: дерекке сүйенген сұрақтар','geography':'География: деректер мен ұғымдар','history-kz':'Қазақстан тарихы: деректер','world-history':'Дүниежүзі тарихы: деректер','kazakh-lit':'Қазақ әдебиеті: авторлар мен шығармалар'}[subject],lang='kk',kind='short',stem=r['question'],accepted=accepted,sourceId='kazqad',sourceRef=f'{split}.jsonl; line {line}; {r["id"]}',explanation='KazQAD аннотациясындағы жауап. Төменде жауапты қамтитын бастапқы сөйлем берілген. Дәйексөз дерек ретінде көрсетіледі; толық мақалаға сілтеме арқылы контексті тексеруге болады.',evidence=evidence,evidenceUrl='https://kk.wikipedia.org/wiki/'+r['title'].replace(' ','_'),review='source-span-checked'))

def translate_math_stem(stem,lang):
 parts=stem.split('$');plain=''.join(part if i%2==0 else'FORMULA'for i,part in enumerate(parts))
 ru={'Let ':'Пусть ','What is the sum of all distinct real zeros of ':'Найдите сумму всех различных действительных нулей функции ','The function ':'Функция ',' is defined for all real ':' определена при всех действительных ','What is its maximum value?':'Найдите её наибольшее значение.','What is its minimum value?':'Найдите её наименьшее значение.','For real ':'При действительных ','let ':'пусть ','What is the sum of all distinct real values excluded from the domain of this expression?':'Найдите сумму всех различных действительных значений, исключённых из области определения выражения.','Consider the equation':'Рассмотрите уравнение','What is the real solution for ':'Найдите действительное решение относительно ','The following system has a unique solution.':'Следующая система имеет единственное решение.','What is ':'Найдите ','What is the sum of all distinct real solutions?':'Найдите сумму всех различных действительных решений.'}
 kk={'Let ':'Берілсін: ','What is the sum of all distinct real zeros of ':'Функцияның барлық әртүрлі нақты нөлдерінің қосындысын табыңыз: ','The function ':'Функция ',' is defined for all real ':' барлық нақты мәндерде анықталған: ','What is its maximum value?':'Ең үлкен мәнін табыңыз.','What is its minimum value?':'Ең кіші мәнін табыңыз.','For real ':'Нақты мәндер үшін: ','let ':'берілсін: ','What is the sum of all distinct real values excluded from the domain of this expression?':'Өрнектің анықталу облысына кірмейтін барлық әртүрлі нақты мәндердің қосындысын табыңыз.','Consider the equation':'Теңдеуді қарастырыңыз','What is the real solution for ':'Нақты шешімін табыңыз: ','The following system has a unique solution.':'Төмендегі жүйенің шешімі жалғыз.','What is ':'Мәнін табыңыз: ','What is the sum of all distinct real solutions?':'Барлық әртүрлі нақты шешімдердің қосындысын табыңыз.'}
 translations=ru if lang=='ru'else kk
 for i in range(0,len(parts),2):
  for old,new in sorted(translations.items(),key=lambda kv:-len(kv[0])):parts[i]=parts[i].replace(old,new)
 return '$'.join(parts).replace('?','.')
def import_math():
 p=Path('shared/satScaleSource.json');rows=json.loads(p.read_text());input_hashes[str(p)]=hashlib.sha256(p.read_bytes()).hexdigest()
 for q in rows:
  if q['difficulty']==1:excluded['math-warmup-excluded']+=1;continue
  identity=q['id'];formulas=re.findall(r'\$[^$]+\$',q['explanation'])
  for lang in ['ru','kk']:
   stem=translate_math_stem(q['stem'],lang)
   if re.search(r'\b(?:Let|What|Consider|following|function|real)\b',re.sub(r'\$[^$]+\$','',stem)):raise AssertionError(stem)
   why=q['explanation']if lang=='ru'else'Негізгі математикалық өрнектер: '+'; '.join(formulas)+'. Нәтиже тәуелсіз символдық есептеумен тексерілген.'
   add(dict(id='es-os-'+sid(identity)+'-'+lang,conditionId='os-'+identity,subject='math',topic='Алгебра и функции'if lang=='ru'else'Алгебра және функциялар',lang=lang,kind='choice'if q.get('choices')else'short',stem=stem,**({'options':q['choices'],'answer':q['answer']}if q.get('choices')else{'accepted':[str(q['answer'])],'responseRule':'numeric'}),sourceId='openstax-algebra',sourceRef=q['attribution']['locator'],explanation=why,review='independent-math-verified',level='C'if q['difficulty']==3 else'B'))

def import_rubq():
 # Reviewed literature-only questions; ambiguous composition dates, films, opera,
 # monuments, family trivia and a place named Pushkin are not literary coverage.
 selected={81,157,180,200,332,337,371,402,403,515,608,833,2076,2093,3124,6246,6287,6333,6406,6439,6541,6588,6592,6915,6933,549,3126,6085,6285,6565,6705}
 for split in ['dev','test']:
  path=args.sources/f'rubq/RuBQ_2.0/RuBQ_2.0_{split}.json'
  for r in json.loads(read(path)):
   if r['uid']not in selected:excluded['rubq-non-literature-or-ambiguous']+=1;continue
   if len(r.get('answers',[]))!=1:excluded['rubq-multiple-entities']+=1;continue
   answer=r['answers'][0];label=str(answer['label']);accepted=[label,r['answer_text'],*answer.get('wd_names',{}).get('ru',[])]
   accepted=list(dict.fromkeys(a.strip()for a in accepted if isinstance(a,str)and 0<len(a.strip())<=180))
   add(dict(id='es-rb-'+str(r['uid']),subject='russian-lit',topic='Русская литература: авторы, произведения и направления',lang='ru',kind='short',stem=r['question_text'],accepted=accepted,sourceId='rubq',sourceRef=f'RuBQ_2.0_{split}.json; uid {r["uid"]}; pinned commit {PINS["rubq"]}',explanation='Факт из открытого набора RuBQ с ответом-сущностью Wikidata. Допустимые русские названия сохранены из исходной разметки. Это тренировка фактических знаний о литературе, а не анализ художественного отрывка.',evidenceUrl=answer['value'].replace('http://','https://'),review='published-key'))

def main():
 snapshot_checks=verify_snapshots()
 import_include();import_kazqad();import_mera();import_belebele();import_math();import_rubq()
 dest=Path('server/content/ent/source-data.json');dest.write_text(json.dumps(records,ensure_ascii=False,separators=(',',':'))+'\n')
 report={'date':'2026-11-03','records':len(records),'distinctConditions':len(set(q['conditionId']for q in records)),'sources':dict(collections.Counter(q['sourceId']for q in records)),'subjects':dict(collections.Counter(q['subject']for q in records)),'languages':dict(collections.Counter(q['lang']for q in records)),'formats':dict(collections.Counter(q['kind']for q in records)),'excluded':dict(excluded),'pins':PINS,'inputSHA256':input_hashes,'verifiedDownloadSnapshots':snapshot_checks,'outputSHA256':hashlib.sha256(dest.read_bytes()).hexdigest()}
 docs=Path('docs/content/ent/expansion');docs.mkdir(parents=True,exist_ok=True);(docs/'import-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 report['editorialCorrections']=[q['id']for q in records if q['id']in CORRECTIONS]
 report['correctionsSHA256']=hashlib.sha256(Path('scripts/ent-content/source-corrections.json').read_bytes()).hexdigest()
 (docs/'import-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 (docs/'near-duplicates.json').write_text(json.dumps(near_duplicates,ensure_ascii=False,indent=2)+'\n')
 for repo,name in [('kazqad','LICENSE'),('belebele','LICENSE_CC-BY-SA4.0'),('rubq','LICENSE.txt')]:shutil.copyfile(args.sources/repo/name,docs/(repo+'-license.txt'))
 print(json.dumps({k:report[k]for k in ['records','distinctConditions','sources','subjects','languages','formats','excluded']},ensure_ascii=False))
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--sources',type=Path,required=True);args=parser.parse_args();main()
