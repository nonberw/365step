"""Read public permission pages, retain hashes and short permission excerpts only."""
import concurrent.futures,hashlib,html,json,re,subprocess
from pathlib import Path
urls=[
 ('siyavula-physical','https://www.siyavula.com/read/za/physical-sciences/grade-12'),
 ('siyavula-biology','https://www.siyavula.com/read/za/life-sciences/grade-10'),
 ('siyavula-formats','https://www.siyavula.com/read'),
 ('precalc','https://www.opentextbookstore.com/precalc/'),
 ('society','https://www.opentextbookstore.com/mathinsociety/'),
 ('python','https://docs.python.org/3/license.html'),
 ('sqlite','https://sqlite.org/copyright.html'),
]
def read(entry):
 name,url=entry;result=subprocess.run(['curl','--fail','--location','--silent','--show-error','--max-time','25',url],capture_output=True)
 if result.returncode:return {'id':name,'url':url,'error':result.stderr.decode()[:120]}
 body=result.stdout;text=html.unescape(re.sub('<[^>]*>',' ',body.decode('utf-8',errors='replace')));text=re.sub(r'\s+',' ',text)
 needles={'python':'All Python releases are Open Source','sqlite':'public-domain','precalc':'Creative Commons','society':'Creative Commons','siyavula-physical':'All Siyavula textbook content','siyavula-biology':'All Siyavula textbook content','siyavula-formats':'Creative Commons Attribution 3.0'}
 i=text.lower().find(needles[name].lower());excerpt=text[i:i+170] if i>=0 else ''
 return {'id':name,'url':url,'checkedAt':'2026-11-03','sha256':hashlib.sha256(body).hexdigest(),'bytes':len(body),'permissionExcerpt':excerpt,'links':sorted(set(re.findall(r'https?://(?:creativecommons.org/licenses/[^\s"<>]+|www\.opentextbookstore\.com/[^\s"<>]*\.pdf)',body.decode(errors='replace'))))}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(read,urls))
path=Path('docs/content/ent/source-evidence.json');path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
print(json.dumps([{'id':r['id'],'downloaded':'sha256'in r}for r in results]))
