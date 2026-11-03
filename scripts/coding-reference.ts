// Independent verification implementations; not used to generate the question bank or expected answers.
export const REF: Record<string, (...a: any[]) => unknown> = {
  "two-sum": (nums: number[], t: number) => {
    const m = new Map<number, number>();
    for (let i = 0; i < nums.length; i++) {
      if (m.has(t - nums[i]!)) return [m.get(t - nums[i]!), i];
      m.set(nums[i]!, i);
    }
  },
  palindrome: (s: string) => {
    const c = s.toLowerCase().replace(/[^a-z0-9]/g, "");
    return c === [...c].reverse().join("");
  },
  fizzbuzz: (n: number) => Array.from({ length: n }, (_, i) => ((i + 1) % 15 === 0 ? "FizzBuzz" : (i + 1) % 3 === 0 ? "Fizz" : (i + 1) % 5 === 0 ? "Buzz" : String(i + 1))),
  vowels: (t: string) => (t.match(/[aeiou]/gi) ?? []).length,
  "missing-number": (nums: number[]) => (nums.length * (nums.length + 1)) / 2 - nums.reduce((a, b) => a + b, 0),
  "average-grade": (g: number[]) => (g.length ? Math.round((g.reduce((a, b) => a + b, 0) / g.length) * 100) / 100 : 0),
  "valid-brackets": (s: string) => {
    const st: string[] = [];
    const pair: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
    for (const ch of s) {
      if ("([{".includes(ch)) st.push(ch);
      else if (st.pop() !== pair[ch]) return false;
    }
    return st.length === 0;
  },
  anagram: (a: string, b: string) => [...a].sort().join("") === [...b].sort().join(""),
  "merge-sorted": (a: number[], b: number[]) => [...a, ...b].sort((x, y) => x - y),
  "max-subarray": (n: number[]) => {
    let best = n[0]!;
    let cur = 0;
    for (const x of n) {
      cur = Math.max(x, cur + x);
      best = Math.max(best, cur);
    }
    return best;
  },
  "group-anagrams": (w: string[]) => {
    const m = new Map<string, string[]>();
    for (const x of w) {
      const k = [...x].sort().join("");
      m.set(k, [...(m.get(k) ?? []), x]);
    }
    return [...m.values()];
  },
  "longest-unique": (s: string) => {
    let best = 0;
    let left = 0;
    const last = new Map<string, number>();
    [...s].forEach((ch, i) => {
      if ((last.get(ch) ?? -1) >= left) left = last.get(ch)! + 1;
      last.set(ch, i);
      best = Math.max(best, i - left + 1);
    });
    return best;
  },
  "product-except-self": (n: number[]) => n.map((_, i) => n.reduce((p, x, j) => (j === i ? p : p * x), 1)),
  "coin-change": (coins: number[], amount: number) => {
    const dp = Array(amount + 1).fill(Infinity);
    dp[0] = 0;
    for (let x = 1; x <= amount; x++) for (const c of coins) if (c <= x) dp[x] = Math.min(dp[x], dp[x - c] + 1);
    return dp[amount] === Infinity ? -1 : dp[amount];
  },
  "search-insert": (n: number[], t: number) => {
    const i = n.findIndex((x) => x >= t);
    return i < 0 ? n.length : i;
  },
  "top-k": (w: string[], k: number) => {
    const c = new Map<string, number>();
    w.forEach((x) => c.set(x, (c.get(x) ?? 0) + 1));
    return [...c].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, k).map((x) => x[0]);
  },
  "rotate-matrix": (m: number[][]) => m[0]!.map((_, i) => m.map((row) => row[i]!).reverse()),
  lis: (n: number[]) => {
    const dp = n.map(() => 1);
    n.forEach((x, i) => {
      for (let j = 0; j < i; j++) if (n[j]! < x) dp[i] = Math.max(dp[i]!, dp[j]! + 1);
    });
    return Math.max(...dp);
  },
  "rain-water": (h: number[]) => h.reduce((s, x, i) => s + Math.max(0, Math.min(Math.max(...h.slice(0, i + 1)), Math.max(...h.slice(i))) - x), 0),
  "edit-distance": (a: string, b: string) => {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++) dp[i]![j] = a[i - 1] === b[j - 1] ? dp[i - 1]![j - 1]! : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
    return dp[a.length]![b.length];
  },
};


// Additional independently written solvers. Expected test values remain separately authored literals.
type Tree = { val: number; left?: Tree | null; right?: Tree | null } | null;
Object.assign(REF, {
  "contains-duplicate": (ids: number[]) => new Set(ids).size !== ids.length,
  majority: (votes: number[]) => [...votes].sort((a,b) => a-b)[Math.floor(votes.length/2)],
  "longest-consecutive": (days: number[]) => {
    const a = [...new Set(days)].sort((a,b) => a-b); let best=0, run=0;
    a.forEach((x,i) => { run=i && x===a[i-1]!+1 ? run+1 : 1; best=Math.max(best,run); }); return best;
  },
  "subarray-sum-k": (a: number[], k: number) => { let s=0, count=0; const freq=new Map([[0,1]]); for(const x of a){s+=x;count+=freq.get(s-k)??0;freq.set(s,(freq.get(s)??0)+1);}return count; },
  "encode-strings": (s: string) => s.replace(/(.)\1*/gs,(part: string) => part[0]!+(part.length>1?part.length:"")),
  "move-zeros": (a: number[]) => [...a.filter(x=>x!==0),...a.filter(x=>x===0)],
  "three-sum": (input: number[]) => {
    const a=[...input].sort((a,b)=>a-b), out:number[][]=[];
    for(let i=0;i<a.length-2;i++){if(i&&a[i]===a[i-1])continue;let l=i+1,r=a.length-1;while(l<r){const s=a[i]!+a[l]!+a[r]!;if(s<0)l++;else if(s>0)r--;else{out.push([a[i]!,a[l]!,a[r]!]);const x=a[l],y=a[r];while(l<r&&a[l]===x)l++;while(l<r&&a[r]===y)r--;}}}return out;
  },
  "container-water": (h: number[]) => {let l=0,r=h.length-1,best=0;while(l<r){best=Math.max(best,(r-l)*Math.min(h[l]!,h[r]!));if(h[l]!<h[r]!)l++;else r--;}return best;},
  "best-time-stock": (p: number[]) => {let low=Infinity,best=0;for(const x of p){best=Math.max(best,x-low);low=Math.min(low,x);}return best;},
  "max-window-sum": (a: number[], k: number) => {let s=a.slice(0,k).reduce((a,b)=>a+b,0),best=s;for(let i=k;i<a.length;i++){s+=a[i]!-a[i-k]!;best=Math.max(best,s);}return best;},
  "char-replacement": (s: string,k: number) => {let l=0,best=0;const counts=new Map<string,number>();for(let r=0;r<s.length;r++){counts.set(s[r]!,1+(counts.get(s[r]!)??0));while(r-l+1-Math.max(...counts.values())>k){const ch=s[l++]!;counts.set(ch,counts.get(ch)!-1);}best=Math.max(best,r-l+1);}return best;},
  "min-window": (s:string,t:string) => {
    const need=new Map<string,number>();for(const ch of t)need.set(ch,(need.get(ch)??0)+1);
    let missing=t.length,l=0,best="";
    for(let r=0;r<s.length;r++){const ch=s[r]!;if(need.has(ch)){if(need.get(ch)!>0)missing--;need.set(ch,need.get(ch)!-1);}while(missing===0){if(!best||r-l+1<best.length)best=s.slice(l,r+1);const old=s[l++]!;if(need.has(old)){need.set(old,need.get(old)!+1);if(need.get(old)!>0)missing++;}}}return best;
  },
  "daily-temps": (a:number[]) => {const out=a.map(()=>0),st:number[]=[];a.forEach((v,i)=>{while(st.length&&a[st.at(-1)!]!<v){const j=st.pop()!;out[j]=i-j;}st.push(i);});return out;},
  "eval-rpn": (tokens:string[]) => {const st:number[]=[];for(const t of tokens){if(!["+","-","*","/"].includes(t)){st.push(Number(t));continue;}const b=st.pop()!,a=st.pop()!;st.push(t==="+"?a+b:t==="-"?a-b:t==="*"?a*b:Math.trunc(a/b));}return st[0];},
  "largest-rectangle": (h:number[]) => {const st:number[]=[],a=[...h,0];let best=0;for(let i=0;i<a.length;i++){while(st.length&&a[st.at(-1)!]!>a[i]!){const height=a[st.pop()!]!;best=Math.max(best,height*(i-(st.at(-1)??-1)-1));}st.push(i);}return best;},
  "first-bad": (builds:boolean[]) => builds.indexOf(false),
  "rotated-search": (a:number[],t:number) => a.indexOf(t),
  "koko-reading": (a:number[],hours:number) => {let l=1,r=Math.max(...a);while(l<r){const m=Math.floor((l+r)/2);if(a.reduce((s,x)=>s+Math.ceil(x/m),0)<=hours)r=m;else l=m+1;}return l;},
  "merge-intervals": (slots:number[][]) => {const out:number[][]=[];for(const [s,e] of [...slots].sort((a,b)=>a[0]!-b[0]!)){if(out.length&&s!<=out.at(-1)![1]!)out.at(-1)![1]=Math.max(e!,out.at(-1)![1]!);else out.push([s!,e!]);}return out;},
  "meeting-rooms": (a:number[][]) => {const events=a.flatMap(([s,e])=>[[s!,1],[e!,-1]]).sort((a,b)=>a[0]!-b[0]!||a[1]!-b[1]!);let rooms=0,best=0;for(const [,delta]of events){rooms+=delta!;best=Math.max(best,rooms);}return best;},
  "tree-depth": (root:Tree) => {let best=0;const st:[Tree,number][]=[[root,1]];while(st.length){const [n,d]=st.pop()!;if(n){best=Math.max(best,d);st.push([n.left??null,d+1],[n.right??null,d+1]);}}return best;},
  "tree-symmetric": (root:Tree) => {if(!root)return true;const st:[Tree,Tree][]=[[root.left??null,root.right??null]];while(st.length){const [a,b]=st.pop()!;if(!a||!b){if(a!==b)return false;}else{if(a.val!==b.val)return false;st.push([a.left??null,b.right??null],[a.right??null,b.left??null]);}}return true;},
  "tree-levels": (root:Tree) => {const out:number[][]=[];let level:NonNullable<Tree>[]=root?[root]:[];while(level.length){out.push(level.map(n=>n.val));level=level.flatMap(n=>[n.left,n.right].filter((n):n is NonNullable<Tree>=>!!n));}return out;},
  "validate-bst": (root:Tree) => {const st:[Tree,number,number][]=[[root,-Infinity,Infinity]];while(st.length){const[n,lo,hi]=st.pop()!;if(n){if(n.val<=lo||n.val>=hi)return false;st.push([n.left??null,lo,n.val],[n.right??null,n.val,hi]);}}return true;},
  "path-sum": (root:Tree,target:number) => {const st:[Tree,number][]=[[root,0]];while(st.length){const[n,s]=st.pop()!;if(n){const sum=s+n.val;if(!n.left&&!n.right&&sum===target)return true;st.push([n.left??null,sum],[n.right??null,sum]);}}return false;},
  islands: (grid:string[][]) => {
    const seen=new Set<string>();let count=0;for(let r=0;r<grid.length;r++)for(let c=0;c<grid[0]!.length;c++)if(grid[r]![c]==="1"&&!seen.has(`${r},${c}`)){count++;const st=[[r,c]];seen.add(`${r},${c}`);while(st.length){const[x,y]=st.pop()!;for(const[nx,ny]of[[x!-1,y!],[x!+1,y!],[x!,y!-1],[x!,y!+1]]){const key=`${nx},${ny}`;if(grid[nx!]?.[ny!]==="1"&&!seen.has(key)){seen.add(key);st.push([nx!,ny!]);}}}}return count;
  },
  "maze-path": (a:number[][]) => {const rows=a.length,cols=a[0]!.length;if(a[0]![0]||a[rows-1]![cols-1])return -1;const queue=[[0,0,0]],seen=new Set(["0,0"]);for(let i=0;i<queue.length;i++){const[x,y,d]=queue[i]!;if(x===rows-1&&y===cols-1)return d;for(const[nx,ny]of[[x!-1,y!],[x!+1,y!],[x!,y!-1],[x!,y!+1]]){const k=`${nx},${ny}`;if(nx!>=0&&nx!<rows&&ny!>=0&&ny!<cols&&a[nx!]![ny!]===0&&!seen.has(k)){seen.add(k);queue.push([nx!,ny!,d!+1]);}}}return -1;},
  "course-order": (n:number,edges:number[][]) => {const next=Array.from({length:n},()=>[] as number[]),degree=Array(n).fill(0);for(const[a,b]of edges){next[b!]!.push(a!);degree[a!]++;}const queue=degree.flatMap((d,i)=>d===0?[i]:[]);for(let i=0;i<queue.length;i++)for(const v of next[queue[i]!]!)if(--degree[v]===0)queue.push(v);return queue.length===n;},
  "friend-circles": (n:number,edges:number[][]) => {const parent=Array.from({length:n},(_,i)=>i);const find=(x:number):number=>{while(parent[x]!==x){parent[x]=parent[parent[x]!]!;x=parent[x]!;}return x;};for(const[a,b]of edges)parent[find(a!)]=find(b!);return new Set(parent.map((_,i)=>find(i))).size;},
  subsets: (a:number[]) => Array.from({length:2**a.length},(_,mask)=>a.filter((_,i)=>mask&(1<<i))),
  permutations: (a:number[]):number[][] => a.length ? a.flatMap((v,i)=>(REF.permutations!(a.filter((_,j)=>i!==j)) as number[][]).map(rest=>[v,...rest])) : [[]],
  "combination-sum": (coins:number[],target:number) => {const a=[...coins].sort((a,b)=>a-b),out:number[][]=[];const visit=(i:number,left:number,items:number[])=>{if(!left){out.push([...items]);return;}for(let j=i;j<a.length&&a[j]!<=left;j++){items.push(a[j]!);visit(j,left-a[j]!,items);items.pop();}};visit(0,target,[]);return out;},
  "n-queens-count": (n:number) => {let count=0;const visit=(row:number,cols:Set<number>,d1:Set<number>,d2:Set<number>)=>{if(row===n){count++;return;}for(let c=0;c<n;c++)if(!cols.has(c)&&!d1.has(row-c)&&!d2.has(row+c)){cols.add(c);d1.add(row-c);d2.add(row+c);visit(row+1,cols,d1,d2);cols.delete(c);d1.delete(row-c);d2.delete(row+c);}};visit(0,new Set(),new Set(),new Set());return count;},
  "climb-stairs": (n:number) => {let a=1,b=1;for(let i=1;i<n;i++)[a,b]=[b,a+b];return b;},
  "house-robber": (a:number[]) => {let skip=0,take=0;for(const x of a)[skip,take]=[Math.max(skip,take),skip+x];return Math.max(skip,take);},
  "unique-paths": (r:number,c:number) => {let v=1n;for(let i=1;i<=Math.min(r-1,c-1);i++)v=v*BigInt(r+c-2-i+1)/BigInt(i);return Number(v);},
  lcs: (a:string,b:string) => {let prev=Array(b.length+1).fill(0);for(const x of a){const next=Array(b.length+1).fill(0);for(let j=1;j<=b.length;j++)next[j]=x===b[j-1]?prev[j-1]+1:Math.max(prev[j],next[j-1]);prev=next;}return prev[b.length];},
  "word-break": (s:string,words:string[]) => {const possible=new Set([0]);for(let i=0;i<s.length;i++)if(possible.has(i))for(const w of words)if(s.startsWith(w,i))possible.add(i+w.length);return possible.has(s.length);},
  knapsack: (w:number[],v:number[],capacity:number) => {let dp=Array(capacity+1).fill(0);w.forEach((weight,i)=>{const next=[...dp];for(let c=weight;c<=capacity;c++)next[c]=Math.max(dp[c],dp[c-weight]+v[i]!);dp=next;});return dp[capacity];},
  "jump-game": (j:number[]) => {let reach=0;for(let i=0;i<j.length;i++){if(i>reach)return false;reach=Math.max(reach,i+j[i]!);}return true;},
  "gas-station": (gas:number[],cost:number[]) => {let total=0,tank=0,start=0;for(let i=0;i<gas.length;i++){const delta=gas[i]!-cost[i]!;tank+=delta;total+=delta;if(tank<0){start=i+1;tank=0;}}return total<0?-1:start;},
  "single-number": (a:number[]) => {const odd=new Set<number>();for(const x of a){if(odd.has(x))odd.delete(x);else odd.add(x);}return [...odd][0];},
  "count-primes": (n:number) => {const composite=new Uint8Array(n);let count=0;for(let i=2;i<n;i++)if(!composite[i]){count++;for(let j=i*i;j<n;j+=i)composite[j]=1;}return count;},
  "fast-power": (a:number,n:number,m:number) => {let result=1n,base=BigInt(a)%BigInt(m),power=BigInt(n);while(power){if(power&1n)result=result*base%BigInt(m);base=base*base%BigInt(m);power>>=1n;}return Number(result%BigInt(m));},
});
