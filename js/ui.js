// Interactions: drawer forms, members, milestones, popups, context menu, drag & drop, selection, toolbar, keyboard.
/* ---------- actions ---------- */
function setCur(id){if(sh.mine&&sh.mine!==id)shUnlock();lkArmed=false;lkWas="";view.q=$("qIn").value="";curId=id;ls.set("mg.cur",id||"");closeDrawer();render()}
function newProject(){
  if(storeRO)return;
  const id=uid();projects[id]={id,name:"新しいプロジェクト",tasks:[]};setCur(id);save(projects[id]);openProject();
}
const drawer=$("drawer");
const setTgl=()=>$("projSet").setAttribute("aria-expanded",!$("projForm").hidden); // the 設定 button shows a cross while its panel is open
function closeDrawer(){drawer.hidden=true;$("taskForm").hidden=true;$("projForm").hidden=true;setTgl();if(editingId){editingId=null;render()}}
function armReset(){document.querySelectorAll(".danger").forEach(b=>{b.classList.remove("arm");b.textContent=b.id==="projDel"?"このプロジェクトを削除":"削除"})}
function openTask(id){
  const p=projects[curId],all=derive(p),r=all.find(x=>x.id===id);if(!r)return;
  editingId=id;armReset();
  drawer.hidden=false;$("projForm").hidden=true;$("taskForm").hidden=false;setTgl();
  parOpts(all,r);FF.forEach(([k,get])=>fset(k,get(r,all)));formInit=Object.fromEntries(FF.map(([k])=>[k,fval(k)]));
  ["f-s","f-e","f-p","f-ms","f-dv"].forEach(k=>$(k).disabled=!!r.parent||readOnly);$("f-pa").disabled=readOnly;
  formExtras(r);
  render();
}
/* task form fields; while the form is open, fields the user has not touched follow changes made elsewhere
   (right-click rename, 担当 box, progress slider…), so 保存 never writes stale values back */
const FF=[["f-pa",(r,all)=>parId(all,r)],["f-name",r=>r.name],["f-as",r=>r.assignees.join("、")],["f-s",r=>r.start],["f-e",r=>r.end],["f-p",r=>String(r.progress)],["f-ms",r=>!!r.milestone],["f-dv",r=>!!r.deliverable],["f-memo",r=>r.memo||""]];
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
}
function bizHint(){const s=$("f-s").value,e=$("f-e").value;if(!s||!e)return"";if(e<s)return"終了日が開始日より前です";return`${biz(D(s),D(e))} 営業日（土日祝・会社の休日を除く）`}
function openProject(){
  const p=projects[curId];armReset();
  drawer.hidden=false;$("taskForm").hidden=true;$("projForm").hidden=false;setTgl();
  document.querySelectorAll("#projForm .pj").forEach(e=>e.hidden=!p);$("projDel").hidden=!p; // without a project: only this PC's folders and ＋ プロジェクト
  bkInfo();shInfo();if(!p)return;$("p-name").value=p.name||"";$("p-json").value=JSON.stringify({name:p.name,members:roster(p),tasks:p.tasks,milestones:p.milestones||[],holidays:p.holidays||[]},null,1);rosterChips();
}
$("f-s").addEventListener("input",()=>{if($("f-e").value<$("f-s").value)$("f-e").value=$("f-s").value;$("f-biz").textContent=bizHint()});
$("f-e").addEventListener("input",()=>$("f-biz").textContent=bizHint());
$("f-p").addEventListener("input",()=>$("f-po").textContent=$("f-p").value+"%");
/* member roster: kept per project, picked from in the task form */
function memChips(){const p=projects[curId],cur=names($("f-as").value);
  $("f-mem").innerHTML=[...new Set([...roster(p),...cur])].map(n=>`<button type="button" class="chip" data-mem="${esc(n)}" aria-pressed="${cur.includes(n)}">${esc(n)}</button>`).join("")}
$("f-as").addEventListener("input",memChips);
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
$("taskForm").addEventListener("submit",e=>{
  e.preventDefault();const p=projects[curId];const t=p&&p.tasks.find(x=>x.id===editingId);if(!t||readOnly)return;
  t.name=$("f-name").value.trim()||"無題";
  t.assignees=names($("f-as").value);
  if(!$("f-s").disabled){let s=$("f-s").value||t.start,en=$("f-e").value||t.end;if(en<s)en=s;t.start=s;t.end=en;t.progress=+$("f-p").value;t.milestone=$("f-ms").checked;setDv(t,$("f-dv").checked)}
  t.memo=$("f-memo").value;
  // 親 changed: move under it (after its children); （なし） = top level, right after the top-level task it was under. moveBlock saves — one undo step with the fields
  const pa=$("f-pa").value,top=()=>{const ts=p.tasks;let i=ts.indexOf(t);while(ts[i].level>0)i--;return ts[i].id};
  if(pa===formInit["f-pa"]||!moveBlock(p,[t.id],pa||top(),pa?"in":"after"))save(p);
  toast("保存しました");closeDrawer();
});
$("taskDel").addEventListener("click",e=>{
  const b=e.currentTarget;if(!b.classList.contains("arm")){b.classList.add("arm");b.textContent="もう一度押すと削除";return}
  const p=projects[curId];p.tasks=p.tasks.filter(t=>t.id!==editingId);save(p);closeDrawer();toast("削除しました");
});
$("projForm").addEventListener("submit",e=>{e.preventDefault();const p=projects[curId];if(readOnly)return;p.name=$("p-name").value.trim()||"無題";save(p);toast("保存しました");closeDrawer()});
$("p-copy").addEventListener("click",()=>{const v=$("p-json").value;navigator.clipboard.writeText(v).then(()=>toast("コピーしました"),()=>{$("p-json").select();toast("選択しました。Ctrl+C でコピーしてください")})});
/* replace the current project's tasks (and milestones / members / name when given); shared by JSON and Excel import */
function replaceData(d){
  const p=projects[curId];if(!p||readOnly)return;const tasks=Array.isArray(d)?d:d.tasks;if(!Array.isArray(tasks))throw 0;
  p.tasks=tasks.filter(t=>t&&t.name&&isDay(t.start)&&isDay(t.end)).map(t=>({id:t.id?String(t.id):uid(),name:String(t.name),start:t.start,end:t.end,progress:Math.max(0,Math.min(100,+t.progress||0)),assignees:Array.isArray(t.assignees)?t.assignees.map(String):[],level:+t.level||0,milestone:!!t.milestone,memo:t.memo||"",deps:Array.isArray(t.deps)?t.deps.map(String):[],...(isHex(t.color)?{color:t.color}:{}),...(t.deliverable?{deliverable:true}:{})}));
  if(Array.isArray(d.milestones))p.milestones=d.milestones.filter(m=>m&&isDay(m.date)).map(m=>({id:m.id||uid(),date:m.date,title:String(m.title||""),color:MSC.includes(m.color)?m.color:"blue"}));
  if(Array.isArray(d.members))p.members=d.members.map(String);
  if(Array.isArray(d.holidays))p.holidays=d.holidays.filter(h=>h&&isDay(h.date)).map(h=>({date:h.date,color:isHex(h.color)?h.color:HOLC}));
  if(d.name)p.name=String(d.name);save(p);closeDrawer();
  const bad=tasks.length-p.tasks.length;toast(`${p.tasks.length} 件のタスクを読み込みました`+(bad?`（${bad} 件は名前か日付が正しくないため読み込みませんでした）`:""));
}
$("p-import").addEventListener("click",()=>{
  try{replaceData(JSON.parse($("p-json").value))}catch(err){toast("JSONを読み取れませんでした。形式を確認してください")}
});
/* Excel in Brabio's export layout: rows 1–2 title / period, row 3 headers A–Q, data from row 5 — project row, milestones, then folders / tasks.
   Brabio's day-by-day chart (column R on) is not written. Columns R–T here are Tempo's own ◆ flag, parent color and deliverable tag (○), which Brabio has no field for.
   Import finds columns by header name, so Brabio's own exports load too. */
const XCOL=["タイプ","アウトライン","ID","タイトル","開始日","〆切日","ステータス","進捗率","状況","完了日","メンバー","内容","完了メンバー","完了メンバーID","メンバーID","リンクID","固定リンクID","マイルストーン","色","成果物"];
const xnow=()=>{const[y,m,d,h,mi]=bkStamp().split(/[-_]/);return`${y}年${m}月${d}日 ${h}時${mi}分`}; // when the sheet was written
function toXlsx(p){
  const{pct,mn,mx}=overall(p),has=isFinite(mn),ps=has?S(mn):"",pe=has?S(mx):"";
  const jd=s=>`${s.slice(0,4)}年${s.slice(5,7)}月${s.slice(8,10)}日`,day=s=>s?{date:s}:"";
  return xlsxBlob([[p.name||""],[has?`${jd(ps)} ～ ${jd(pe)} （${xnow()}）`:""],XCOL,[],
    ["project",0,p.id,p.name||"",day(ps),day(pe),"",pct,has?ST[status({start:ps,end:pe,progress:pct})]:"","",roster(p).join("\n")],
    ...[...(p.milestones||[])].sort((a,b)=>a.date<b.date?-1:1).map(m=>["milestone",1,"",m.title,day(m.date),day(m.date),"","","","","",m.color||"blue"]),
    ...derive(p).map(r=>[r.parent?"folder":"task",r.level+1,r.id,r.name,day(r.start),day(r.end),r.progress>=100?"完了":r.progress>0?"作業中":"未着手",r.progress,ST[r.st],"",
      r.parent?"":r.assignees.join("\n"),r.memo||"","","","",(r.deps||[]).join("\n"),"",r.milestone?"◆":"",isHex(r.color)?r.color:"",r.deliverable?"○":""])],
    {widths:[9,6,12,36,11,11,9,7,9,11,16,30,12,12,12,12,12,8,9,8],head:2,freeze:4});
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
      progress:Math.round(parseFloat(g("進捗率"))||0),assignees:names(s("メンバー")),milestone:/^(◆|1|true)$/i.test(s("マイルストーン")),deliverable:/^(○|〇|1|true)$/i.test(s("成果物")),color:s("色"),memo:String(g("内容")),
      deps:(s("リンクID")+" "+s("固定リンクID")).split(/[\s,、]+/).filter(Boolean)}); // 固定リンク (red, fixed gap) loads as a normal link
  });
  return d;
}
/* 一覧: a sheet for reading only (not importable): titles indented by level, fewer columns */
function toListXlsx(p){const day=s=>s?{date:s}:"";
  return xlsxBlob([[p.name||""],[`${xnow()}　※閲覧用（Tempo には読み込めません）`],
    ["ID","タイトル","担当","開始日","〆切日","営業日","進捗率","状況"],
    ...derive(p).map(r=>[r.id,"　".repeat(r.level)+r.name,r.assignees.join("、"),day(r.start),day(r.end),biz(D(r.start),D(r.end)),r.progress,ST[r.st]])],
    {widths:[13,52,16,11,11,7,7,9],head:2});
}
function xdl(blob,p,tag){const{mn,mx}=overall(p),a=document.createElement("a");a.href=URL.createObjectURL(blob);
  a.download=((p.name||"Tempo")+tag+(isFinite(mn)?` (${S(mn)}～${S(mx)})`:"")).replace(/[\\/:*?"<>|]/g,"_")+".xlsx";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
$("p-xout").addEventListener("click",()=>{const p=projects[curId];if(p)xdl(toXlsx(p),p,"")});
$("p-xlist").addEventListener("click",()=>{const p=projects[curId];if(p)xdl(toListXlsx(p),p," 一覧")});
$("p-xin").addEventListener("click",()=>$("p-xfile").click());
$("p-xfile").addEventListener("change",async e=>{const f=e.target.files[0];e.target.value="";if(!f)return;
  try{replaceData(await fromXlsx(await f.arrayBuffer()))}catch(err){toast("Excelを読み取れませんでした。「タイプ」「タイトル」の列がある .xlsx（Brabio 形式）か確認してください")}});
/* backup folder (storage.js): pick it, 保存 button, what was saved last, restore from any saved file */
function bkInfo(){
  $("saveBtn").hidden=!window.showDirectoryPicker;
  // short status only: the explanations are in the buttons' tooltips (the user found the panel too wordy)
  $("bk-info").textContent=!window.showDirectoryPicker?"Chrome / Edge で使えます"
    :!bk.dir?"未設定"
    :!bk.ok?`「${bk.dir.name}」　次の編集時に許可を確認`
    :`「${bk.dir.name}」　自動 ${bk.last||"—"}　手動 ${bk.saved||"—"}`}
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
  Object.entries(all).forEach(([id,p])=>{projects[id]={id,name:String(p.name||"無題"),tasks:p.tasks,milestones:Array.isArray(p.milestones)?p.milestones:[],holidays:Array.isArray(p.holidays)?p.holidays:[],...(Array.isArray(p.members)?{members:p.members}:{}),...(projects[id]?.shared?{shared:true,rev:projects[id].rev}:{})};save(projects[id])});
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
  $("sh-where").textContent=p?.shared?"保存場所：共有フォルダ":"保存場所：このブラウザ";
  $("sh-info").textContent=location.host?"共有ドライブ上の Tempo.html を直接開いています。共有フォルダを使うには Tempo.bat から開いてください" // page opened from a network path: Chrome won't let it use folders
    :!sh.dir?"未設定":`「${sh.dir.name}」　共有プロジェクト ${Object.keys(sh.data).length} 件`;
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
drawer.addEventListener("click",e=>{if(e.target.closest("[data-close]"))closeDrawer()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!drawer.hidden)closeDrawer()});

$("projSel").addEventListener("change",e=>setCur(e.target.value));
$("projNew").addEventListener("click",newProject);
$("projSet").addEventListener("click",()=>$("projForm").hidden?openProject():closeDrawer()); // it shows a cross while open: pressing it again closes
$("meSel").addEventListener("change",e=>{me=e.target.value;ls.set("mg.me",me);render()});
$("whoSel").addEventListener("change",e=>{view.who=e.target.value;render()});
document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>{view.list=b.dataset.view==="list";ls.set("mg.view",view.list?"list":"gantt");render()}));
$("leafBtn").addEventListener("click",()=>{view.leaf=!view.leaf;ls.set("mg.leaf",view.leaf?"1":"");render()}); // 一覧: only the top folders and the tagged tasks (deliverables)
$("todayBtn").addEventListener("click",scrollToToday);
document.querySelectorAll("[data-scale]").forEach(b=>b.addEventListener("click",()=>{view.scale=b.dataset.scale;ls.set("mg.scale",view.scale);render()}));
$("qIn").addEventListener("input",e=>{view.q=e.target.value.trim().toLowerCase();render()}); // search this project by task name
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
const chart=$("chart");
chart.addEventListener("click",e=>{
  if(e.target.closest("[data-pg]"))return;
  if(e.target.closest("[data-ids]")){view.ids=!view.ids;ls.set("mg.ids",view.ids?"1":"");render();return} // 一覧: fold / unfold the ID column
  const dn=e.target.closest("[data-done]");if(dn){const p=projects[curId],t=p.tasks.find(x=>x.id===dn.dataset.done); // 一覧: 完了 checkbox
    if(t&&!readOnly){t.progress=dn.checked?100:0;save(p);
      // the save drew the row again with the box already in its new state, so the box → tick motion never ran: put the new box
      // back to the old state without motion (.still), then let it go to the new one
      const n=document.querySelector(`[data-done="${CSS.escape(t.id)}"]`);if(n){n.classList.add("still");n.checked=!n.checked;void n.offsetWidth;n.classList.remove("still");n.checked=!n.checked}}
    return}
  const lk=e.target.closest("[data-lk]");if(lk){const id=curId; // edit lock, the switch in the corner: mine = end editing / nobody's = take it / someone else's = release (twice)
    if(lk.dataset.lk==="end")shUnlock().then(()=>{render();toast("編集を終了しました")});
    else if(lk.dataset.lk==="take")shRun(()=>shLock(id)).then(()=>{render();toast("ロックしました（編集中）")},err=>toast(err.code==="locked"?`${err.by||"ほかの人"}さんが編集中です`:"ロックできませんでした")); // the switch, off: lock now, without an edit
    else if(!lkArmed){lkArmed=true;render()}
    else{lkArmed=false;shForce(id).then(()=>{render();toast("ロックを解除しました")},()=>toast("ロックを解除できませんでした"))}
    return}
  const as=e.target.closest("[data-as]");if(as){asEdit&&asEdit.id===as.dataset.as?closeAsPick():openAsPick(as);return}
  const fl=e.target.closest("[data-ms]");if(fl){openMs(null,fl.dataset.ms,e.clientX,e.clientY);return}
  const ht=e.target.closest("#ht");if(ht&&range){const n=range.a+Math.floor((e.clientX-ht.getBoundingClientRect().left)/range.dw);if(n>=range.a&&n<=range.b)openMs(S(n),null,e.clientX,e.clientY);return}
  if(e.target.closest("[data-act=newproj]"))return newProject();
  if(e.target.closest("[data-act=add]"))return cmd("add");
  const tg=e.target.closest("[data-tg]");if(tg){const id=tg.dataset.tg;collapsed.has(id)?collapsed.delete(id):collapsed.add(id);render();return}
  const o=e.target.closest("[data-open]");if(o)selectRow(o.dataset.open,e);
});

// just under the anchor, or above it when there is no room below
const below=(r,el)=>r.bottom+6+el.offsetHeight>innerHeight-8?Math.max(8,r.top-6-el.offsetHeight):r.bottom+6;
/* assignee picker on the 担当 cell: pick from the roster, saved as one step on close */
const asPop=$("asPop");let asEdit=null;
const asTask=()=>{const p=projects[curId];return p&&asEdit&&p.tasks.find(t=>t.id===asEdit.id)};
function openAsPick(el){closeAsPick();const t=projects[curId].tasks.find(x=>x.id===el.dataset.as);if(!t||readOnly)return;
  asEdit={id:t.id,a0:JSON.stringify(t.assignees||[])};paintAsPick();asPop.hidden=false;
  const r=el.getBoundingClientRect();asPop.style.left=Math.max(16,Math.min(r.left,innerWidth-asPop.offsetWidth-16))+"px";asPop.style.top=below(r,asPop)+"px";
  asPop.querySelector("button")?.focus()}
function paintAsPick(){const p=projects[curId],cur=asTask().assignees||[];
  $("asMem").innerHTML=[...new Set([...roster(p),...cur])].map(n=>`<button type="button" class="chip" data-pick="${esc(n)}" aria-pressed="${cur.includes(n)}">${esc(n)}</button>`).join("")||`<span class="hint">「設定」でメンバーを登録してください</span>`}
$("asMem").addEventListener("click",e=>{const b=e.target.closest("[data-pick]"),t=asTask();if(!b||!t)return;const n=b.dataset.pick,cur=t.assignees||[];
  t.assignees=cur.includes(n)?cur.filter(x=>x!==n):[...cur,n];paintAsPick();render()});
function closeAsPick(){if(!asEdit)return;const t=asTask(),changed=t&&JSON.stringify(t.assignees||[])!==asEdit.a0;asPop.hidden=true;asEdit=null;if(changed)save(projects[curId])}
document.addEventListener("pointerdown",e=>{if(asEdit&&!asPop.contains(e.target)&&!e.target.closest("[data-as]"))closeAsPick()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&asEdit)closeAsPick()});

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
  ts.splice(blockEnd(ts,i)+1,0,...add.map(name=>({id:uid(),name,start:r.start,end:r.end,progress:0,assignees:[...r.assignees],level:r.level+1,...($("bulkDv").checked?{deliverable:true}:{})})));
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
  const b=row.getBoundingClientRect(),f=(e.clientY-b.top)/b.height;rd.to={id:row.dataset.id,w:view.list&&view.leaf?(f<.5?"before":"after"):f<.3?"before":f>.7?"after":"in"};row.classList.add("drop-"+rd.to.w)});
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
let drag=null;
chart.addEventListener("pointerdown",e=>{
  const el=e.target.closest("[data-bar]");if(!el||e.button!==0)return;
  const p=projects[curId],t=p.tasks.find(x=>x.id===el.dataset.bar);
  const r=derive(p).find(x=>x.id===el.dataset.bar);
  if(!t||r.parent||readOnly){drag={click:el.dataset.bar,x0:e.clientX,moved:false};return}
  const m=e.target.classList.contains("l")?"l":e.target.classList.contains("r")?"r":"m";
  // moving (not resizing) a bar that is part of a multi-selection moves every selected task, and the tasks under selected parents
  let ts=[t];
  if(m==="m"&&sel.has(t.id)&&sel.size>1){const leaf=new Set(derive(p).filter(x=>!x.parent).map(x=>x.id));
    ts=topBlocks(p).flatMap(i=>p.tasks.slice(i,blockEnd(p.tasks,i)+1)).filter(x=>leaf.has(x.id))}
  drag={el,t,m,x0:e.clientX,moved:false,items:ts.map(x=>({t:x,s0:D(x.start),e0:D(x.end)}))};
  el.setPointerCapture(e.pointerId);e.preventDefault();
});
function paintBar(t,s,en){ // live position of one bar (and its label / date cells) while dragging
  const el=document.querySelector(`#chart [data-bar="${CSS.escape(t.id)}"]`);if(!el)return; // inside a collapsed parent
  el.classList.add("dragging");const row=el.closest(".row"),X=n=>(n-range.a)*range.dw;
  if(el.classList.contains("ms"))el.style.left=(X(en)+range.dw/2-7)+"px";
  else{el.style.left=X(s)+"px";el.style.width=((en-s+1)*range.dw)+"px"}
  const w=row.querySelector(".who");if(w){w.innerHTML=lab(t,s,en);w.style.left=(el.classList.contains("ms")?X(en)+range.dw/2+12:X(en+1)+6)+"px"}
  const ds=row.querySelectorAll(".lc .c-d");ds[0].textContent=md(s);ds[1].textContent=md(en);row.querySelector(".lc .c-n").textContent=biz(s,en);
}
chart.addEventListener("pointermove",e=>{
  if(!drag||!drag.el)return;
  const dd=Math.round((e.clientX-drag.x0)/range.dw);
  if(Math.abs(e.clientX-drag.x0)>3){drag.moved=true;dragging=true}
  if(!drag.moved)return;
  drag.items.forEach(it=>{let s=it.s0,en=it.e0;
    if(drag.m==="m"||it.t.milestone){s+=dd;en+=dd}else if(drag.m==="l"){s=Math.min(it.s0+dd,en)}else{en=Math.max(it.e0+dd,s)}
    it.ns=s;it.ne=en;paintBar(it.t,s,en)});
});
function endDrag(e){
  if(!drag)return;const d=drag;drag=null;
  if(d.el&&d.moved&&d.items[0].ns!=null){dragging=false;const p=projects[curId]; // tasks looked up again: a sync may have replaced the project during the drag
    d.items.forEach(it=>{const t=p.tasks.find(x=>x.id===it.t.id);if(t){t.start=S(it.ns);t.end=S(it.ne)}});save(p);
    if(d.items.some(it=>it.t.id===editingId))openTask(editingId);return}
  dragging=false;selectRow(d.click||d.t.id,e); // a plain click on a bar: Ctrl / Shift select like on a row
}
chart.addEventListener("pointerup",endDrag);
chart.addEventListener("pointercancel",()=>{drag=null;dragging=false;render()});

/* ---------- selection & toolbar ---------- */
chart.addEventListener("dblclick",e=>{if(e.target.closest("input"))return;if(e.target.closest("[data-as]"))return;const pg=e.target.closest("[data-pg]");if(pg)return openPg(pg);const o=e.target.closest("[data-open],[data-bar]");if(o)openTask(o.dataset.open||o.dataset.bar)});
function selectRow(id,e){
  if(e&&(e.ctrlKey||e.metaKey)){sel.has(id)?sel.delete(id):sel.add(id)}
  else if(e&&e.shiftKey&&lastSel&&visOrder.includes(lastSel)){const a=visOrder.indexOf(lastSel),b=visOrder.indexOf(id);sel=new Set(visOrder.slice(Math.min(a,b),Math.max(a,b)+1))}
  else sel=new Set([id]);
  lastSel=id;delArmed=false;paintSel();
}
function paintSel(){document.querySelectorAll("#chart .row[data-id]").forEach(r=>r.classList.toggle("sel",sel.has(r.dataset.id)||r.dataset.id===editingId));renderTools()}
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
const leafView=()=>view.list&&view.leaf; // 一覧「成果物のみ」: the rows between the folder and the deliverables are not on screen
function cmd(c){
  const p=projects[curId];if(!p)return;if(readOnly&&c!=="copy")return;
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
    case"asAdd":case"asDel":{openAs(c);return}
    case"del":{if(!idx.length)return;if(!delArmed){delArmed=true;renderTools();return}
      const kill=new Set();topBlocks(p).forEach(i=>{for(let k=i;k<=blockEnd(ts,i);k++)kill.add(ts[k].id)});
      p.tasks=ts.filter(t=>!kill.has(t.id));p.tasks.forEach(t=>{if(t.deps)t.deps=t.deps.filter(d=>!kill.has(d))});
      sel=new Set();delArmed=false;if(kill.has(editingId))closeDrawer();save(p);toast(`${kill.size} 件を削除しました`);return}
  }
}
$("tools").addEventListener("click",e=>{const b=e.target.closest("[data-cmd]");if(b&&!b.disabled)cmd(b.dataset.cmd)});
let asMode=null;
function openAs(m){const p=projects[curId];asMode=m;$("asForm").hidden=false;
  const names=[...new Set(selIdx(p).flatMap(i=>p.tasks[i].assignees||[]))];
  $("asLbl").textContent=m==="asAdd"?"担当者を追加：":"外す担当者：";$("asIn").hidden=m!=="asAdd";$("asSel").hidden=m==="asAdd";
  $("asSel").innerHTML=names.map(n=>`<option>${esc(n)}</option>`).join("");$("asOk").textContent=m==="asAdd"?"追加":"外す";
  if(m==="asDel"&&!names.length){$("asForm").hidden=true;toast("選択中のタスクに担当者がいません");return}
  $("asIn").value="";setTimeout(()=>(m==="asAdd"?$("asIn"):$("asSel")).focus(),20);}
$("asCancel").addEventListener("click",()=>{$("asForm").hidden=true});
$("asForm").addEventListener("submit",e=>{e.preventDefault();const p=projects[curId];
  if(asMode==="asAdd"){const add=names($("asIn").value);if(!add.length)return;
    selIdx(p).forEach(i=>{const t=p.tasks[i];t.assignees=[...new Set([...(t.assignees||[]),...add])]})}
  else{const n=$("asSel").value;selIdx(p).forEach(i=>{const t=p.tasks[i];t.assignees=(t.assignees||[]).filter(a=>a!==n)})}
  $("asForm").hidden=true;save(p);toast("担当者を更新しました")});
document.addEventListener("keydown",e=>{
  if(e.target.closest("input,textarea,select")||!drawer.hidden||!pop.hidden||!bulkPop.hidden||!dropPop.hidden||!ctx.hidden||asEdit||pgEdit||!sel.size)return; // a popup is open: Tab / Enter / Delete belong to it
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
  if(!(e.ctrlKey||e.metaKey)||e.altKey||e.target.closest("input,textarea,select")||!pop.hidden||drag)return;const k=e.key.toLowerCase();
  if(k==="z"&&!e.shiftKey){undo(false);e.preventDefault()}else if(k==="y"||(k==="z"&&e.shiftKey)){undo(true);e.preventDefault()}
});
