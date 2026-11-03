"""Independent reference checks: solve equations, enumerate outcomes, execute SQL/Python.
Does not import the generator or trust its expected-answer formulas.
"""
import ast, contextlib, io, ipaddress, itertools, json, hashlib, re, sqlite3
from collections import Counter
from pathlib import Path
import sympy as s
R=s.Rational
x=s.Symbol('x',real=True)
path=Path('server/content/ent/numeric-data.json')
rows=json.loads(path.read_text())
counts=Counter()
def ref(f,p):
 p={k:R(v) if isinstance(v,str) and re.fullmatch(r'-?\d+(?:/\d+)?',v) else v for k,v in p.items()}
 def v(*names):return [p[n] for n in names]
 if f=='radical':
  a,b,c=v('a','b','c'); roots=s.solve((x-c)**2-a*x-b,x)
  valid=[z for z in roots if z>=c and s.sqrt(a*z+b)==z-c];assert len(valid)==1;return valid[0]
 if f=='log-domain':
  a,b,t=v('a','b','t');valid=[z for z in s.solve((x-a)*(x+b)-t,x) if z>a and z>-b];assert len(valid)==1;return valid[0]
 if f=='rational-simplify':
  a,b,k=v('a','b','k');return R(k*k+(b-a)*k-a*b,k*k-a*a)
 if f=='symmetric-system':
  total,prod=v('total','prod');roots=s.solve(x*x-total*x+prod,x);assert len(roots)==2;return sum(z*z for z in roots)
 if f=='rational-inequality':
  a,b,c=v('a','b','c');sol=s.solve_univariate_inequality((x-a)*(x-b)/(x-c)>=0,x,relational=False)
  parts=list(sol.args) if isinstance(sol,s.Union) else [sol];bounded=[z for z in parts if isinstance(z,s.Interval) and z.measure!=s.oo];assert len(bounded)==1;return bounded[0].measure
 if f=='system-inequalities':
  a,b,c=v('a','b','c');return sum((z-a)*(z-b)<=0 and 2*z>=2*c for z in range(-100,101))
 if f=='progression':
  u,w,n=v('u','v','n');a,d=s.symbols('a d');sol=s.solve([a+2*d-u,a+6*d-w],[a,d]);return sum(sol[a]+k*sol[d] for k in range(n))
 if f=='derivative-extremum':
  F=s.sympify(p['expression'],locals={'x':x});crit=s.solve(s.diff(F,x),x);maxima=[z for z in crit if s.diff(F,x,2).subs(x,z)<0];assert len(maxima)==1;return F.subs(x,maxima[0])
 if f=='exponential-model':
  a,k,t=v('a','k','t');sequence=[a*k,a*k*k];ratio=R(sequence[1],sequence[0]);
  while len(sequence)<t:sequence.append(sequence[-1]*ratio)
  return sequence[t-1]
 if f=='triangle-bisector':
  a,b,c=v('a','b','c');assert abs(a-b)<c<a+b;return s.solve(s.Eq(x/(c-x),R(a,b)),x)[0]
 if f=='pyramid-section':
  V,t=v('V','t');height=s.Integer(3);base=V*3/height;small=base*t*t*(height*t)/3;return V-small
 if f=='vector-orthogonal':
  a,b,c,d=v('a','b','c','d');sol=s.solve(s.Matrix([a*x,b]).dot(s.Matrix([c,d])),x)[0];assert (a*sol,b)!=(0,0);return sol
 if f=='braking':
  speed,a,delay=v('v','a','delay');t=s.Symbol('t');return speed*delay+s.integrate(speed-a*t,(t,0,R(speed,a)))
 if f=='incline-friction':
  m,mu=v('m','mu');normal=R(4,5)*m*10;return s.solve(x-R(3,5)*m*10-mu*normal,x)[0]
 if f=='inelastic':
  m,n,vv,u=v('m','n','v','u');return s.solve((m+n)*x-m*vv+n*u,x)[0]
 if f=='heat-engine':return 100*(1-R(p['Q']-p['W'],p['Q']))
 if f=='capacitor-series':
  a,b,U=v('a','b','U');return s.solve(s.Eq(x/a+x/b,U),x)[0]
 if f=='source-power':
  E,r,ext=v('E','r','ext');current=s.solve(E-x*r-x*ext,x)[0];return (E-current*r)*current
 if f=='induction':
  N,B,A,dt=v('N','B','A','dt');return abs((0-N*B*A)/dt)
 if f=='spring-energy':
  k,A,z=v('k','A','x');return s.integrate(k*x,(x,z,A))
 if f=='lens':
  F,a=v('F','a');return s.solve(s.Eq(1/F, R(1,a)+1/x),x)[0]
 if f=='photoeffect':return s.solve(x+p['work']-p['photon'],x)[0]
 if f=='isotope':return p['A']-((p['Z']-p['charge'])+p['charge'])
 if f=='bond-electrons':return len(list(itertools.product(range(p['n']),range(2))))
 if f=='carbonate-acid':return R(p['mass']*p['purity'],100)/100*R('22.4')
 if f=='redox-permanganate':return (7-2)*p['n']
 if f=='solution-dilution':return s.solve(p['c']*p['V']-p['target']*(p['V']+x),x)[0]
 if f=='metal-alloy':return R(p['mass']*p['percent'],100)/65*R('22.4')
 if f=='ammonia-yield':return R(2*17*p['n']*p['percent'],100)
 if f=='alkene-combustion':
  # Atom conservation: n CO2 plus n H2O contain 3n oxygen atoms.
  return s.solve(2*x-2*p['n']-p['n'],x)[0]
 if f=='ester-yield':return min(p['acid'],p['alc'])*88*R(p['percent'],100)
 if f=='limiting-water':return min(R(p['h'],2),s.Integer(p['o']))*2*18*R(p['percent'],100)
 if f=='compound-discount':
  price,pct,tax=v('price','pct','tax');reduced=price-R(price*pct,100);return reduced+reduced*tax/100
 if f=='table-weighted':
  a,b,c=v('a','b','c');all_scores=[60]*a+[75]*b+[90]*c;return R(sum(all_scores),len(all_scores))
 if f=='work-together':return s.solve(s.Eq(x/p['a']+x/p['b'],1),x)[0]
 if f=='prob-without':
  a,b=v('a','b');pairs=list(itertools.combinations(range(a+b),2));return R(sum(i<a and j<a for i,j in pairs),len(pairs))
 if f=='loan-decreasing':
  balance=p['principal'];principal_installment=R(balance,p['months']);interest=balance*R(p['rate'],100);return principal_installment+interest
 if f=='tiling-waste':
  minimum=p['a']*p['b']*(1+R(p['extra'],100))/p['side']**2;return s.ceiling(minimum)
 if f=='binary-expression':return int(format(p['a'],'b'),2)-int(format(p['b'],'o'),8)
 if f=='logic-count':return len(set(range(p['bound'],p['end']))&set(range(1,p['end'],2)))
 if f=='binary-search':
  worst=0
  for target in range(p['n']):
   lo,hi,count=0,p['n']-1,0
   while lo<=hi:
    mid=(lo+hi)//2;count+=1
    if target==mid:break
    if target<mid:hi=mid-1
    else:lo=mid+1
   worst=max(worst,count)
  return worst
 if f=='python-loop':
  tree=ast.parse(p['code']);assert not any(isinstance(n,(ast.Import,ast.ImportFrom,ast.Attribute)) for n in ast.walk(tree))
  capture=io.StringIO()
  with contextlib.redirect_stdout(capture):exec(compile(tree,'authored-reference','exec'),{'__builtins__':{'range':range,'print':print}})
  return s.Integer(capture.getvalue().strip())
 if f=='sql-sum':
  db=sqlite3.connect(':memory:');db.execute('CREATE TABLE T(id INTEGER,grp TEXT,value INTEGER)');db.executemany('INSERT INTO T VALUES(?,?,?)',p['rows']);return db.execute("SELECT SUM(value) FROM T WHERE grp='A'").fetchone()[0]
 if f=='network-hosts':return sum(1 for _ in ipaddress.IPv4Network('192.168.0.0/'+str(p['prefix'])).hosts())
 if f=='image-memory':return R(len(bytearray(p['w']*p['h']*(p['bits']//8))),1024)
 if f=='map-scale':return R(p['scale'],100)*p['cm']/1000
 if f=='temperature-height':return p['base']-R(p['height'],100)*R('0.6')
 if f=='river-discharge':return p['w']*p['d']*p['v']
 if f=='population-rate':return (R(p['b'],p['pop'])-R(p['d'],p['pop']))*1000
 if f=='ecology-energy':
  energy=s.Integer(p['energy'])
  for _ in range(2):energy=energy*R(p['eff'],100)
  return energy
 if f=='dna-pairs':
  adenine=R(p['total']*p['percent'],100);thymine=adenine;return (p['total']-adenine-thymine)/2
 if f=='genetics-testcross':
  gametes=list(itertools.product('Aa','Bb'));return R(sum(a=='a' and b=='b' for a,b in gametes),len(gametes))*p['n']
 raise AssertionError(f)

def parse_choice(value):
 value=value.strip('$').replace(' ', '').replace('\\left','').replace('\\right','')
 value=re.sub(r'\\frac\{(-?\d+)\}\{(\d+)\}',r'(\1/\2)',value)
 return s.sympify(value)
for row in rows:
 expected=ref(row['family'],row['parameters']);assert s.simplify(expected-s.sympify(row['expected']))==0,(row['id'],expected,row['expected'])
 values=[parse_choice(o) for o in row['options']]
 assert sum(s.simplify(z-expected)==0 for z in values)==1,row['id']
 assert s.simplify(values[0]-expected)==0,row['id']
 assert len(set(values))==4,row['id'];counts[row['family']]+=1
out={'checkedAt':'2026-11-03','records':len(rows),'families':dict(counts),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'method':'Independent CAS solutions, integration, finite enumeration, real SQLite queries and Python execution; all choices checked for numerical equivalence.'}
dest=Path('docs/content/ent/numeric-verification.json');dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'verified':len(rows),'families':len(counts)}))
