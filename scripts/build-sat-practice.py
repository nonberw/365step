#!/usr/bin/env python3
"""Reproducible offline practice, explicitly labeled reinforcement, never independent authored items.
Original templates by 365step (CC BY-SA 4.0); DeepMind source generator Apache-2.0.
"""
import hashlib, json, random, re, sys
from pathlib import Path
import numpy as np
import sympy as S
import importlib.util
spec=importlib.util.spec_from_file_location('scale_import',Path(__file__).with_name('build-sat-scale.py'))
imp=importlib.util.module_from_spec(spec);spec.loader.exec_module(imp)
R=S.Rational
L=S.latex
x=S.Symbol('x',real=True)
rng=random.Random(36520261103)

def I(a,b):return rng.randint(a,b)
def make(kind):
    p={};domain='Advanced Math';skill='Nonlinear equations';difficulty=3
    if kind=='composition-domain':
        r,s,c=I(-8,8),I(-8,8),I(-8,8)
        if r==c or r==s:raise ValueError()
        a,b=I(2,12),I(-6,6);u=S.Symbol('u');f=(u-r)*(u-s)/(u-r);g=a/(x-b)+c
        excluded=[S.Integer(b),S.Integer(b)+R(a,r-c)];ans=sum(excluded)
        stem=f'Let $f(u)=\\frac{{(u-({r}))(u-({s}))}}{{u-({r})}}$ and $g(x)={L(g)}$. What is the sum of all distinct real values excluded from the domain of $f(g(x))$? Use the original expressions before canceling factors.'
        why=f'Внутренняя функция запрещает $x={b}$. Внешняя функция запрещает аргумент $u={r}$ даже после сокращения. Решаем $g(x)={r}$ и получаем $x={L(excluded[1])}$. Значения различны, их сумма ${L(ans)}$.'
        p=dict(r=r,s=s,c=c,a=a,b=b);skill='Nonlinear functions'
    elif kind=='parameter-system':
        a,e,b,d,c,f=I(-5,5),I(-5,5),I(1,7),I(1,7),I(1,12),I(1,12)
        k=S.Symbol('k');poly=(k-a)*(k-e)-b*d;ks=S.solve(poly,k)
        if any(S.simplify(c*d-f*(k0-a))==0 for k0 in ks):raise ValueError()
        ans=a*a+e*e+2*b*d
        stem=f'The system $(k-({a}))x+{b}y={c}$ and ${d}x+(k-({e}))y={f}$ has no solution. What is the sum of the squares of all possible real values of $k$?'
        why=f'Для параллельных строк требуется $(k-({a}))(k-({e}))-{b*d}=0$. Проверка правых частей исключает совпадение строк при обоих корнях. По Виету сумма корней ${a+e}$, произведение ${a*e-b*d}$. Сумма квадратов $({a+e})^2-2({a*e-b*d})={ans}$.'
        p=dict(a=a,e=e,b=b,d=d,c=c,f=f);domain='Algebra';skill='Systems of linear equations'
    elif kind=='integer-root-ratios':
        A=I(8,80);T=I(2,5)
        valid=[k for k in range(1,A) if k!=A-k and max(k,A-k)>=T*min(k,A-k)]
        ans=len(valid)
        stem=f'For an integer $k$ with $1\\leq k\\leq {A-1}$, the equation $x^2-{A}x+k({A}-k)=0$ must have two distinct positive roots, with the larger root at least {T} times the smaller. How many values of $k$ satisfy all the conditions?'
        why=f'Многочлен равен $(x-k)(x-({A}-k))$. Оба корня положительны в заданном диапазоне. Для отношения проверяем две ветви: $k\\geq {T}({A}-k)$ или ${A}-k\\geq {T}k$. Равные корни исключаются. Допустимые целые $k$: '+', '.join(map(str,valid))+f'. Их количество {ans}.'
        p=dict(A=A,T=T)
    elif kind=='constrained-revenue':
        base,step,quantity,loss=I(4,30),I(1,5),I(60,220),I(2,9);N=I(2,min(15,quantity//loss));values=[(base+step*n)*(quantity-loss*n) for n in range(N+1)]
        vertex=R(step*quantity-base*loss,2*step*loss)
        if not 1<vertex<N-1:raise ValueError()
        best=max(values);winners=[n for n,v in enumerate(values) if v==best]
        if len(winners)!=1:raise ValueError()
        ans=winners[0];vertex=R(step*quantity-base*loss,2*step*loss)
        stem=f'A seller raises a price from {base} dollars by {step} dollars for each step $n$. Sales fall from {quantity} units by {loss} units per step. The seller may choose an integer $n$ with $0\\leq n\\leq {N}$. Which value of $n$ maximizes revenue?'
        why=f'Выручка $R(n)=({base}+{step}n)({quantity}-{loss}n)$ — парабола с отрицательным старшим коэффициентом. Её вершина при $n={L(vertex)}$. Проверяем ближайшие целые и границы от 0 до {N}. Единственный максимум ${best}$ достигается при $n={ans}$.'
        p=dict(base=base,step=step,quantity=quantity,loss=loss,N=N);skill='Quadratic functions'
    elif kind=='tangent-parabola':
        h,v,m=I(-9,9),I(-15,15),I(-10,10)
        if not m:raise ValueError()
        ans=S.Integer(v)-h*m-R(m*m,4)
        stem=f'The line $y={m}x+b$ and the parabola $y=(x-({h}))^2+({v})$ intersect at exactly one real point. What is $b$?'
        why=f'Приравниваем: $x^2-({2*h+m})x+({h*h+v}-b)=0$. Единственное пересечение требует нулевого дискриминанта: $({2*h+m})^2-4({h*h+v}-b)=0$. Отсюда $b={L(ans)}$.'
        p=dict(h=h,v=v,m=m)
    elif kind=='tangent-circle':
        h,k,r=I(-12,12),I(-12,12),I(2,13);a,b,norm=rng.choice([(3,4,5),(5,12,13),(8,15,17)])
        ans=a*h+b*k+r*norm
        stem=f'The line ${a}x+{b}y=c$ is tangent to $(x-({h}))^2+(y-({k}))^2={r*r}$. Of the two possible real values of $c$, what is the larger?'
        why=f'Центр $({h},{k})$, радиус {r}. Расстояние до прямой $|{a*h+b*k}-c|/{norm}$ равно радиусу. Поэтому $c={a*h+b*k}\\pm {r*norm}$; большее значение ${ans}$.'
        p=dict(h=h,k=k,r=r,a=a,b=b);domain='Geometry and Trigonometry';skill='Circles'
    elif kind=='cone-stages':
        H=I(8,30);a=I(1,H-3);b=I(a+1,H-1);radius=I(3,12);ans=R(b**3-a**3,H**3)
        stem=f'A conical container has height {H} cm and base radius {radius} cm, with the vertex downward. Water rises from {a} cm to {b} cm above the vertex. What fraction of the full cone volume was added?'
        why=f'Радиусы подобных сечений пропорциональны высоте, поэтому объёмная доля равна кубу отношения высот. Добавленная доля $({b}/{H})^3-({a}/{H})^3={L(ans)}$. Вычитать только отношения высот нельзя.'
        p=dict(H=H,a=a,b=b,radius=radius);difficulty=2;domain='Geometry and Trigonometry';skill='Area and volume'
    elif kind=='conditional-pair':
        red,blue,green=I(2,15),I(2,15),I(1,10);N=red+blue+green;den=S.binomial(N,2)-S.binomial(N-red,2);ans=S.Integer(red*blue)/den
        stem=f'A bag holds {red} red, {blue} blue and {green} green tokens. Two are drawn uniformly without replacement. Given that at least one drawn token is red, what is the probability that the pair contains one red and one blue token?'
        why=f'Всего неупорядоченных пар $\\binom{{{N}}}{{2}}$. Условию соответствует $\\binom{{{N}}}{{2}}-\\binom{{{N-red}}}{{2}}={den}$ пар. Нужных красно-синих пар ${red}\\cdot {blue}={red*blue}$. Условная вероятность ${red*blue}/{den}={L(ans)}$.'
        p=dict(red=red,blue=blue,green=green);domain='Problem-Solving and Data Analysis';skill='Probability'
    elif kind=='strict-success-threshold':
        nA,nB=I(15,80),I(15,80);a,b=I(3,nA-2),I(3,nB-2)
        if R(a,nA)>=R(b,nB):raise ValueError()
        threshold=R(b*nA-a*nB,nB-b);ans=int(S.floor(threshold))+1
        stem=f'Method A succeeds in {a} of {nA} trials; method B succeeds in {b} of {nB} trials. Additional trials are performed only for A and every additional trial succeeds. What is the least number of additional trials needed for A\'s overall success rate to be strictly greater than B\'s?'
        why=f'Требуется $({a}+x)/({nA}+x)>{b}/{nB}$. Знаменатели положительны; после умножения получаем $x>{L(threshold)}$. Из-за строгого неравенства минимальное неотрицательное целое — ${ans}$. При нём сравнение выполняется, при предыдущем целом — нет.'
        p=dict(nA=nA,nB=nB,a=a,b=b);difficulty=2;domain='Problem-Solving and Data Analysis';skill='Percentages'
    elif kind=='composed-exponential':
        A,B,p0,q,alpha,beta,t=I(2,20),I(2,3),I(1,3),I(4,6),I(1,3),I(-2,2),I(1,4)
        exponent=alpha*t+beta
        if exponent<0 or exponent>8:raise ValueError()
        target=A*B**exponent;ans=t
        stem=f'For $F(u)=a b^u$ with $a>0$ and $b>1$, $F({p0})={A*B**p0}$ and $F({q})={A*B**q}$. Let $G(t)=F({alpha}t+({beta}))$. If $G(t)={target}$, what is $t$?'
        why=f'Отношение двух данных значений даёт $b^{{{q-p0}}}={B**(q-p0)}$, значит $b={B}$ и $a={A}$. Из $F({alpha}t+({beta}))={target}$ получаем ${alpha}t+({beta})={exponent}$. Поэтому $t={ans}$.'
        p=dict(A=A,B=B,p0=p0,q=q,alpha=alpha,beta=beta,target=target);skill='Exponential models'
    elif kind=='transformed-quadratic-level':
        center,delta,a,k,b,D=I(3,12),I(1,2),I(1,6),I(2,6),I(-6,6),I(3,7)
        r,s=center-delta,center+delta;f0=a*r*s;level=a*(D*D-delta*delta);ans=R(2*((center-b)**2+D**2),k*k)
        stem=f'A quadratic function $f$ has zeros {r} and {s} and satisfies $f(0)={f0}$. What is the sum of the squares of all real solutions of $f({k}x+({b}))={level}$?'
        why=f'Из нулей $f(u)=a(u-{r})(u-{s})$, а значение при нуле даёт $a={a}$. При указанном уровне получаем $(u-{center})^2={D*D}$, значит $u={center-D}$ или $u={center+D}$. Переводим обратно: $x=({center-D}-({b}))/{k}$ и $x=({center+D}-({b}))/{k}$. Сумма квадратов ${L(ans)}$.'
        p=dict(center=center,delta=delta,a=a,k=k,b=b,D=D);skill='Quadratic functions'
    elif kind=='polynomial-remainder':
        r,s,t=I(-5,5),I(-5,5),I(-5,5);aa,bb,c=I(-7,7),I(-7,7),I(-8,8)
        if r==s or t in (r,s) or not r or not s:raise ValueError()
        P=x**3+aa*x**2+bb*x+c;pr=P.subs(x,r);ps=P.subs(x,s);ans=P.subs(x,t)
        stem=f'Let $P(x)=x^3+ax^2+bx+({c})$. The remainder when $P(x)$ is divided by $x-({r})$ is {pr}, and the remainder on division by $x-({s})$ is {ps}. What is $P({t})$?'
        why=f'По теореме об остатке $P({r})={pr}$ и $P({s})={ps}$. Получаем два линейных уравнения для коэффициентов: ${r*r}a+({r})b={pr-r**3-c}$ и ${s*s}a+({s})b={ps-s**3-c}$. Их единственное решение $a={aa}$, $b={bb}$. Подстановка даёт $P({t})={ans}$.'
        # The coefficient system is singular for r=-s only when both squared/linear rows are dependent; reject explicitly.
        if S.det(S.Matrix([[r*r,r],[s*s,s]]))==0:raise ValueError()
        p=dict(r=r,s=s,t=t,c=c,pr=int(pr),ps=int(ps));skill='Nonlinear functions'
    elif kind=='radical-domain-check':
        c,d,e=I(1,8),I(1,5),I(6,12);a=e-d;b=c*(d-e)+d*e;ans=c+e
        stem=f'For real $x$, $\\sqrt{{{a}x+({b})}}=x-{c}$. What is the real solution?'
        why=f'Правая часть требует $x\\geq {c}$. После возведения в квадрат кандидаты ${c-d}$ и ${c+e}$. Первый меньше {c} и посторонний; второй удовлетворяет исходному равенству. Ответ ${ans}$.'
        p=dict(c=c,d=d,e=e,a=a,b=b);difficulty=2
    elif kind=='evaporation-model':
        V=I(20,150);p0,p1=I(5,20),I(25,50);ans=R(V*(p1-p0),p1)
        stem=f'A container holds {V} liters of a {p0}% salt solution. Only water evaporates. How many liters must evaporate for the concentration to reach {p1}%? Assume the amount of salt is unchanged.'
        why=f'Соли ${V}\\cdot {p0}/100$ литра. Конечный объём ${V*p0}/{p1}$ литра. Испарившийся объём ${V}-{V*p0}/{p1}={L(ans)}$ литра.'
        p=dict(V=V,p0=p0,p1=p1);domain='Algebra';skill='Linear models';difficulty=2
    elif kind=='mixture-model':
        V=I(5,40);lo,mid,hi=I(5,15),I(20,30),I(35,60);ans=R(V*(mid-lo),hi-mid)
        stem=f'{V} liters of a {lo}% solution are mixed with $x$ liters of a {hi}% solution to produce a {mid}% solution. What is $x$? Assume volumes add.'
        why=f'Баланс вещества: ${lo}\\cdot {V}+{hi}x={mid}({V}+x)$. Значит $({hi}-{mid})x={V*(mid-lo)}$ и $x={L(ans)}$.'
        p=dict(V=V,lo=lo,mid=mid,hi=hi);domain='Algebra';skill='Linear models';difficulty=2
    elif kind=='weighted-mean-removal':
        n,k,u,v=I(20,60),I(3,10),I(60,80),I(81,95);ans=R((n+k)*u-n*v,k)
        if ans<0 or ans>100:raise ValueError()
        stem=f'A group of {n+k} students has mean score {u}. After {k} leave, the remaining {n} students have mean {v}. What was the mean score of the students who left?'
        why=f'Первоначальная сумма $({n+k})\\cdot {u}={(n+k)*u}$, оставшаяся ${n}\\cdot {v}={n*v}$. На {k} ушедших приходится разность этих сумм. Их среднее ${L(ans)}$.'
        p=dict(n=n,k=k,u=u,v=v);domain='Problem-Solving and Data Analysis';skill='One-variable data';difficulty=2
    elif kind=='linear-composition':
        a,b,t=I(2,9),I(-9,9),I(-7,7);ans=-a*t+R(b,1-a)
        stem=f'Let $f(x)=mx+n$, where $m<0$, and suppose $f(f(x))={a*a}x+({b})$ for every real $x$. What is $f({t})$?'
        why=f'Сравнение коэффициентов даёт $m^2={a*a}$. Из $m<0$ получаем $m=-{a}$. Далее $n(m+1)={b}$, значит $n={L(R(b,1-a))}$. Подставляем аргумент: $f({t})={L(ans)}$.'
        p=dict(a=a,b=b,t=t);domain='Algebra';skill='Linear functions';difficulty=2
    elif kind=='percent-share':
        N1,N2=I(10,40)*10,I(10,40)*10;share1,share2=I(2,7)*10,I(2,7)*10
        if share2<=share1:raise ValueError()
        a=N1*share1//100;b=N2*share2//100;ans=R(100*(share2-share1),share1)
        stem=f"A club grows from {a} of a school's {N1} students to {b} of its {N2} students. By what percent did the club's share of enrollment increase, relative to its original share?"
        why=f'Первая доля ${a}/{N1}={share1}/100$, вторая ${b}/{N2}={share2}/100$. Относительный рост доли $({share2}-{share1})/{share1}\\cdot100\\%={L(ans)}\\%$. Это не разность в процентных пунктах.'
        p=dict(a=a,b=b,N1=N1,N2=N2);domain='Problem-Solving and Data Analysis';skill='Percentages';difficulty=2
    else:raise ValueError(kind)
    return stem,ans,why,domain,skill,difficulty,kind,{'kind':'practice','family':kind,'parameters':p}

FAMILIES=['composition-domain','parameter-system','integer-root-ratios','constrained-revenue','tangent-parabola','tangent-circle','cone-stages','conditional-pair','strict-success-threshold','composed-exponential','transformed-quadratic-level','polynomial-remainder','radical-domain-check','evaporation-model','mixture-model','weighted-mean-removal','linear-composition','percent-share']

def main():
    questions=[];records=[];seen=set()
    for kind in FAMILIES:
        count=0
        while count<100:
            try:
                adapted=make(kind)
                if adapted[0] in seen:continue
                q,rec=imp.question(f'scale-practice-{kind}-{count+1:03d}',adapted,'precalc','Local 365step generator family '+kind+'; mathematical methods from the open Precalculus curriculum','reinforcement','scale-practice:'+kind)
                q['attribution'].update(changes='Вариант для закрепления, созданный локальным генератором 365step по теме открытого учебника. Это не отдельная авторская задача SAT. Условия и русское решение — CC BY-SA 4.0.',license='CC BY-SA 4.0',licenseUrl='https://creativecommons.org/licenses/by-sa/4.0/')
                if kind=='conditional-pair':
                    value=S.Rational(rec['expected']);r,b,g=(rec['parameters'][k] for k in ('red','blue','green'));N=r+b+g
                    candidates=[R(r*b,S.binomial(N,2)),R(r*b,N*N),1-value,value/2,value*2]
                    wrong=[]
                    for v in candidates:
                        if v!=value and 0<=v<=1 and v not in wrong:wrong.append(v)
                        if len(wrong)==3:break
                    pos=count%4;wrong.insert(pos,value);q.update(choices=['$'+L(v)+'$' for v in wrong],answer=pos);q.pop('numericRule',None)
                seen.add(adapted[0]);questions.append(q);records.append(rec);count+=1
            except (ValueError,ZeroDivisionError):continue
    # Independent upstream source generator: only algebra/functions, no calculus, trigonometric identities or ML 'hard' labels.
    sys.path.insert(0,str(Path(__file__).parent/'vendor'/'mathematics_dataset'))
    from mathematics_dataset.modules import algebra,polynomials
    from mathematics_dataset.util import composition
    random.seed(36520261103);np.random.seed(36520261103 % 2**32)
    for module,fun in [('linear-2d',algebra.solve_linear_2d),('polynomial-zeros',algebra.polynomial_roots),('function-value',polynomials.evaluate)]:
        count=0;attempts=0
        while count<200:
            attempts+=1
            if attempts>6000:raise RuntimeError('Insufficient verified examples for '+module)
            try:
                original=fun(None,composition.PreSampleArgs(1,1,3,6));text=str(original.question)
                if module=='linear-2d':
                    match=re.fullmatch(r'Solve (.+) for ([a-zA-Z])\.',text)
                    if not match:continue
                    raw=match[1].replace(' and ',';').replace(', ',';');target=match[2];vs=sorted(set(re.findall(r'[a-zA-Z]',raw)))
                    adapted=imp.adapt(raw,vs.index(target))
                    if S.simplify(adapted[1]-original.answer)!=0:raise AssertionError('Upstream linear key disagrees')
                elif module=='polynomial-zeros':
                    if text.startswith('Factor '):
                        raw=text[7:].rstrip('.')
                        upstream=original.answer.xreplace({v:imp.SYMBOLS[str(v)] for v in original.answer.free_symbols})
                        if S.simplify(imp.expr(raw)-upstream)!=0:raise AssertionError('Upstream factor key disagrees: '+text)
                        adapted=imp.adapt(raw,1)
                    else:continue
                else:
                    match=re.fullmatch(r'Let ([a-zA-Z])\(([a-zA-Z])\) = (.+)\. (?:Calculate|What is|Give|Determine) \1\(([-0-9/]+)\)[.?]',text)
                    if not match:continue
                    name,var,raw,argument=match.groups();e=imp.expr(raw);v=imp.SYMBOLS[var];answer=S.simplify(e.subs(v,R(argument)))
                    if S.simplify(answer-original.answer)!=0:raise AssertionError('Upstream value key disagrees')
                    stem=f'Let ${name}({var})={L(e)}$. What is ${name}({argument})$?'
                    why=f'Подставляем ${var}={argument}$ в данную функцию: ${name}({argument})={L(e.subs(v,R(argument),simultaneous=True))}={L(answer)}$. Сначала вычисляем степени, затем произведения и сумму.'
                    adapted=(stem,answer,why,'Advanced Math','Nonlinear functions',2,'function-value',{'kind':'evaluate','expression':str(e),'variable':var,'input':argument})
                if adapted[0] in seen:continue
                q,rec=imp.question(f'scale-deepmind-{module}-{count+1:03d}',adapted,'deepmind-math','mathematics_dataset/modules/'+('polynomials.py' if module=='function-value' else 'algebra.py')+'; seed 36520261103; sample '+str(attempts),'reinforcement','scale-deepmind:'+module)
                q['attribution'].update(changes='Сгенерировано локально открытым Mathematics Dataset (DeepMind), адаптировано 365step: формат SAT и русское решение. Это вариант для закрепления, не официальный SAT. Apache-2.0; уведомления сохранены.',license='Apache-2.0',licenseUrl='https://www.apache.org/licenses/LICENSE-2.0')
                q['difficulty']=min(q['difficulty'],2);rec.update(upstreamQuestion=text,upstreamAnswer=str(original.answer))
                seen.add(adapted[0]);questions.append(q);records.append(rec);count+=1
            except (ValueError,TypeError,S.PolynomialError):continue
    Path('shared/satScalePractice.json').write_text(json.dumps(questions,ensure_ascii=False,indent=2)+'\n')
    Path('scripts/sat-scale-reference/sat-scale-practice-reference.json').write_text(json.dumps(records,indent=2)+'\n')
    print(json.dumps({'practice':len(questions),'hard':sum(q['difficulty']==3 for q in questions),'families':len(set(q['familyId'] for q in questions))}))

if __name__=='__main__':main()
