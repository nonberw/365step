"""Offline preparation only. No inference service and no student data."""
import json,os,re,time
from pathlib import Path
from collections import Counter
import ctranslate2,sentencepiece as spm
root=Path(os.environ['EXAM_EN_WORK']); model=root/'model'
source=spm.SentencePieceProcessor(model_file=str(model/'source.spm'))
target=spm.SentencePieceProcessor(model_file=str(model/'target.spm'))
translator=ctranslate2.Translator(str(model),device='cpu',compute_type='int8',intra_threads=4)
ru=re.compile('[А-Яа-яЁё]')
# Protect equations, numerals, original English quotations and identifiers as opaque tokens.
protected=re.compile(r'\$\$[\s\S]+?\$\$|\$[^$]+\$|`[^`]+`|https?://[^\s]+|[A-Za-z0-9πθ√][A-Za-z0-9πθ√²³⁴⁵⁶⁷⁸⁹⁰⁻⁺.,:+*/^=<>≤≥≠≈%(){}\\_ −–—\-]*')
glossary=[(r'неограничительн\w*\s+относительн\w*\s+придаточн\w*','nonrestrictive relative clause'),(r'неограничительн\w*\s+придаточн\w*','nonrestrictive clause'),(r'точк\w*\s+с\s+запят\w*','semicolon'),(r'запят(?:ая|ой|ую|ые|ых|ыми|ым)','comma'),(r'двоеточи\w*','colon'),(r'подлежащ\w*','subject'),(r'сказуем\w*','predicate'),(r'существительн\w*','noun'),(r'местоимени\w*','pronoun'),(r'исходн\w*\s+знаменател\w*','original denominator'),(r'област\w*\s+определени\w*','domain'),(r'вершин\w*\s+парабол\w*','vertex of the parabola')]

def letters(i):
 out=''
 while True:
  out=chr(65+i%26)+out;i=i//26-1
  if i<0:return out

def prepare(text):
 values=[]
 def mark(m):
  raw=m.group();core=raw.rstrip(' .,:;−–—-')
  if not core:return raw
  suffix=raw[len(core):];token='ZXQ'+letters(len(values))+'ZXQ';values.append(core)
  return token+suffix
 masked=protected.sub(mark,text)
 # Keep whitespace and paragraph boundaries outside the translation engine.
 chunks=re.split(r'(\n+)',masked)
 keys=[]
 for c in chunks:
  if not ru.search(c):continue
  stripped=c.strip()
  # Paragraphs keep enough context for technical explanations.
  for part in re.split(r'(?<=[.!?])\s+(?=[А-ЯЁA-Z])',stripped):
   if ru.search(part):keys.append(part)
 return masked,values,keys
strings=json.loads((root/'strings.json').read_text())
prepared={s:prepare(s) for s in strings}
keys=list(dict.fromkeys(k for _,_,ks in prepared.values() for k in ks))
cache_path=root/'mt-cache.json';cache=json.loads(cache_path.read_text()) if cache_path.exists() else {}
pending=[k for k in keys if k not in cache]
print('Strings',len(strings),'unique paragraphs',len(keys),'pending',len(pending),flush=True)
started=time.time()
for i in range(0,len(pending),32):
 batch=pending[i:i+32];inputs=[]
 for text in batch:
  for pattern,replacement in glossary:text=re.sub(pattern,replacement,text,flags=re.I)
  inputs.append(source.encode(text,out_type=str)+['</s>'])
 results=translator.translate_batch(inputs,beam_size=4,max_decoding_length=420,max_input_length=500)
 for key,result in zip(batch,results):cache[key]=target.decode(result.hypotheses[0])
 if i%128==0:
  cache_path.write_text(json.dumps(cache,ensure_ascii=False,indent=2));print(i+len(batch),'/',len(pending),'seconds',round(time.time()-started),flush=True)
cache_path.write_text(json.dumps(cache,ensure_ascii=False,indent=2))
# Reassemble translated paragraphs with every protected token exactly once, in order.
result={};rejected=[]
for original,(masked,values,ks) in prepared.items():
 out=masked
 for key in sorted(set(ks),key=len,reverse=True):out=out.replace(key,cache[key])
 found=re.findall(r'ZXQ[A-Z]+ZXQ',out)
 expected=['ZXQ'+letters(i)+'ZXQ' for i in range(len(values))]
 if found!=expected or ru.search(out):
  rejected.append(original);continue
 for token,value in zip(expected,values):out=out.replace(token,value)
 # Preserve layout around source fragments used inside JSX/template literals.
 prefix=re.match(r'^\s*',original).group();suffix=re.search(r'\s*$',original).group()
 out=prefix+out.strip()+suffix
 result[original]=out
(root/'translations.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
(root/'rejected.json').write_text(json.dumps(rejected,ensure_ascii=False,indent=2))
print('Done',len(result),'rejected',len(rejected),'seconds',round(time.time()-started),flush=True)
