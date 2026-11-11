"""Recover entries for which the full-context model did not preserve opaque tokens."""
import json,re,os,time
from pathlib import Path
import ctranslate2,sentencepiece as spm
root=Path(os.environ['EXAM_EN_WORK']); model=root/'model'
ru=re.compile('[А-Яа-яЁё]')
protected=re.compile(r'\$\$[\s\S]+?\$\$|\$[^$]+\$|`[^`]+`|https?://[^\s]+|[A-Za-z0-9πθ√][A-Za-z0-9πθ√²³⁴⁵⁶⁷⁸⁹⁰⁻⁺.,:+*/^=<>≤≥≠≈%(){}\\_ −–—\-]*')
strings=json.loads((root/'strings.json').read_text());result=json.loads((root/'translations.json').read_text());overrides=json.loads(Path('scripts/english-exams/overrides.json').read_text());result.update(overrides)
# Full AI system prompts are developer instructions, not UI copy.
missing=[s for s in strings if s not in result]
segments={};pieces={}
for text in missing:
 parts=[];at=0
 for m in protected.finditer(text):
  parts.extend(re.split(r'([.!?;:\n]+)',text[at:m.start()]));parts.append(m.group());at=m.end()
 parts.extend(re.split(r'([.!?;:\n]+)',text[at:]));pieces[text]=parts
 for part in parts:
  if ru.search(part) and part.strip():segments[part.strip()]=None
cachepath=root/'fragment-cache.json';cache=json.loads(cachepath.read_text()) if cachepath.exists() else {};todo=[x for x in segments if x not in cache]
s=spm.SentencePieceProcessor(model_file=str(model/'source.spm'));t=spm.SentencePieceProcessor(model_file=str(model/'target.spm'));tr=ctranslate2.Translator(str(model),device='cpu',compute_type='int8',intra_threads=4)
print('Missing strings',len(missing),'fragments',len(todo),flush=True)
for i in range(0,len(todo),32):
 batch=todo[i:i+32];inputs=[]
 for x in batch:
  x=re.sub(r'точк\w*\s+с\s+запят\w*','semicolon',x,flags=re.I);x=re.sub(r'запят(?:ая|ой|ую|ые|ых|ыми|ым)','comma',x,flags=re.I)
  inputs.append(s.encode(x,out_type=str)+['</s>'])
 for key,out in zip(batch,tr.translate_batch(inputs,beam_size=3,max_decoding_length=180,max_input_length=220)):cache[key]=t.decode(out.hypotheses[0])
 if i%128==0:cachepath.write_text(json.dumps(cache,ensure_ascii=False,indent=2));print(i+len(batch),'/',len(todo),flush=True)
cachepath.write_text(json.dumps(cache,ensure_ascii=False,indent=2))
rejected=[]
for text,parts in pieces.items():
 out=[]
 for part in parts:
  if ru.search(part):
   key=part.strip();translated=cache.get(key,part)
   # Standard metric unit symbols must not become ordinary English words.
   translated={'см':'cm','см²':'cm²','см³':'cm³','м²':'m²','м³':'m³','км':'km','мм':'mm'}.get(key,translated)
   out.append(re.match(r'^\s*',part).group()+translated+re.search(r'\s*$',part).group())
  else:out.append(part)
 output=''.join(out)
 if ru.search(output):rejected.append(text)
 else:result[text]=output
(root/'translations.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));(root/'remaining.json').write_text(json.dumps(rejected,ensure_ascii=False,indent=2))
print('Published',len(result),'Remaining',len(rejected),flush=True)
