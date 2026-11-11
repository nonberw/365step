"""Prepare source text locally; no network or provider API is used."""
import os,json,re,zipfile,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
SOURCE=Path(os.environ.get('SAT_EXACT_SOURCES',ROOT/'.cache/sat-exact-sources'))
# Source archive hashes were recorded before any content was selected.
snapshots=json.loads((ROOT/'docs/content/sat-exact/source-snapshots.json').read_text())
for item in snapshots:
 path=SOURCE/item['file']
 assert hashlib.sha256(path.read_bytes()).hexdigest()==item['sha256'],'Wrong source snapshot: '+item['file']
for archive in ['onestop.zip','onestop-english.zip']:
 with zipfile.ZipFile(SOURCE/archive)as z:
  for n in z.namelist():assert not n.startswith('/')and'..'not in Path(n).parts
  z.extractall(SOURCE)
qa=SOURCE/'onestop-qa-master/data/onestop_qa.json'
if not qa.exists():
 qa.parent.mkdir(parents=True,exist_ok=True)
 with zipfile.ZipFile(SOURCE/'onestop-qa-master/annotations/onestop_qa.zip')as z:
  n=next(n for n in z.namelist()if n.endswith('onestop_qa.json'))
  qa.write_bytes(z.read(n))
paragraphs=[]
for f in sorted((SOURCE/'OneStopEnglishCorpus-master/Texts-SeparatedByReadingLevel/Adv-Txt').glob('*.txt')):
 for line in f.read_text(encoding='utf-8-sig').splitlines():
  p=re.sub(r'\s+',' ',line).strip()
  if 40<=len(p.split())<=170:paragraphs.append([f.name,p])
(SOURCE/'corpus-paragraphs.json').write_text(json.dumps(paragraphs,ensure_ascii=False))
print('Prepared',len(paragraphs),'Advanced paragraphs. Original dropped capitals are preserved until the documented display repair.')
