#!/usr/bin/env python3
"""Independent key audit of the offline expansion, including every generated variant.

Uses matrices, complete real solution sets, exhaustive finite searches and direct
geometric/physical models rather than reading the generator's stored answer.
No network, API, database or application credentials are used.
"""
import itertools, json, re
from collections import Counter
from pathlib import Path
import sympy as s
R=s.Rational
x=s.Symbol('x', real=True)

def parse(text):
    names={v:s.Symbol(v,real=True) for v in re.findall(r'\b[a-zA-Z]\b',text)}
    return s.sympify(text,locals=names,evaluate=False,rational=True)

def real_roots(e,v):
    result=s.solveset(e,v,domain=s.S.Reals)
    assert isinstance(result,s.FiniteSet),str(result)
    return list(result)

def reference(rec):
    kind=rec['kind']
    if kind=='practice':
        p=rec['parameters'];f=rec['family']
        if f=='composition-domain':
            g=p['a']/(x-p['b'])+p['c']
            return sum(set([s.Integer(p['b']),*real_roots(g-p['r'],x)]))
        if f=='parameter-system':
            k=s.Symbol('k',real=True);A=s.Matrix([[k-p['a'],p['b']],[p['d'],k-p['e']]])
            B=s.Matrix([p['c'],p['f']]);ks=real_roots(A.det(),k)
            assert len(ks)==2
            for v in ks:assert A.subs(k,v).row_join(B).rank()>A.subs(k,v).rank()
            return sum(v*v for v in ks)
        if f=='integer-root-ratios':
            valid=0
            for k in range(1,p['A']):
                # Discriminant formula, independently of the factorization used to build the item.
                d=p['A']**2-4*k*(p['A']-k)
                lo=(p['A']-s.sqrt(d))/2;hi=(p['A']+s.sqrt(d))/2
                valid+=int(bool(lo>0 and hi!=lo and hi>=p['T']*lo))
            return valid
        if f=='constrained-revenue':
            vals={n:(p['base']+p['step']*n)*(p['quantity']-p['loss']*n) for n in range(p['N']+1)}
            winners=[n for n,v in vals.items() if v==max(vals.values())];assert len(winners)==1
            return winners[0]
        if f=='tangent-parabola':
            b=s.Symbol('b');poly=(x-p['h'])**2+p['v']-(p['m']*x+b)
            return s.solve(s.discriminant(poly,x),b)[0]
        if f=='tangent-circle':
            c=s.Symbol('c',real=True)
            roots=real_roots((p['a']*p['h']+p['b']*p['k']-c)**2-p['r']**2*(p['a']**2+p['b']**2),c)
            return max(roots)
        if f=='cone-stages':
            def volume(h):return s.pi*(R(p['radius']*h,p['H']))**2*h/3
            return s.cancel((volume(p['b'])-volume(p['a']))/volume(p['H']))
        if f=='conditional-pair':
            tokens=['r']*p['red']+['b']*p['blue']+['g']*p['green']
            pairs=list(itertools.combinations(range(len(tokens)),2))
            given=[(a,b) for a,b in pairs if 'r' in (tokens[a],tokens[b])]
            good=[(a,b) for a,b in given if {tokens[a],tokens[b]}=={'r','b'}]
            return R(len(good),len(given))
        if f=='strict-success-threshold':
            for n in range(100000):
                if R(p['a']+n,p['nA']+n)>R(p['b'],p['nB']):return n
            raise AssertionError('unbounded success search')
        if f=='composed-exponential':
            y1=p['A']*p['B']**p['p0'];y2=p['A']*p['B']**p['q']
            b=s.root(R(y2,y1),p['q']-p['p0']);a=y1/b**p['p0']
            results=[t for t in range(-20,21) if a*b**(p['alpha']*t+p['beta'])==p['target']]
            assert len(results)==1
            return results[0]
        if f=='transformed-quadratic-level':
            r=p['center']-p['delta'];t=p['center']+p['delta'];f0=p['a']*r*t
            coefficient=R(f0,r*t);u=p['k']*x+p['b']
            level=p['a']*(p['D']**2-p['delta']**2)
            roots=real_roots(coefficient*(u-r)*(u-t)-level,x);assert len(roots)==2
            return sum(v*v for v in roots)
        if f=='polynomial-remainder':
            a,b=s.symbols('a b');poly=x**3+a*x**2+b*x+p['c']
            coefficients=s.solve([poly.subs(x,p['r'])-p['pr'],poly.subs(x,p['s'])-p['ps']],(a,b))
            return poly.subs(coefficients).subs(x,p['t'])
        if f=='radical-domain-check':
            roots=s.solve(s.sqrt(p['a']*x+p['b'])-(x-p['c']),x)
            valid=[v for v in roots if v.is_real and v>=p['c'] and s.sqrt(p['a']*v+p['b'])==v-p['c']]
            assert len(valid)==1
            return valid[0]
        if f=='evaporation-model':
            return s.solve(R(p['V']*p['p0'],100)-R(p['p1'],100)*(p['V']-x),x)[0]
        if f=='mixture-model':
            return s.solve(R(p['V']*p['lo'],100)+R(p['hi'],100)*x-R(p['mid'],100)*(p['V']+x),x)[0]
        if f=='weighted-mean-removal':
            return s.solve((p['n']*p['v']+p['k']*x)/(p['n']+p['k'])-p['u'],x)[0]
        if f=='linear-composition':
            m,n=s.symbols('m n',real=True);solutions=s.solve([m*m-p['a']**2,n*(m+1)-p['b']],(m,n))
            selected=[mm*p['t']+nn for mm,nn in solutions if mm<0];assert len(selected)==1
            return selected[0]
        if f=='percent-share':
            old=R(p['a'],p['N1']);new=R(p['b'],p['N2']);return (new/old-1)*100
        raise AssertionError(f)
    if kind=='system':
        vs=[s.Symbol(v,real=True) for v in rec['variables']]
        A,b=s.linear_eq_to_matrix([parse(e) for e in rec['equations']],vs)
        solution=A.inv()*b
        for i,v in enumerate(vs):assert s.simplify(solution[i]-R(rec['solution'][str(v)]))==0
        return solution[rec['variables'].index(rec['target'])]
    v=s.Symbol(rec['variable'],real=True)
    if kind=='equation':
        a,b=parse(rec['left']),parse(rec['right']);roots=real_roots(a-b,v)
        valid=[r for r in roots if a.subs(v,r).is_finite and b.subs(v,r).is_finite and s.simplify(a.subs(v,r)-b.subs(v,r))==0]
        assert set(valid)==set(map(R,rec['solutions']))
        return sum(valid)
    e=parse(rec['expression'])
    if kind=='domain':
        denoms=[term.base for term in s.preorder_traversal(e) if isinstance(term,s.Pow) and term.exp.is_number and term.exp<0 and term.base.has(v)]
        excluded=set(r for d in denoms for r in real_roots(d,v))
        assert excluded and excluded==set(map(R,rec['excluded']))
        return sum(excluded)
    if kind=='zeros':
        roots=real_roots(e,v);assert set(roots)==set(map(R,rec['solutions']))
        return sum(roots)
    if kind=='vertex':
        points=real_roots(s.diff(e,v),v);assert len(points)==1
        return e.subs(v,points[0])
    if kind=='evaluate':return e.subs(v,R(rec['input']))
    raise AssertionError(kind)

def numeric_option(text):
    text=text.strip('$ ')
    text=re.sub(r'\\frac\{([^{}]+)\}\{([^{}]+)\}',r'(\1)/(\2)',text)
    text=text.replace('{','(').replace('}',')').replace('\\left','').replace('\\right','')
    return s.simplify(s.sympify(text))

def main():
    kinds=Counter();checked=0
    for name in ('source','practice'):
        qs=json.loads(Path('shared/satScale'+name.title()+'.json').read_text())
        records=json.loads(Path('scripts/sat-scale-reference/sat-scale-'+name+'-reference.json').read_text())
        by_id={r['id']:r for r in records};assert len(qs)==len(by_id)
        for q in qs:
            rec=by_id[q['id']]
            try:
                result=s.simplify(reference(rec));want=R(rec['expected'])
                assert s.simplify(result-want)==0,f'{result} != {want}'
                if 'choices' in q:
                    vals=[numeric_option(c) for c in q['choices']]
                    assert len(vals)==4 and len(set(vals))==4
                    matches=[i for i,v in enumerate(vals) if s.simplify(v-result)==0]
                    assert matches==[q['answer']],str(matches)
                else:assert R(q['answer'])==result
                assert rec['expected'] not in ('nan','oo','zoo')
                checked+=1;kinds[rec.get('family',rec['kind'])]+=1
            except Exception as error:raise AssertionError(q['id']+': '+str(error)) from error
    report={'mathChecked':checked,'byMethod':dict(kinds),'result':'all independently recomputed keys and all numeric options passed'}
    Path('docs/content/sat-scale-verification.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report))

if __name__=='__main__':main()
