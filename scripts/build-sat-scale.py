#!/usr/bin/env python3
"""Offline importer. Requires sympy; accepts only the pinned CC-BY OpenStax edition.

No network, provider API or credentials are used. Runtime answers and private
verification records are separate. Source exercises are adapted to a single
numeric SAT-style response; diagrams and off-syllabus topics are excluded.
"""
import argparse
import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile
import sympy as S
from sympy.parsing.sympy_parser import parse_expr, standard_transformations, implicit_multiplication_application, rationalize

PIN = '4922e46ebc04326979e19392ccc2384cb8b9076c'
C = '{http://cnx.rice.edu/cnxml}'
M = '{http://www.w3.org/1998/Math/MathML}'
TRANSFORMS = standard_transformations + (implicit_multiplication_application, rationalize,)
SYMBOLS = {x: S.Symbol(x, real=True) for x in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'}
SYMBOLS['sqrt'] = S.sqrt
ALLOWED = {
 'm49301','m49304','m49306','m49308','m49312','m49314','m49320','m49324','m49326','m49327',
 'm49337','m49346','m49347','m49348','m49349','m49351','m49352','m49353','m49361','m49362',
 'm49420','m49431','m50389','m51239','m51241','m51242','m51246','m51247','m51248','m51252',
 'm51253','m51254','m51256','m51258','m51259','m51261','m51262','m51263','m51265','m51266',
 'm51267','m51268','m51270','m51271','m51272','m51274','m51275','m51276','m51277','m51278',
 'm51279','m51280','m51281',
}

def mml(node):
    tag = node.tag.split('}')[-1]
    kids = list(node)
    if tag in ('mi','mn','mo'):
        t = (node.text or '').strip().replace('−','-').replace('–','-').replace('×','*').replace('⋅','*').replace('·','*').replace('÷','/')
        if t in ('\u2061','\u2062','\u200b','\u00a0'): return ''
        if t in ('|','<','>','≤','≥','≠','∞','π','∈','∪'): raise ValueError('unsupported notation')
        return t
    if tag in ('mspace','mphantom'): return ''
    if tag == 'mtext':
        if (node.text or '').strip(): raise ValueError('text inside math')
        return ''
    if tag == 'msup': return '('+mml(kids[0])+')**('+mml(kids[1])+')'
    if tag == 'mfrac': return '(('+mml(kids[0])+')/('+mml(kids[1])+'))'
    if tag == 'msqrt': return 'sqrt('+''.join(mml(k) for k in kids)+')'
    if tag == 'mroot': return '('+mml(kids[0])+')**(1/('+mml(kids[1])+'))'
    if tag == 'mfenced':
        content = ','.join(mml(k) for k in kids)
        return content if any(k.tag == M+'mtable' for k in kids) else '('+content+')'
    if tag == 'mtable': return ';'.join(mml(k) for k in kids)
    if tag in ('mtr','mlabeledtr'): return ''.join(mml(k) for k in kids)
    if tag not in ('math','mrow','mtd','mstyle','semantics'): raise ValueError('unsupported MathML '+tag)
    return ''.join(mml(k) for k in kids)

def expr(text):
    text = text.strip().strip(',.').replace('^','**')
    if not text or len(text)>400 or not re.fullmatch(r'[a-zA-Z0-9+*/().\s-]+',text): raise ValueError('unsafe expression')
    if '..' in text or '()' in text or any(len(w)>1 and w!='sqrt' for w in re.findall('[a-zA-Z]+',text)): raise ValueError('unsupported identifier')
    if re.search(r'(?<!sqrt)[a-zA-Z]\s*\(',text.replace('sqrt(','√(')):raise ValueError('undefined function application')
    result=parse_expr(text,local_dict=SYMBOLS,transformations=TRANSFORMS,evaluate=False)
    if not isinstance(result,S.Expr) or any(isinstance(a,S.Tuple) for a in S.preorder_traversal(result)): raise ValueError('not a scalar expression')
    if any(p.exp.is_number and abs(p.exp)>12 for p in result.atoms(S.Pow)):raise ValueError('excessive exponent')
    return result

def rational_roots(poly, x):
    p = S.Poly(poly,x)
    if p.degree()<1 or p.degree()>3: raise ValueError('degree outside scope')
    roots = p.ground_roots()
    if sum(roots.values()) != p.degree(): raise ValueError('not all roots rational')
    return sorted(roots)

def as_answer(value):
    v = S.simplify(value)
    if not v.is_Rational or abs(v)>100000: raise ValueError('non-rational or excessive answer')
    return str(v)

def equations(raw):
    parts = raw.split(';')
    return [p.strip() for p in parts if p.count('=')==1]

def adapt(raw, mode):
    eqs = equations(raw)
    if len(eqs)>2: raise ValueError('more than two equations')
    if len(eqs)==2:
        es = [expr(e.split('=')[0])-expr(e.split('=')[1]) for e in eqs]
        vs = sorted(set.union(*(e.free_symbols for e in es)),key=str)
        if len(vs)!=2 or any(S.Poly(e,*vs).total_degree()!=1 for e in es): raise ValueError('unsupported system')
        sol = S.solve(es,vs,dict=True)
        if len(sol)!=1 or any(v not in sol[0] or not sol[0][v].is_Rational for v in vs): raise ValueError('nonunique system')
        v=vs[mode%2]; answer=sol[0][v]
        a,b=vs
        stem='The following system has a unique solution.\n\n'+ '\n\n'.join('$'+S.latex(S.Eq(expr(e.split('=')[0]),expr(e.split('=')[1]),evaluate=False))+'$' for e in eqs)+f'\n\nWhat is ${S.latex(v)}$?'
        explanation=f'Исключаем одну переменную из двух линейных уравнений. Решение системы: ${S.latex(a)}={S.latex(sol[0][a])}$, ${S.latex(b)}={S.latex(sol[0][b])}$. Подстановка в обе исходные строки даёт ноль в разностях левой и правой частей. Требуемое значение ${S.latex(v)}={S.latex(answer)}$.'
        return stem,answer,explanation,'Algebra','Systems of linear equations',2,'linear-system', {'kind':'system','equations':[str(S.expand(e)) for e in es],'variables':list(map(str,vs)),'target':str(v),'solution':{str(k):str(v) for k,v in sol[0].items()}}
    if len(eqs)==1:
        left,right=eqs[0].split('=')
        if re.fullmatch(r'\s*[a-zA-Z]\([a-zA-Z]\)\s*',left):
            raw=right; eqs=[]
        else:
            l,r=expr(left),expr(right)
            vs=sorted(l.free_symbols|r.free_symbols,key=str)
            if len(vs)!=1: raise ValueError('not a one-variable equation')
            x=vs[0]; delta=l-r
            numerator=S.together(delta).as_numer_denom()[0]
            candidates=rational_roots(numerator,x)
            valid=[v for v in candidates if all(z.subs(x,v).is_finite and S.simplify(delta.subs(x,v))==0 for z in (l,r))]
            if not valid: raise ValueError('no valid real roots')
            answer = sum(valid) if len(valid)>1 else valid[0]
            prompt = 'What is the sum of all distinct real solutions?' if len(valid)>1 else f'What is the real solution for ${x}$?'
            stem=f'Consider the equation\n\n${S.latex(l)}={S.latex(r)}$.\n\n'+prompt
            denoms=[S.denom(z) for z in (l,r)]
            restricted=any(d.has(x) for d in denoms)
            degree=S.Poly(numerator,x).degree()
            difficulty=3 if (degree==3 and numerator.is_Add and len(S.Poly(numerator,x).terms())>=3 and S.count_ops(numerator)>=7) or (restricted and degree==2 and len(valid)<len(candidates)) else 2 if degree>=2 or restricted or S.count_ops(delta)>3 else 1
            fact=S.factor(numerator)
            explanation=f'Переносим все члены в одну сторону и приводим к общему знаменателю. Числитель раскладывается как ${S.latex(fact)}$. Кандидаты: '+', '.join('$'+S.latex(x)+'='+S.latex(v)+'$' for v in candidates)+'. Проверяем исходные знаменатели и обе стороны; допустимые корни: '+', '.join('$'+S.latex(v)+'$' for v in valid)+f'. '+('Складываем различные корни: ' if len(valid)>1 else 'Ответ: ')+f'${S.latex(answer)}$.'
            return stem,answer,explanation,'Advanced Math' if degree>1 or restricted else 'Algebra','Nonlinear equations' if degree>1 or restricted else 'Linear equations in one variable',difficulty,'equation-'+str(degree),{'kind':'equation','left':str(l),'right':str(r),'variable':str(x),'candidates':list(map(str,candidates)),'solutions':list(map(str,valid))}
    if eqs: raise ValueError('equation not handled')
    e=expr(raw); vs=sorted(e.free_symbols,key=str)
    if len(vs)!=1: raise ValueError('not a one-variable expression')
    x=vs[0]
    # An expression is used as a newly defined function; no source context or diagram is assumed.
    denominator=S.denom(e)
    if denominator.has(x):
        roots=rational_roots(denominator,x)
        answer=sum(roots)
        stem=f'For real ${x}$, let $P({x})={S.latex(e)}$. What is the sum of all distinct real values excluded from the domain of this expression?'
        explanation=f'Выражение не определено, когда исходный знаменатель равен нулю: ${S.latex(S.factor(denominator))}=0$. Запрещённые значения: '+', '.join('$'+S.latex(v)+'$' for v in roots)+f'. Их сумма ${S.latex(answer)}$. Сокращение общего множителя не возвращает исключённое значение в исходную область определения.'
        return stem,answer,explanation,'Advanced Math','Nonlinear functions',2,'domain',{'kind':'domain','expression':str(e),'variable':str(x),'excluded':list(map(str,roots))}
    if S.count_ops(e)<2:raise ValueError('trivial expression without standalone context')
    p=S.Poly(e,x); degree=p.degree()
    if degree==2 and mode%3==0:
        a,b,c=p.all_coeffs(); xv=-b/(2*a); answer=S.simplify(e.subs(x,xv)); word='minimum' if a>0 else 'maximum'
        stem=f'The function $f({x})={S.latex(e)}$ is defined for all real ${x}$. What is its {word} value?'
        explanation=f'Дополняем квадрат: $f({x})={S.latex(a)}({x}-({S.latex(xv)}))^2+({S.latex(answer)})$. Поскольку старший коэффициент '+('положителен' if a>0 else 'отрицателен')+f', искомый экстремум равен ${S.latex(answer)}$ и достигается при ${x}={S.latex(xv)}$.'
        return stem,answer,explanation,'Advanced Math','Quadratic functions',2,'vertex',{'kind':'vertex','expression':str(e),'variable':str(x),'point':str(xv)}
    roots=rational_roots(e,x)
    answer=sum(roots)
    stem=f'Let $P({x})={S.latex(e)}$. What is the sum of all distinct real zeros of $P$?'
    explanation=f'Разложение на множители: $P({x})={S.latex(S.factor(e))}$. Различные действительные нули: '+', '.join('$'+S.latex(v)+'$' for v in roots)+f'. Каждый повторяющийся корень учитывается один раз, поэтому сумма равна ${S.latex(answer)}$.'
    # A cubic degree alone does not make an item Hard: factored powers and
    # monomials disclose their zeros immediately. Reserve Hard for a genuine
    # expanded multistep factorization; repeated roots still count just once.
    difficulty=3 if degree==3 and e.is_Add and len(p.terms())>=3 and S.count_ops(e)>=7 and len(roots)>=2 else 2 if degree>=2 else 1
    return stem,answer,explanation,'Advanced Math' if degree>=2 else 'Algebra','Nonlinear equations' if degree>=2 else 'Linear equations in one variable',difficulty,'zeros-'+str(degree),{'kind':'zeros','expression':str(e),'variable':str(x),'solutions':list(map(str,roots))}

def question(slug, adapted, source_id, locator, purpose='assessment', family=None):
    stem,answer,explanation,domain,skill,difficulty,kind,record=adapted
    answer=as_answer(answer)
    value=S.Rational(answer)
    index=int(hashlib.sha256(slug.encode()).hexdigest()[:8],16)
    q={'id':slug,'section':'math','domain':domain,'skill':skill,'difficulty':difficulty,'stem':stem,'answer':answer,'explanation':explanation,'source':'bank','purpose':purpose,'attribution':{'sourceId':source_id,'locator':locator,'changes':'Адаптация 365step: исходная формула преобразована в вопрос формата SAT, добавлены новое русское решение и проверка ответа. Исходная версия OpenStax — CC BY 4.0; адаптация — CC BY 4.0.','license':'CC BY 4.0','licenseUrl':'https://creativecommons.org/licenses/by/4.0/','download':'/content/sat-scale-2026.json'}}
    # SAT grid-in width; otherwise explicit four-way numerical choices.
    if len(answer.lstrip('-'))>5 or index%4!=0:
        wrong=[]
        for candidate in [-value, value+1,value-1,2*value,value/2,value+2]:
            if candidate!=value and candidate not in wrong:wrong.append(candidate)
            if len(wrong)==3:break
        options=[str(v) for v in wrong];pos=index%4;options.insert(pos,answer)
        q.update(choices=['$'+S.latex(S.Rational(v))+'$' for v in options],answer=pos)
    else:q['numericRule']={'kind':'exact'}
    structure = re.sub(r'-?\d+(?:\.\d+)?','#',record.get('expression',record.get('left',kind)))
    q['familyId']=family or 'scale-source:'+kind+':'+hashlib.sha256(structure.encode()).hexdigest()[:12]
    record.update(id=slug,expected=answer,kindName=kind)
    return q,record

def import_source(archive):
    questions=[];records=[];seen=set();counts=Counter();rejects=Counter()
    z=ZipFile(archive);prefix=z.namelist()[0]
    assert z.read(prefix+'LICENSE').startswith(b'Attribution 4.0 International'), 'Wrong edition license'
    assert PIN in prefix, 'Use the pinned 2026 CC BY source archive'
    for name in sorted(z.namelist()):
        if not name.endswith('/index.cnxml') or name.split('/')[-2] not in ALLOWED:continue
        module=name.split('/')[-2];root=ET.fromstring(z.read(name));title=''.join(root.find(C+'title').itertext())
        for exercise in root.iter(C+'exercise'):
            problem=exercise.find(C+'problem')
            if problem is None or any(n.tag in (C+'figure',C+'image',C+'table') for n in problem.iter()):continue
            math=list(problem.iter(M+'math'))
            if len(math)!=1:continue
            try:
                raw=mml(math[0]);mode=int(hashlib.sha256((module+exercise.get('id','')).encode()).hexdigest()[:8],16)
                adapted=adapt(raw,mode)
                identity=adapted[0]
                if identity in seen:continue
                q,rec=question('scale-source-'+module+'-'+exercise.get('id','').replace('fs-id','').replace('eip-','')[:60],adapted,'openstax-2026-08',title+' · '+module+' · exercise '+exercise.get('id','')+' · commit '+PIN)
                seen.add(identity);questions.append(q);records.append(rec);counts[title]+=1
            except (ValueError,TypeError,KeyError,IndexError,AttributeError,SyntaxError,NotImplementedError,S.PolynomialError,S.SympifyError,ZeroDivisionError) as error:rejects[type(error).__name__]+=1
    return questions,records,{'bySourceSection':dict(counts),'excluded':dict(rejects)}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--archive',required=True);ap.add_argument('--output',default='shared/satScaleSource.json');ap.add_argument('--records',default='scripts/sat-scale-reference/sat-scale-source-reference.json');args=ap.parse_args()
    qs,recs,stats=import_source(args.archive)
    Path(args.output).write_text(json.dumps(qs,ensure_ascii=False,indent=2)+'\n');Path(args.records).parent.mkdir(parents=True,exist_ok=True);Path(args.records).write_text(json.dumps(recs,indent=2)+'\n')
    Path('docs/content/sat-scale-import.json').write_text(json.dumps({'commit':PIN,'sourceSha256':hashlib.sha256(Path(args.archive).read_bytes()).hexdigest(),'questions':len(qs),'difficulty':dict(Counter(q['difficulty'] for q in qs)),**stats},indent=2)+'\n')
    print(json.dumps({'questions':len(qs),'hard':sum(q['difficulty']==3 for q in qs),**stats}))

if __name__=='__main__':main()
