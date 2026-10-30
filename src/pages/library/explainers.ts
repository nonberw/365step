// Interactive explainers in the spirit of iamtechartist.com/every-joule:
// a live diagram, then predict → test → lift the flap → completion stamp.
// Each one is a self-contained HTML page rendered in a sandboxed iframe,
// the same way AI-generated explainers are shown.

interface Explainer {
  title: string;
  question: string;
  options: string[];
  correct: number;
  /** Controls markup shown under the scene after the test */
  controls: string;
  /** JS: defines draw(t) for the scene, test() animation (returns a Promise) and update() for free play */
  script: string;
  reveal: string;
}

export const EXPLAINER_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:";

/** Shared frame: postMessage({type:"stamp"}) tells the reader the student finished. */
export function explainerDoc(e: Explainer) {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${EXPLAINER_CSP}">
<style>
:root{--red:#b5121b;--ink:#1d1919;--paper:#fbf8f4;--muted:#6f6866;--line:#e6dfd8;--ok:#1f8a4c}
*{box-sizing:border-box}body{margin:0;font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);background:var(--paper)}
.wrap{max-width:760px;margin:0 auto;padding:18px 16px 28px}
h1{font-size:20px;margin:0 0 4px}.eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--red);font-weight:700}
.scene{position:relative;background:#fff;border:1px solid var(--line);border-radius:18px;overflow:hidden;margin:12px 0}
canvas{display:block;width:100%;height:280px}
.step{background:#fff;border:1px solid var(--line);border-radius:18px;padding:14px;margin-top:12px}
.step b.n{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:var(--ink);color:#fff;font-size:12px;margin-right:6px}
.opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:10px}
button{font:inherit;cursor:pointer;border-radius:999px;border:1.5px solid var(--line);background:#fff;padding:9px 14px;font-weight:600}
button:disabled{opacity:.5;cursor:default}
.opt.sel{border-color:var(--red);background:#fdeceb}.opt.right{border-color:var(--ok);background:#e5f5ec}.opt.wrong{border-color:var(--red);background:#fdeceb;text-decoration:line-through}
.primary{background:var(--red);border-color:var(--red);color:#fff}.dark{background:var(--ink);border-color:var(--ink);color:#fff}
.flap{position:relative;margin-top:12px;border-radius:18px;overflow:hidden}
.flap .cover{position:absolute;inset:0;background:repeating-linear-gradient(135deg,var(--ink) 0 12px,#2b2626 12px 24px);color:#fff;display:grid;place-items:center;font-weight:700;cursor:pointer;transition:transform .7s cubic-bezier(.2,.8,.2,1);transform-origin:top}
.flap.open .cover{transform:perspective(800px) rotateX(-100deg)}
.flap .body{background:#fff;border:1px solid var(--line);border-radius:18px;padding:16px;min-height:90px}
.controls{display:none;gap:14px;flex-wrap:wrap;margin-top:10px}.controls.on{display:flex}
label{display:flex;flex-direction:column;font-size:13px;color:var(--muted);min-width:150px;flex:1}
input[type=range]{accent-color:var(--red)}
.readout{font-variant-numeric:tabular-nums;font-weight:700;color:var(--ink)}
.stamp{display:none;margin:18px auto 0;width:150px;height:150px;border:5px double var(--red);border-radius:50%;color:var(--red);font-weight:800;text-align:center;place-items:center;transform:rotate(-12deg) scale(2);opacity:0;transition:all .45s cubic-bezier(.2,1.4,.4,1)}
.stamp.on{display:grid}.stamp.show{transform:rotate(-12deg) scale(1);opacity:1}
.verdict{margin-top:8px;font-weight:600}
</style></head><body><div class="wrap">
<div class="eyebrow">Интерактив · каждый джоуль на счету</div><h1>${e.title}</h1>
<div class="scene"><canvas id="c"></canvas></div>
<div class="step"><b class="n">1</b><b>Предскажи.</b> ${e.question}
<div class="opts">${e.options.map((o, i) => `<button class="opt" data-i="${i}">${o}</button>`).join("")}</div></div>
<div class="step"><b class="n">2</b><b>Проверь опытом.</b> <button id="test" class="primary" disabled>Запустить опыт</button>
<div id="verdict" class="verdict"></div><div id="controls" class="controls">${e.controls}</div></div>
<div class="step"><b class="n">3</b><b>Подними клапан</b> — там объяснение.
<div class="flap" id="flap"><div class="body">${e.reveal}</div><div class="cover" id="cover">Нажми, чтобы открыть</div></div></div>
<div style="text-align:center;margin-top:14px"><button id="done" class="dark" disabled>Я понял(а) ✓</button></div>
<div class="stamp" id="stamp">ПОНЯТО<br>${new Date().toLocaleDateString("ru-RU")}</div>
</div><script>
const CORRECT=${e.correct};let pick=-1,tested=false;
const cv=document.getElementById('c'),ctx=cv.getContext('2d');
function fit(){const r=cv.getBoundingClientRect();cv.width=r.width*devicePixelRatio;cv.height=r.height*devicePixelRatio;ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0)}
const W=()=>cv.getBoundingClientRect().width,H=()=>cv.getBoundingClientRect().height;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function anim(ms,fn){return new Promise(res=>{const t0=performance.now();function f(t){const k=Math.min(1,(t-t0)/ms);fn(k);k<1?requestAnimationFrame(f):res()}requestAnimationFrame(f)})}
function bar(x,y,w,h,v,max,color,label){ctx.fillStyle='#eee';ctx.fillRect(x,y,w,h);const hh=h*Math.max(0,Math.min(1,v/max));ctx.fillStyle=color;ctx.fillRect(x,y+h-hh,w,hh);ctx.fillStyle='#1d1919';ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillText(label,x+w/2,y+h+14)}
${e.script}
document.querySelectorAll('.opt').forEach(b=>b.onclick=()=>{if(tested)return;pick=+b.dataset.i;document.querySelectorAll('.opt').forEach(x=>x.classList.toggle('sel',x===b));document.getElementById('test').disabled=false});
document.getElementById('test').onclick=async()=>{const btn=document.getElementById('test');btn.disabled=true;await test();tested=true;
document.querySelectorAll('.opt').forEach(x=>{const i=+x.dataset.i;if(i===CORRECT)x.classList.add('right');else if(i===pick)x.classList.add('wrong');x.classList.remove('sel')});
document.getElementById('verdict').textContent=pick===CORRECT?'Верно! Предсказание совпало с опытом.':'Опыт показал другое — интересно, почему? Подними клапан.';
document.getElementById('controls').classList.add('on');btn.textContent='Повторить опыт';btn.disabled=false;document.getElementById('done').disabled=false;update()};
document.getElementById('cover').onclick=()=>document.getElementById('flap').classList.add('open');
document.getElementById('done').onclick=()=>{document.getElementById('flap').classList.add('open');const s=document.getElementById('stamp');s.classList.add('on');requestAnimationFrame(()=>requestAnimationFrame(()=>s.classList.add('show')));parent.postMessage({type:'stamp'},'*')};
document.querySelectorAll('#controls input').forEach(i=>i.oninput=update);
addEventListener('resize',()=>{fit();draw(0)});fit();draw(0);
const wrap=document.querySelector('.wrap');new ResizeObserver(()=>parent.postMessage({type:'height',h:wrap.offsetHeight+4},'*')).observe(wrap);
</script></body></html>`;
}

export const EXPLAINERS: Record<string, Explainer> = {
  "drop-ball": {
    title: "Мяч падает с высоты 5 м",
    question: "Мяч массой 1 кг падает с высоты 5 м без сопротивления воздуха. С какой скоростью он ударится о землю?",
    options: ["≈ 5 м/с", "≈ 10 м/с", "≈ 25 м/с", "Зависит от массы"],
    correct: 1,
    controls: `<label>Высота, м <input id="h" type="range" min="1" max="20" step="0.5" value="5"><span class="readout" id="hv"></span></label>
<label>Масса, кг <input id="m" type="range" min="0.5" max="5" step="0.5" value="1"><span class="readout" id="mv"></span></label>`,
    script: `const g=9.8;let H0=5,M=1,y=0;
function draw(k){fit();const w=W(),h=H();ctx.clearRect(0,0,w,h);const top=20,ground=h-30,px=(ground-top)/20;
ctx.fillStyle='#e6dfd8';ctx.fillRect(0,ground,w,30);ctx.strokeStyle='#ccc';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(60,ground-H0*px);ctx.lineTo(w*0.55,ground-H0*px);ctx.stroke();ctx.setLineDash([]);
ctx.fillStyle='#6f6866';ctx.font='12px system-ui';ctx.textAlign='left';ctx.fillText('h = '+H0+' м',8,ground-H0*px+4);
const cur=H0*(1-k*k);const by=ground-cur*px-12;ctx.fillStyle='#b5121b';ctx.beginPath();ctx.arc(w*0.3,by,10+M*2,0,7);ctx.fill();
const Ep=M*g*cur,Ek=M*g*(H0-cur),tot=M*g*H0,max=M*g*20;const v=Math.sqrt(2*g*(H0-cur));
bar(w*0.68,top,34,ground-top-20,Ep,max,'#1d1919','Eп');bar(w*0.68+50,top,34,ground-top-20,Ek,max,'#b5121b','Eк');bar(w*0.68+100,top,34,ground-top-20,tot,max,'#1f8a4c','Сумма');
ctx.fillStyle='#1d1919';ctx.textAlign='left';ctx.font='bold 14px system-ui';ctx.fillText('v = '+v.toFixed(1)+' м/с',w*0.3+24,by+5);}
async function test(){H0=+(document.getElementById('h')?.value||5);M=+(document.getElementById('m')?.value||1);await anim(Math.sqrt(2*H0/9.8)*700,draw);}
function update(){H0=+document.getElementById('h').value;M=+document.getElementById('m').value;document.getElementById('hv').textContent=H0+' м → v = '+Math.sqrt(2*g*H0).toFixed(1)+' м/с';document.getElementById('mv').textContent=M+' кг → Eп = '+(M*g*H0).toFixed(0)+' Дж';draw(1)}`,
    reveal: `<p><b>Потенциальная энергия наверху</b> $mgh$ целиком переходит в <b>кинетическую</b> $\\frac{mv^2}{2}$ у земли.</p>
<p>$mgh = \\frac{mv^2}{2} \\Rightarrow v = \\sqrt{2gh} = \\sqrt{2 \\cdot 9{,}8 \\cdot 5} \\approx 9{,}9$ м/с.</p>
<p>Масса <b>сократилась</b> — поэтому скорость от неё не зависит. Подвигай ползунок массы: энергия растёт, а скорость нет. Зелёный столбик «Сумма» всё время одинаковый — это и есть закон сохранения энергии.</p>`,
  },
  "push-box": {
    title: "Толкаем тяжёлый ящик",
    question: "Ты толкаешь ящик с силой 20 Н, но он не сдвигается с места. Какую работу ты совершил?",
    options: ["0 Дж", "20 Дж", "200 Дж", "Зависит от времени"],
    correct: 0,
    controls: `<label>Сила, Н <input id="f" type="range" min="0" max="60" step="1" value="20"><span class="readout" id="fv"></span></label>
<label>Путь, м <input id="s" type="range" min="0" max="10" step="0.5" value="4"><span class="readout" id="sv"></span></label>`,
    script: `const FR=25;let F=20,S=4,x=0;
function draw(k){fit();const w=W(),h=H();ctx.clearRect(0,0,w,h);const ground=h-50;ctx.fillStyle='#e6dfd8';ctx.fillRect(0,ground,w,50);
const moves=F>FR;const dist=moves?S*k:0;const px=(w-200)/10;const bx=80+dist*px;
ctx.fillStyle='#8a5a3c';ctx.fillRect(bx,ground-60,70,60);ctx.strokeStyle='#5c3a26';ctx.strokeRect(bx,ground-60,70,60);
ctx.fillStyle='#b5121b';const len=Math.max(8,F*2);ctx.fillRect(bx-len-6,ground-34,len,8);ctx.beginPath();ctx.moveTo(bx-6,ground-40);ctx.lineTo(bx+4,ground-30);ctx.lineTo(bx-6,ground-20);ctx.fill();
ctx.fillStyle='#1d1919';ctx.font='bold 14px system-ui';ctx.textAlign='left';ctx.fillText('F = '+F+' Н',bx-len-6,ground-44);
ctx.fillText('Трение покоя до '+FR+' Н',w-210,24);ctx.font='bold 22px system-ui';ctx.fillText('A = '+(F*dist).toFixed(0)+' Дж',w-210,58);
ctx.font='12px system-ui';ctx.fillStyle='#6f6866';ctx.fillText(moves?'ящик едет: путь '+dist.toFixed(1)+' м':'ящик стоит: путь 0 м',w-210,80)}
async function test(){F=20;S=4;await anim(1600,k=>{F=Math.round(20*Math.min(1,k*2));draw(k)})}
function update(){F=+document.getElementById('f').value;S=+document.getElementById('s').value;document.getElementById('fv').textContent=F+' Н'+(F>FR?' — сдвинули!':' — не хватает');document.getElementById('sv').textContent=S+' м';anim(900,draw)}`,
    reveal: `<p>Работа $A = F \\cdot s$ — это сила, умноженная на <b>путь</b>. Если ящик не сдвинулся, $s = 0$ и работа равна нулю, сколько бы ты ни старался.</p>
<p>Мышцы при этом тратят энергию — она уходит в тепло внутри тела, а не в движение ящика. Попробуй силу больше 25 Н: ящик поедет, и счётчик джоулей начнёт расти.</p>`,
  },
  "lamp-efficiency": {
    title: "Куда уходит каждый джоуль лампы",
    question: "Лампа накаливания получила 100 Дж электрической энергии. Сколько из них станет светом?",
    options: ["≈ 5 Дж", "≈ 25 Дж", "≈ 50 Дж", "≈ 90 Дж"],
    correct: 0,
    controls: `<label>Тип лампы <select id="lamp" style="font:inherit;padding:6px;border-radius:10px"><option value="5">Накаливания (5%)</option><option value="35">Светодиодная (35%)</option></select><span class="readout" id="lv"></span></label>`,
    script: `let EFF=5,parts=[];
function spawn(){parts=Array.from({length:100},(_,i)=>({i,light:i<EFF,t:-i*0.012,a:(Math.random()-.5)*1.6}))}
function draw(k){fit();const w=W(),h=H();ctx.clearRect(0,0,w,h);const cx=w*0.3,cy=h*0.5;
ctx.fillStyle='#ffe9a8';ctx.beginPath();ctx.arc(cx,cy,30,0,7);ctx.fill();ctx.strokeStyle='#1d1919';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#6f6866';ctx.fillRect(cx-12,cy+28,24,22);
ctx.fillStyle='#1d1919';ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillText('100 Дж',cx-80,cy+4);ctx.fillRect(cx-60,cy-1,26,2);
let L=0,Q=0;for(const p of parts){const t=Math.max(0,Math.min(1,p.t+k*2.2));if(t<=0)continue;if(t>=1){p.light?L++:Q++;continue}
const r=34+t*(w*0.42);const ang=p.light?-0.5+p.a*0.25:0.6+p.a*0.6;ctx.fillStyle=p.light?'#f2b705':'#b5121b';ctx.beginPath();ctx.arc(cx+Math.cos(ang)*r,cy+Math.sin(ang)*r*0.8,3,0,7);ctx.fill()}
ctx.textAlign='left';ctx.font='bold 16px system-ui';ctx.fillStyle='#c48f00';ctx.fillText('Свет: '+L+' Дж',w*0.72,h*0.25);ctx.fillStyle='#b5121b';ctx.fillText('Тепло: '+Q+' Дж',w*0.72,h*0.75)}
async function test(){spawn();await anim(2600,draw)}
function update(){EFF=+document.getElementById('lamp').value;document.getElementById('lv').textContent='КПД '+EFF+'%';spawn();anim(2600,draw)}
spawn();`,
    reveal: `<p>Лампа накаливания светит, потому что нить раскаляется до 2500 °C. Почти вся энергия уходит в <b>тепло</b> (и невидимое инфракрасное излучение), светом становится лишь около 5%.</p>
<p>$\\eta = \\frac{5\\ \\text{Дж}}{100\\ \\text{Дж}} \\cdot 100\\% = 5\\%$. Переключи на светодиодную лампу: та же яркость при меньших затратах, потому что меньше джоулей теряется в тепло.</p>`,
  },
  parabola: {
    title: "Корни уравнения на графике",
    question: "Сколько действительных корней у уравнения $x^2 - 4x + 4 = 0$?",
    options: ["Ни одного", "Один", "Два", "Бесконечно много"],
    correct: 1,
    controls: `<label>a <input id="a" type="range" min="-3" max="3" step="0.5" value="1"><span class="readout" id="av"></span></label>
<label>b <input id="b" type="range" min="-8" max="8" step="1" value="-4"><span class="readout" id="bv"></span></label>
<label>c <input id="cc" type="range" min="-8" max="8" step="1" value="4"><span class="readout" id="cv"></span></label>`,
    script: `let A=1,B=-4,C=4;
function draw(k){fit();const w=W(),h=H();ctx.clearRect(0,0,w,h);const sx=w/16,sy=h/16,ox=w/2,oy=h/2;
ctx.strokeStyle='#e6dfd8';ctx.lineWidth=1;for(let i=-8;i<=8;i++){ctx.beginPath();ctx.moveTo(ox+i*sx,0);ctx.lineTo(ox+i*sx,h);ctx.stroke();ctx.beginPath();ctx.moveTo(0,oy+i*sy);ctx.lineTo(w,oy+i*sy);ctx.stroke()}
ctx.strokeStyle='#1d1919';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(0,oy);ctx.lineTo(w,oy);ctx.moveTo(ox,0);ctx.lineTo(ox,h);ctx.stroke();
ctx.strokeStyle='#b5121b';ctx.lineWidth=3;ctx.beginPath();const end=-8+16*k;let first=true;for(let x=-8;x<=end;x+=0.05){const y=A*x*x+B*x+C;const X=ox+x*sx,Y=oy-y*sy;first?ctx.moveTo(X,Y):ctx.lineTo(X,Y);first=false}ctx.stroke();
const D=B*B-4*A*C;ctx.fillStyle='#1d1919';ctx.font='bold 14px system-ui';ctx.textAlign='left';ctx.fillText('D = '+D,10,22);
if(k>=1&&A!==0){const roots=D>0?[(-B-Math.sqrt(D))/(2*A),(-B+Math.sqrt(D))/(2*A)]:D===0?[-B/(2*A)]:[];ctx.fillStyle='#1f8a4c';for(const r of roots){ctx.beginPath();ctx.arc(ox+r*sx,oy,7,0,7);ctx.fill()}
ctx.fillStyle='#1d1919';ctx.fillText(roots.length?'корни: '+roots.map(r=>+r.toFixed(2)).join(' и '):'корней нет',10,42)}}
async function test(){A=1;B=-4;C=4;await anim(1800,draw)}
function update(){A=+document.getElementById('a').value;B=+document.getElementById('b').value;C=+document.getElementById('cc').value;['a','b','cc'].forEach(i=>document.getElementById(i==='cc'?'cv':i+'v').textContent=document.getElementById(i).value);draw(1)}`,
    reveal: `<p>Корни — это точки, где парабола касается или пересекает ось $x$. У $x^2 - 4x + 4 = (x-2)^2$ вершина лежит прямо на оси: парабола <b>касается</b> её в точке $x = 2$.</p>
<p>Дискриминант $D = 16 - 16 = 0$ — ровно один корень. Двигай $c$: при $D > 0$ точек две, при $D < 0$ парабола «отрывается» от оси и корней нет.</p>`,
  },
};

/** KaTeX is not available inside the sandbox, so $…$ is shown as plain text without the dollar signs. */
export function handcrafted(id: string) {
  const e = EXPLAINERS[id];
  if (!e) return null;
  const plain = (s: string) => s.replace(/\$([^$]+)\$/g, (_, tex: string) => texToText(tex));
  return explainerDoc({ ...e, question: plain(e.question), reveal: plain(e.reveal) });
}

function texToText(tex: string) {
  return tex
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "($1)/($2)")
    .replace(/\\sqrt\{([^}]*)\}/g, "√($1)")
    .replace(/\\(text|mathrm)\{([^}]*)\}/g, "$2")
    .replace(/\\cdot/g, "·")
    .replace(/\\Rightarrow/g, "⇒")
    .replace(/\\eta/g, "η")
    .replace(/\\pm/g, "±")
    .replace(/\\approx/g, "≈")
    .replace(/\\%/g, "%")
    .replace(/\{,\}/g, ",")
    .replace(/\\ /g, " ")
    .replace(/\^2/g, "²")
    .replace(/[{}]/g, "");
}
