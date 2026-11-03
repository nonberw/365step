export interface EntSourceQuestion {
 id:string;conditionId:string;subject:string;topic:string;lang:'ru'|'kk'|'en';kind:'choice'|'short';
 stem:string;passage?:string;options?:string[];answer?:number;accepted?:string[];
 responseRule?:'number-set'|'text'|'numeric';sourceId:string;sourceRef:string;
 explanation:string;evidence?:string;evidenceUrl?:string;
 review:'published-key'|'source-span-checked'|'independent-math-verified';level?:'B'|'C';
}
export type EntSourcePublic=Omit<EntSourceQuestion,'answer'|'accepted'|'explanation'|'evidence'|'evidenceUrl'>;
export interface EntSourceAttribution {id:string;title:string;authors:string;url:string;license:string;licenseUrl:string;notice:string}
export interface EntSourceMeta {
 total:number;conditions:number;subjects:Record<string,number>;languages:Record<string,number>;
 sourceCounts:Record<string,number>;formats:Record<string,number>;sources:EntSourceAttribution[];
}
