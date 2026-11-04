import type { PracticeFeedback, PracticeItem } from '../../shared/learningContent';
export function numericValue(value:unknown):number|null {
 if(typeof value!=='string'&&typeof value!=='number')return null;
 const text=String(value).trim().replace(',','.');
 if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:\/[+-]?(?:\d+(?:\.\d*)?|\.\d+))?$/.test(text))return null;
 const p=text.split('/').map(Number);const n=p.length===2?p[0]!/p[1]!:p[0]!;return Number.isFinite(n)?n:null;
}
export function assessPractice(item:PracticeItem,value:unknown):PracticeFeedback {
 if(item.kind==='rubric')return {status:'submitted',correct:null,explanation:'Ответ сохранён для проверки по критериям. Это не автоматическое подтверждение правильности или экспертная оценка.',criteria:item.criteria};
 const a=numericValue(value),b=numericValue(item.answer);
 const correct=item.kind==='numeric'?a!==null&&b!==null&&Math.abs(a-b)<=(Number.isInteger(b)?1e-8:Math.max(1e-6,Math.abs(b)*0.00001)):String(value).trim()===item.answer;
 return {status:correct?'correct':'incorrect',correct,answer:item.answer,explanation:item.explanation??''};
}
