// Startup: cloud when published as an Artifact, otherwise this browser (see storage.js).
render();
(async()=>{
  let b=window.claude&&window.claude.use?backends.cloud:backends.local,info;
  try{info=await b.open(onData)}catch(e){b=backends.local;info=await b.open(onData)}
  store=b;readOnly=info.readOnly;render();backupInit();
})();
