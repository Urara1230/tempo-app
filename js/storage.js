// Storage: where project data lives. Every backend has the same three methods, so adding a new
// place (a file on a shared drive, a small server…) means adding one entry here — nothing else changes.
//   open(onData) → Promise<{readOnly}>   call onData({id: project, …}) with all projects now, and again when they change elsewhere
//   put(id, data) → Promise               save one project (data = body(p), no id inside)
//   remove(id)    → Promise               delete one project
const backends={
  // this browser's localStorage. Chrome/Edge share it across every locally opened file.
  local:{
    label:"このブラウザに保存",
    read(){try{return JSON.parse(ls.get("mg.projects"))}catch(e){return null}},
    write(all){ls.set("mg.projects",JSON.stringify(all))},
    // projects in the shared folder (see sh below) come along with this browser's own; put / remove go to where the project lives
    async open(onData){sh.emit=()=>onData({...(this.read()||{}),...shProjects()});sh.emit();return{readOnly:false}}, // first run starts empty: no sample data ships with the repo
    async put(id,data){if(isShared(id))return shRun(()=>shPut(id,data));const all=this.read()||{};all[id]={id,...data};this.write(all)},
    async remove(id){if(isShared(id))return shRun(()=>shRemove(id));const all=this.read()||{};delete all[id];this.write(all)},
  },
  // published as a claude.ai Artifact: shared cloud db, live sync between viewers.
  cloud:{
    label:"クラウドに自動保存",
    db:null,
    async open(onData){
      this.db=await window.claude.use("db");if(!this.db)throw new Error("no db");
      this.db.collection("projects").onSnapshot(s=>onData(Object.fromEntries(s.docs.map(d=>[d.id,{id:d.id,...JSON.parse(JSON.stringify(d.data()))}]))),
        ()=>toast("データの同期が止まりました。再読み込みしてください"));
      let readOnly=false;try{const u=await window.claude.use("user");if(u&&u.can&&await u.can("data.write")===false)readOnly=true}catch(e){}
      return{readOnly};
    },
    put(id,data){return this.db.doc("projects/"+id).set(data)},
    remove(id){return this.db.doc("projects/"+id).delete()},
  },
};

// Backup folder (Chrome / Edge): every change overwrites <folder>/auto.backup.json; the 保存 button adds <folder>/YYYY-MM-DD_HH-MM-SS.backup.json.
// The folder handle is kept in IndexedDB; after a browser restart Chrome asks once, on the first edit, to allow the folder again.
const bk={dir:null,ok:false,asked:false,timer:null,last:null,saved:null}; // last = time of the auto save, saved = file of the last 保存
function kv(mode,fn){return new Promise((ok,ng)=>{const r=indexedDB.open("tempo",1);r.onupgradeneeded=()=>r.result.createObjectStore("kv");r.onerror=()=>ng(r.error);
  r.onsuccess=()=>{const tx=r.result.transaction("kv",mode),q=fn(tx.objectStore("kv"));tx.oncomplete=()=>ok(q.result);tx.onerror=()=>ng(tx.error)}})}
const bkStamp=()=>{const d=new Date(),z=n=>String(n).padStart(2,"0");return`${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}_${z(d.getHours())}-${z(d.getMinutes())}-${z(d.getSeconds())}`};
async function bkWrite(name){const f=await bk.dir.getFileHandle(name,{create:true}),w=await f.createWritable();
  await w.write(JSON.stringify(Object.fromEntries(Object.entries(projects).map(([id,p])=>[id,{id,...body(p)}])),null,1));await w.close()}
function backupSoon(){ // runs inside the user's click / key, so Chrome may show its permission prompt here
  if(!bk.dir)return;
  if(!bk.ok){if(bk.asked)return;bk.asked=true;bk.dir.requestPermission({mode:"readwrite"}).then(r=>{bk.ok=r==="granted";bkInfo();if(bk.ok)backupSoon()},()=>{});return}
  clearTimeout(bk.timer);
  bk.timer=setTimeout(()=>bkWrite("auto.backup.json").then(()=>{bk.last=bkStamp().slice(11).replaceAll("-",":");bkInfo()},()=>{bk.ok=false;bk.asked=false;bkInfo();toast("バックアップを保存できませんでした。保存先フォルダを確認してください")}),1000);
}
async function backupInit(){try{bk.dir=await kv("readonly",s=>s.get("bkDir"))||null;if(bk.dir)bk.ok=await bk.dir.queryPermission({mode:"readwrite"})==="granted"}catch(e){}bkInfo()}

// Shared folder (Chrome / Edge, v0.0.2): the data/ folder on a shared drive, one file per project: projects/<id>.json.
// A project lives either there (p.shared, in memory only) or in this browser — never both. sh.data = the shared projects
// as last read, cached in localStorage (mg.shared) so they still show, read-only, when the folder cannot be reached.
// The folder is re-read every 2.5 s. Saving compares rev: a file someone else saved since we read it is never overwritten.
// Edit lock: locks/<id>.json = {by, sid, at}. Taken on the first save, kept by a heartbeat every 30 s while I click or type,
// let go when I switch project, press 編集を終了, close the page, or do nothing for 2 min. Others see the project read-only meanwhile.
const sh={dir:null,ok:false,asked:false,err:false,at:0,files:{},data:{},emit:null,q:Promise.resolve(), // ok = permission, err = folder unreachable
  locks:{},sig:"",mine:null,beat:0,act:Date.now(),newVer:""}; // newVer = a newer version published to app/ // mine = the project whose lock this page holds, act = last click / key
const SID=uid(),LOCK_MS=120e3; // this page's lock id; a lock not refreshed for 2 min counts as left
// version check: publish.py writes data/app-version.json when it updates app/. A page still running older code
// must not write shared data (the format may have changed): shared projects go read-only until it is reloaded.
const VER=document.querySelector(".ver")?.textContent||"",vnum=v=>String(v).slice(1).split(".").reduce((a,x)=>a*1e4+ +x,0); // "v1.2.3" → comparable number
try{const c=JSON.parse(ls.get("mg.shared"));if(c&&c.projects){sh.data=c.projects;sh.at=c.at||0}}catch(e){}
const shCache=()=>ls.set("mg.shared",JSON.stringify({at:sh.at,projects:sh.data}));
const isShared=id=>!!(projects[id]?.shared||sh.data[id]);
const shProjects=()=>Object.fromEntries(Object.entries(sh.data).map(([id,d])=>[id,{...JSON.parse(JSON.stringify(d)),id,shared:true}])); // copies: edits must not touch sh.data
const lockLive=l=>!!l&&Date.now()-l.at<LOCK_MS; // ponytail: compares the writer's clock with ours — fine while office PCs keep time
const lockOther=id=>{const l=sh.locks[id];return lockLive(l)&&l.sid!==SID?l:null}; // someone else is editing this project
function shRun(f){const r=sh.q.then(f);sh.q=r.catch(()=>{});return r} // one folder operation at a time, so a poll never reads between our read and write
const shDir=(n="projects")=>sh.dir.getDirectoryHandle(n,{create:true});
async function shJson(dir,n){try{return JSON.parse(await(await(await dir.getFileHandle(n)).getFile()).text())}catch(e){if(e.name==="NotFoundError")return null;throw e}}
async function shWrite(dir,n,obj){const fh=await dir.getFileHandle(n,{create:true}),w=await fh.createWritable();await w.write(JSON.stringify(obj,null,1));await w.close();return fh.getFile()}
async function shRead(){ // true when a project file or a lock changed since the last read
  const pd=await shDir(),seen=new Set();let ch=false;
  for await(const[n,h]of pd.entries()){if(h.kind!=="file"||!n.endsWith(".json"))continue;const id=n.slice(0,-5),f=await h.getFile(),k=f.lastModified+":"+f.size;seen.add(id);
    if(sh.files[id]===k&&sh.data[id])continue;
    try{const d=JSON.parse(await f.text());if(d&&Array.isArray(d.tasks)){sh.data[id]=d;sh.files[id]=k;ch=true}}catch(e){} // half-written or not ours: try again next time
  }
  Object.keys(sh.data).forEach(id=>{if(!seen.has(id)){delete sh.data[id];delete sh.files[id];ch=true}});
  const locks={};for await(const[n,h]of(await shDir("locks")).entries())if(h.kind==="file"&&n.endsWith(".json"))try{locks[n.slice(0,-5)]=JSON.parse(await(await h.getFile()).text())}catch(e){}
  sh.locks=locks;if(sh.mine&&lockOther(sh.mine))sh.mine=null; // taken over after a forced release
  const v=(await shJson(sh.dir,"app-version.json"))?.version,nv=vnum(v)>vnum(VER)?String(v):""; // only newer: a developer's own newer copy is not held back
  if(nv!==sh.newVer){sh.newVer=nv;ch=true;if(nv&&sh.mine)await shUnlockNow()}
  const sig=JSON.stringify([sh.mine,Object.entries(locks).filter(([,l])=>lockLive(l)).map(([id,l])=>[id,l.by,l.sid])]); // heartbeats alone don't redraw
  if(sig!==sh.sig){sh.sig=sig;ch=true}
  return ch}
async function shBeat(){if(!sh.mine||Date.now()-sh.beat<30e3)return; // keep my lock while I'm active, let it go after 2 min without a click or key
  if(Date.now()-sh.act>=LOCK_MS)return shUnlockNow();
  const ld=await shDir("locks"),l=await shJson(ld,sh.mine+".json");
  if(l?.sid===SID){await shWrite(ld,sh.mine+".json",{...l,at:Date.now()});sh.beat=Date.now()}else sh.mine=null}
async function shPoll(){clearTimeout(sh.timer);
  if(sh.dir&&sh.ok)await shRun(async()=>{try{await shBeat();const ch=await shRead();sh.at=Date.now();if(ch||sh.err){sh.err=false;shCache();sh.emit?.()}}
    catch(e){if(!sh.err){sh.err=true;sh.emit?.()}}});
  sh.timer=setTimeout(shPoll,2500)}
const lockedBy=by=>Object.assign(new Error("locked"),{code:"locked",by});
async function shLock(id){ // before saving: take (or keep) the lock. Write, then read back — of two people at the same moment, one wins
  const ld=await shDir("locks"),n=id+".json";let l=await shJson(ld,n);
  if(lockLive(l)&&l.sid!==SID)throw lockedBy(l.by);
  if(l?.sid===SID&&lockLive(l)&&sh.mine===id)return;
  if(sh.mine&&sh.mine!==id)await shUnlockNow();
  await shWrite(ld,n,{by:me,sid:SID,at:Date.now()});l=await shJson(ld,n);
  if(l?.sid!==SID)throw lockedBy(l?.by);
  sh.mine=id;sh.beat=Date.now();sh.locks[id]=l;if(!dragging)render()} // the corner shows 編集中 at once
async function shUnlockNow(){const id=sh.mine;sh.mine=null;if(!id)return;const ld=await shDir("locks"),l=await shJson(ld,id+".json");if(l?.sid===SID)await ld.removeEntry(id+".json")}
const shUnlock=()=>shRun(shUnlockNow).catch(()=>{}); // switching project, 編集を終了
const shForce=id=>shRun(async()=>{try{await(await shDir("locks")).removeEntry(id+".json")}catch(e){if(e.name!=="NotFoundError")throw e}delete sh.locks[id]}); // someone else's lock, pressed twice
async function shPut(id,data){
  if(sh.newVer)throw Object.assign(new Error("version"),{code:"version"});
  await shLock(id);const pd=await shDir(),cur=await shJson(pd,id+".json");
  if((cur?.rev||0)!==(data.rev||0))throw Object.assign(new Error("conflict"),{code:"conflict"}); // saved (or deleted) by someone else since we read it
  const d={...data,rev:(data.rev||0)+1},f=await shWrite(pd,id+".json",d);
  sh.files[id]=f.lastModified+":"+f.size;sh.data[id]=d;if(projects[id])projects[id].rev=d.rev;shCache()}
async function shRemove(id){await(await shDir()).removeEntry(id+".json");delete sh.data[id];delete sh.files[id];shCache()}
// local → shared: written under the same ID (a new one if taken), then removed from this browser. Not undoable: it moves, nothing is lost
async function shMove(p){
  let id=p.id;if(!/^[\w-]+$/.test(id)||sh.data[id])id=uid();
  const data=body(p);delete data.rev;await shRun(()=>shPut(id,data));
  clearTimeout(timers[p.id]);delete timers[p.id];pendingIds.delete(p.id);
  const all=backends.local.read()||{};delete all[p.id];backends.local.write(all);sh.emit();return id}
async function shPick(){const d=await showDirectoryPicker({id:"tempo-shared",mode:"readwrite"});
  if(d.name.toLowerCase()!=="data")throw Object.assign(new Error("name"),{code:"name",picked:d.name}); // everyone picks the same <shared drive>/Tempo/data — a wrong folder would split the team silently
  if(bk.dir&&await bk.dir.isSameEntry(d))throw Object.assign(new Error("same"),{code:"same"}); // the backup folder is a copy of my data, not the shared one
  if(sh.mine)await shUnlock();
  sh.dir=d;sh.ok=true;sh.err=false;sh.files={};sh.data={};sh.locks={};await kv("readwrite",s=>s.put(d,"shDir"));await shPoll()}
async function shInit(){try{sh.dir=await kv("readonly",s=>s.get("shDir"))||null;if(sh.dir)sh.ok=await sh.dir.queryPermission({mode:"readwrite"})==="granted"}catch(e){}shPoll();render()}
// every click or key counts as activity for the lock; after a browser restart the first click also asks Chrome to allow the folder again
addEventListener("keydown",()=>sh.act=Date.now(),true);
addEventListener("pointerdown",()=>{sh.act=Date.now();if(!sh.dir||sh.ok||sh.asked)return;sh.asked=true;
  sh.dir.requestPermission({mode:"readwrite"}).then(r=>{sh.ok=r==="granted";shPoll();render()},()=>{})},true);
addEventListener("pagehide",()=>{if(sh.mine)shUnlockNow().catch(()=>{})}); // best effort: the page may close first — then the lock runs out in 2 min
