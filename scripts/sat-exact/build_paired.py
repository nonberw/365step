from common import *
from paired_items import PAIRS
DATA=json.loads((SOURCES/'onestop-qa-master/data/onestop_qa.json').read_text())['data'];bank=Bank()
for ai,pi,text1,opts,reason in PAIRS:
 a=DATA[ai];text2=a['paragraphs'][pi]['Adv']['context'];identity=f'paired:{ai}:{pi}'
 passage='Text 1\n'+text1+'\n\nText 2\n'+text2
 reasons=[reason]+[f'Этот вариант не передаёт различие между позициями: {reason} Он либо преувеличивает вывод, либо подменяет обсуждаемое ограничение более сильным утверждением.'for _ in range(3)]
 attr=attribution('onestop-qa-exact',f'{a["title"]}; Advanced paragraph {pi+1}; newly authored opposing position','https://github.com/berzak/onestop-qa/tree/7a058755e1ff0d3f835a67109c669c7e294d4239/annotations/annotated_articles','365step: Text 1 — новая гипотетическая позиция, не цитата реального автора; Text 2 — исходный Advanced-отрывок OneStopQA. Новый сравнительный вопрос, варианты и русское объяснение. Не официальный SAT.')
 q=make('cross-text-connections',identity,passage,'How would the author of Text 2 most likely respond to the conclusion in Text 1?',opts,reasons,attr,family='exact:'+identity,level=2)
 assert bank.put('cross-text-connections',q,dict(source='onestop-paired',originalContext=text2,text1=text1,sourceArticle=ai,paragraph=pi,key=opts[0]))
bank.dump('paired-candidates')
