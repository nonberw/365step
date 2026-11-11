from common import *
from urllib.parse import quote
corpus=json.loads((SOURCES/'corpus-paragraphs.json').read_text())
contexts_manifest=json.loads((ROOT/'scripts/sat-exact/vocabulary_contexts.json').read_text())
# Meanings and distractors are authored for the selected contextual sense, not drawn
# from unrelated dictionary entries. Each lexical target appears only once.
rows=[line.split('|')for line in (ROOT/'scripts/sat-exact/vocabulary_choices.tsv').read_text().splitlines()if line.strip()]
assert len(rows)==NEED['words-in-context']==174
assert len({r[0]for r in rows})==len(rows)
bank=Bank();used=collections.Counter();audit=[]
for word,*opts in rows:
 assert len(opts)==4
 contexts=[(f,p)for f,p in corpus if re.search(r'\b'+word+r'\b',p,re.I)and len(p.split())<=150 and not re.search(r'\b(?:sexual abuse|satanic abuse)\b',p,re.I)]
 record=contexts_manifest[word]
 pref=next(((f,p)for f,p in contexts if f==record['file']and sha(p)==record['sha256']),None)
 assert pref,'Pinned context missing: '+word
 contexts.sort(key=lambda x:(x!=pref,abs(len(x[1].split())-90),x[0],x[1]))
 context=next(((f,p)for f,p in contexts if used[norm(p)]<2),None)
 if not context:raise ValueError('No usable context: '+word)
 f,p=context
 # A negative prefix is part of a word, not a separate target (e.g. non-contributory).
 m=next((m for m in re.finditer(r'\b'+word+r'\b',p,re.I)if not p[max(0,m.start()-4):m.start()].lower().endswith('non-')),None)
 if not m:raise ValueError('Only prefixed target: '+word)
 a,b=m.span();passage=p[:a]+'**'+p[a:b]+'**'+p[b:]
 # Keep the whole source paragraph. Quote a local window solely in the explanation.
 local=p[max(0,a-100):min(len(p),b+140)]
 reasons=[f'В контексте «…{local}…» слово «{word}» означает «{opts[0]}». Выбор основан на том, что описывает автор в этом абзаце, а не на сходстве звучания.']+[f'«{wrong}» меняет смысл исходного употребления. В приведённом контексте «{word}» передаёт «{opts[0]}»; вариант добавляет другое значение, которого здесь нет.'for wrong in opts[1:]]
 url='https://github.com/nishkalavallabhi/OneStopEnglishCorpus/blob/37f8db3945cd2f3cc0caafe45674147b224349be/Texts-SeparatedByReadingLevel/Adv-Txt/'+quote(f)
 attr=attribution('onestop-lexicon-exact',f'{f}; paragraph SHA-256 {sha(p)}; target {word}',url,'365step: новый вопрос и четыре авторских толкования к полному Advanced-абзацу; выделено целевое слово. Исходный текст OneStopEnglish CC BY-SA 4.0; адаптация распространяется на тех же условиях. Не официальный SAT; сложность предварительная.')
 q=make('words-in-context','ose-manual:'+f+':'+word,passage,f'As used in the text, what does “{word}” most nearly mean?',opts,reasons,attr,family='exact:lexeme:'+word)
 assert bank.put('words-in-context',q,dict(source='onestop-lexicon',file=f,originalContext=p,target=word,authoredChoices=opts,start=a,end=b))
 used[norm(p)]+=1;audit.append(dict(word=word,context=p,choices=opts,id=q['id']))
bank.dump('vocabulary-candidates');(SOURCES/'vocabulary-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2))
