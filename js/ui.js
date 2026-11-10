// Interactions: drawer forms, members, milestones, popups, context menu, drag & drop, selection, toolbar, keyboard.
/* ---------- actions ---------- */
function setCur(id){leaveTask();leaveMemo();log("project",{p:id});if(sh.mine&&sh.mine!==id)shEnd();lkArmed=false;lkWas="";view.q=$("qIn").value="";stSave();curId=id;ls.set("mg.cur",id||"");stLoad();closeDrawer();render()} // stSave / stLoad: each project's folding, selection, scroll (v0.0.16)
function newProject(){
  if(storeRO)return;
  const id=uid();projects[id]={id,name:"新しいプロジェクト",tasks:[]};setCur(id);save(projects[id]);openProject();
}
const drawer=$("drawer");
const setTgl=()=>$("projSet").setAttribute("aria-expanded",!$("projForm").hidden); // the 設定 button shows a cross while its panel is open
function closeDrawer(){drawer.hidden=true;$("taskForm").hidden=true;$("projForm").hidden=true;setTgl();if(editingId){editingId=null;render()}}
function armReset(){document.querySelectorAll(".danger").forEach(b=>{b.classList.remove("arm");b.textContent=b.id==="projDel"?"このプロジェクトを削除":"削除"})}
function openTask(id){
  if(editingId!==id)leaveTask(); // another task: what was changed in the panel is saved first
  const p=projects[curId],all=derive(p),r=all.find(x=>x.id===id);if(!r)return;
  editingId=id;armReset();
  drawer.hidden=false;$("projForm").hidden=true;$("taskForm").hidden=false;setTgl();
  parOpts(all,r);FF.forEach(([k,get])=>fset(k,get(r,all)));formInit=Object.fromEntries(FF.map(([k])=>[k,fval(k)]));
  ["f-s","f-sh","f-e","f-eh","f-p","f-ms","f-dv"].forEach(k=>$(k).disabled=!!r.parent||readOnly);$("f-pa").disabled=readOnly;
  formExtras(r);
  fIcon=r.icon&&IMGF.test(r.icon.file)?{...r.icon}:null;fIcon0=icoN(fIcon);fPar=!!r.parent;$("f-icgal").hidden=true;icoForm();
  render();
}
/* task form fields; while the form is open, fields the user has not touched follow changes made elsewhere
   (right-click rename, 担当 box, progress slider…), so 保存 never writes stale values back */
const FF=[["f-pa",(r,all)=>parId(all,r)],["f-name",r=>r.name],["f-as",r=>r.assignees.join("、")],["f-s",r=>r.start],["f-sh",r=>r.startPM?"pm":"am"],["f-e",r=>r.end],["f-eh",r=>r.endAM?"am":"pm"],["f-p",r=>String(r.progress)],["f-ms",r=>!!r.milestone],["f-dv",r=>!!r.deliverable],["f-memo",r=>r.memo||""]];
const fval=k=>$(k).type==="checkbox"?$(k).checked:$(k).value;
const fset=(k,v)=>{if($(k).type==="checkbox")$(k).checked=v;else $(k).value=v};
let formInit={};
function formExtras(r){$("f-po").textContent=$("f-p").value+"%";memChips();$("f-biz").textContent=r.parent?"子タスクから自動計算されます":bizHint()}
// names of the parents above the task, top first: where a new or moved task ended up, even when 成果物のみ hides them
const parPath=(all,r)=>{const out=[];let L=r.level;for(let j=r.idx-1;j>=0&&L>0;j--)if(all[j].level<L){out.unshift(all[j].name);L=all[j].level}return out.join(" › ")};
const setDv=(t,on)=>{if(on)t.deliverable=true;else delete t.deliverable}; // the deliverable tag is stored only when set, so old data stays as it was
const parId=(all,r)=>{for(let j=r.idx-1;j>=0&&r.level>0;j--)if(all[j].level<r.level)return all[j].id;return""}; // the task's parent, "" on the top level
/* 親 in the task panel: the tasks that could be the parent, as their full path; picked + 保存 = the task (with its children) moves under it.
   Left out: the task itself and what is under it; deliverables — tagged ones, and 3rd-level tasks without sub-tasks (older ones not tagged yet):
   they made the list long; to put a task under one, drag it or use Tab. Greyed: a parent that would take it past the 4th level */
function parOpts(all,r){const end=blockEnd(all,r.idx),blk=all.slice(r.idx,end+1),path=x=>(x.level?parPath(all,x)+" › ":"")+x.name;
  $("f-pa").innerHTML=`<option value="">（なし）</option>`+all.map(x=>x.level>2||isDv(x)||(x.level===2&&!x.parent)||(x.idx>=r.idx&&x.idx<=end)?"":`<option value="${esc(x.id)}"${deep(blk,x.level+1-r.level)?" disabled":""}>${esc(path(x))}</option>`).join("")}
function syncForm(){
  if($("taskForm").hidden||!editingId)return;const all=derive(projects[curId]),r=all.find(x=>x.id===editingId);if(!r)return;
  const pv=$("f-pa").value;parOpts(all,r);$("f-pa").value=pv;if($("f-pa").selectedIndex<0)$("f-pa").value=formInit["f-pa"]=parId(all,r); // the picked parent is gone: back to where the task is
  let ch=false;FF.forEach(([k,get])=>{const v=get(r,all);if(fval(k)===formInit[k]&&v!==formInit[k]){fset(k,v);formInit[k]=v;ch=true}});
  if(ch)formExtras(r);
  icoForm(); // a picture read just now
}
const formH=(s,e)=>{const a=2*D(s)+($("f-sh").value==="pm"?1:0);return[a,Math.max(a,2*D(e)+($("f-eh").value==="am"?0:1))]}; // the panel's dates as half-day slots: an afternoon start with a morning end on one day = that afternoon
function bizHint(){const s=$("f-s").value,e=$("f-e").value;if(!s||!e)return"";if(e<s)return"終了日が開始日より前です";return`${bizH(...formH(s,e))} 営業日（土日祝・会社の休日を除く）`}
function openProject(){
  leaveTask();const p=projects[curId];armReset();
  drawer.hidden=false;$("taskForm").hidden=true;$("projForm").hidden=false;setTgl();
  document.querySelectorAll("#projForm .pj").forEach(e=>e.hidden=!p);$("projDel").hidden=!p; // without a project: only this PC's folders and ＋ プロジェクト
  bkInfo();shInfo();thInfo();if(!p)return;$("p-name").value=p.name||"";$("p-json").value=JSON.stringify({name:p.name,members:roster(p),tasks:p.tasks,milestones:p.milestones||[],holidays:p.holidays||[]},null,1);rosterChips();
}
$("f-s").addEventListener("input",()=>{if($("f-e").value<$("f-s").value)$("f-e").value=$("f-s").value;$("f-biz").textContent=bizHint()});
["f-e","f-sh","f-eh"].forEach(k=>$(k).addEventListener("input",()=>$("f-biz").textContent=bizHint()));
$("f-p").addEventListener("input",()=>$("f-po").textContent=$("f-p").value+"%");
/* member roster: kept per project, picked from in the task form */
function memChips(){const p=projects[curId],cur=names($("f-as").value);
  $("f-mem").innerHTML=[...new Set([...roster(p),...cur])].map(n=>`<button type="button" class="chip" data-mem="${esc(n)}" aria-pressed="${cur.includes(n)}">${esc(n)}</button>`).join("")}
// a name off the roster: typed below the names and added with Enter (v0.0.13 — the names are the way to pick; f-as holds the list)
$("f-asNew").addEventListener("keydown",e=>{if(e.key!=="Enter")return;e.preventDefault();$("f-as").value=[...new Set([...names($("f-as").value),...names(e.target.value)])].join("、");e.target.value="";memChips()});
$("f-mem").addEventListener("click",e=>{const b=e.target.closest("[data-mem]");if(!b)return;const n=b.dataset.mem,cur=names($("f-as").value);
  $("f-as").value=(cur.includes(n)?cur.filter(x=>x!==n):[...cur,n]).join("、");memChips()});
function rosterChips(){const p=projects[curId];
  $("p-mems").innerHTML=roster(p).map(n=>`<span class="chip">${esc(n)}<button type="button" data-rm="${esc(n)}" aria-label="${esc(n)}を外す">×</button></span>`).join("")||`<span class="hint">まだいません</span>`}
function addMembers(){const p=projects[curId],add=names($("p-mem").value);if(!add.length||readOnly)return;
  p.members=[...new Set([...roster(p),...add])];$("p-mem").value="";save(p);rosterChips();$("p-mem").focus()}
$("p-memAdd").addEventListener("click",addMembers);
$("p-mem").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();addMembers()}});
$("p-mems").addEventListener("click",e=>{const b=e.target.closest("[data-rm]");if(!b||readOnly)return;const p=projects[curId];
  p.members=roster(p).filter(n=>n!==b.dataset.rm);save(p);rosterChips()}); // tasks keep their assignees
$("taskForm").addEventListener("submit",e=>{e.preventDefault();if(saveTask()!==false){toast("保存しました");closeDrawer()}});
// leaving the task panel any other way (完了, Esc, another task, another project, 設定) saves what was changed in it (v0.0.13) — nothing is lost, Ctrl+Z undoes it
const taskDirty=()=>!$("taskForm").hidden&&!!editingId&&(FF.some(([k])=>fval(k)!==formInit[k])||icoN(fIcon)!==fIcon0);
function leaveTask(){if(readOnly||!taskDirty())return;if(saveTask()!==false)toast("保存しました（Ctrl+Z で元に戻せます）")}
function saveTask(){
  const p=projects[curId];const t=p&&p.tasks.find(x=>x.id===editingId);if(!t||readOnly)return false;
  t.name=$("f-name").value.trim()||"無題";
  t.assignees=names($("f-as").value);
  if(!$("f-s").disabled){let s=$("f-s").value||t.start,en=$("f-e").value||t.end;if(en<s)en=s;setH(t,...formH(s,en));t.progress=+$("f-p").value;t.milestone=$("f-ms").checked;setDv(t,$("f-dv").checked)}
  t.memo=$("f-memo").value;
  const ic=icoN(fIcon);if(ic!==fIcon0){if(ic)t.icon=JSON.parse(ic);else delete t.icon} // stored only when there is one, so old data stays as it was
  // 親 changed: move under it (after its children); （なし） = top level, right after the top-level task it was under. moveBlock saves — one undo step with the fields
  const pa=$("f-pa").value,top=()=>{const ts=p.tasks;let i=ts.indexOf(t);while(ts[i].level>0)i--;return ts[i].id};
  if(pa===formInit["f-pa"]||!moveBlock(p,[t.id],pa||top(),pa?"in":"after"))save(p);
  FF.forEach(([k])=>formInit[k]=fval(k));fIcon0=icoN(fIcon); // saved: what is in the panel now is no longer a change
}
/* icon in the task panel (v0.0.12): fIcon = the icon as 保存 will write it (null = none), fIcon0 = as it was. A picture dropped on the box, or picked by
   clicking the empty box, goes into the shared folder's images/ at once (storage.js imgPut); one from the list is there already. Drag in the box = move, wheel = zoom */
let fIcon=null,fIcon0="",fPar=false,icoDrag=null;
const r3=v=>Math.round(v*1000)/1000,icoN=i=>i?JSON.stringify({file:i.file,x:r3(num(i.x,0,1,.5)),y:r3(num(i.y,0,1,.5)),z:r3(num(i.z,1,5,1))}):"";
const icoOn=()=>!!sh.dir&&sh.ok&&!readOnly;
function icoForm(){const box=$("f-icbox"),img=box.firstElementChild,c=fIcon&&imgOf(fIcon.file);
  box.classList.toggle("dv",!fPar&&$("f-dv").checked);box.classList.toggle("has",!!c);box.classList.toggle("off",!icoOn());
  if(c){img.src=c.url;img.style.cssText=icoPos(c,fIcon)}else img.removeAttribute("src");
  $("f-ichint").textContent=!sh.dir?"共有フォルダを選ぶとアイコンを使えます":!sh.ok?"共有フォルダに接続するとアイコンを使えます":fIcon&&!c?"画像を読み込み中…（共有フォルダの images に見つからないときは表示されません）"
    :readOnly?"":c?"ドラッグで位置、ホイールで拡大・縮小":"画像をドロップするか、枠をクリックしてファイルを選びます";
  $("f-icpick").disabled=!icoOn();$("f-icdel").hidden=!fIcon||readOnly}
async function icoAdd(f){if(!icoOn())return;$("f-ichint").textContent="画像を保存中…";
  try{fIcon={file:await imgPut(f),x:.5,y:.5,z:1};$("f-icgal").hidden=true}catch(e){log("img-fail",{step:"add",...errInfo(e)});
    toast(e?.name==="InvalidStateError"?"画像として読み込めませんでした。PNG・JPEG・WebP などの画像ファイルを選んでください":`画像を保存できませんでした（${e?.name||"Error"}）。共有フォルダにつながっているか確認してください`)}icoForm()}
const icb=$("f-icbox");
icb.addEventListener("click",()=>{if(!fIcon&&icoOn())$("f-icin").click()});
$("f-icin").addEventListener("change",e=>{const f=e.target.files[0];e.target.value="";if(f)icoAdd(f)});
icb.addEventListener("dragover",e=>{e.preventDefault();e.stopPropagation()});
icb.addEventListener("drop",e=>{e.preventDefault();e.stopPropagation();const f=e.dataTransfer.files[0];if(f)icoAdd(f)}); // not the page's drop (a backup file)
icb.addEventListener("pointerdown",e=>{if(!fIcon||!imgs[fIcon.file]?.url||readOnly)return;e.preventDefault();icb.setPointerCapture(e.pointerId);icoDrag=[e.clientX,e.clientY]});
icb.addEventListener("pointermove",e=>{if(!icoDrag)return;const c=imgs[fIcon.file],s=icb.clientWidth*num(fIcon.z,1,5,1)/Math.min(c.w,c.h); // s = screen px per picture px
  fIcon={...fIcon,x:num(num(fIcon.x,0,1,.5)-(e.clientX-icoDrag[0])/(s*c.w),0,1,.5),y:num(num(fIcon.y,0,1,.5)-(e.clientY-icoDrag[1])/(s*c.h),0,1,.5)};icoDrag=[e.clientX,e.clientY];icoForm()});
["pointerup","pointercancel"].forEach(k=>icb.addEventListener(k,()=>icoDrag=null));
// the same without the mouse: Enter / Space on the empty box = pick a file; arrows move the picture, + / − zoom
icb.addEventListener("keydown",e=>{if(readOnly)return;if(!fIcon){if((e.key==="Enter"||e.key===" ")&&icoOn()){e.preventDefault();$("f-icin").click()}return}
  if(!imgs[fIcon.file]?.url)return;const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key],z=e.key==="+"||e.key===";"?1.1:e.key==="-"?1/1.1:0;if(!d&&!z)return;e.preventDefault();e.stopPropagation();
  fIcon=d?{...fIcon,x:num(num(fIcon.x,0,1,.5)+d[0]*.02,0,1,.5),y:num(num(fIcon.y,0,1,.5)+d[1]*.02,0,1,.5)}:{...fIcon,z:num(num(fIcon.z,1,5,1)*z,1,5,1)};icoForm()});
icb.addEventListener("wheel",e=>{if(!fIcon||!imgs[fIcon.file]?.url||readOnly)return;e.preventDefault();fIcon={...fIcon,z:num(num(fIcon.z,1,5,1)*Math.exp(-e.deltaY/500),1,5,1)};icoForm()},{passive:false});
$("f-icpick").addEventListener("click",async()=>{const g=$("f-icgal");if(!g.hidden){g.hidden=true;return}g.hidden=false;g.textContent="読み込み中…";
  const ns=await imgList(),cs=await Promise.all(ns.map(imgLoad));
  g.innerHTML=ns.map((n,i)=>cs[i]?`<button type="button" data-icf="${n}" title="この画像を使う" aria-label="この画像を使う"><img src="${cs[i].url}" alt=""></button>`:"").join("")||'<span class="hint">共有フォルダの images に画像がありません</span>'}); // n: <16 hex>.webp (IMGF)
$("f-icgal").addEventListener("click",e=>{const b=e.target.closest("[data-icf]");if(!b||readOnly)return;fIcon={file:b.dataset.icf,x:.5,y:.5,z:1};$("f-icgal").hidden=true;icoForm()});
$("f-icdel").addEventListener("click",()=>{fIcon=null;icoForm()});
$("f-dv").addEventListener("change",icoForm); // a deliverable's icon is square
$("taskDel").addEventListener("click",e=>{
  const b=e.currentTarget;if(!b.classList.contains("arm")){b.classList.add("arm");b.textContent="もう一度押すと削除";return}
  const p=projects[curId];p.tasks=p.tasks.filter(t=>t.id!==editingId);save(p);closeDrawer();toast("削除しました");
});
$("projForm").addEventListener("submit",e=>e.preventDefault());
// project name (v0.0.13): saved when it is left (Enter or a click elsewhere) — no button of its own
$("p-name").addEventListener("change",()=>{const p=projects[curId];if(!p||readOnly)return;const v=$("p-name").value.trim()||"無題";if(v!==p.name){p.name=v;save(p);toast("プロジェクト名を保存しました")}});
$("p-name").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();e.target.blur()}});
$("p-copy").addEventListener("click",()=>{const v=$("p-json").value;navigator.clipboard.writeText(v).then(()=>toast("コピーしました"),()=>{$("p-json").select();toast("選択しました。Ctrl+C でコピーしてください")})});
/* replace the current project's tasks (and milestones / members / name when given); shared by JSON and Excel import */
// xl: from Excel, which has no icons — a task keeps the icon it has now (same ID). An icon is kept only with a picture name that can be looked up (IMGF)
function replaceData(d,xl){
  const p=projects[curId];if(!p||readOnly)return;const tasks=Array.isArray(d)?d:d.tasks;if(!Array.isArray(tasks))throw 0;
  const was=Object.fromEntries(p.tasks.map(t=>[t.id,t.icon])),icoIn=i=>i&&IMGF.test(i.file)?{icon:JSON.parse(icoN(i))}:{};
  p.tasks=tasks.filter(t=>t&&t.name&&isDay(t.start)&&isDay(t.end)).map(t=>({id:t.id?String(t.id):uid(),name:String(t.name),start:t.start,end:t.end,progress:Math.max(0,Math.min(100,+t.progress||0)),assignees:Array.isArray(t.assignees)?t.assignees.map(String):[],level:+t.level||0,milestone:!!t.milestone,memo:t.memo||"",deps:Array.isArray(t.deps)?t.deps.map(String):[],...(isHex(t.color)?{color:t.color}:{}),...(t.deliverable?{deliverable:true}:{}),...(t.startPM?{startPM:true}:{}),...(t.endAM?{endAM:true}:{}),...icoIn(t.icon||xl&&was[String(t.id)])}));
  if(Array.isArray(d.milestones))p.milestones=d.milestones.filter(m=>m&&isDay(m.date)).map(m=>({id:m.id||uid(),date:m.date,title:String(m.title||""),color:MSC.includes(m.color)?m.color:"blue"}));
  if(Array.isArray(d.members))p.members=d.members.map(String);
  if(Array.isArray(d.holidays))p.holidays=d.holidays.filter(h=>h&&isDay(h.date)).map(h=>({date:h.date,color:isHex(h.color)?h.color:HOLC}));
  if(d.name)p.name=String(d.name);save(p);closeDrawer();
  const bad=tasks.length-p.tasks.length;toast(`${p.tasks.length} 件のタスクを読み込みました`+(bad?`（${bad} 件は名前か日付が正しくないため読み込みませんでした）`:"")+"。Ctrl+Z で元に戻せます");
}
$("p-import").addEventListener("click",()=>{
  try{replaceData(JSON.parse($("p-json").value))}catch(err){toast("JSONを読み取れませんでした。形式を確認してください")}
});
/* Excel in Brabio's export layout: rows 1–2 title / period, row 3 headers A–Q, data from row 5 — project row, milestones, then folders / tasks.
   Brabio's day-by-day chart (column R on) is not written. Columns R–T here are Tempo's own ◆ flag, parent color and deliverable tag (○), which Brabio has no field for.
   Import finds columns by header name, so Brabio's own exports load too. */
const XCOL=["タイプ","アウトライン","ID","タイトル","開始日","〆切日","ステータス","進捗率","状況","完了日","メンバー","内容","完了メンバー","完了メンバーID","メンバーID","リンクID","固定リンクID","マイルストーン","色","成果物","午後開始","午前終了"];
const xnow=()=>{const[y,m,d,h,mi]=bkStamp().split(/[-_]/);return`${y}年${m}月${d}日 ${h}時${mi}分`}; // when the sheet was written
function toXlsx(p){
  const{pct,mn,mx}=overall(p),has=isFinite(mn),ps=has?S(mn):"",pe=has?S(mx):"";
  const jd=s=>`${s.slice(0,4)}年${s.slice(5,7)}月${s.slice(8,10)}日`,day=s=>s?{date:s}:"";
  return xlsxBlob([[p.name||""],[has?`${jd(ps)} ～ ${jd(pe)} （${xnow()}）`:""],XCOL,[],
    ["project",0,p.id,p.name||"",day(ps),day(pe),"",pct,has?ST[status({start:ps,end:pe,progress:pct})]:"","",roster(p).join("\n")],
    ...[...(p.milestones||[])].sort((a,b)=>a.date<b.date?-1:1).map(m=>["milestone",1,"",m.title,day(m.date),day(m.date),"","","","","",m.color||"blue"]),
    ...derive(p).map(r=>[r.parent?"folder":"task",r.level+1,r.id,r.name,day(r.start),day(r.end),r.progress>=100?"完了":r.progress>0?"作業中":"未着手",r.progress,ST[r.st],"",
      r.parent?"":r.assignees.join("\n"),r.memo||"","","","",(r.deps||[]).join("\n"),"",r.milestone?"◆":"",isHex(r.color)?r.color:"",r.deliverable?"○":"",r.startPM?"○":"",r.endAM?"○":""])],
    {widths:[9,6,12,36,11,11,9,7,9,11,16,30,12,12,12,12,12,8,9,8,8,8],head:2,freeze:4});
}
const xdate=v=>{if(typeof v==="number")return S(Math.floor(v)-XL_EPOCH);const m=/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/.exec(String(v??"").trim());return m?`${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`:""};
async function fromXlsx(buf){
  const rows=await readXlsx(buf),key=v=>String(v??"").trim(),h=rows.findIndex(r=>r.some(v=>key(v)==="タイプ")&&r.some(v=>key(v)==="タイトル"));if(h<0)throw 0;
  const ci={};rows[h].forEach((v,i)=>{if(key(v)&&!(key(v)in ci))ci[key(v)]=i});
  const d={tasks:[],milestones:[]};
  rows.slice(h+1).forEach(r=>{const g=k=>ci[k]==null||r[ci[k]]==null?"":r[ci[k]],s=k=>key(g(k)),type=s("タイプ");
    if(type==="project"){if(s("タイトル"))d.name=s("タイトル");const m=names(s("メンバー"));if(m.length)d.members=m}
    else if(type==="milestone")d.milestones.push({date:xdate(g("開始日"))||xdate(g("〆切日")),title:s("タイトル"),color:s("内容")});
    else if(type||s("タイトル"))d.tasks.push({id:s("ID"),name:s("タイトル"),level:Math.max(0,Math.min(3,(+g("アウトライン")||1)-1)),start:xdate(g("開始日")),end:xdate(g("〆切日")),
      progress:Math.round(parseFloat(g("進捗率"))||0),assignees:names(s("メンバー")),milestone:/^(◆|1|true)$/i.test(s("マイルストーン")),deliverable:/^(○|〇|1|true)$/i.test(s("成果物")),startPM:/^(○|〇|1|true)$/i.test(s("午後開始")),endAM:/^(○|〇|1|true)$/i.test(s("午前終了")),color:s("色"),memo:String(g("内容")),
      deps:(s("リンクID")+" "+s("固定リンクID")).split(/[\s,、]+/).filter(Boolean)}); // 固定リンク (red, fixed gap) loads as a normal link
  });
  return d;
}
/* 一覧: a sheet for reading only (not importable): titles indented by level, fewer columns */
function toListXlsx(p){const day=s=>s?{date:s}:"";
  return xlsxBlob([[p.name||""],[`${xnow()}　※閲覧用（Tempo には読み込めません）`],
    ["ID","タイトル","担当","開始日","〆切日","営業日","進捗率","状況"],
    ...derive(p).map(r=>[r.id,"　".repeat(r.level)+r.name,r.assignees.join("、"),day(r.start),day(r.end),bizH(hs(r),he(r)),r.progress,ST[r.st]])],
    {widths:[13,52,16,11,11,7,7,9],head:2});
}
function xdl(blob,p,tag){const{mn,mx}=overall(p),a=document.createElement("a");a.href=URL.createObjectURL(blob);
  a.download=((p.name||"Tempo")+tag+(isFinite(mn)?` (${S(mn)}～${S(mx)})`:"")).replace(/[\\/:*?"<>|]/g,"_")+".xlsx";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
$("p-xout").addEventListener("click",()=>{const p=projects[curId];if(p)xdl(toXlsx(p),p,"")});
$("p-xlist").addEventListener("click",()=>{const p=projects[curId];if(p)xdl(toListXlsx(p),p," 一覧")});
$("p-xin").addEventListener("click",()=>$("p-xfile").click());
$("p-xfile").addEventListener("change",async e=>{const f=e.target.files[0];e.target.value="";if(!f)return;
  try{replaceData(await fromXlsx(await f.arrayBuffer()),true)}catch(err){toast("Excelを読み取れませんでした。「タイプ」「タイトル」の列がある .xlsx（Brabio 形式）か確認してください")}});
/* backup folder (storage.js): pick it, 保存 button, what was saved last, restore from any saved file */
function bkInfo(){
  $("saveBtn").hidden=!window.showDirectoryPicker;
  // short status only: the explanations are in the buttons' tooltips (the user found the panel too wordy)
  $("bk-info").textContent=!window.showDirectoryPicker?"Chrome / Edge で使えます"
    :!bk.dir?"未設定"
    :!bk.ok?`「${bk.dir.name}」　次の編集時に許可を確認`
    :`✓ 「${bk.dir.name}」　自動 ${bk.last||"—"}　手動 ${bk.saved||"—"}`;
  $("bk-pick").textContent=bk.dir?"変更":"保存先フォルダを選ぶ"} // set: the button only changes it
async function pickDir(){const d=await showDirectoryPicker({id:"tempo-backup",mode:"readwrite"});if(sh.dir&&await sh.dir.isSameEntry(d))throw Object.assign(new Error("same"),{code:"same"});bk.dir=d;bk.ok=true;bk.asked=true;await kv("readwrite",s=>s.put(bk.dir,"bkDir"))}
$("bk-pick").addEventListener("click",async()=>{
  try{await pickDir();backupSoon();bkInfo();toast("バックアップ先を設定しました")}
  catch(e){if(e.name!=="AbortError")toast(e.code==="same"?"共有フォルダと同じフォルダは選べません":"フォルダを選べませんでした")}});
$("saveBtn").addEventListener("click",async()=>{const n=bkStamp()+".backup.json"; // named by the moment the button is pressed
  try{
    if(!bk.dir)await pickDir();
    if(!bk.ok)bk.ok=await bk.dir.requestPermission({mode:"readwrite"})==="granted";
    if(!bk.ok){toast("フォルダへのアクセスが許可されていません");return}
    await bkWrite(n);bk.saved=n;bkInfo();toast(`保存しました：${n}`);
  }catch(e){if(e.name!=="AbortError")toast("保存できませんでした。保存先フォルダを確認してください")}});
// Chrome / Edge: the picker opens in the backup folder (the plain file box can't be told where to start); elsewhere the plain file box
$("bk-restore").addEventListener("click",async()=>{if(!window.showOpenFilePicker)return $("bk-file").click();
  try{const[h]=await showOpenFilePicker({id:"tempo-backup",...(bk.dir?{startIn:bk.dir}:{}),types:[{description:"Tempo バックアップ",accept:{"application/json":[".json"]}}]});
    if(storeRO)return;const all=await readBackup(await h.getFile());if(all)restoreBackup(all)}
  catch(e){if(e.name!=="AbortError")toast("ファイルを開けませんでした")}}); // AbortError: the picker was closed
// a backup file's projects, or null (with a message) when the file is not a backup
async function readBackup(f){
  try{const all=JSON.parse(await f.text()),days=(a,k)=>!Array.isArray(a)||a.every(x=>x&&k.every(d=>isDay(x[d]))); // a row without its dates would stop the page from drawing
    if(!all||!Object.values(all).length||!Object.values(all).every(p=>p&&Array.isArray(p.tasks)&&days(p.tasks,["start","end"])&&days(p.milestones,["date"])&&days(p.holidays,["date"])))throw 0;return all}
  catch(err){toast("バックアップファイル（.backup.json）を読み取れませんでした");return null}}
async function restoreBackup(all){
  // keep the state before the restore in one file, overwritten each time: auto.backup.json is about to hold the restored data
  const pre="before-restore.backup.json";let kept=false;if(bk.ok)try{await bkWrite(pre);kept=true}catch(err){}
  Object.entries(all).forEach(([id,p])=>{projects[id]={id,name:String(p.name||"無題"),tasks:p.tasks,milestones:Array.isArray(p.milestones)?p.milestones:[],holidays:Array.isArray(p.holidays)?p.holidays:[],...(Array.isArray(p.members)?{members:p.members}:{}),...(Array.isArray(p.notes)?{notes:p.notes}:{}),...(projects[id]?.shared?{shared:true,rev:projects[id].rev}:{})};save(projects[id])});
  closeDrawer();toast(`${Object.keys(all).length} 件のプロジェクトを復元しました`+(kept?`（復元前の状態は ${pre} に保存）`:""));
}
$("bk-file").addEventListener("change",async e=>{const f=e.target.files[0];e.target.value="";if(!f||storeRO)return;const all=await readBackup(f);if(all)restoreBackup(all)});
/* drop a backup file anywhere on the page = バックアップから復元, after a confirmation that says what it will replace (a drop is easy to do by mistake) */
const dropPop=$("dropPop");let dropAll=null;
const closeDrop=()=>{dropPop.hidden=true;dropAll=null};
document.addEventListener("dragover",e=>{if([...e.dataTransfer.types].includes("Files"))e.preventDefault()}); // without this the browser opens the file instead
document.addEventListener("drop",async e=>{const f=e.dataTransfer.files[0];if(!f)return;e.preventDefault();
  if(storeRO){toast("閲覧のみのため読み込めません");return}
  const all=await readBackup(f);if(!all)return;const ns=Object.values(all).map(p=>String(p.name||"無題"));
  dropAll=all;$("dropFile").textContent=f.name;$("dropWhat").textContent=`${ns.length} 件のプロジェクト：${ns.join("、")}`;
  dropPop.hidden=false;dropPop.style.left=Math.max(16,(innerWidth-dropPop.offsetWidth)/2)+"px";dropPop.style.top=Math.max(16,(innerHeight-dropPop.offsetHeight)/3)+"px"});
dropPop.addEventListener("submit",e=>{e.preventDefault();const all=dropAll;closeDrop();if(all)restoreBackup(all)});
$("dropCancel").addEventListener("click",closeDrop);
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!dropPop.hidden)closeDrop()});
/* shared folder (storage.js): pick it, move the open project there, copy a shared one back as a separate local project */
function shInfo(){const p=projects[curId],on=store===backends.local&&!!window.showDirectoryPicker;
  $("sh-row").hidden=$("sh-info").hidden=!on;$("sh-proj").hidden=!on||!p;$("sh-move").hidden=!p||!!p.shared||!sh.dir;$("sh-copy").hidden=!p?.shared;
  $("sh-where").textContent=p?.shared?"共有フォルダ":"このブラウザ";
  $("sh-info").textContent=location.host?"共有ドライブ上の Tempo.html を直接開いています。共有フォルダを使うには Tempo.bat から開いてください" // page opened from a network path: Chrome won't let it use folders
    :!sh.dir?"未設定":`${sh.ok?"✓ ":""}「${sh.dir.name}」　共有プロジェクト ${Object.keys(sh.data).length} 件`;
  $("sh-pick").textContent=sh.dir?"変更":"フォルダを選ぶ";
  $("sh-path").hidden=!on||!sh.dir||!sh.path;$("sh-path").textContent=sh.path}
$("sh-pick").addEventListener("click",async()=>{try{await shPick();shInfo();render();const n=Object.keys(sh.data).length;
    toast(n?`共有フォルダを設定しました。共有プロジェクト ${n} 件は上のプロジェクト一覧（👥）から開けます`:"共有フォルダを設定しました（共有プロジェクトはまだありません）")}
  catch(e){if(e.name!=="AbortError")toast(e.code==="name"?`「data」という名前のフォルダを選んでください（選んだフォルダ：${e.picked}）`:e.code==="same"?"バックアップ先と同じフォルダは選べません":"フォルダを選べませんでした")}});
$("sh-move").addEventListener("click",async()=>{const p=projects[curId];if(!p||p.shared||storeRO)return;
  if(!sh.ok||sh.err){toast("共有フォルダに接続できません");return}
  if(!me){toast("先に上の「自分」で名前を選んでください");return}
  try{setCur(await shMove(p));toast("共有フォルダへ移動しました")}catch(e){toast("移動できませんでした。共有フォルダを確認してください")}});
$("sh-copy").addEventListener("click",()=>{const p=projects[curId];if(!p?.shared||storeRO)return;const id=uid(),d=structuredClone(body(p));delete d.rev;
  projects[id]={...d,id,name:(p.name||"無題")+"（コピー）"};setCur(id);save(projects[id]);toast("ローカルにコピーしました")});
$("projDel").addEventListener("click",e=>{
  const b=e.currentTarget;if(readOnly)return;if(!b.classList.contains("arm")){b.classList.add("arm");b.textContent="もう一度押すと完全に削除";return}
  const id=curId;delete projects[id];queue(id);closeDrawer();setCur(Object.keys(projects)[0]||null);toast("プロジェクトを削除しました");
});
drawer.addEventListener("click",e=>{if(e.target.closest("[data-close]")){leaveTask();closeDrawer()}});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!drawer.hidden){leaveTask();closeDrawer()}});

// screen colors (v0.0.13): light unless picked otherwise — mg.theme = light / dark / os (follow Windows / Chrome), this browser only. Tempo.html's <head> applies it before drawing
const theme=()=>["dark","os"].includes(ls.get("mg.theme"))?ls.get("mg.theme"):"light";
const thInfo=()=>document.querySelectorAll("[data-th]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.th===theme()));
$("thSeg").addEventListener("click",e=>{const b=e.target.closest("[data-th]");if(!b)return;const t=b.dataset.th;ls.set("mg.theme",t);
  if(t==="os")delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=t;thInfo()});
$("projSel").addEventListener("change",e=>{if(e.target.value!=="+new")return setCur(e.target.value);e.target.value=curId||"";newProject()}); // the list's last line: ＋ 新しいプロジェクト (v0.0.13; was in 設定)
$("projSet").addEventListener("click",()=>$("projForm").hidden?openProject():closeDrawer()); // it shows a cross while open: pressing it again closes
const setMe=v=>{me=v;ls.set("mg.me",me);render()};
$("meSel").addEventListener("change",e=>{const s=e.target;if(!s.selectedOptions[0].hasAttribute("data-in"))return setMe(s.value);s.hidden=true;const i=$("meIn");i.hidden=false;i.value=me;i.focus();i.select()}); // 名前を入力…: a name off the roster, so a newcomer can take the lock and add themselves
$("meIn").addEventListener("keydown",e=>{if(e.key!=="Enter"&&e.key!=="Escape")return;e.stopPropagation();const v=e.target.value.trim();e.target.blur();if(e.key==="Enter"&&v)setMe(v)});
$("meIn").addEventListener("blur",e=>{e.target.hidden=true;$("meSel").hidden=false;render()}); // left without Enter: nothing changes
$("whoSel").addEventListener("change",e=>{view.who=e.target.value;render()});
document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>{const v=b.dataset.view;if((v==="memo")!==view.memo)view.q=$("qIn").value=""; // the search box finds tasks or notes: emptied when that changes
  leaveMemo();view.list=v==="list";view.memo=v==="memo";ls.set("mg.view",v);render()}));
$("leafBtn").addEventListener("click",()=>{view.leaf=!view.leaf;ls.set("mg.leaf",view.leaf?"1":"");render()}); // only the top folders and the tagged tasks (deliverables), in 一覧 and the chart
$("refSel").addEventListener("change",e=>{const m=refMap();if(e.target.value)m[curId]=e.target.value;else delete m[curId];ls.set("mg.ref",JSON.stringify(m));refFold.clear();render()}); // overlay (v0.0.10): per open project, this browser only
$("todayBtn").addEventListener("click",scrollToToday);
document.querySelectorAll("[data-scale]").forEach(b=>b.addEventListener("click",()=>{view.scale=b.dataset.scale;ls.set("mg.scale",view.scale);render()}));
$("qIn").addEventListener("input",e=>{view.q=e.target.value.trim().toLowerCase();memoHit=-1;render()}); // search this project by task name (in メモ: the notes)
$("qIn").addEventListener("keydown",e=>{if(e.key!=="Enter"||!view.memo)return;e.preventDefault();const ms=[...document.querySelectorAll("#chart .md mark")];if(!ms.length)return; // メモ: Enter = the next one found on this page
  memoHit=(memoHit+1)%ms.length;ms.forEach((m,i)=>m.classList.toggle("cur",i===memoHit));ms[memoHit].scrollIntoView({block:"center"})});
$("chips").addEventListener("click",e=>{const c=e.target.closest("[data-st]");if(!c)return;view.st=view.st===c.dataset.st?"":c.dataset.st;render()});

const FLAG='<svg width="12" height="13" viewBox="0 0 12 13" aria-hidden="true"><path d="M1.5 1v11.5" stroke="var(--ink2)" stroke-width="1.3"/><path d="M2 1.2h8.3l-1.9 2.9 1.9 2.9H2z" fill="var(--mc)"/></svg>';
const MSC=["blue","red","green","yellow","purple"];
document.querySelectorAll("#msPop [data-flag]").forEach(el=>el.innerHTML=FLAG);
const pop=$("msPop");let msEdit=null;
function openMs(date,id,x,y){
  if(readOnly)return;const p=projects[curId];if(!p)return;
  const m=id?(p.milestones||[]).find(v=>v.id===id):null;
  msEdit={date:m?m.date:date,id:m?m.id:null};
  const n=D(msEdit.date);
  $("msTitle").textContent=`${msEdit.date.replaceAll("-","/")} (${WD[dow(n)]}) のマイルストーン`;
  const c=MSC.includes(m?.color)?m.color:"blue";$("msc-"+c).checked=true;$("msFlagIco").className="mc-"+c;$("msFlagIco").innerHTML=FLAG;
  $("msName").value=m?m.title:"";$("msDel").hidden=!m;$("msDel").classList.remove("arm");$("msDel").textContent="削除";
  $("msOk").textContent=m?"更新する":"登録する";
  const co=(p.holidays||[]).find(v=>v.date===msEdit.date);
  $("holColor").value=co?coHol(n).color:(ls.get("mg.holColor")||HOLC);$("holTgl").textContent=co?"休日を解除":"休日にする";
  pop.hidden=false;const w=pop.offsetWidth,h=pop.offsetHeight;
  pop.style.left=Math.max(16,Math.min(x-20,innerWidth-w-16))+"px";pop.style.top=Math.max(16,Math.min(y+14,innerHeight-h-16))+"px";
  setTimeout(()=>$("msName").focus(),20);
}
function closeMs(){pop.hidden=true;msEdit=null}
pop.addEventListener("change",e=>{if(e.target.name==="msc")$("msFlagIco").className="mc-"+e.target.value});
pop.addEventListener("submit",e=>{e.preventDefault();const p=projects[curId];if(!p||!msEdit)return;
  const color=(pop.querySelector("input[name=msc]:checked")||{}).value||"blue",title=$("msName").value.trim();
  p.milestones=p.milestones||[];
  if(msEdit.id){const m=p.milestones.find(v=>v.id===msEdit.id);if(m){m.title=title;m.color=color}}
  else p.milestones.push({id:uid(),date:msEdit.date,title,color});
  closeMs();save(p);toast("マイルストーンを保存しました");});
/* company holiday on the same date popup (per project; not a workday, drawn in its color). Always a new array — see coHol in core.js */
$("holTgl").addEventListener("click",()=>{const p=projects[curId];if(!p||!msEdit)return;const d=msEdit.date,hs=p.holidays||[],has=hs.some(v=>v.date===d);
  p.holidays=has?hs.filter(v=>v.date!==d):[...hs,{date:d,color:$("holColor").value}];
  closeMs();save(p);toast(has?"会社の休日を解除しました":"会社の休日にしました")});
$("holColor").addEventListener("change",()=>{const p=projects[curId];if(!p||!msEdit)return;const v=$("holColor").value;ls.set("mg.holColor",v); // next new holiday starts with it
  if((p.holidays||[]).some(h=>h.date===msEdit.date)){p.holidays=p.holidays.map(h=>h.date===msEdit.date?{...h,color:v}:h);save(p)}});
$("msCancel").addEventListener("click",closeMs);
$("msDel").addEventListener("click",e=>{const b=e.currentTarget;if(!b.classList.contains("arm")){b.classList.add("arm");b.textContent="もう一度押すと削除";return}
  const p=projects[curId];p.milestones=(p.milestones||[]).filter(v=>v.id!==msEdit.id);closeMs();save(p);toast("削除しました")});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!pop.hidden)closeMs()});
document.addEventListener("pointerdown",e=>{if(!pop.hidden&&!pop.contains(e.target)&&!e.target.closest("#ht"))closeMs()});
const chart=$("chart"),chartRef=$("chartRef");
let whoT=0,stT=0;const onScroll=(a,b)=>()=>{if(!b.hidden&&b.scrollLeft!==a.scrollLeft)b.scrollLeft=a.scrollLeft; // two panes (v0.0.16): left-right in step, up-down each on its own
  if(!whoT)whoT=requestAnimationFrame(()=>{whoT=0;whoGone()});clearTimeout(stT);stT=setTimeout(stSave,300)}; // stSave: the scroll position is kept (v0.0.16)
chart.addEventListener("scroll",onScroll(chart,chartRef),{passive:true});chartRef.addEventListener("scroll",onScroll(chartRef,chart),{passive:true});
chartRef.addEventListener("click",e=>{const rt=e.target.closest("[data-rtg]");if(rt){const id=rt.dataset.rtg;refFold.has(id)?refFold.delete(id):refFold.add(id);render()}}); // the overlay's rows: folding is all they do
// the divider between the two panes: drag = the upper pane's share (15–85 %), kept in this browser; double-click = half and half
const refBar=$("refBar"),setSplit=r=>{r=Math.min(.85,Math.max(.15,r));ls.set("mg.split",String(r));$("charts").style.setProperty("--sp",r);refBar.setAttribute("aria-valuenow",Math.round(r*100))};
refBar.addEventListener("pointerdown",e=>{if(e.button)return;refBar.setPointerCapture(e.pointerId);refBar.classList.add("on");e.preventDefault();refBar.focus()}); // focus: preventDefault would keep it away, and ↑↓ need it (v0.0.17)
refBar.addEventListener("pointermove",e=>{if(!refBar.classList.contains("on"))return;const b=$("charts").getBoundingClientRect();setSplit((e.clientY-b.top)/b.height)});
refBar.addEventListener("lostpointercapture",()=>refBar.classList.remove("on"));
refBar.addEventListener("dblclick",()=>setSplit(.5));
refBar.addEventListener("keydown",e=>{const d={ArrowUp:-.05,ArrowDown:.05}[e.key];if(d){e.preventDefault();setSplit(splitR()+d)}}); // without a drag (docs/ui-checklist.md)
addEventListener("pagehide",stSave);
chart.addEventListener("click",e=>{
  if(e.target.closest("[data-pg]"))return;
  if(e.target.closest("[data-cols]")){view.cols=!view.cols;ls.set("mg.cols",view.cols?"":"0");render();return} // ガント: fold / unfold 担当・開始・終了・日数・進捗
  if(e.target.closest("[data-ids]")){view.ids=!view.ids;ls.set("mg.ids",view.ids?"1":"");render();return} // 一覧: fold / unfold the ID column
  const dn=e.target.closest("[data-done]");if(dn){const p=projects[curId],t=p.tasks.find(x=>x.id===dn.dataset.done); // 一覧: 完了 checkbox
    if(t&&!readOnly){t.progress=dn.checked?100:0;save(p);
      // the save drew the row again with the box already in its new state, so the box → tick motion never ran: put the new box
      // back to the old state without motion (.still), then let it go to the new one
      const n=document.querySelector(`[data-done="${CSS.escape(t.id)}"]`);if(n){n.classList.add("still");n.checked=!n.checked;void n.offsetWidth;n.classList.remove("still");n.checked=!n.checked}}
    return}
  const lk=e.target.closest("[data-lk]");if(lk){const id=curId;leaveMemo(); // edit lock, the switch in the corner: mine = end editing / nobody's = take it / someone else's = release (twice)
    if(lk.dataset.lk==="end")shEnd(true).then(ok=>{render();toast(ok?"編集を終了しました":"未保存の変更があります。保存が終わるまで編集を終了できません")});
    else if(lk.dataset.lk==="take")shTake(id).then(()=>{render();toast(sh.bare?"ロックのファイルを作れなかったため、ロックなしで編集します":"編集を始めました（ほかの人は閲覧のみ）")},err=>{render();toast(err.code==="locked"?`${err.by||"ほかの人"}さんが編集中です`:`ロックできませんでした（${err&&err.name||"Error"}）`)}); // the switch, off: lock, read the latest, and editing starts
    else if(!lkArmed){lkArmed=true;render()}
    else{lkArmed=false;shForce(id).then(()=>{render();toast("ロックを解除しました")},()=>toast("ロックを解除できませんでした"))}
    return}
  if(view.memo&&projects[curId])return memoClick(e);
  const as=e.target.closest("[data-as]");if(as){asEdit&&asEdit.at===as.dataset.as?closeAsPick():openAsPick(as);return}
  const fl=e.target.closest("[data-ms]");if(fl){openMs(null,fl.dataset.ms,e.clientX,e.clientY);return}
  const ht=e.target.closest("#ht");if(ht&&range){const n=range.a+Math.floor((e.clientX-ht.getBoundingClientRect().left)/range.dw);if(n>=range.a&&n<=range.b)openMs(S(n),null,e.clientX,e.clientY);return}
  if(e.target.closest("[data-act=newproj]"))return newProject();
  if(e.target.closest("[data-act=add]"))return cmd("add");
  const rt=e.target.closest("[data-rtg]");if(rt){const id=rt.dataset.rtg;refFold.has(id)?refFold.delete(id):refFold.add(id);render();return} // overlaid project: fold a parent / the whole section ("")
  const tg=e.target.closest("[data-tg]");if(tg){const id=tg.dataset.tg;collapsed.has(id)?collapsed.delete(id):collapsed.add(id);render();return}
  const o=e.target.closest("[data-open]");if(o)selectRow(o.dataset.open,e);
});

// just under the anchor, or above it when there is no room below
const below=(r,el)=>r.bottom+6+el.offsetHeight>innerHeight-8?Math.max(8,r.top-6-el.offsetHeight):r.bottom+6;
/* assignee picker (v0.0.13): on a 担当 cell — for all the selected tasks when that row is one of them — or from the toolbar's 担当者を追加 / 外す.
   A click on a name adds it, or takes it off when every task has it (追加: adds only, 外す: takes off only); a name off the roster is typed below.
   The box stays open for more names until ×, Esc or a click elsewhere; saved then, as one undo step. Parents (their 担当 is the sum) are left out */
const asPop=$("asPop");let asEdit=null;
const asTasks=()=>{const p=projects[curId];return p&&asEdit?p.tasks.filter(t=>asEdit.ids.includes(t.id)):[]};
const asNames=()=>{const cur=[...new Set(asTasks().flatMap(t=>t.assignees||[]))];return asEdit.mode==="del"?cur:[...new Set([...roster(projects[curId]),...cur])]};
function openAsPick(el,mode="tg"){closeAsPick();const p=projects[curId];if(!p||readOnly)return;const par=new Set(derive(p).filter(r=>r.parent).map(r=>r.id));
  const one=el.dataset.as,ids=(one&&!(sel.has(one)&&sel.size>1)?[one]:[...sel]).filter(id=>!par.has(id));
  asEdit={ids,mode,at:one||""};const ts=asTasks();
  if(!ts.length||mode==="del"&&!asNames().length){asEdit=null;toast(ts.length?"選択中のタスクに担当者がいません":"子タスクのないタスクを選んでください");return}
  asEdit.a0=JSON.stringify(ts.map(t=>t.assignees||[]));paintAsPick();asPop.hidden=false;
  const r=el.getBoundingClientRect();asPop.style.left=Math.max(16,Math.min(r.left,innerWidth-asPop.offsetWidth-16))+"px";asPop.style.top=below(r,asPop)+"px";
  ($("asMem").querySelector("button")||$("asNew")).focus()}
function paintAsPick(){const ts=asTasks(),n=ts.length,m=asEdit.mode;
  $("asHd").textContent=(m==="add"?"担当者を追加":m==="del"?"担当者を外す":"担当者")+(n>1?`（${n} 件のタスク）`:"");
  $("asMem").innerHTML=asNames().map(x=>{const k=ts.filter(t=>(t.assignees||[]).includes(x)).length;return`<button type="button" class="chip" data-pick="${esc(x)}" aria-pressed="${m==="del"?"false":k===n?"true":k?"mixed":"false"}">${esc(x)}</button>`}).join("")
    ||`<span class="hint">${m==="del"?"担当者がいません":"「設定」でメンバーを登録するか、下に名前を入力してください"}</span>`;
  $("asNew").hidden=m==="del"}
function asPick(n,how){const ts=asTasks(),off=how==="del"||how==="tg"&&ts.every(t=>(t.assignees||[]).includes(n));
  ts.forEach(t=>{const cur=t.assignees||[];t.assignees=off?cur.filter(x=>x!==n):cur.includes(n)?cur:[...cur,n]});paintAsPick();render()}
$("asMem").addEventListener("click",e=>{const b=e.target.closest("[data-pick]");if(b&&asEdit)asPick(b.dataset.pick,asEdit.mode)});
$("asNew").addEventListener("keydown",e=>{if(e.key!=="Enter"||!asEdit)return;e.preventDefault();names(e.target.value).forEach(n=>asPick(n,"add"));e.target.value=""});
$("asX").addEventListener("click",()=>closeAsPick());
function closeAsPick(){if(!asEdit)return;const changed=JSON.stringify(asTasks().map(t=>t.assignees||[]))!==asEdit.a0;asPop.hidden=true;asEdit=null;if(changed)save(projects[curId])}
document.addEventListener("pointerdown",e=>{if(asEdit&&!asPop.contains(e.target)&&!e.target.closest("[data-as]"))closeAsPick()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&asEdit){closeAsPick();e.stopImmediatePropagation()}}); // Esc closes the box only — the selection it works on stays

/* progress popup on the bar label */
const pgPop=$("pgPop");let pgEdit=null;
const pgTask=()=>{const p=projects[curId];return p&&pgEdit&&p.tasks.find(t=>t.id===pgEdit.id)};
function openPg(el){closePg();const t=projects[curId].tasks.find(x=>x.id===el.dataset.pg);if(!t||readOnly)return;
  pgEdit={id:t.id,p0:t.progress||0};$("pgR").value=pgEdit.p0;pgPop.hidden=false;
  const r=el.getBoundingClientRect(),w=pgPop.offsetWidth;pgPop.style.left=Math.max(16,Math.min(r.left-20,innerWidth-w-16))+"px";pgPop.style.top=below(r,pgPop)+"px";
  $("pgR").focus()}
function closePg(back){if(!pgEdit)return;const t=pgTask();pgPop.hidden=true;
  if(t&&back)t.progress=pgEdit.p0;const changed=t&&t.progress!==pgEdit.p0;pgEdit=null;
  if(changed)save(projects[curId]);else render()} // one undo step per open→close
$("pgR").addEventListener("input",()=>{const t=pgTask();if(t){t.progress=+$("pgR").value;render()}});
$("pgBack").addEventListener("click",()=>closePg(true));
document.addEventListener("pointerdown",e=>{if(pgEdit&&!pgPop.contains(e.target)&&!e.target.closest("[data-pg]"))closePg()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&pgEdit)closePg()});

/* right-click menu on the task name side */
const ctx=$("ctxMenu");let ctxId=null;
// a task icon held under the mouse for 0.2 s: the whole picture beside it (v0.0.12)
let icoT=0;const icoOff=()=>{clearTimeout(icoT);$("icoPop").hidden=true};
const icoOver=e=>{const i=e.target.closest(".ico");if(!i)return;icoOff();icoT=setTimeout(()=>{const c=imgs[i.dataset.img];if(!c?.url||!i.isConnected)return;const p=$("icoPop"),b=i.getBoundingClientRect();
  p.firstChild.src=c.url;p.hidden=false;const ph=c.h*Math.min(1,256/c.w,256/c.h)+10;p.style.left=b.right+8+"px";p.style.top=Math.max(8,Math.min(innerHeight-ph-8,b.top+b.height/2-ph/2))+"px"},200)};
[chart,chartRef].forEach(c=>{c.addEventListener("mouseover",icoOver);c.addEventListener("mouseout",e=>{if(e.target.closest(".ico"))icoOff()})}); // the overlay's icons too
chart.addEventListener("contextmenu",e=>{const o=e.target.closest("[data-open]");if(!o||readOnly||e.target.closest("input"))return;e.preventDefault();
  ctxId=o.dataset.open;if(!sel.has(ctxId))selectRow(ctxId);
  const r=derive(projects[curId]).find(x=>x.id===ctxId);$("ctxColor").hidden=!r?.parent; // 色 only for parents
  if(r?.parent)$("ctxPc").value=parColor(r);
  ctx.querySelectorAll("[data-ctx]").forEach(b=>b.disabled=document.querySelector(`#tools [data-cmd="${b.dataset.ctx}"]`).disabled); // same rules as the toolbar
  const dv=dvSel();$("ctxDv").disabled=!dv.ts.length;$("ctxDv").textContent=dv.on||!dv.ts.length?"成果物にする":"成果物を外す";
  ctx.hidden=false;
  ctx.style.left=Math.min(e.clientX,innerWidth-ctx.offsetWidth-8)+"px";ctx.style.top=Math.min(e.clientY,innerHeight-ctx.offsetHeight-8)+"px";$("ctxRename").focus()});
let ctxPreview=false; // the row shows a picked color that 決定 has not saved yet
function closeCtx(){if(ctx.hidden)return;ctx.hidden=true;if(ctxPreview){ctxPreview=false;render()}} // closing without 決定 drops the preview
$("ctxRename").addEventListener("click",()=>{closeCtx();rename(ctxId)});
$("ctxBulk").addEventListener("click",()=>{closeCtx();openBulk(ctxId)});
// deliverable tag for the whole selection: the selected tasks without sub-tasks; on = at least one of them is not tagged yet (so: tag them all), else untag
const dvSel=()=>{const p=projects[curId],par=new Set(derive(p).filter(r=>r.parent).map(r=>r.id)),ts=p.tasks.filter(t=>sel.has(t.id)&&!par.has(t.id));return{ts,on:!ts.every(t=>t.deliverable)}};
$("ctxDv").addEventListener("click",()=>{closeCtx();const{ts,on}=dvSel();if(!ts.length||readOnly)return;
  ts.forEach(t=>setDv(t,on));save(projects[curId]);toast(on?`${ts.length} 件を成果物にしました`:`${ts.length} 件を成果物から外しました`)});
ctx.addEventListener("click",e=>{const b=e.target.closest("[data-ctx]");if(!b||b.disabled)return;closeCtx();cmd(b.dataset.ctx)}); // the toolbar's commands, on the right-clicked row (or the selection it belongs to)
/* add several child tasks at once: one name per line, put under the task after its children; dates and assignees come from that task.
   Closes only with キャンセル / Esc, so a click elsewhere doesn't lose pasted lines */
const bulkPop=$("bulkPop");let bulkId=null;
function openBulk(id){const p=projects[curId],r=p&&derive(p).find(x=>x.id===id);if(!r||readOnly)return;
  if(r.level>=3){toast("これ以上深い階層にはできません");return}
  bulkId=id;$("bulkTitle").textContent=`「${r.name}」の子タスクを一括追加`;$("bulkIn").value="";bulkPop.hidden=false;
  bulkPop.style.left=Math.max(16,(innerWidth-bulkPop.offsetWidth)/2)+"px";bulkPop.style.top=Math.max(16,(innerHeight-bulkPop.offsetHeight)/3)+"px";$("bulkIn").focus()}
function closeBulk(){bulkPop.hidden=true;bulkId=null}
bulkPop.addEventListener("submit",e=>{e.preventDefault();const p=projects[curId],ts=p&&p.tasks,i=ts?ts.findIndex(t=>t.id===bulkId):-1;if(i<0||readOnly)return closeBulk();
  const r=derive(p)[i],add=$("bulkIn").value.split("\n").map(s=>s.trim()).filter(Boolean);if(!add.length)return;
  ts.splice(blockEnd(ts,i)+1,0,...add.map(name=>({id:uid(),name,start:r.start,end:r.end,...(r.startPM?{startPM:true}:{}),...(r.endAM?{endAM:true}:{}),progress:0,assignees:[...r.assignees],level:r.level+1,...($("bulkDv").checked?{deliverable:true}:{})})));
  collapsed.delete(bulkId);closeBulk();save(p);toast(`${add.length} 件の子タスクを追加しました`)});
$("bulkCancel").addEventListener("click",closeBulk);
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!bulkPop.hidden)closeBulk()});
function setParentColor(c){const p=projects[curId],t=p&&p.tasks.find(x=>x.id===ctxId);ctxPreview=false;ctx.hidden=true;if(!t)return;
  if(c)t.color=c;else delete t.color;save(p)}
// the browser's color picker has no OK button: picking only previews on the row, 決定 saves
$("ctxPc").addEventListener("input",()=>{const r=document.querySelector(`#chart .row[data-id="${CSS.escape(ctxId)}"]`);if(!r)return;
  ctxPreview=true;r.classList.add("pc");r.style.setProperty("--pc",$("ctxPc").value)});
$("ctxPcOk").addEventListener("click",()=>setParentColor($("ctxPc").value));
$("ctxPcNone").addEventListener("click",()=>setParentColor(null));
document.addEventListener("pointerdown",e=>{if(!ctx.contains(e.target))closeCtx()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeCtx()});
function rename(id){const p=projects[curId],t=p&&p.tasks.find(x=>x.id===id),tn=document.querySelector(`.row[data-id="${CSS.escape(id)}"] .tn`);if(!t||!tn)return;
  const inp=document.createElement("input");inp.className="rn";inp.value=t.name;inp.setAttribute("aria-label","タスク名");tn.replaceWith(inp);inp.focus();inp.select();
  let done=false;const end=ok=>{if(done)return;done=true;const v=inp.value.trim(),p=projects[curId],t=p&&p.tasks.find(x=>x.id===id); // looked up again: a sync may have replaced the project while the name was typed
    if(ok&&v&&t&&v!==t.name){t.name=v;save(p)}else render()};
  inp.addEventListener("keydown",e=>{if(e.key==="Enter")end(true);else if(e.key==="Escape"){e.stopPropagation();end(false)}});
  inp.addEventListener("blur",()=>end(true))}

/* メモ (v0.0.14): Markdown pages of the project in tabs (p.notes = [{id, title, md}], view.js renderMemo). Edited like the tasks: only while the project
   can be edited (a shared one: under the lock), through save(p) — so undo, the shared folder and the backups carry them. Imports never touch them */
let memoArm=false,memoHit=-1; // memoArm: 削除 pressed once; memoHit: the search hit Enter went to last
const memoDirty=()=>!!memoEd&&!!$("noteIn")&&$("noteIn").value!==memoEd.md0;
function editMemo(){const c=curNote(projects[curId]);if(!c||readOnly)return;memoEd={p:curId,id:c.id,md0:c.md};render();memoSide=mdSrc()?"l":"r";(mdSrc()?$("noteIn"):$("notePrev")).focus()}
// leaving the page being edited (完了, Esc, another tab / view / project, the lock switch) saves it — one undo step. What can't be saved is not dropped quietly
function leaveMemo(){if(!memoEd)return;const ed=memoEd,v=$("noteIn")?.value;memoEd=null;if(v==null||v===ed.md0)return;
  const p=projects[ed.p],n=p&&notesOf(p).find(x=>x.id===ed.id);
  if(!n||readOnly){navigator.clipboard?.writeText(v).catch(()=>{});toast("メモを保存できなかったため、書いた内容をクリップボードにコピーしました");return}
  n.md=v;save(p);toast("メモを保存しました（Ctrl+Z で元に戻せます）")}
function memoClick(e){const p=projects[curId];if(!p)return;const a=e.target.closest("[data-act]")?.dataset.act,t=e.target.closest("[data-note]");
  if(memoArm&&a!=="noteDel"){memoArm=false;render()}
  if(t){if(t.dataset.note!==curNote(p)?.id){leaveMemo();pickNote(t.dataset.note);memoHit=-1;render()}return}
  if(readOnly)return;
  const k=e.target.closest("[data-md]")?.dataset.md;if(k)return mdTool(k);
  if(a==="noteAdd"){leaveMemo();const ns=notesOf(p),n={id:uid(),title:"ページ"+(ns.length+1),md:""};p.notes=[...ns,n];pickNote(n.id);save(p);renameNote(n.id)}
  else if(a==="noteEdit")editMemo();
  else if(a==="noteDone"){leaveMemo();render()}
  else if(a==="noteDel"){if(!memoArm){memoArm=true;render();return}memoArm=false;const c=curNote(p);p.notes=notesOf(p).filter(n=>n!==c);save(p);toast("ページを削除しました（Ctrl+Z で元に戻せます）")}}
// a tab double-clicked: its name in a box (Enter / a click elsewhere = keep, Esc = drop); .rn keeps a sync from redrawing it away (core.js busy)
function renameNote(id){const n=notesOf(projects[curId]).find(x=>x.id===id),tb=document.querySelector(`#chart [data-note="${CSS.escape(id)}"]`);if(!n||!tb||readOnly)return;
  const inp=document.createElement("input");inp.className="rn";inp.value=n.title;inp.size=Math.max(8,String(n.title).length+2);inp.setAttribute("aria-label","ページの名前");tb.replaceWith(inp);inp.focus();inp.select();
  let done=false;const end=ok=>{if(done)return;done=true;const v=inp.value.trim(),p=projects[curId],n=p&&notesOf(p).find(x=>x.id===id);if(ok&&v&&n&&v!==n.title){n.title=v;save(p)}else render()};
  inp.addEventListener("keydown",e=>{if(e.key==="Enter")end(true);else if(e.key==="Escape"){e.stopPropagation();end(false)}});inp.addEventListener("blur",()=>end(true))}
function moveNote(id,to,after){const p=projects[curId],ns=notesOf(p),n=ns.find(x=>x.id===id);if(!n||id===to||readOnly)return;const rest=ns.filter(x=>x!==n),k=rest.findIndex(x=>x.id===to);if(k<0)return;
  rest.splice(after?k+1:k,0,n);p.notes=rest;save(p)}
// tabs are put in order by dragging them (the browser's own drag and drop), or without the mouse: Alt+← / → on a tab
let noteDrag=null;
chart.addEventListener("dragstart",e=>{const t=e.target.closest?.("[data-note]");if(!t||!view.memo||readOnly)return;noteDrag=t.dataset.note;e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain","")});
chart.addEventListener("dragover",e=>{if(noteDrag&&e.target.closest("[data-note]"))e.preventDefault()});
chart.addEventListener("drop",e=>{const t=e.target.closest("[data-note]"),id=noteDrag;noteDrag=null;if(!id||!t)return;e.preventDefault();e.stopPropagation(); // not the page's drop (a backup file)
  const r=t.getBoundingClientRect();moveNote(id,t.dataset.note,e.clientX>r.left+r.width/2)});
chart.addEventListener("dragend",()=>noteDrag=null);
chart.addEventListener("keydown",e=>{const t=e.target.closest?.("[data-note]");if(!t||!e.altKey||!["ArrowLeft","ArrowRight"].includes(e.key))return;e.preventDefault();
  const ns=notesOf(projects[curId]),i=ns.findIndex(x=>x.id===t.dataset.note),j=i+(e.key==="ArrowLeft"?-1:1);if(i<0||j<0||j>=ns.length)return;
  const id=ns[i].id;moveNote(id,ns[j].id,j>i);document.querySelector(`#chart [data-note="${CSS.escape(id)}"]`)?.focus()});
chart.addEventListener("input",e=>{const pv=$("notePrev");if(!pv)return;
  if(e.target.id==="noteIn"){pv.innerHTML=prevHtml(e.target.value);if(view.q)markHits(pv,view.q)} // the preview follows the typing
  else if(pv.contains(e.target))$("noteIn").value=mdOf(pv)}); // typed (or a box ticked) on the right: the Markdown on the left follows
// on the right only plain text comes in: pasted text is inserted as text, nothing is dropped in
chart.addEventListener("paste",e=>{if(!e.target.closest?.("#notePrev"))return;e.preventDefault();document.execCommand("insertText",false,e.clipboardData.getData("text/plain"))});
chart.addEventListener("drop",e=>{if(e.target.closest?.("#notePrev")){e.preventDefault();e.stopPropagation()}},true);
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&(e.target.id==="noteIn"||e.target.closest?.("#notePrev"))){leaveMemo();render()}});
/* the format buttons (plan 4e): on the side the cursor was in last — on the right the browser's own editing (then mdOf, as for typing), on the left the Markdown marks */
let memoSide="l",memoRange=null; // memoRange: the cursor on the right, kept while a button or the heading list has the focus
chart.addEventListener("focusin",e=>{if(e.target.id==="noteIn")memoSide="l";else if(e.target.closest?.("#notePrev"))memoSide="r"});
document.addEventListener("selectionchange",()=>{const s=getSelection(),pv=$("notePrev");if(pv&&s.rangeCount&&pv.contains(s.anchorNode))memoRange=s.getRangeAt(0).cloneRange()});
chart.addEventListener("mousedown",e=>{if(e.target.closest("[data-md]"))e.preventDefault()}); // a button doesn't take the cursor away
chart.addEventListener("change",e=>{if(!e.target.matches("[data-mdh]"))return;const v=e.target.value;e.target.value="";if(v)mdTool("h"+v)});
const MDTBL="| 見出し1 | 見出し2 | 見出し3 |\n|---|---|---|\n|  |  |  |",notTbl=()=>toast("表の中にカーソルを置いてから押してください");
function mdTool(k){const pv=$("notePrev"),ta=$("noteIn");if(!pv||!ta)return;let u;
  if(k==="src"){const on=!mdSrc();ls.set("mg.mdsrc",on?"1":"0");pv.parentElement.classList.toggle("src",on);document.querySelector('[data-md="src"]').setAttribute("aria-pressed",on);if(!on){memoSide="r";pv.focus()}return} // the text stays: only shown or not
  if(k==="link"){u=prompt("リンク先（https://…）","https://");if(!u||!/^https?:\/\/\S+$/.test(u.trim()))return;u=u.trim()}
  if(memoSide==="r"){pv.focus();if(memoRange&&pv.contains(memoRange.startContainer)){const s=getSelection();s.removeAllRanges();s.addRange(memoRange)}mdToolR(k,pv,ta,u)}
  else mdToolL(k,ta,u)}
const caretIn=s=>{const n=getSelection().anchorNode;return(n?.nodeType===3?n.parentElement:n)?.closest?.(s)}; // the element around the cursor
function mdToolR(k,pv,ta,u){const ex=(c,v)=>document.execCommand(c,false,v),txt=getSelection().toString(),at=caretIn("li,td,th");
  const sync=()=>{ta.value=mdOf(pv)};
  if(/^h\d$/.test(k))return ex("formatBlock",k==="h0"?"<p>":`<h${k[1]}>`);
  if(k==="b")return ex("bold");if(k==="i")return ex("italic");if(k==="s")return ex("strikeThrough");
  if(k==="code")return ex("insertHTML",`<code>${esc(txt||"code")}</code>`);
  if(k==="ul")return ex("insertUnorderedList");if(k==="ol")return ex("insertOrderedList");
  if(k==="task"){if(!at||at.tagName!=="LI")ex("insertUnorderedList");const li=caretIn("li");
    if(li&&pv.contains(li)&&!li.querySelector(":scope>input"))li.insertAdjacentHTML("afterbegin",'<input type="checkbox"> ');return sync()}
  if(k==="quote")return ex("formatBlock","<blockquote>");if(k==="hr")return ex("insertHorizontalRule");
  if(k==="link")return ex("insertHTML",`<a href="${esc(u)}">${esc(txt||u)}</a>`);
  if(k==="table")return ex("insertHTML",prevHtml(MDTBL));
  // a row / column of the table the cursor is in
  const tb=at?.closest("table");if(!at||at.tagName==="LI"||!tb||!pv.contains(tb))return notTbl();
  const tr=at.parentElement,ci=at.cellIndex,head=tr.parentElement.tagName==="THEAD";
  if(k==="trow"){const r=document.createElement("tr");r.innerHTML="<td></td>".repeat(tr.cells.length);if(head)(tb.tBodies[0]||tb.createTBody()).prepend(r);else tr.after(r)}
  else if(k==="tcol")[...tb.rows].forEach(r=>{const c=document.createElement(r.parentElement.tagName==="THEAD"?"th":"td");r.cells[ci]?r.cells[ci].after(c):r.append(c)});
  else if(k==="tdrow"){if(head)return toast("見出しの行は削除できません");tr.remove()}
  else if(k==="tdcol"){[...tb.rows].forEach(r=>r.cells[ci]?.remove());if(!tb.rows[0]?.cells.length)tb.remove()}
  sync()}
function mdToolL(k,ta,u){const v=ta.value,s=ta.selectionStart,e=ta.selectionEnd,a=v.lastIndexOf("\n",s-1)+1;let z=v.indexOf("\n",Math.max(s,e>s&&v[e-1]==="\n"?e-1:e));if(z<0)z=v.length;
  const put=(x,y,t,c0,c1)=>{ta.focus();ta.setSelectionRange(x,y);document.execCommand("insertText",false,t);if(c0!=null)ta.setSelectionRange(x+c0,x+c1)}; // the browser's insert: the box's own Ctrl+Z takes it back
  const strip=l=>l.replace(/^(\s*)(?:#{1,6}\s+|(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?)/,"$1");
  const mk=f=>{let i=0;put(a,z,v.slice(a,z).split("\n").map(l=>{const t=strip(l),d=t.match(/^\s*/)[0];return d+f(++i)+t.slice(d.length)}).join("\n"))}; // each line of the selection: its mark replaced
  if(/^h\d$/.test(k))return put(a,z,v.slice(a,z).split("\n").map(l=>(k==="h0"?"":"#".repeat(k[1])+" ")+strip(l).trimStart()).join("\n"));
  const w={b:"**",i:"*",s:"~~",code:"`"}[k];if(w){const t=v.slice(s,e)||"文字";return put(s,e,w+t+w,w.length,w.length+t.length)}
  if(k==="ul")return mk(()=>"- ");if(k==="ol")return mk(i=>i+". ");if(k==="task")return mk(()=>"- [ ] ");
  if(k==="quote")return put(a,z,v.slice(a,z).split("\n").map(l=>"> "+l).join("\n"));
  if(k==="hr")return put(z,z,"\n\n---\n");
  if(k==="link")return put(s,e,`[${v.slice(s,e)||u}](${u})`);
  if(k==="table")return put(z,z,(z?"\n\n":"")+MDTBL+"\n");
  // a row / column of the table the cursor is in: the table's lines read as cells and written again
  const L=v.split("\n"),li=v.slice(0,s).split("\n").length-1;let t0=li,t1=li;if(!L[li].includes("|"))return notTbl();
  while(t0>0&&L[t0-1].includes("|")&&L[t0-1].trim())t0--;while(t1<L.length-1&&L[t1+1].includes("|")&&L[t1+1].trim())t1++;
  if(t1===t0||!TS.test(L[t0+1]))return notTbl();
  const R=L.slice(t0,t1+1).map(x=>x.trim().replace(/^\|/,"").replace(/\|$/,"").split("|").map(c=>c.trim())),r=li-t0,
    col=Math.min(R[0].length-1,Math.max(0,(v.slice(a,s).match(/\|/g)||[]).length-(L[li].trim().startsWith("|")?1:0)));
  if(k==="trow")R.splice(Math.max(r,1)+1,0,R[0].map(()=>""));
  else if(k==="tcol")R.forEach((x,j)=>x.splice(col+1,0,j===1?"---":""));
  else if(k==="tdrow"){if(r<2)return toast("見出しの行は削除できません");R.splice(r,1)}
  else if(k==="tdcol")R.forEach(x=>x.splice(col,1));
  const at=n=>n?L.slice(0,n).join("\n").length+1:0;
  put(at(t0),at(t1)+L[t1].length,R[0].length?R.map(x=>"| "+x.join(" | ")+" |").join("\n"):"")}

/* long-press a task row, then drop it before / after / into another task.
   When the pressed row is part of a multi-selection, every selected block (with its children) moves, in list order. */
let rd=null,noClick=false;
function moveBlock(p,ids,tid,where){
  const ts=p.tasks,blks=ids.map(id=>{const i=ts.findIndex(t=>t.id===id);return ts.slice(i,blockEnd(ts,i)+1)}),moving=new Set(blks.flat().map(t=>t.id));
  if(moving.has(tid)){toast("移動するタスクやその子タスクの中には移動できません");return render()}
  const rest=ts.filter(t=>!moving.has(t.id));let k=rest.findIndex(t=>t.id===tid);const TL=rest[k].level||0,lv=where==="in"?TL+1:TL;
  if(where!=="before")k=blockEnd(rest,k)+1;
  if(blks.some(b=>deep(b,lv-(b[0].level||0)))){toast("これ以上深い階層にはできません");return render()}
  blks.forEach(b=>{const d=lv-(b[0].level||0);b.forEach(t=>t.level=(t.level||0)+d)});rest.splice(k,0,...blks.flat());p.tasks=rest;collapsed.delete(tid);save(p);return true;
}
const clearDrop=()=>document.querySelectorAll(".drop-before,.drop-after,.drop-in").forEach(r=>r.classList.remove("drop-before","drop-after","drop-in"));
chart.addEventListener("pointerdown",e=>{const o=e.target.closest(".lc[data-open]");
  if(!o||e.button!==0||readOnly||e.target.closest("button,input")||e.ctrlKey||e.metaKey||e.shiftKey)return;
  rd={id:o.dataset.open,x:e.clientX,y:e.clientY,on:false,t:setTimeout(()=>{const p=projects[curId];
    rd.tops=sel.has(rd.id)&&sel.size>1?topBlocks(p).map(i=>p.tasks[i].id):[rd.id]; // the blocks that move
    rd.moving=new Set(rd.tops.flatMap(id=>{const i=p.tasks.findIndex(t=>t.id===id);return p.tasks.slice(i,blockEnd(p.tasks,i)+1).map(t=>t.id)}));
    rd.on=true;document.body.classList.add("rowdrag");rd.moving.forEach(id=>document.querySelector(`#chart .row[data-id="${CSS.escape(id)}"]`)?.classList.add("grabbed"))},350)}});
document.addEventListener("pointermove",e=>{if(!rd)return; // 成果物のみ: never "in" a row — it would become a hidden parent and vanish
  if(!rd.on){if(Math.hypot(e.clientX-rd.x,e.clientY-rd.y)>5){clearTimeout(rd.t);rd=null}return}
  clearDrop();rd.to=null;const row=document.elementFromPoint(e.clientX,e.clientY)?.closest(".row[data-id]");if(!row||rd.moving.has(row.dataset.id))return;
  const b=row.getBoundingClientRect(),f=(e.clientY-b.top)/b.height;rd.to={id:row.dataset.id,w:leafView()?(f<.5?"before":"after"):f<.3?"before":f>.7?"after":"in"};row.classList.add("drop-"+rd.to.w)});
function endRowDrag(e){if(!rd)return;const d=rd;rd=null;clearTimeout(d.t);if(!d.on)return;
  document.body.classList.remove("rowdrag");clearDrop();noClick=true;setTimeout(()=>noClick=false);
  if(d.to&&e.type==="pointerup")moveBlock(projects[curId],d.tops,d.to.id,d.to.w);else render()}
document.addEventListener("pointerup",endRowDrag);document.addEventListener("keydown",e=>{if(e.key==="Escape"&&rd)endRowDrag(e)});document.addEventListener("pointercancel",endRowDrag);
chart.addEventListener("click",e=>{if(noClick)e.stopImmediatePropagation()},true); // the drop is not a click

/* task table width: drag the corner's right edge; kept in this browser */
let lwd=null;const setLw=w=>document.documentElement.style.setProperty("--lw",w+"px");
if(+ls.get("mg.lw"))setLw(+ls.get("mg.lw"));
chart.addEventListener("pointerdown",e=>{if(e.button||!e.target.classList.contains("lwh"))return;lwd={x:e.clientX,w0:e.target.closest(".corner").offsetWidth};e.preventDefault()});
document.addEventListener("pointermove",e=>{if(lwd)setLw(lwd.w=Math.round(Math.max(160,Math.min(innerWidth-120,lwd.w0+e.clientX-lwd.x))))});
document.addEventListener("pointerup",()=>{if(lwd&&lwd.w)ls.set("mg.lw",lwd.w);lwd=null});

/* drag bars */
// what moves with blocks (indexes of tasks): every task without sub-tasks in them — a parent's dates follow from those
const movers=(p,is)=>{const leaf=new Set(derive(p).filter(x=>!x.parent).map(x=>x.id));return is.flatMap(i=>p.tasks.slice(i,blockEnd(p.tasks,i)+1)).filter(x=>leaf.has(x.id))};
// the same without dragging (plan 4g): 右クリック →「日程をずらす N 日」moves the selection (with what is under selected parents) by N calendar days
function shiftSel(){const p=projects[curId],n=+$("ctxSh").value;if(!p||readOnly)return;if(!Number.isInteger(n)||!n){toast("ずらす日数を整数で入れてください（マイナスで前へ）");return}
  closeCtx();const ts=movers(p,topBlocks(p));ts.forEach(t=>setH(t,hs(t)+2*n,he(t)+2*n));save(p);
  toast(`${ts.length} 件のタスクを ${n>0?n+" 日後ろ":-n+" 日前"}へずらしました（Ctrl+Z で元に戻せます）`);if(ts.some(t=>t.id===editingId))openTask(editingId)}
$("ctxShOk").addEventListener("click",shiftSel);$("ctxSh").addEventListener("keydown",e=>{if(e.key==="Enter")shiftSel()});
let drag=null;
chart.addEventListener("pointerdown",e=>{
  const el=e.target.closest("[data-bar]");if(!el||e.button!==0)return;
  const p=projects[curId],t=p.tasks.find(x=>x.id===el.dataset.bar);
  const r=derive(p).find(x=>x.id===el.dataset.bar);
  if(!t||readOnly){drag={click:el.dataset.bar,x0:e.clientX,moved:false};return}
  const m=e.target.classList.contains("l")?"l":e.target.classList.contains("r")?"r":"m"; // a parent's bar has no ends: always "m"
  // moving (not resizing) a bar that is part of a multi-selection moves every selected task, and the tasks under selected parents; a parent's bar moves the tasks under it (v0.0.14)
  let ts=[t];const multi=sel.has(t.id)&&sel.size>1;
  if(m==="m"&&(multi||r.parent))ts=movers(p,multi?topBlocks(p):[p.tasks.indexOf(t)]);
  drag={el,t,m,x0:e.clientX,moved:false,sum:r.parent?r:null,items:ts.map(x=>({t:x,s0:hs(x),e0:he(x)}))}; // in half-day slots; sum: the parent's bar follows what is under it
  el.setPointerCapture(e.pointerId);e.preventDefault();
});
function paintBar(t,s,en){ // live position of one bar (and its label / date cells) while dragging; s, en = half-day slots
  const el=document.querySelector(`#chart [data-bar="${CSS.escape(t.id)}"]`);if(!el)return; // inside a collapsed parent
  el.classList.add("dragging");const row=el.closest(".row"),dw=range.dw,X=h=>(h/2-range.a)*dw;
  if(el.classList.contains("ms"))el.style.left=(X(en&~1)+dw/2-7)+"px";
  else{el.style.left=X(s)+"px";el.style.width=((en-s+1)*dw/2)+"px";el.querySelectorAll(".offd").forEach(o=>o.remove());el.querySelector(".fill").insertAdjacentHTML("afterend",offSegs(s,en,dw))} // the days off under it change as it moves
  const w=row.querySelector(".who");if(w){w.innerHTML=lab(t,s,en);w.style.left=(el.classList.contains("ms")?X(en&~1)+dw/2+12:X(en+1)+6)+"px"}
  const ds=row.querySelectorAll(".lc .c-d");ds[0].innerHTML=dS(s);ds[1].innerHTML=dE(en);row.querySelector(".lc .c-n").textContent=bizH(s,en);
}
chart.addEventListener("pointermove",e=>{
  if(!drag||!drag.el)return;
  const dx=e.clientX-drag.x0,dd=2*Math.round(dx/range.dw),dh=view.scale==="day"?Math.round(dx*2/range.dw):dd; // in half-day slots: dd whole days, dh half days in the 日 scale (週 / 月: whole days)
  if(Math.abs(e.clientX-drag.x0)>3){drag.moved=true;dragging=true}
  if(!drag.moved)return;
  drag.items.forEach(it=>{let s=it.s0,en=it.e0;
    if(it.t.milestone){s+=dd;en+=dd}else if(drag.m==="m"){s+=dh;en+=dh}else if(drag.m==="l"){s=Math.min(it.s0+dh,en)}else{en=Math.max(it.e0+dh,s)} // a ◆ moves by whole days
    it.ns=s;it.ne=en;paintBar(it.t,s,en)});
  if(drag.sum)paintBar(drag.sum,Math.min(...drag.items.map(it=>it.ns)),Math.max(...drag.items.map(it=>it.ne)));
});
function endDrag(e){
  if(!drag)return;const d=drag;drag=null;
  if(d.el&&d.moved&&d.items[0].ns!=null){dragging=false;const p=projects[curId]; // tasks looked up again: a sync may have replaced the project during the drag
    d.items.forEach(it=>{const t=p.tasks.find(x=>x.id===it.t.id);if(t)setH(t,it.ns,it.ne)});save(p);
    if(d.items.some(it=>it.t.id===editingId))openTask(editingId);return}
  dragging=false;selectRow(d.click||d.t.id,e); // a plain click on a bar: Ctrl / Shift select like on a row
}
chart.addEventListener("pointerup",endDrag);
chart.addEventListener("pointercancel",()=>{drag=null;dragging=false;render()});

/* ---------- selection & toolbar ---------- */
chart.addEventListener("dblclick",e=>{if(e.target.closest("input,textarea"))return;if(view.memo){const t=e.target.closest("[data-note]");if(t)renameNote(t.dataset.note);else if(e.target.closest(".mview"))editMemo();return}if(e.target.closest("[data-as]"))return;const pg=e.target.closest("[data-pg]");if(pg)return openPg(pg);const o=e.target.closest("[data-open],[data-bar]");if(o)openTask(o.dataset.open||o.dataset.bar)});
function selectRow(id,e){
  if(e&&(e.ctrlKey||e.metaKey)){sel.has(id)?sel.delete(id):sel.add(id)}
  else if(e&&e.shiftKey&&lastSel&&visOrder.includes(lastSel)){const a=visOrder.indexOf(lastSel),b=visOrder.indexOf(id);sel=new Set(visOrder.slice(Math.min(a,b),Math.max(a,b)+1))}
  else sel=new Set([id]);
  lastSel=id;delArmed=false;paintSel();
}
function paintSel(){document.querySelectorAll("#chart .row[data-id]").forEach(r=>r.classList.toggle("sel",sel.has(r.dataset.id)||r.dataset.id===editingId));renderTools();stSave()}
function blockEnd(ts,i){let j=i;while(j+1<ts.length&&(ts[j+1].level||0)>(ts[i].level||0))j++;return j}
const deep=(ts,d)=>Math.max(...ts.map(t=>(t.level||0)+d))>3; // these tasks, moved d levels in, would pass the 4th level
function selIdx(p){return p.tasks.map((t,i)=>sel.has(t.id)?i:-1).filter(i=>i>=0)}
function topBlocks(p){ // selected indices that aren't inside another selected block
  const idx=selIdx(p),out=[];let until=-1;idx.forEach(i=>{if(i>until){out.push(i);until=blockEnd(p.tasks,i)}});return out}
function newTask(level){let s=TODAY;while(isOff(s))s++;let e=s,c=1;while(c<5){e++;if(!isOff(e))c++}
  return{id:uid(),name:"新しいタスク",start:S(s),end:S(e),progress:0,assignees:[],level}}
function renderTools(){
  const p=projects[curId],n=p?selIdx(p).length:0,ro=readOnly||!p;
  document.querySelectorAll("#tools [data-cmd]").forEach(b=>{const c=b.dataset.cmd;
    const need={copy:1,insAbove:1,insBelow:1,bulk:1,indent:1,outdent:1,up:1,down:1,link:2,unlink:1,asAdd:1,asDel:1,edit:1,del:1}[c]||0;
    const h=p&&H(p.id);b.disabled=ro&&c!=="copy"||n<need||(c==="paste"&&!clip)||((c==="edit"||c==="bulk")&&n!==1)||(c==="undo"&&!(h&&h.u.length))||(c==="redo"&&!(h&&h.r.length))||(leafView()&&(c==="indent"||c==="outdent"));});
  const db2=document.querySelector('#tools [data-cmd=del]');db2.classList.toggle("arm",delArmed);db2.title=delArmed?"もう一度押すと削除":"削除（Delete を 2 回）";
  $("selInfo").textContent=n?`${n} 件選択中${delArmed?"　もう一度押すと削除します":""}`:"行をクリックで選択（Ctrl / Shift で複数）";
}
const leafView=()=>view.leaf; // 「成果物のみ」 (一覧 and the chart): the rows between the folder and the deliverables are not on screen
function cmd(c){
  const p=projects[curId];if(!p)return;log("cmd",{c,ids:[...sel].slice(0,30)});if(readOnly&&c!=="copy")return;
  const ts=p.tasks;const idx=selIdx(p);const first=idx[0],last=idx.length?blockEnd(ts,idx[idx.length-1]):-1,lastTop=ts[idx[idx.length-1]]; // lastTop: the last selected row — what is put "below the selection" becomes its sibling
  if(c!=="del")delArmed=false;
  if(leafView()&&(c==="indent"||c==="outdent")){toast("階層の変更は「成果物のみ」を解除してから行ってください");return} // the row above / below in the data may be hidden here: a row would turn into a hidden parent and vanish (same reason as no drop "into" a row)
  switch(c){
    case"copy":{if(!idx.length)return;const bl=topBlocks(p).flatMap(i=>ts.slice(i,blockEnd(ts,i)+1));clip=structuredClone(bl);toast(`${clip.length} 件をコピーしました`);renderTools();return}
    case"paste":{if(!clip)return;const map={};const items=clip.map(t=>{const n={...structuredClone(t),id:uid()};map[t.id]=n.id;return n});
      items.forEach(t=>{t.deps=(t.deps||[]).map(d=>map[d]).filter(Boolean)});
      const at=last>=0?last+1:ts.length,off=(lastTop?.level||0)-(items[0].level||0);
      if(deep(items,off)){toast("これ以上深い階層にはできません");return}
      items.forEach(t=>t.level=Math.max(0,(t.level||0)+off));ts.splice(at,0,...items);sel=new Set(items.map(t=>t.id));save(p);toast(`${items.length} 件を貼り付けました`);return}
    case"insAbove":case"insBelow":case"add":{const ref=first>=0?(c==="insAbove"?ts[first]:lastTop):ts[ts.length-1];const t=newTask(ref?ref.level||0:0);
      if(leafView())t.deliverable=true; // added in 成果物のみ: a deliverable — untagged it would not be on screen
      const at=c==="insAbove"&&first>=0?first:last>=0?last+1:ts.length;ts.splice(at,0,t);sel=new Set([t.id]);lastSel=t.id;editingId=t.id;save(p);openTask(t.id);setTimeout(()=>$("f-name").select(),30);return}
    case"indent":{topBlocks(p).forEach(i=>{const L=ts[i].level||0;if(i===0||(ts[i-1].level||0)<L)return;const j=blockEnd(ts,i);
        if(deep(ts.slice(i,j+1),1)){toast("これ以上深い階層にはできません");return} // the deepest task under it counts, not only the row itself
        for(let k=i;k<=j;k++)ts[k].level=(ts[k].level||0)+1});save(p);return}
    case"outdent":{topBlocks(p).forEach(i=>{if(!(ts[i].level>0))return;const j=blockEnd(ts,i);for(let k=i;k<=j;k++)ts[k].level--});save(p);return}
    case"up":case"down":{const i=topBlocks(p)[0];if(i==null)return;const L=ts[i].level||0,j=blockEnd(ts,i);
      if(c==="up"){let k=i-1;while(k>=0&&(ts[k].level||0)>L)k--;if(k<0||(ts[k].level||0)<L)return;const blk=ts.splice(i,j-i+1);ts.splice(k,0,...blk)}
      else{const n=j+1;if(n>=ts.length||(ts[n].level||0)!==L)return;const m=blockEnd(ts,n);const blk=ts.splice(i,j-i+1);ts.splice(m-(j-i),0,...blk)}
      save(p);return}
    case"link":{const par=new Set(derive(p).filter(r=>r.parent).map(r=>r.id)),ids=[...sel].map(id=>ts.find(t=>t.id===id)).filter(t=>t&&!par.has(t.id)); /* in the order they were selected */if(ids.length<2){toast("子タスクのない行を 2 つ以上選んでください");return}
      const byId=Object.fromEntries(ts.map(t=>[t.id,t]));let n=0; // a link that would close a loop (A→B→A) is left out
      for(let k=1;k<ids.length;k++)if(!reach(byId,ids[k-1].id,ids[k].id)){ids[k].deps=[...new Set([...(ids[k].deps||[]),ids[k-1].id])];n++}
      if(n)save(p);toast(n<ids.length-1?"循環するリンクは作成しませんでした":`${ids.length} 件をリンクしました`);return}
    case"unlink":{ts.forEach(t=>{if(sel.has(t.id))t.deps=[];else if(t.deps)t.deps=t.deps.filter(d=>!sel.has(d))});save(p);toast("リンクを解除しました");return}
    case"undo":case"redo":{undo(c==="redo");return}
    case"edit":{if(idx.length===1)openTask(ts[first].id);return}
    case"bulk":{if(idx.length===1)openBulk(ts[first].id);return}
    case"asAdd":case"asDel":{openAsPick(document.querySelector(`#tools [data-cmd="${c}"]`),c==="asAdd"?"add":"del");return}
    case"del":{if(!idx.length)return;if(!delArmed){delArmed=true;renderTools();return}
      const kill=new Set();topBlocks(p).forEach(i=>{for(let k=i;k<=blockEnd(ts,i);k++)kill.add(ts[k].id)});
      p.tasks=ts.filter(t=>!kill.has(t.id));p.tasks.forEach(t=>{if(t.deps)t.deps=t.deps.filter(d=>!kill.has(d))});
      sel=new Set();delArmed=false;if(kill.has(editingId))closeDrawer();save(p);toast(`${kill.size} 件を削除しました`);return}
  }
}
$("tools").addEventListener("click",e=>{const b=e.target.closest("[data-cmd]");if(b&&!b.disabled)cmd(b.dataset.cmd)});
document.addEventListener("keydown",e=>{
  if(view.memo||e.target.closest("input,textarea,select")||!drawer.hidden||!pop.hidden||!bulkPop.hidden||!dropPop.hidden||!ctx.hidden||asEdit||pgEdit||!sel.size)return; // a popup is open: Tab / Enter / Delete belong to it
  const k=e.key,mod=e.ctrlKey||e.metaKey;
  if(mod&&k.toLowerCase()==="c"){cmd("copy");e.preventDefault()}
  else if(mod&&k.toLowerCase()==="v"){cmd("paste");e.preventDefault()}
  else if(k==="Tab"){cmd(e.shiftKey?"outdent":"indent");e.preventDefault()}
  else if(e.altKey&&k==="ArrowUp"){cmd("up");e.preventDefault()}
  else if(e.altKey&&k==="ArrowDown"){cmd("down");e.preventDefault()}
  else if(k==="Delete"||k==="Backspace"){cmd("del");e.preventDefault()}
  else if(k==="Enter"){cmd("edit");e.preventDefault()}
  else if(k==="Escape"){sel=new Set();delArmed=false;paintSel()}
});

document.addEventListener("keydown",e=>{
  if(!(e.ctrlKey||e.metaKey)||e.altKey||e.target.closest("input,textarea,select,[contenteditable]")||!pop.hidden||drag)return;const k=e.key.toLowerCase();
  if(k==="z"&&!e.shiftKey){undo(false);e.preventDefault()}else if(k==="y"||(k==="z"&&e.shiftKey)){undo(true);e.preventDefault()}
});
