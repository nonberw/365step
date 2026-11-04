export type PracticeKind='choice'|'numeric'|'rubric';
export interface PracticeItem {id:string;kind:PracticeKind;prompt:string;choices?:string[];answer?:string;explanation?:string;criteria?:string[];minWords?:number;level:'Старт'|'Практика'|'Вызов'}
export type PublicPracticeItem=Omit<PracticeItem,'answer'|'explanation'>;
export interface LearningLesson {id:string;moduleId:string;version:number;title:string;minutes:number;objective:string;blocks:{title:string;text:string}[];items:PracticeItem[]}
export interface LearningProject {id:string;moduleId:string;title:string;brief:string;deliverables:string[];rubric:{label:string;description:string}[]}
export interface LearningModuleContent {reviewStatus?:'authored'|'reviewed';id:string;directionId:string;title:string;summary:string;outcomes:string[];prerequisites:string[];lessons:LearningLesson[];project:LearningProject;sourceNote:string}
export interface PracticeFeedback {status:'correct'|'incorrect'|'submitted';correct:boolean|null;answer?:string;explanation:string;criteria?:string[]}
export interface ModuleCase {id:string;scenario:string;theory:string;example:string;challenge:string;deliverable:string;data:string;calculation:{prompt:string;answer:string;explanation:string}}
