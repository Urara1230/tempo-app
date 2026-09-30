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
    async open(onData){onData(this.read()||{});return{readOnly:false}}, // first run starts empty: no sample data ships with the repo
    async put(id,data){const all=this.read()||{};all[id]={id,...data};this.write(all)},
    async remove(id){const all=this.read()||{};delete all[id];this.write(all)},
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
