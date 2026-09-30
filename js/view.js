// Rendering: header stats, timeline, task rows, bars.
/* ---------- render ---------- */
function renderToolbar(){
  const ids=Object.keys(projects).sort((a,b)=>(projects[a].name||"").localeCompare(projects[b].name||""));
  $("projSel").innerHTML=ids.map(id=>`<option value="${esc(id)}"${id===curId?" selected":""}>${projects[id].shared?"👥 ":""}${esc(projects[id].name||"無題")}</option>`).join("")||`<option>プロジェクトなし</option>`;
  const p=projects[curId];
  readOnly=storeRO||!!(p?.shared&&(!sh.ok||sh.err||sh.newVer||!me||lockOther(p.id))); // a shared project: read-only offline, after a newer version, without a name, or while someone else edits it
  const ms=p?members(p):[];
  if(view.who&&!ms.includes(view.who))view.who="";
  $("whoSel").innerHTML=`<option value="">（全員）</option>`+ms.map(m=>`<option${m===view.who?" selected":""}>${esc(m)}</option>`).join("");
  $("meSel").innerHTML=`<option value="">自分：未選択</option>`+[...new Set([...(p?roster(p):[]),...(me?[me]:[])])].map(m=>`<option value="${esc(m)}"${m===me?" selected":""}>自分：${esc(m)}</option>`).join("");
  $("members").innerHTML=ms.map(m=>`<option value="${esc(m)}">`).join("");
  document.querySelectorAll("[data-scale]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.scale===view.scale));
  const shLbl=!p?.shared?"":!sh.dir?"共有フォルダが未設定です（閲覧のみ）":!sh.ok?"共有フォルダ：画面をクリックすると接続します（閲覧のみ）"
    :sh.err?`共有フォルダに接続できません（最終取得 ${sh.at?new Date(sh.at).toTimeString().slice(0,5):"—"}）`
    :sh.newVer?`新しいバージョン ${sh.newVer} があります。再読み込み（F5）してください（それまで閲覧のみ）`:"共有フォルダと同期中";
  $("modeLbl").textContent=store?(storeRO?"閲覧のみ":shLbl||store.label):"";
  if(!p){$("stats").innerHTML="";return}
  const {rows,pct,mn,mx}=overall(p);
  const cnt={};rows.forEach(r=>cnt[r.st]=(cnt[r.st]||0)+1);
  const period=rows.length?`${S(mn).replaceAll("-","/")}〜${S(mx).replaceAll("-","/")}`:"—";
  const nxt=(p.milestones||[]).filter(m=>D(m.date)>=TODAY).sort((x,y)=>x.date<y.date?-1:1)[0];
  const nxtHtml=nxt?`<span class="nextms mc-${nxt.color||"blue"}">次の節目 ${FLAG} <b>${md(D(nxt.date))} ${esc(nxt.title)}</b>（あと${D(nxt.date)-TODAY}日・${biz(TODAY,D(nxt.date))}営業日）</span>`:"";
  $("stats").innerHTML=`<span>期間 <b>${period}</b></span>`+nxtHtml+`<span>全体進捗 <b>${pct}%</b><span class="meter"><span style="width:${pct}%"></span></span></span>`+
    Object.keys(ST).filter(k=>cnt[k]).map(k=>`<button type="button" class="chip st-${k}" data-st="${k}" aria-pressed="${view.st===k}"><span class="dot"></span>${ST[k]} <span class="n">${cnt[k]}</span></button>`).join("")+
    (view.st?`<button type="button" class="chip" data-st="">絞り込み解除</button>`:"");
}

// edit lock line in the task table's corner (shared projects only)
function lockBar(p){if(!p.shared||!sh.ok||sh.err||sh.newVer)return"";const o=lockOther(p.id);if(!o)lkArmed=false;
  return`<div class="lk">${!me?"🔒 上の「自分」で名前を選ぶと編集できます"
    :o?`🔒 ${esc(o.by||"だれか")}さんが編集中（閲覧のみ）<button type="button" class="btn danger${lkArmed?" arm":""}" data-lk="force">${lkArmed?`もう一度押すと${esc(o.by||"")}さんのロックを解除`:"ロックを解除"}</button>`
    :sh.mine===p.id?`✏️ 編集中（ほかの人は閲覧のみ）<button type="button" class="btn" data-lk="end">編集を終了</button>`:"🔓 だれも編集していません（編集を始めると自動でロック）"}</div>`}
function render(){
  renderToolbar();
  const chart=$("chart");
  if(!store){chart.innerHTML=`<div class="empty">読み込み中…</div>`;return}
  const p=projects[curId];
  if(!p){chart.innerHTML=`<div class="empty"><div>プロジェクトがまだありません。</div><button class="btn pri" type="button" data-act="newproj">プロジェクトを作成</button></div>`;return}
  const all=derive(p);
  const sc=view.scale, dw=sc==="day"?30:sc==="week"?12:4;
  let mn=TODAY,mx=TODAY;all.forEach(r=>{mn=Math.min(mn,D(r.start));mx=Math.max(mx,D(r.end))});(p.milestones||[]).forEach(m=>{mn=Math.min(mn,D(m.date));mx=Math.max(mx,D(m.date))});
  // today ± half a year, stretched only to cover this project's own dates
  let a=Math.min(TODAY-183,mn-10),b=Math.max(TODAY+183,mx+10);
  if(sc==="week")while(dow(a)!==1)a--;
  if(sc==="month"){const d=dt(a);a=D(`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-01`)}
  range={a,b,dw};
  const tw=(b-a+1)*dw;
  const X=n=>(n-a)*dw;

  // header
  let top="",bot="",bg="";
  const monthRuns=[];
  for(let n=a;n<=b;){const d=dt(n),y=d.getUTCFullYear(),m=d.getUTCMonth();let e=n;while(e+1<=b&&dt(e+1).getUTCMonth()===m)e++;monthRuns.push({n,e,y,m});n=e+1}
  if(sc==="month"){
    for(let i=0;i<monthRuns.length;){const y=monthRuns[i].y;let j=i;while(j+1<monthRuns.length&&monthRuns[j+1].y===y)j++;top+=`<div class="hc top" style="left:${X(monthRuns[i].n)}px;width:${(monthRuns[j].e-monthRuns[i].n+1)*dw}px">${y}年</div>`;i=j+1}
    monthRuns.forEach(r=>{bot+=`<div class="hc bot" style="left:${X(r.n)}px;width:${(r.e-r.n+1)*dw}px">${r.m+1}月</div>`;bg+=`<div class="vl" style="left:${X(r.n)}px"></div>`});
  }else{
    monthRuns.forEach(r=>{top+=`<div class="hc top" style="left:${X(r.n)}px;width:${(r.e-r.n+1)*dw}px">${r.y}年${r.m+1}月</div>`});
    for(let n=a;n<=b;n++){
      const co=coHol(n); // company holiday: its own color, over weekend / national holiday shading
      if(isOff(n))bg+=`<div class="off${!co&&isHol(n)&&dow(n)!==6&&dow(n)!==0?" hol":""}" style="left:${X(n)}px;width:${dw}px${co?`;background:${co.color}2e`:""}"></div>`;
      if(sc==="day"){
        const w=dow(n),cls=n===TODAY?"today":(w===0||isHol(n)||co)?"sun":w===6?"sat":"";
        bot+=`<div class="hc bot ${cls}" style="left:${X(n)}px;width:${dw}px${co&&n!==TODAY?`;color:${co.color}`:""}"${co?' title="会社の休日"':""}>${dt(n).getUTCDate()}<small>${WD[w]}</small></div>`;
      }else if(dow(n)===1){
        bot+=`<div class="hc bot" style="left:${X(n)}px;width:${7*dw}px">${md(n)}</div>`;bg+=`<div class="vl" style="left:${X(n)}px"></div>`;
      }
    }
  }
  if(TODAY>=a&&TODAY<=b)bg+=`<div class="now" style="left:${X(TODAY)+dw/2-1}px"></div>`;
  let flags="";
  (p.milestones||[]).slice().sort((x,y)=>x.date<y.date?-1:1).forEach(m=>{const n=D(m.date);if(n<a||n>b)return;const cx=X(n)+dw/2;
    bg+=`<div class="msl mc-${m.color||"blue"}" style="left:${cx-1}px"></div>`;
    flags+=`<button type="button" class="flag mc-${m.color||"blue"}" data-ms="${m.id}" style="left:${cx-4}px" title="${md(n)} ${esc(m.title)}">${FLAG}<span>${esc(m.title)||md(n)}</span></button>`;});
  const hint=(p.milestones||[]).length||readOnly?"":`<div class="band-hint" style="left:${Math.max(6,X(TODAY)-60)}px">日付をクリックしてマイルストーンを追加</div>`;
  const bgStyle=sc==="day"?`background-image:repeating-linear-gradient(to right,transparent 0 ${dw-1}px,var(--line2) ${dw-1}px ${dw}px)`:"";

  // rows (collapse + filter)
  const filtering=view.who||view.st;
  const match=r=>(!view.who||r.assignees.includes(view.who))&&(!view.st||r.st===view.st);
  const visible=new Array(all.length).fill(true);
  if(filtering){
    for(let i=all.length-1;i>=0;i--){
      const r=all[i];
      if(r.parent){let any=false;for(let j=i+1;j<all.length&&all[j].level>r.level;j++)if(visible[j]&&!all[j].parent){any=true;break}visible[i]=any}
      else visible[i]=match(r);
    }
  }
  let hideBelow=null,rowsHtml="";const vis=[],geo={};
  all.forEach((r,i)=>{
    if(hideBelow!==null){if(r.level>hideBelow)return;hideBelow=null}
    if(r.parent&&collapsed.has(r.id))hideBelow=r.level;
    if(!visible[i])return;
    const s=D(r.start),e=D(r.end),x=X(s),w=(e-s+1)*dw,bd=biz(s,e);
    const who=r.assignees.join("、");geo[r.id]={i:vis.length,s,e};vis.push(r.id);
    let mark;
    if(r.milestone&&!r.parent){
      mark=`<div class="ms st-${r.st}" data-bar="${r.id}" style="left:${X(e)+dw/2-7}px" title="${esc(r.name)}"></div><span class="who" style="left:${X(e)+dw/2+12}px">${lab(r,s,e)}</span>`;
    }else{
      const urg=!r.parent&&r.st!=="done"&&r.st!=="over";
      mark=`<div class="bar st-${r.st}${r.parent?" sum":""}${urg?" urg dl"+delay(r):""}" data-bar="${r.id}" style="left:${x}px;width:${w}px" title="${esc(r.name)}｜${md(s)}〜${md(e)}｜${r.progress}%｜${ST[r.st]}"><div class="fill" style="width:${r.progress}%"></div>${!r.parent&&w>50?`<span class="bl">${esc(r.name)}</span>`:""}${r.parent?"":`<i class="h l"></i><i class="h r"></i>`}</div><span class="who" style="left:${x+w+6}px">${lab(r,s,e)}</span>`;
    }
    rowsHtml+=`<div class="row${r.parent?" parent":""}${r.parent?" pc":""}${r.id===editingId||sel.has(r.id)?" sel":""}"${r.parent?` style="--pc:${parColor(r)}"`:""} data-id="${r.id}">
      <div class="lc" data-open="${r.id}"><div class="c-name" style="padding-left:${6+r.level*18}px">${r.parent?`<button type="button" class="tg" data-tg="${r.id}" aria-label="折りたたみ">${collapsed.has(r.id)?"▸":"▾"}</button>`:`<span class="dot st-${r.st}" title="${ST[r.st]}"></span>`}<span class="tn">${esc(r.name)}</span></div><div class="c-as">${r.parent||readOnly?esc(who):`<button type="button" class="asbox${who?"":" none"}" data-as="${r.id}" aria-label="担当者を選ぶ" title="${esc(who)}"><span>${esc(who)||"担当なし"}</span><b aria-hidden="true">${who?"▾":"＋"}</b></button>`}</div><div class="c-d">${md(s)}</div><div class="c-d">${md(e)}</div><div class="c-n">${bd}</div><div class="c-p">${r.progress}%</div></div>
      <div class="tl">${mark}</div></div>`;
  });
  if(!readOnly)rowsHtml+=`<div class="row addrow"><div class="lc" data-act="add"><div class="c-name" style="padding-left:12px">＋ タスクを追加</div></div><div class="tl"></div></div>`;

  visOrder=vis;
  let lk="";const H0=75,RH=34;
  all.forEach(r=>(r.deps||[]).forEach(pid=>{const A=geo[pid],B=geo[r.id];if(!A||!B)return;
    const x1=X(A.e+1),x2=X(B.s),up=B.i<A.i,y1=H0+A.i*RH+17+(up?-10:10),y2=H0+B.i*RH+17,xv=Math.min(x1-6,x2-10);
    lk+=`<path class="${B.s<=A.e?"bad":""}" d="M${xv} ${y1}V${y2}H${x2-1}" marker-end="url(#lk-arrow)"/>`;}));
  const linksSvg=lk?`<svg class="links" width="${tw}" height="${H0+vis.length*RH+RH}"><defs><marker id="lk-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--ink2)" stroke="none"/></marker></defs>${lk}</svg>`:"";
  const sl=chart.scrollLeft,st=chart.scrollTop;
  chart.innerHTML=`<div class="grid" style="--tw:${tw}px;width:calc(var(--lw) + ${tw}px)">
    <div class="bgl" style="${bgStyle}">${bg}</div>
    <div class="hdr"><div class="corner"><div class="c-name" style="flex:1;flex-direction:column;align-items:flex-start;gap:6px">${lockBar(p)}<small style="color:var(--ink2);font-size:10.5px">マイルストーン ▶</small>タスク</div><div class="c-as">担当</div><div class="c-d">開始</div><div class="c-d">終了</div><div class="c-n" title="営業日">日数</div><div class="c-p">進捗</div></div><div class="ht" id="ht"><div class="band"></div>${top}${bot}${hint}${flags}</div></div>
    ${rowsHtml}${linksSvg}</div>`;
  if(scrolledFor!==curId+sc){scrolledFor=curId+sc;scrollInitial()}else{chart.scrollLeft=sl;chart.scrollTop=st}
}
function scrollToToday(){if(!range)return;const c=$("chart");c.scrollLeft=Math.max(0,(TODAY-range.a)*range.dw-120)}
function scrollInitial(){const p=projects[curId],o=p&&overall(p);if(!o||!o.rows.length||!range)return scrollToToday();
  const target=(TODAY>=o.mn-7&&TODAY<=o.mx+7)?TODAY:o.mn;$("chart").scrollLeft=Math.max(0,(target-range.a)*range.dw-120)}
