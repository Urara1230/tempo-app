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
    write(all){localStorage.setItem("mg.projects",JSON.stringify(all))}, // not ls.set: a full or blocked storage must reach the "could not save" message
    // projects in the shared folder (see sh below) come along with this browser's own; put / remove go to where the project lives
    async open(onData){sh.emit=()=>onData({...(this.read()||{}),...shProjects()});sh.emit();
      addEventListener("storage",e=>{if(e.key==="mg.projects")sh.emit()}); // another tab of this browser saved: show it here too
      return{readOnly:false}}, // first run starts empty: no sample data ships with the repo
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
const bkWrite=name=>shWrite(bk.dir,name,Object.fromEntries(Object.entries(projects).map(([id,p])=>[id,{id,...body(p)}])));
function backupSoon(){ // runs inside the user's click / key, so Chrome may show its permission prompt here
  if(!bk.dir)return;
  if(!bk.ok){if(bk.asked)return;bk.asked=true;bk.dir.requestPermission({mode:"readwrite"}).then(r=>{bk.ok=r==="granted";bkInfo();if(bk.ok)backupSoon()},()=>{});return}
  clearTimeout(bk.timer);
  bk.timer=setTimeout(()=>bkWrite("auto.backup.json").then(()=>{bk.last=bkStamp().slice(11).replaceAll("-",":");bkInfo()},()=>{bk.ok=false;bk.asked=false;bkInfo();toast("バックアップを保存できませんでした。保存先フォルダを確認してください")}),1000);
}
async function backupInit(){try{bk.dir=await kv("readonly",s=>s.get("bkDir"))||null;if(bk.dir)bk.ok=await bk.dir.queryPermission({mode:"readwrite"})==="granted"}catch(e){}bkInfo()}

// Shared folder (Chrome / Edge, v0.0.2): the data/ folder on a shared drive, one file per project: projects/<name>_<id>.json.
// A project lives either there (p.shared, in memory only) or in this browser — never both. sh.data = the shared projects
// as last read, cached in localStorage (mg.shared) so they still show, read-only, when the folder cannot be reached.
// Edit lock: locks/<id>.json = {by, sid, at}. A shared project is edited only while this page holds its lock (v0.0.7): taken with the
// switch in the table's corner (shTake: the lock, then the project as it is in the folder now), kept by a heartbeat every 30 s while I click
// or type, let go with the switch, when I switch project, close the page, or do nothing for 2 min. Everyone else sees the project read-only.
// So a project file changes only while someone holds its lock, and the folder is watched lightly (shRead): every 5 s the locks folder is
// listed; the project files are looked at when an editor has finished, when I take a lock, and once a minute.
// Saving still compares rev: a file someone else saved since we read it is never overwritten.
const sh={dir:null,ok:false,asked:false,err:false,at:0,files:{},data:{},emit:null,q:Promise.resolve(), // ok = permission, err = folder unreachable
  locks:{},lf:{},busy:new Set(),fn:{},dup:{},full:0,sig:"",mine:null,beat:0,act:Date.now(),newVer:"",path:""}; // lf = the lock files as last seen (time:size), busy = projects someone else was editing at the last look, fn = each project's file name as last listed, dup = other files found for the same project, full = when the last full look was // newVer = a newer version published to app/ // mine = the project whose lock this page holds, act = last click / key
const SID=uid(),LOCK_MS=120e3; // this page's lock id; a lock not refreshed for 2 min counts as left
// version check: publish.py writes data/app-version.json when it updates app/. A page still running older code
// must not write shared data (the format may have changed): shared projects go read-only until it is reloaded.
const VER=document.querySelector(".ver")?.textContent||"",vnum=v=>String(v).slice(1).split(".").reduce((a,x)=>a*1e4+ +x,0); // "v1.2.3" → comparable number
try{const c=JSON.parse(ls.get("mg.shared"));if(c&&c.projects){sh.data=c.projects;sh.at=c.at||0}}catch(e){}
const shCache=()=>ls.set("mg.shared",JSON.stringify({at:sh.at,projects:sh.data}));
const isShared=id=>!!(projects[id]?.shared||sh.data[id]);
const shProjects=()=>Object.fromEntries(Object.entries(sh.data).map(([id,d])=>[id,{...structuredClone(d),id,shared:true}])); // copies: edits must not touch sh.data
const lockLive=l=>!!l&&Date.now()-l.at<LOCK_MS; // ponytail: compares the writer's clock with ours — fine while office PCs keep time
const lockOther=id=>{const l=sh.locks[id];return lockLive(l)&&l.sid!==SID?l:null}; // someone else is editing this project
function shRun(f){const r=sh.q.then(f);sh.q=r.catch(()=>{});return r} // one folder operation at a time, so a poll never reads between our read and write
const shDir=(n="projects")=>sh.dir.getDirectoryHandle(n,{create:true});
// projects/<project name>_<id>.json (v0.0.7; before: <id>.json — still read, renamed at the next save). The name is only there for people looking
// into the folder: what a file name can't hold is left out, and the id is what follows the last "_" (ids hold no "_": shMove; names may)
const shName=(name,id)=>String(name||"").replace(/[\\/:*?"<>|\x00-\x1f]/g,"").slice(0,40).replace(/[. ]+$/,"")+"_"+id+".json";
const shId=n=>n.slice(n.lastIndexOf("_")+1,-5);
async function shJson(dir,n){try{return JSON.parse(await(await(await dir.getFileHandle(n)).getFile()).text())}catch(e){if(e.name==="NotFoundError")return null;throw e}}
async function shWrite(dir,n,obj){const fh=await dir.getFileHandle(n,{create:true}),w=await fh.createWritable();await w.write(JSON.stringify(obj,null,1));await w.close();return fh}
// One look at the folder; true when something to show changed. Every look lists the locks folder and opens a lock file only when it is new or
// was rewritten. The project files are looked at in a full look: at the start, back online, once a minute (new and deleted projects, a lock
// taken and let go between two looks, a new version), when I take a lock, and when the lock someone else held is gone — they finished: what they
// saved is read whatever the file's time says. A file is opened when its time or size changed; not while someone else holds its lock, unless
// we have nothing of it to show yet. The full look is also where each project's file name is learnt (sh.fn): it changes with the project's name
async function shRead(){
  let ch=false,full=Date.now()-sh.full>=60e3;const locks={},lf={};
  for await(const[n,h]of(await shDir("locks")).entries()){if(h.kind!=="file"||!n.endsWith(".json"))continue;const id=n.slice(0,-5);
    try{const f=await h.getFile(),k=f.lastModified+":"+f.size;locks[id]=sh.lf[id]===k&&sh.locks[id]?sh.locks[id]:JSON.parse(await f.text());lf[id]=k}catch(e){}} // half-written: next time
  sh.locks=locks;sh.lf=lf;if(sh.mine&&lockOther(sh.mine))sh.mine=null; // taken over after a forced release
  sh.busy.forEach(id=>{if(!lockOther(id)){delete sh.files[id];full=true}});sh.busy=new Set(Object.keys(locks).filter(lockOther));
  if(full){sh.full=Date.now();const fn={},at={},dup={};
    for await(const[n,h]of(await shDir()).entries()){if(h.kind!=="file"||!n.endsWith(".json"))continue;const id=shId(n);
      try{const f=await h.getFile(),k=f.lastModified+":"+f.size;
        if(fn[id]){const old=at[id]>=f.lastModified?n:fn[id];(dup[id]||(dup[id]=[])).push(old);if(old===n)continue} // two files for one project (the one under its old name could not be removed): the newer one counts, the other goes at the next save (shPut)
        fn[id]=n;at[id]=f.lastModified;
        if(sh.data[id]&&(sh.files[id]===k||lockOther(id)))continue; // unchanged, or still being edited: when they finish
        const d=JSON.parse(await f.text());if(d&&Array.isArray(d.tasks)){sh.data[id]=d;sh.files[id]=k;ch=true}} // not ours: left alone
      catch(e){if(!fn[id])fn[id]=n;if(sh.data[id])sh.full=0}} // half-written, or being replaced just now: it is still there — look again next time
    Object.keys(sh.data).forEach(id=>{if(!fn[id]){delete sh.data[id];delete sh.files[id];ch=true}});sh.fn=fn;sh.dup=dup;
    const av=await shJson(sh.dir,"app-version.json"),v=av?.version,nv=vnum(v)>vnum(VER)?String(v):""; // only newer: a developer's own newer copy is not held back
    sh.path=typeof av?.path==="string"?av.path:""; // where the folder is, as publish.py saw it: the browser itself only gives the folder's name
    if(nv!==sh.newVer){sh.newVer=nv;ch=true;if(nv&&sh.mine)await shUnlockNow()}}
  const sig=JSON.stringify([sh.mine,Object.entries(locks).filter(([,l])=>lockLive(l)).map(([id,l])=>[id,l.by,l.sid])]); // heartbeats alone don't redraw
  if(sig!==sh.sig){sh.sig=sig;ch=true}
  return ch}
async function shBeat(){if(!sh.mine||Date.now()-sh.beat<30e3)return; // keep my lock while I'm active, let it go after 2 min without a click or key
  if(Date.now()-sh.act>=LOCK_MS)return shUnlockNow();
  const ld=await shDir("locks"),l=await shJson(ld,sh.mine+".json");
  if(l?.sid===SID){await shWrite(ld,sh.mine+".json",{...l,at:Date.now()});sh.beat=Date.now()}else sh.mine=null}
async function shPoll(){clearTimeout(sh.timer);
  if(sh.dir&&sh.ok)await shRun(async()=>{try{const m=sh.mine;await shBeat();const ch=await shRead();sh.at=Date.now();if(ch||sh.err||m!==sh.mine){sh.err=false;shCache();sh.emit?.()}} // m: my lock was let go after 2 min — the project is read-only again
    catch(e){sh.full=0;if(!sh.err){sh.err=true;sh.emit?.()}}}); // back online: a full look
  sh.timer=setTimeout(shPoll,5000)}
const lockedBy=by=>Object.assign(new Error("locked"),{code:"locked",by});
async function shLock(id){ // before saving: take (or keep) the lock. Write, then read back — of two people at the same moment, one wins
  const ld=await shDir("locks"),n=id+".json";let l=await shJson(ld,n);
  if(lockLive(l)&&l.sid!==SID){sh.locks[id]=l;throw lockedBy(l.by)} // the corner shows whose it is at once
  if(l?.sid===SID&&lockLive(l)&&sh.mine===id)return;
  if(sh.mine&&sh.mine!==id)await shUnlockNow();
  await shWrite(ld,n,{by:me,sid:SID,at:Date.now()});l=await shJson(ld,n);
  if(l?.sid!==SID){if(l)sh.locks[id]=l;throw lockedBy(l?.by)}
  sh.mine=id;sh.beat=Date.now();sh.locks[id]=l;if(!busy())render()} // the corner shows 編集中 at once
async function shUnlockNow(){const id=sh.mine;sh.mine=null;if(!id)return;const ld=await shDir("locks"),l=await shJson(ld,id+".json");if(l?.sid===SID)await ld.removeEntry(id+".json")}
const shUnlock=()=>shRun(shUnlockNow).catch(()=>{});
// the lock switch, turned on: the lock first, then a full look that reads the project as it is in the folder now — nobody else can change it from here on, so the editing starts from the latest content
const shTake=id=>shRun(async()=>{await shLock(id);delete sh.files[id];sh.full=0;await shRead();if(!sh.data[id])await shUnlockNow(); // deleted meanwhile
  shCache();sh.emit?.()});
// editing ends (the switch, switching project): what is still waiting is written first, then the lock goes. keep: not while a save keeps
// failing — the change is only here yet, and letting others in now would end in a refused save. Resolves to whether the lock was let go
function shEnd(keep){const id=sh.mine;if(!id)return Promise.resolve(true);if(timers[id]){clearTimeout(timers[id]);flush(id)}
  return chain.then(()=>keep&&retry[id]?false:shUnlock().then(()=>true))}
const shForce=id=>shRun(async()=>{try{await(await shDir("locks")).removeEntry(id+".json")}catch(e){if(e.name!=="NotFoundError")throw e}delete sh.locks[id];delete sh.lf[id]}); // someone else's lock, pressed twice
async function shPut(id,data){
  if(sh.newVer)throw Object.assign(new Error("version"),{code:"version"});
  await shLock(id);const pd=await shDir(),was=sh.fn[id],nn=shName(data.name,id),cur=await shJson(pd,was||nn);
  if((cur?.rev||0)!==(data.rev||0)){ // saved (or deleted) by someone else since we read it: what was just read is what the page shows next
    if(cur&&Array.isArray(cur.tasks))sh.data[id]=cur;else delete sh.data[id];delete sh.files[id];sh.full=0;shCache();throw Object.assign(new Error("conflict"),{code:"conflict"})}
  const d={...data,rev:(data.rev||0)+1},f=await(await shWrite(pd,nn,d)).getFile();
  for(const o of new Set([was,...(sh.dup[id]||[])]))if(o&&o!==nn)try{await pd.removeEntry(o)}catch(e){} // the project was renamed (or its file still had the old <id>.json name): the old file goes. One that can't be removed now is found again by the next full look
  sh.fn[id]=nn;delete sh.dup[id];
  sh.files[id]=f.lastModified+":"+f.size;sh.data[id]=structuredClone(d);if(projects[id])projects[id].rev=d.rev;shCache()} // a copy: d holds the open project's own task objects, and sh.data must stay what the file says (see shProjects) — an edit in progress would otherwise look like a change made elsewhere
async function shRemove(id){await(await shDir()).removeEntry(sh.fn[id]||shName(projects[id]?.name,id));delete sh.data[id];delete sh.files[id];delete sh.fn[id];shCache()}
// local → shared: written under the same ID (a new one if taken), then removed from this browser. Not undoable: it moves, nothing is lost
async function shMove(p){
  let id=p.id;if(!/^[A-Za-z0-9-]+$/.test(id)||sh.data[id])id=uid(); // no "_": the id is what follows the last "_" of the file name
  const data=body(p);delete data.rev;await shRun(()=>shPut(id,data));
  clearTimeout(timers[p.id]);delete timers[p.id];delete retry[p.id];pendingIds.delete(p.id);
  const all=backends.local.read()||{};delete all[p.id];backends.local.write(all);sh.emit();return id}
async function shPick(){const d=await showDirectoryPicker({id:"tempo-shared",mode:"readwrite"});
  if(d.name.toLowerCase()!=="data")throw Object.assign(new Error("name"),{code:"name",picked:d.name}); // everyone picks the same <shared drive>/Tempo/data — a wrong folder would split the team silently
  if(bk.dir&&await bk.dir.isSameEntry(d))throw Object.assign(new Error("same"),{code:"same"}); // the backup folder is a copy of my data, not the shared one
  if(sh.mine)await shUnlock();
  sh.dir=d;sh.ok=true;sh.err=false;sh.files={};sh.data={};sh.locks={};sh.lf={};sh.busy=new Set();sh.fn={};sh.dup={};sh.full=0;sh.path="";await kv("readwrite",s=>s.put(d,"shDir"));await shPoll()}
async function shInit(){try{sh.dir=await kv("readonly",s=>s.get("shDir"))||null;if(sh.dir)sh.ok=await sh.dir.queryPermission({mode:"readwrite"})==="granted"}catch(e){}shPoll();render()}
// every click or key counts as activity for the lock; after a browser restart the first click also asks Chrome to allow the folder again
addEventListener("keydown",()=>sh.act=Date.now(),true);
addEventListener("pointerdown",()=>{sh.act=Date.now();if(!sh.dir||sh.ok||sh.asked)return;sh.asked=true;
  sh.dir.requestPermission({mode:"readwrite"}).then(r=>{sh.ok=r==="granted";shPoll();render()},()=>{})},true);
addEventListener("pagehide",()=>{if(sh.mine)shUnlockNow().catch(()=>{})}); // best effort: the page may close first — then the lock runs out in 2 min
