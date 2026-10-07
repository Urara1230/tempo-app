// Rendering: header stats, timeline, task rows, bars. Stored data is not checked on the way in, so everything put into HTML here is escaped or validated.
const mc=m=>"mc-"+(MSC.includes(m.color)?m.color:"blue"); // milestone color class: one of the five, never raw text
// fold button of a top-level parent: a closed folder when folded, an open one when unfolded (lower parents keep ▸ / ▾)
const folder=open=>`<svg class="fd${open?" open":""}" width="15" height="13" viewBox="0 0 15 13" aria-hidden="true">${open
  ?'<path d="M1 11.5V1.5h4l1.5 1.5H13v2.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M3.2 5.5h11.3l-2.4 6H.8z" fill="currentColor"/>'
  :'<path d="M.7 1.7a1 1 0 0 1 1-1h3.5l1.5 1.5h6.6a1 1 0 0 1 1 1v7.6a1 1 0 0 1-1 1H1.7a1 1 0 0 1-1-1z" fill="currentColor"/>'}</svg>`;
/* ---------- render ---------- */
function renderToolbar(){
  const ids=Object.keys(projects).sort((a,b)=>(projects[a].name||"").localeCompare(projects[b].name||""));
  $("projSel").innerHTML=ids.map(id=>`<option value="${esc(id)}"${id===curId?" selected":""}>${projects[id].shared?"👥 ":""}${esc(projects[id].name||"無題")}</option>`).join("")||`<option>プロジェクトなし</option>`;
  const p=projects[curId];
  readOnly=storeRO||!!(p?.shared&&(!sh.ok||sh.err||sh.newVer||!me||sh.mine!==p.id)); // a shared project is edited only while this page holds its lock (the switch in the corner): read-only otherwise — also offline, after a newer version, without a name
  const ms=p?members(p):[];
  if(view.who&&!ms.includes(view.who))view.who="";
  $("whoSel").innerHTML=`<option value="">（全員）</option>`+ms.map(m=>`<option${m===view.who?" selected":""}>${esc(m)}</option>`).join("");
  $("meSel").innerHTML=`<option value="">自分：未選択</option>`+[...new Set([...(p?roster(p):[]),...(me?[me]:[])])].map(m=>`<option value="${esc(m)}"${m===me?" selected":""}>自分：${esc(m)}</option>`).join("");
  $("members").innerHTML=ms.map(m=>`<option value="${esc(m)}">`).join("");
  document.querySelectorAll("[data-scale]").forEach(b=>{b.setAttribute("aria-pressed",b.dataset.scale===view.scale);b.disabled=view.list});$("todayBtn").disabled=view.list; // no timeline in 一覧
  document.querySelectorAll("[data-view]").forEach(b=>b.setAttribute("aria-pressed",(b.dataset.view==="list")===view.list));
  $("leafBtn").setAttribute("aria-pressed",view.leaf);$("leafBtn").disabled=!view.list; // 一覧 only
  const shLbl=!p?.shared?"":!sh.dir?"共有フォルダが未設定です（閲覧のみ）":!sh.ok?"共有フォルダ：画面をクリックすると接続します（閲覧のみ）"
    :sh.err?`共有フォルダに接続できません（最終取得 ${sh.at?new Date(sh.at).toTimeString().slice(0,5):"—"}）`
    :sh.newVer?`新しいバージョン ${sh.newVer} があります。Tempo.bat から開き直してください（それまで閲覧のみ）`:"共有フォルダと同期中";
  const uns=Object.keys(retry).length>0; // a save failed and is being tried again (core.js flush)
  $("modeLbl").textContent=store?(uns?"未保存の変更があります（再試行中）｜":"")+(storeRO?"閲覧のみ":shLbl||store.label):"";$("modeLbl").classList.toggle("warn",uns);
  if(!p){$("stats").innerHTML=$("chips").innerHTML="";return}
  const {rows,pct,mn,mx}=overall(p);
  const cnt={};rows.forEach(r=>cnt[r.st]=(cnt[r.st]||0)+1);
  const period=rows.length?`${S(mn).replaceAll("-","/")}〜${S(mx).replaceAll("-","/")}`:"—";
  const nxt=(p.milestones||[]).filter(m=>D(m.date)>=TODAY).sort((x,y)=>x.date<y.date?-1:1)[0];
  const nxtHtml=nxt?`<span class="nextms ${mc(nxt)}">次の節目 ${FLAG} <b>${md(D(nxt.date))} ${esc(nxt.title)}</b>（あと${D(nxt.date)-TODAY}日・${biz(TODAY,D(nxt.date))}営業日）</span>`:"";
  $("stats").innerHTML=`<span>期間 <b>${period}</b></span>`+nxtHtml+`<span>全体進捗 <b>${pct}%</b><span class="meter"><span style="width:${pct}%"></span></span></span>`;
  $("chips").innerHTML=Object.keys(ST).filter(k=>cnt[k]).map(k=>`<button type="button" class="chip st-${k}" data-st="${k}" aria-pressed="${view.st===k}"><span class="dot"></span>${ST[k]} <span class="n">${cnt[k]}</span></button>`).join("")+
    (view.st?`<button type="button" class="chip" data-st="">絞り込み解除</button>`:"");
}

// edit lock in the task table's corner (shared projects only): a switch with a padlock on its knob. Off = nobody edits, the project is read-only
// (a press takes the lock and editing starts). On = locked: mine (a press ends editing) or someone else's (.other; pressed twice it is released). Without 自分 it is shut, grey, and can't be pressed.
// data-on = the state now; it is drawn in the state it had last time (lkWas) and render() then moves it, so the switch's motion runs
function lockBar(p){if(!p.shared||!sh.ok||sh.err||sh.newVer)return"";const o=lockOther(p.id);if(!o)lkArmed=false;
  const mine=sh.mine===p.id,on=String(!me||!!o||mine),was=lkWas||on;lkWas=on;
  return`<div class="lk"><button type="button" class="sw lock${o?" other":""}${lkArmed||mine&&sh.bare?" arm":""}" data-lk="${o?"force":mine?"end":"take"}" data-on="${on}" aria-pressed="${was}"${me?"":" disabled"} title="${!me?"":o?"2 回押すと、ロックを強制的に解除します":mine?"押すと編集を終了します":"押すとロックして編集を始めます"}"><em></em>${!me?"上の「自分」で名前を選ぶと編集できます"
    :o?(lkArmed?`もう一度押すと${esc(o.by||"")}さんのロックを解除`:`${esc(o.by||"だれか")}さんが編集中（閲覧のみ）`)
    :mine?(sh.bare?"編集中（ロックなし：ほかの人も同時に編集できます）":"編集中（ほかの人は閲覧のみ）"):"閲覧のみ（編集するにはこのスイッチを押します）"}</button></div>`}
const isDv=r=>!!r.deliverable&&!r.parent; // a deliverable (成果物): tagged, and only while it has no sub-tasks — like the milestone flag
// 一覧 view, 完了 column: a leaf has a checkbox (100% ⇄ 0%); a parent shows 完了 when every task under it is done, else done / all.
// dvOnly (成果物のみ): a folder counts its deliverables only, — when it has none
function doneCell(all,r,dvOnly){
  if(!r.parent)return readOnly?(r.progress>=100?"完了":"未完了"):`<input type="checkbox" data-done="${esc(r.id)}"${r.progress>=100?" checked":""} aria-label="完了">`;
  let n=0,d=0;for(let j=r.idx+1;j<all.length&&all[j].level>r.level;j++)if(dvOnly?isDv(all[j]):!all[j].parent){n++;if(all[j].progress>=100)d++}
  return !n?"—":d===n?"完了":`${d}/${n}`}
function render(){
  const p=projects[curId];if(p&&H(p.id).last==null)H(p.id).last=snap(p); // undo starts from the state first shown
  renderToolbar();renderTools();syncForm();
  const chart=$("chart");
  if(!store){chart.innerHTML=`<div class="empty"><i class="spin"></i>読み込み中…</div>`;return}
  if(!p){chart.innerHTML=`<div class="empty"><div>プロジェクトがまだありません。</div><button class="btn pri" type="button" data-act="newproj">プロジェクトを作成</button></div>`;return}
  const all=derive(p);
  const sc=view.scale, list=view.list, dw=sc==="day"?30:sc==="week"?12:4;
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
    bg+=`<div class="msl ${mc(m)}" style="left:${cx-1}px"></div>`;
    flags+=`<button type="button" class="flag ${mc(m)}" data-ms="${esc(m.id)}" style="left:${cx-4}px" title="${md(n)} ${esc(m.title)}">${FLAG}<span>${esc(m.title)||md(n)}</span></button>`;});
  const hint=(p.milestones||[]).length||readOnly?"":`<div class="band-hint" style="left:${Math.max(6,X(TODAY)-60)}px">日付をクリックしてマイルストーンを追加</div>`;
  const bgStyle=sc==="day"?`background-image:repeating-linear-gradient(to right,transparent 0 ${dw-1}px,var(--line2) ${dw-1}px ${dw}px)`:"";

  // rows (collapse + filter)
  const q=view.q,filtering=view.who||view.st||q;
  const qa=[],qok=all.map(r=>{qa[r.level]=!q||r.name.toLowerCase().includes(q);return qa.slice(0,r.level+1).some(Boolean)}); // search: its own name, or a parent's (a ticket is found with everything under it)
  const match=r=>(!view.who||r.assignees.includes(view.who))&&(!view.st||r.st===view.st)&&qok[r.idx];
  const visible=new Array(all.length).fill(true),leaf=list&&view.leaf; // leaf = 一覧「成果物のみ」: top-level folders and the tagged tasks (deliverables) one step in under them
  if(filtering){
    for(let i=all.length-1;i>=0;i--){
      const r=all[i];
      if(r.parent){let any=false;for(let j=i+1;j<all.length&&all[j].level>r.level;j++)if(visible[j]&&(leaf?isDv(all[j]):!all[j].parent)){any=true;break}visible[i]=any} // 成果物のみ: only a deliverable keeps its folder on screen
      else visible[i]=match(r);
    }
  }
  let hideBelow=null,rowsHtml="",rowY=0;const vis=[],geo={},pa=[],RH=34; // pa = names of the parents above the row; rowY = where the next row starts, RH = a row's height (--rh in tempo.css)
  if(leaf&&!all.some(isDv))rowsHtml=`<div class="row dvhint"><div class="lc"><div class="c-name hint">成果物のタグが付いたタスクがありません。タスクを選んで右クリック →「成果物にする」で付けられます</div></div><div class="tl"></div></div>`;
  all.forEach((r,i)=>{
    pa[r.level]=r.name;
    if(hideBelow!==null){if(r.level>hideBelow)return;hideBelow=null}
    if(leaf&&(r.parent?r.level:!r.deliverable))return; // 成果物のみ: parents between the top folder and the task are left out (named in the tooltip), so their folding doesn't count; so are untagged tasks
    if(r.parent&&collapsed.has(r.id))hideBelow=r.level;
    if(!visible[i])return;
    const s=D(r.start),e=D(r.end),x=X(s),w=(e-s+1)*dw,bd=biz(s,e);
    // a lower parent, unfolded: a low heading row (.row.slim, 22px in tempo.css) without a summary bar or dates — its tasks are right below and its progress
    // in the table; many of these bars made the chart hard to read. Folded, the bar is all the chart shows of the group, so the full row is back
    const slim=r.parent&&r.level&&!collapsed.has(r.id),rh=slim?22:RH;
    const who=r.assignees.join("、"),id=esc(r.id);if(!slim)geo[r.id]={i:vis.length,s,e,y:rowY+rh/2};rowY+=rh;vis.push(r.id); // y: the row's middle, for the link arrows; a low row has no bar for an arrow to end at (a link kept from before the task got sub-tasks)
    let mark;
    if(slim)mark="";
    else if(r.milestone&&!r.parent){
      mark=`<div class="ms st-${r.st}" data-bar="${id}" style="left:${X(e)+dw/2-7}px" title="${esc(r.name)}"></div><span class="who" style="left:${X(e)+dw/2+12}px">${lab(r,s,e)}</span>`;
    }else{
      const urg=!r.parent&&r.st!=="done"&&r.st!=="over";
      mark=`<div class="bar st-${r.st}${r.parent?" sum":""}${urg?" urg dl"+delay(r):""}" data-bar="${id}" style="left:${x}px;width:${w}px" title="${esc(r.name)}｜${md(s)}〜${md(e)}｜${r.progress}%｜${ST[r.st]}"><div class="fill" style="width:${r.progress}%"></div>${!r.parent&&w>50?`<span class="bl">${esc(r.name)}</span>`:""}${r.parent?"":`<i class="h l"></i><i class="h r"></i>`}</div><span class="who" style="left:${x+w+6}px">${lab(r,s,e)}</span>`;
    }
    rowsHtml+=`<div class="row${r.parent?" parent":""}${r.parent?" pc":""}${slim?" slim":""}${r.id===editingId||sel.has(r.id)?" sel":""}"${r.parent?` style="--pc:${parColor(r)}"`:""} data-id="${id}">
      <div class="lc" data-open="${id}"><div class="c-name" style="padding-left:${6+(leaf?(r.level?1:0):r.level)*18}px">${r.parent?`<button type="button" class="tg" data-tg="${id}" aria-label="折りたたみ" aria-expanded="${!collapsed.has(r.id)}">${r.level?(collapsed.has(r.id)?"▸":"▾"):folder(!collapsed.has(r.id))}</button>`:`<span class="dot st-${r.st}${r.deliverable?" dv":""}" title="${ST[r.st]}${r.deliverable?"・成果物":""}"></span>`}<span class="tn"${leaf&&r.level>1?` title="${esc(pa.slice(1,r.level).join(" › "))}"`:""}>${esc(r.name)}</span></div><div class="c-as">${r.parent||readOnly?esc(who):`<button type="button" class="asbox${who?"":" none"}" data-as="${id}" aria-label="担当者を選ぶ" title="${esc(who)}"><span>${esc(who)||"担当なし"}</span><b aria-hidden="true">${who?"▾":"＋"}</b></button>`}</div><div class="c-d">${slim?"":md(s)}</div><div class="c-d">${slim?"":md(e)}</div><div class="c-n">${bd}</div><div class="c-p">${r.progress}%</div><div class="c-id">${id}</div><div class="c-st">${ST[r.st]}</div><div class="c-done">${list?doneCell(all,r,leaf):""}</div></div>
      <div class="tl">${mark}</div></div>`;
  });
  if(!readOnly)rowsHtml+=`<div class="row addrow"><div class="lc" data-act="add"><div class="c-name" style="padding-left:12px">＋ タスクを追加</div></div><div class="tl"></div></div>`;

  visOrder=vis;
  let lk="";const H0=75;
  all.forEach(r=>(r.deps||[]).forEach(pid=>{const A=geo[pid],B=geo[r.id];if(!A||!B)return;
    const x1=X(A.e+1),x2=X(B.s),up=B.i<A.i,y1=H0+A.y+(up?-10:10),y2=H0+B.y,xv=Math.min(x1-6,x2-10);
    lk+=`<path class="${B.s<=A.e?"bad":""}" d="M${xv} ${y1}V${y2}H${x2-1}" marker-end="url(#lk-arrow)"/>`;}));
  const linksSvg=lk?`<svg class="links" width="${tw}" height="${H0+rowY+RH}"><defs><marker id="lk-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--ink2)" stroke="none"/></marker></defs>${lk}</svg>`:"";
  const sl=chart.scrollLeft,st=chart.scrollTop;
  chart.classList.toggle("list",list); // 一覧: the same table without the timeline (tempo.css)
  chart.classList.toggle("noid",!view.ids);
  chart.innerHTML=`<div class="grid" style="--tw:${tw}px;width:calc(var(--lw) + ${tw}px)">
    <div class="bgl" style="${bgStyle}">${bg}</div>
    <div class="hdr"><div class="corner"><div class="c-name" style="flex:1;flex-direction:column;align-items:flex-start;gap:6px">${lockBar(p)}<small style="color:var(--ink2);font-size:10.5px">マイルストーン ▶</small>タスク</div><div class="c-as"><i class="lwh lwn" title="ドラッグでタスク列の幅を変更"></i>担当</div><div class="c-d">開始</div><div class="c-d">終了</div><div class="c-n" title="営業日">日数</div><div class="c-p">進捗</div><div class="c-id"><button type="button" class="tg" data-ids title="${view.ids?"ID の列を折りたたむ":"ID の列を表示"}" aria-label="ID の列の表示切り替え">${view.ids?"◂":"▸"}</button><span>ID</span></div><div class="c-st">状況</div><div class="c-done">完了</div><i class="lwh" title="ドラッグで幅を変更"></i></div><div class="ht" id="ht"><div class="band"></div>${top}${bot}${hint}${flags}</div></div>
    ${rowsHtml}${linksSvg}</div>`;
  if(scrolledFor!==curId+sc+list){scrolledFor=curId+sc+list;scrollInitial()}else{chart.scrollLeft=sl;chart.scrollTop=st}
  const lb=chart.querySelector(".sw.lock");if(lb&&lb.getAttribute("aria-pressed")!==lb.dataset.on){void lb.offsetWidth;lb.setAttribute("aria-pressed",lb.dataset.on)} // the lock switch changed since the last drawing: lockBar drew its old state, now it moves
}
function scrollToToday(){if(!range)return;const c=$("chart");c.scrollLeft=Math.max(0,(TODAY-range.a)*range.dw-120)}
function scrollInitial(){const p=projects[curId],o=p&&overall(p);if(!o||!o.rows.length||!range)return scrollToToday();
  const target=(TODAY>=o.mn-7&&TODAY<=o.mx+7)?TODAY:o.mn;$("chart").scrollLeft=Math.max(0,(target-range.a)*range.dw-120)}
