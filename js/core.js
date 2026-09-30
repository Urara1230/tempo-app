// Data & calculation: dates, workdays, status, delay level, derive; app state; save / persistence / undo.
const DAY=864e5;
const D=s=>Math.round(Date.UTC(+s.slice(0,4),+s.slice(5,7)-1,+s.slice(8,10))/DAY);
const S=n=>new Date(n*DAY).toISOString().slice(0,10);
const dt=n=>new Date(n*DAY);
const dow=n=>dt(n).getUTCDay();
const isHol=n=>HOL.has(S(n));
// company holidays of the open project: p.holidays=[{date,color}]. Edits must assign a new array — the lookup is cached on it.
// ponytail: always the open project's list; a restore that saves several projects shifts their links by it too
const isHex=c=>/^#[0-9a-f]{6}$/i.test(c); // any user color that goes into style="" must pass this
const HOLC="#e8590c",PARC=["#6685ff","#20c997","#fab005"]; // default colors: company holiday; parent task by level 0 / 1 / 2 (level 3 has no children)
const parColor=r=>isHex(r.color)?r.color:PARC[Math.min(r.level||0,2)]; // every parent is colored; t.color only when changed from the default
let coArr,coMap=new Map();
const coHol=n=>{const h=projects[curId]?.holidays;
  if(h!==coArr){coArr=h;coMap=new Map((h||[]).map(x=>[x.date,{...x,color:isHex(x.color)?x.color:HOLC}]))}
  return coMap.get(S(n))};
const isOff=n=>{const w=dow(n);return w===0||w===6||isHol(n)||!!coHol(n)};
function biz(a,b){let c=0;for(let n=a;n<=b;n++)if(!isOff(n))c++;return c}
const _t=new Date();
const TODAY=D(_t.getFullYear()+"-"+String(_t.getMonth()+1).padStart(2,"0")+"-"+String(_t.getDate()).padStart(2,"0"));
const WD="日月火水木金土";
const md=n=>{const d=dt(n);return (d.getUTCMonth()+1)+"/"+d.getUTCDate()};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid=()=>Math.random().toString(36).slice(2,10);
const ST={todo:"未着手",ok:"順調",late:"進捗遅れ",over:"期限切れ",done:"完了"};
const $=id=>document.getElementById(id);
const ls={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};

let projects={}, curId=ls.get("mg.cur"), store=null, readOnly=false; // store: the backend from storage.js, null while loading
let view={scale:ls.get("mg.scale")||"day",who:"",st:""};
let visOrder=[];
let collapsed=new Set(), editingId=null, dragging=false, scrolledFor=null, range=null;
const pendingIds=new Set(), timers={};
let sel=new Set(), lastSel=null, clip=null, delArmed=false;
let chain=Promise.resolve();

// share of the task's own workdays already past (to yesterday), 0–1
function elapsed(t){const s=D(t.start),e=D(t.end);return TODAY<s?0:Math.min(1,biz(s,TODAY-1)/Math.max(1,biz(s,e)))}
// Brabio GetDelayLevel: 0 = on schedule, 1–4 = how far progress lags time (in workdays)
function delay(t){const s=D(t.start),tot=Math.max(1,biz(s,D(t.end))),lag=biz(s,TODAY)-(t.progress||0)/100*tot;
  return lag<=0?0:lag<1?1:Math.min(Math.ceil((lag-1)/tot*4)+1,4)}
function status(t){
  if((t.progress||0)>=100)return"done";
  const s=D(t.start),e=D(t.end);
  if(TODAY<s)return"todo";
  if(TODAY>e)return"over";
  if((t.progress||0)/100+0.1<elapsed(t))return"late";
  return"ok";
}
function derive(p){
  const ts=p.tasks||[];
  const rows=ts.map((t,i)=>({...t,idx:i,level:t.level||0,assignees:t.assignees||[],progress:t.progress||0}));
  for(let i=rows.length-1;i>=0;i--){
    const r=rows[i],kids=[];
    for(let j=i+1;j<rows.length&&rows[j].level>r.level;j++)if(rows[j].level===r.level+1)kids.push(rows[j]);
    if(kids.length){
      r.parent=true;
      r.start=S(Math.min(...kids.map(k=>D(k.start))));r.end=S(Math.max(...kids.map(k=>D(k.end))));
      let w=0,sum=0;kids.forEach(k=>{const b=Math.max(1,biz(D(k.start),D(k.end)));w+=b;sum+=b*k.progress});
      r.progress=Math.round(sum/w);
      r.assignees=[...new Set(kids.flatMap(k=>k.assignees))];
    }
    r.st=status(r);
  }
  return rows;
}
// whole project: leaf tasks, workday-weighted progress, first start / last end (day numbers)
function overall(p){
  const rows=derive(p).filter(r=>!r.parent);let w=0,sum=0,mn=Infinity,mx=-Infinity;
  rows.forEach(r=>{const s=D(r.start),e=D(r.end),b=Math.max(1,biz(s,e));w+=b;sum+=b*r.progress;mn=Math.min(mn,s);mx=Math.max(mx,e)});
  return{rows,pct:w?Math.round(sum/w):0,mn,mx};
}
// label right of the bar: "2/28 (土)　0%　18営業日　担当"
function lab(r,s,e){const who=esc((r.assignees||[]).join("、")),d=`${md(e)} (${WD[dow(e)]})`,pr=r.progress||0;
  if(r.milestone&&!r.parent)return`${d}　${esc(r.name)}${who?"　"+who:""}`;
  const pg=r.parent||readOnly?`${pr}%`:`<button type="button" class="pg" data-pg="${r.id}" title="ダブルクリックで進捗を変更">${pr}%</button>`;
  return`${d}　${pg}　${biz(s,e)}営業日${who?"　"+who:""}`}
function members(p){return [...new Set([...(p.members||[]),...(p.tasks||[]).flatMap(t=>t.assignees||[])])]}
const roster=p=>p.members||members(p); // until a roster is saved, start from names used in tasks
const names=v=>v.split(/[、,，\n]/).map(s=>s.trim()).filter(Boolean);

/* ---------- persistence ---------- */
function body(p){return{name:p.name,tasks:p.tasks,milestones:p.milestones||[],holidays:p.holidays||[],...(p.members?{members:p.members}:{}),updatedAt:p.updatedAt}}
function applyLinks(p){
  let moved=0;const byId={};p.tasks.forEach(t=>byId[t.id]=t);
  for(let pass=0;pass<p.tasks.length+1;pass++){let ch=false;
    p.tasks.forEach(t=>(t.deps||[]).forEach(pid=>{const a=byId[pid];if(!a)return;const ae=D(a.end);if(D(t.start)>ae)return;
      let ns=ae+1;while(isOff(ns))ns++;const dur=Math.max(1,biz(D(t.start),D(t.end)));let ne=ns,c=1;while(c<dur){ne++;if(!isOff(ne))c++}t.start=S(ns);t.end=S(ne);ch=true;moved++;}));
    if(!ch)break}
  p.tasks.forEach(t=>{if(t.deps)t.deps=t.deps.filter(id=>byId[id]&&id!==t.id)});
  return moved;
}
/* undo: each project keeps snapshots of its state before each save */
const hist={};let restoring=false;
const snap=p=>JSON.stringify({name:p.name,tasks:p.tasks,milestones:p.milestones||[],holidays:p.holidays||[],members:p.members||null});
function H(id){return hist[id]||(hist[id]={u:[],r:[],last:null})}
function undo(redo){
  const p=projects[curId];if(!p||readOnly)return;const h=H(p.id),from=redo?h.r:h.u,to=redo?h.u:h.r;
  if(!from.length){toast(redo?"やり直す操作がありません":"元に戻す操作がありません");return}
  to.push(h.last);const s=JSON.parse(from.pop());p.name=s.name;p.tasks=s.tasks;p.milestones=s.milestones;p.holidays=s.holidays;p.members=s.members||undefined;
  closeDrawer();$("asForm").hidden=true;delArmed=false;restoring=true;save(p);restoring=false;toast(redo?"やり直しました":"元に戻しました");
}
function save(p){p.updatedAt=Date.now();const m=applyLinks(p);
  const h=H(p.id),cur=snap(p);if(!restoring&&h.last!=null&&h.last!==cur){h.u.push(h.last);if(h.u.length>50)h.u.shift();h.r=[]}h.last=cur; // ponytail: whole-project snapshots, fine at this size
  render();queue(p.id);if(m)toast("リンク先のタスクを後ろにずらしました")}
function queue(id){backupSoon();pendingIds.add(id);clearTimeout(timers[id]);timers[id]=setTimeout(()=>flush(id),400)}
function flush(id){
  delete timers[id];
  const p=projects[id];
  chain=chain.then(()=>p?store.put(id,body(p)):store.remove(id))
    .catch(err=>{if(err&&err.code==="invalid_argument"){readOnly=true;toast("編集権限がないため保存できません");}else toast("保存できませんでした。もう一度お試しください")})
    .finally(()=>{if(!timers[id])pendingIds.delete(id)});
}
// all projects from storage (at start, and when changed elsewhere); keeps local edits not yet saved
function onData(all){
  const next={};
  Object.entries(all).forEach(([id,p])=>{next[id]=pendingIds.has(id)&&projects[id]?projects[id]:p});
  pendingIds.forEach(id=>{if(projects[id])next[id]=projects[id]; else delete next[id]});
  projects=next;
  Object.keys(next).forEach(id=>{if(!pendingIds.has(id)&&hist[id])hist[id].last=snap(next[id])});
  if(!projects[curId])curId=Object.keys(projects)[0]||null;
  if(!dragging)render();
}
function toast(msg){document.querySelectorAll(".toast").forEach(x=>x.remove());const t=document.createElement("div");t.className="toast";t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2600)}
