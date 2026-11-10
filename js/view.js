// Rendering: header stats, timeline, task rows, bars. Stored data is not checked on the way in, so everything put into HTML here is escaped or validated.
// a parent row's color: its own, or the 完了 grey once every task under it is done (v0.0.14)
const pcol=r=>r.st==="done"?"var(--st-done)":parColor(r);
const mc=m=>"mc-"+(MSC.includes(m.color)?m.color:"blue"); // milestone color class: one of the five, never raw text
// fold button of a top-level parent: a closed folder when folded, an open one when unfolded (lower parents keep ▸ / ▾)
const folder=open=>`<svg class="fd${open?" open":""}" width="15" height="13" viewBox="0 0 15 13" aria-hidden="true">${open
  ?'<path d="M1 11.5V1.5h4l1.5 1.5H13v2.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M3.2 5.5h11.3l-2.4 6H.8z" fill="currentColor"/>'
  :'<path d="M.7 1.7a1 1 0 0 1 1-1h3.5l1.5 1.5h6.6a1 1 0 0 1 1 1v7.6a1 1 0 0 1-1 1H1.7a1 1 0 0 1-1-1z" fill="currentColor"/>'}</svg>`;
/* ---------- メモ (v0.0.14) ---------- */
// Markdown, the common forms only. All text is escaped first and the marks then become fixed tags: a note can't bring HTML of its own; links only http(s)
const mdIn=s=>{const code=[];s=esc(s).replace(/`([^`]+)`/g,(_,c)=>`\u0000${code.push(c)-1}\u0000`); // inline code: kept out of the rest
  return s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|[^"=>])(https?:\/\/[\w\-.~:/?#@!$&;=%+,]+)/g,'$1<a href="$2" target="_blank" rel="noopener">$2</a>') // ASCII only: Japanese right after a URL is not part of it
    .replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/(^|[^*])\*([^*\s](?:[^*]*[^*\s])?)\*/g,"$1<em>$2</em>").replace(/~~(.+?)~~/g,"<del>$1</del>") // no _italic_: motion names are full of _
    .replace(/\u0000(\d+)\u0000/g,(_,i)=>`<code>${code[i]}</code>`)};
const LI=/^(\s*)([-*+]|\d+[.)])\s+(.*)$/,HR=/^\s*([-*_])(\s*\1){2,}\s*$/,TS=/^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
// a list: an item's deeper lines are a list inside it, or more of its text; - [ ] / - [x] are shown ticked or not (changed only by editing)
function mdList(b){const ord=/^\s*\d/.test(b[0]),base=b[0].match(/^\s*/)[0].length;let h="",i=0;
  while(i<b.length){const m=LI.exec(b[i]);let t=m?m[3]:b[i].trim();i++;const sub=[],more=[];
    while(i<b.length&&b[i].match(/^\s*/)[0].length>base)sub.push(b[i++]);while(sub.length&&!LI.test(sub[0]))more.push(sub.shift().trim());
    const c=/^\[([ xX])\]\s+(.*)$/.exec(t);if(c)t=c[2];
    h+=`<li${c?' class="task"':""}>${c?`<input type="checkbox" disabled${c[1]===" "?"":" checked"}> `:""}${[t,...more].map(mdIn).join("<br>")}${sub.length?mdList(sub):""}</li>`}
  return(ord?"<ol>":"<ul>")+h+(ord?"</ol>":"</ul>")}
// blocks: ``` code, # headings, ---, > quotes, | tables |, lists, paragraphs (a line break stays a line break)
function mdHtml(src){const L=String(src??"").replace(/\r\n?/g,"\n").split("\n"),tbl=k=>k+1<L.length&&L[k].includes("|")&&L[k+1].includes("-")&&TS.test(L[k+1]);let h="",i=0,m;
  const cells=s=>s.trim().replace(/^\|/,"").replace(/\|$/,"").split("|");
  while(i<L.length){const l=L[i];
    if(/^\s*```/.test(l)){const b=[];i++;while(i<L.length&&!/^\s*```/.test(L[i]))b.push(L[i++]);i++;h+=`<pre><code>${esc(b.join("\n"))}</code></pre>`}
    else if(m=/^(#{1,6})\s+(.*)$/.exec(l)){h+=`<h${m[1].length}>${mdIn(m[2])}</h${m[1].length}>`;i++}
    else if(HR.test(l)){h+="<hr>";i++}
    else if(/^\s*>/.test(l)){const b=[];while(i<L.length&&/^\s*>/.test(L[i]))b.push(L[i++].replace(/^\s*>\s?/,""));h+=`<blockquote>${mdHtml(b.join("\n"))}</blockquote>`}
    else if(tbl(i)){const al=cells(L[i+1]).map(c=>/^\s*:-+:\s*$/.test(c)?"center":/-:\s*$/.test(c)?"right":""); // the alignment: one of two fixed words
      const row=(s,t)=>"<tr>"+cells(s).map((c,k)=>`<${t}${al[k]?` style="text-align:${al[k]}"`:""}>${mdIn(c.trim())}</${t}>`).join("")+"</tr>";
      h+=`<table><thead>${row(L[i],"th")}</thead><tbody>`;i+=2;while(i<L.length&&L[i].includes("|")&&L[i].trim())h+=row(L[i++],"td");h+="</tbody></table>"}
    else if(LI.test(l)){const b=[];while(i<L.length&&(LI.test(L[i])||b.length&&/^\s+\S/.test(L[i])))b.push(L[i++]);h+=mdList(b)}
    else if(!l.trim())i++;
    else{const b=[];while(i<L.length&&L[i].trim()&&!/^(#{1,6}\s|\s*```|\s*>)/.test(L[i])&&!LI.test(L[i])&&!HR.test(L[i])&&!tbl(i))b.push(mdIn(L[i++]));h+=`<p>${b.join("<br>")}</p>`}}
  return h}
// the right side while editing: the same drawing, edited where it is (contenteditable) — its checkboxes can be ticked
const prevHtml=md=>mdHtml(md).replaceAll('<input type="checkbox" disabled','<input type="checkbox"'); // notes are escaped: "<input" only comes from mdList
// ...and turned back into Markdown on each change: only the forms mdHtml draws are read, anything else as its text — so no HTML gets into a note
function mdOf(el){
  const inl=n=>[...n.childNodes].map(c=>{if(c.nodeType===3)return c.data.replace(/ /g," ");if(c.nodeType!==1)return"";const t=c.tagName,s=inl(c),w=k=>s.trim()?k+s+k:s;
    return t==="BR"?"\n":t==="STRONG"||t==="B"?w("**"):t==="EM"||t==="I"?w("*"):/^(DEL|S|STRIKE)$/.test(t)?w("~~"):t==="CODE"?(c.textContent?"`"+c.textContent+"`":"")
      :t==="A"?(c.getAttribute("href")===s?s:`[${s}](${c.getAttribute("href")})`):/^(INPUT|UL|OL)$/.test(t)?"":s}).join("");
  const list=(n,d)=>[...n.children].filter(li=>li.tagName==="LI").map((li,i)=>{const b=li.querySelector(":scope>input"),ind="  ".repeat(d);
    return[ind+(n.tagName==="OL"?`${i+1}. `:"- ")+(b?`[${b.checked?"x":" "}] `:"")+inl(li).trim().replace(/\n/g,"\n"+ind+"  "),...[...li.children].filter(c=>/^(UL|OL)$/.test(c.tagName)).map(c=>list(c,d+1))].join("\n")}).join("\n");
  const blk=n=>{if(n.nodeType!==1)return n.nodeType===3?n.data.trim():"";const t=n.tagName;
    if(/^H[1-6]$/.test(t))return"#".repeat(t[1])+" "+inl(n).replace(/\n/g," ").trim();
    if(t==="UL"||t==="OL")return list(n,0);
    if(t==="BLOCKQUOTE")return mdOf(n).split("\n").map(l=>l?"> "+l:">").join("\n");
    if(t==="PRE")return"```\n"+n.textContent.replace(/\n$/,"")+"\n```";
    if(t==="HR")return"---";
    if(t==="TABLE"){const r=[...n.rows],al=[...(r[0]?.cells||[])].map(c=>c.style.textAlign==="center"?":-:":c.style.textAlign==="right"?"--:":"---"),row=x=>"| "+[...x.cells].map(c=>inl(c).replace(/\n/g," ").replace(/\|/g,"｜").trim()).join(" | ")+" |"; // a | typed in a cell would start a new column: written full-width
      return r.length?[row(r[0]),"|"+al.join("|")+"|",...r.slice(1).map(row)].join("\n"):""}
    return n.querySelector(":scope>:is(p,div,ul,ol,table,pre,blockquote,h1,h2,h3,h4,h5,h6,hr)")?mdOf(n):inl(n).replace(/^\n+|\n+$/g,"")}; // a line the browser made (Enter): a paragraph
  return[...el.childNodes].map(blk).filter(s=>s.trim()).join("\n\n")}
// search hits on the page shown: each wrapped in <mark> (text nodes only, so nothing else of the page changes)
function markHits(el,q){const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),ns=[];while(w.nextNode())ns.push(w.currentNode);
  ns.forEach(n=>{const t=n.data,l=t.toLowerCase();let i=l.indexOf(q),a=0;if(i<0)return;const f=document.createDocumentFragment();
    for(;i>=0;i=l.indexOf(q,a)){f.append(t.slice(a,i));const k=document.createElement("mark");k.textContent=t.slice(i,i+q.length);f.append(k);a=i+q.length}
    f.append(t.slice(a));n.replaceWith(f)})}
// stored notes are not checked on the way in: only objects, title and md read as text
const notesOf=p=>Array.isArray(p?.notes)?p.notes.filter(n=>n&&typeof n==="object"&&(n.title=String(n.title??""),n.md=String(n.md??""),true)):[];
const noteMap=()=>{try{return JSON.parse(ls.get("mg.note"))||{}}catch(e){return{}}}; // the page last looked at, per project, this browser only
const pickNote=id=>{const m=noteMap();m[curId]=id;ls.set("mg.note",JSON.stringify(m))};
const curNote=p=>{const ns=notesOf(p),id=noteMap()[curId];return ns.find(n=>n.id===id)||ns[0]||null};
let memoEd=null; // the page being edited: {p, id, md0 = its text when editing began}
// the format buttons while editing (plan 4e): they work on the side the cursor was last in (ui.js mdTool); 0 = a divider
const MDTOOL=`<div class="mtool" role="toolbar" aria-label="書式"><select data-mdh aria-label="見出し" title="この行を見出し・本文にします"><option value="">見出し</option><option value="0">本文</option>${[1,2,3,4,5,6].map(n=>`<option value="${n}">見出し${n}</option>`).join("")}</select>`
  +[0,["b","<b>B</b>","太字（Ctrl+B）"],["i","<i>I</i>","斜体（Ctrl+I）"],["s","<s>S</s>","取り消し線"],["code","&lt;/&gt;","コード"],0,["ul","・リスト","箇条書き"],["ol","1. 番号","番号付きリスト"],["task","☑ チェック","チェックボックス付きリスト"],0,
    ["quote","引用","引用"],["hr","区切り線","区切り線"],["link","リンク","リンク（https://…）"],0,["table","表","表を入れる（3 列 × 2 行）"],["trow","＋行","表：カーソルのある行の下に行を追加"],["tcol","＋列","表：カーソルのある列の右に列を追加"],["tdrow","−行","表：カーソルのある行を削除"],["tdcol","−列","表：カーソルのある列を削除"]]
    .map(b=>b?`<button type="button" data-md="${b[0]}" title="${b[2]}" aria-label="${b[2]}">${b[1]}</button>`:'<span class="sep"></span>').join(""); // closed in renderMemo, after the Markdown switch
const mdSrc=()=>ls.get("mg.mdsrc")==="1"; // plan 4f: the Markdown on the left shown while editing (this browser); off = the page only
function renderMemo(p){const chart=$("chart"),ns=notesOf(p),cur=curNote(p),q=view.q,hits=s=>q?s.toLowerCase().split(q).length-1:0;scrolledFor=null; // back in the chart: open where it opens
  const tabs=ns.map(n=>{const k=hits(n.title+"\n"+n.md);return`<button type="button" role="tab" class="mtab${q&&!k?" dim":""}" data-note="${esc(n.id)}" aria-selected="${n===cur}"${readOnly?"":` draggable="true" title="ダブルクリックで名前を変更・ドラッグで並べ替え"`}>${esc(n.title)||"無題"}${k?`<span class="n">${k}</span>`:""}</button>`}).join("")
    +(readOnly?"":`<button type="button" class="mtab add" data-act="noteAdd" title="ページを追加" aria-label="ページを追加">＋</button>`);
  const acts=readOnly||!cur?"":memoEd?`<button class="btn pri" type="button" data-act="noteDone" title="保存して表示に戻ります（Esc でも同じ。Ctrl+Z で元に戻せます）">完了</button>`
    :`<button class="btn" type="button" data-act="noteEdit" title="編集（ページをダブルクリックでも同じ）">編集</button><button class="btn danger${memoArm?" arm":""}" type="button" data-act="noteDel">${memoArm?"もう一度押すとこのページを削除":"削除"}</button>`;
  const hd=`<div class="mhd">${lockBar(p)}<div class="mtabs" role="tablist" aria-label="メモのページ">${tabs}</div><span class="spacer"></span>${acts}</div>`;
  if(memoEd&&(memoEd.p!==curId||memoEd.id!==cur?.id||readOnly))leaveMemo(); // the page went away (undo, sync) or editing stopped being allowed
  const ed=chart.querySelector(".med");
  if(memoEd&&ed){chart.querySelector(".mhd").outerHTML=hd;const pv=$("notePrev");if(document.activeElement!==pv){pv.innerHTML=prevHtml($("noteIn").value);if(q)markHits(pv,q)}lockMove(chart);return} // editing: the box (and what is typed, on either side) stays, the rest is drawn again
  chart.innerHTML=`<div class="mv">${hd}${!cur?`<div class="empty"><div>メモはまだありません。チームの規則（命名ルール・納品チェックなど）を Markdown で書いておけます</div>${readOnly?"":'<button class="btn pri" type="button" data-act="noteAdd">ページを追加</button>'}</div>`
    :memoEd?`${MDTOOL}<span class="spacer"></span><button type="button" class="mdsw" data-md="src" aria-pressed="${mdSrc()}" title="左に Markdown（記号のままの文）を並べて表示します">Markdown</button></div><div class="med${mdSrc()?" src":""}"><textarea id="noteIn" spellcheck="false" aria-label="メモ（Markdown）">${esc(cur.md)}</textarea><div class="md mprev" id="notePrev" contenteditable="true" spellcheck="false" aria-label="プレビュー（ここでも直接編集できます）" title="ここでも直接書き換えられます（表の行・列や見出しの段階は左の Markdown で）">${prevHtml(cur.md)}</div></div>`
    :`<div class="md mview" role="tabpanel"${readOnly?"":` title="ダブルクリックで編集"`}>${mdHtml(cur.md)||`<p class="hint">${readOnly?"このページは空です":"空のページです。ダブルクリックか「編集」で書き始めます"}</p>`}</div>`}</div>`;
  if(q)chart.querySelectorAll(".md").forEach(el=>markHits(el,q));lockMove(chart)}
/* ---------- render ---------- */
function renderToolbar(){
  const ids=Object.keys(projects).sort((a,b)=>(projects[a].name||"").localeCompare(projects[b].name||""));
  $("projSel").innerHTML=ids.map(id=>`<option value="${esc(id)}"${id===curId?" selected":""}>${projects[id].shared?"👥 ":""}${esc(projects[id].name||"無題")}</option>`).join("")||`<option value="">プロジェクトなし</option>`;
  if(!storeRO)$("projSel").insertAdjacentHTML("beforeend",`<option value="+new">＋ 新しいプロジェクト</option>`); // v0.0.13: new projects from here (was a button in 設定)
  const p=projects[curId];
  readOnly=storeRO||!!(p?.shared&&(!sh.ok||sh.err||sh.newVer||!me||sh.mine!==p.id)); // a shared project is edited only while this page holds its lock (the switch in the corner): read-only otherwise — also offline, after a newer version, without a name
  const ms=p?members(p):[];
  if(view.who&&!ms.includes(view.who))view.who="";
  $("whoSel").innerHTML=`<option value="">（全員）</option>`+ms.map(m=>`<option${m===view.who?" selected":""}>${esc(m)}</option>`).join("");
  $("meSel").innerHTML=`<option value="">自分：未選択</option>`+[...new Set([...(p?roster(p):[]),...(me?[me]:[])])].map(m=>`<option value="${esc(m)}"${m===me?" selected":""}>自分：${esc(m)}</option>`).join("")+`<option data-in>名前を入力…</option>`; // not on the roster (a newcomer): typed in, ui.js meIn
  $("members").innerHTML=ms.map(m=>`<option value="${esc(m)}">`).join("");
  document.querySelectorAll("[data-scale]").forEach(b=>{b.setAttribute("aria-pressed",b.dataset.scale===view.scale);b.disabled=view.list});$("todayBtn").disabled=view.list; // no timeline in 一覧
  document.querySelectorAll("[data-view]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.view===(view.memo?"memo":view.list?"list":"gantt")));
  document.querySelector(".app").classList.toggle("memo",view.memo); // メモ: the chart's controls are hidden (tempo.css)
  $("qIn").title=view.memo?"このプロジェクトのメモを検索（Enter で次へ）":"このプロジェクトのタスクを名前で検索";$("qIn").setAttribute("aria-label",view.memo?"メモを検索":"タスク名で検索");
  $("leafBtn").setAttribute("aria-pressed",view.leaf); // 一覧 and the chart alike (v0.0.9; until then 一覧 only)
  const rp=refOf();$("refSel").disabled=view.list||!p; // the overlay is in the chart only
  $("refSel").innerHTML=`<option value="">重ねて表示：なし</option>`+ids.filter(id=>id!==curId).map(id=>`<option value="${esc(id)}"${projects[id]===rp?" selected":""}>重ねて表示：${projects[id].shared?"👥 ":""}${esc(projects[id].name||"無題")}</option>`).join("");
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
  $("chips").innerHTML=Object.keys(ST).filter(k=>cnt[k]).map(k=>`<button type="button" class="chip st-${k}" data-st="${k}" aria-pressed="${view.st===k}"${view.st===k?' title="もう一度押すと絞り込み解除"':""}>${view.st===k?'<b class="x" aria-hidden="true">×</b>':'<span class="dot"></span>'}${ST[k]} <span class="n">${cnt[k]}</span></button>`).join(""); // pressed again = filter off: a × in the status color in place of its dot says so (v0.0.14; was a 絞り込み解除 chip, which pushed the row onto two lines)
}

// edit lock in the task table's corner (shared projects only): a switch with a padlock on its knob. Off = nobody edits, the project is read-only
// (a press takes the lock and editing starts). On = locked: mine (a press ends editing) or someone else's (.other; pressed twice it is released). Without 自分 it is shut, grey, and can't be pressed.
// data-on = the state now; it is drawn in the state it had last time (lkWas) and render() then moves it, so the switch's motion runs
function lockBar(p){if(!p.shared||!sh.ok||sh.err||sh.newVer)return"";const o=lockOther(p.id);if(!o)lkArmed=false;
  const mine=sh.mine===p.id,on=String(!me||!!o||mine),was=lkWas||on;lkWas=on;
  return`<div class="lk"><button type="button" class="sw lock${o?" other":""}${lkArmed||mine&&sh.bare?" arm":""}" data-lk="${o?"force":mine?"end":"take"}" data-on="${on}" aria-pressed="${was}"${me?"":" disabled"} title="${!me?"":o?"2 回押すと、ロックを強制的に解除します":mine?"押すと編集を終了します":"押すとロックして編集を始めます"}"><em></em>${!me?"上の「自分」で名前を選ぶと編集できます"
    :o?(lkArmed?`もう一度押すと${esc(o.by||"")}さんのロックを解除`:`${esc(o.by||"だれか")}さんが編集中（閲覧のみ）`)
    :mine?(sh.bare?"編集中（ロックなし：ほかの人も同時に編集できます）":"編集中（ほかの人は閲覧のみ）"):"閲覧のみ（編集するにはこのスイッチを押します）"}</button></div>`}
// start / end date cells: a small ½ marks a half day (the cell is too narrow for 午後 / 午前; the tooltip says which)
const dS=h=>md(h>>1)+(h&1?'<sup class="half" title="午後から">½</sup>':""),dE=h=>md(h>>1)+(h&1?"":'<sup class="half" title="午前まで">½</sup>');
// days off (土日・祝日・会社の休日, as for 営業日) on a bar running from slot h0 to h1: grey pieces, days off in a row as one (v0.0.9). dw = a day's width
function offSegs(h0,h1,dw){let o="";for(let n=h0>>1;n<=h1>>1;n++)if(isOff(n)){let m=n;while(m<h1>>1&&isOff(m+1))m++;const a0=Math.max(2*n,h0),b0=Math.min(2*m+1,h1);
  o+=`<i class="offd" style="left:${(a0-h0)*dw/2}px;width:${(b0-a0+1)*dw/2}px"></i>`;n=m}return o}
const isDv=r=>!!r.deliverable&&!r.parent; // a deliverable (成果物): tagged, and only while it has no sub-tasks — like the milestone flag
// task icon (v0.0.12): the picture in a circle (a square for a deliverable) ringed in the status color, in place of the dot; a folder's after its fold button, ringed in its color.
// icon.x / y = the point of the picture at the middle (0–1), z = zoom (1 = its shorter side fills the circle). Not shown until the picture is read (storage.js imgOf)
const num=(v,a,b,d)=>{v=+v;return Number.isFinite(v)?Math.min(b,Math.max(a,v)):d};
const icoPos=(c,i)=>{const z=num(i.z,1,5,1),m=Math.min(c.w,c.h),W=z*c.w/m*100,V=z*c.h/m*100;return`width:${W}%;height:${V}%;left:${50-num(i.x,0,1,.5)*W}%;top:${50-num(i.y,0,1,.5)*V}%`}; // c = the picture's size, i = the icon
function ico(r){const c=r.icon&&imgOf(r.icon.file);if(!c)return"";
  return`<span class="ico${r.parent?"":` st-${r.st}`}${isDv(r)?" dv":""}" data-img="${r.icon.file}" role="img" aria-label="${r.parent?"アイコン":ST[r.st]+(isDv(r)?"・成果物":"")}"><img src="${c.url}" alt="" style="${icoPos(c,r.icon)}"></span>`}
// 一覧 view, 完了 column: a leaf has a checkbox (100% ⇄ 0%); a parent shows 完了 when every task under it is done, else done / all.
// dvOnly (成果物のみ): a folder counts its deliverables only, — when it has none
function doneCell(all,r,dvOnly){
  if(!r.parent)return readOnly?(r.progress>=100?"完了":"未完了"):`<input type="checkbox" data-done="${esc(r.id)}"${r.progress>=100?" checked":""} aria-label="完了">`;
  let n=0,d=0;for(let j=r.idx+1;j<all.length&&all[j].level>r.level;j++)if(dvOnly?isDv(all[j]):!all[j].parent){n++;if(all[j].progress>=100)d++}
  return !n?"—":d===n?"完了":`${d}/${n}`}
/* overlay (v0.0.10): another project under this one on the same timeline — all of it (this project's filters don't apply; 成果物のみ does, as above), read-only.
   Its rows have no data-id / data-open / data-bar / data-ms, so nothing on them can be picked, opened, dragged or dropped on; only folding (data-rtg) works.
   Workdays, statuses and grey days off use the open project's company holidays (coHol), as everything on screen does */
function refRows(rp,all,rms,X,XH,dw){
  const shutAll=refFold.has(""),leaf=view.leaf,pa=[],fl=rms.map(m=>{const n=D(m.date);return`<span class="flag ${mc(m)}" style="left:${X(n)+dw/2-4}px" title="${md(n)} ${esc(m.title)}">${FLAG}<span>${esc(m.title)||md(n)}</span></span>`}).join("");
  let h=`<div class="row refhd"><div class="lc"><div class="c-name"><button type="button" class="tg" data-rtg="" aria-label="折りたたみ" aria-expanded="${!shutAll}">${shutAll?"▸":"▾"}</button><span class="tn">${rp.shared?"👥 ":""}${esc(rp.name||"無題")}</span><small>重ねて表示（閲覧のみ）全体進捗 ${overall(rp).pct}%${leaf&&!all.some(isDv)?"・成果物なし":""}</small></div></div><div class="tl">${fl}</div></div>`;
  if(shutAll)return h;
  let hide=null;
  all.forEach(r=>{
    pa[r.level]=r.name;
    if(hide!==null){if(r.level>hide)return;hide=null}
    if(leaf&&(r.parent?r.level:!r.deliverable))return; // 成果物のみ, as for this project's rows
    const shut=r.parent&&refFold.has(r.id);if(shut)hide=r.level;
    const h0=hs(r),h1=he(r),x=XH(h0),w=(h1-h0+1)*dw/2,slim=r.parent&&r.level&&!shut,id=esc(r.id),urg=!r.parent&&r.st!=="done"&&r.st!=="over";
    const mark=slim?"":r.milestone&&!r.parent?`<div class="ms st-${r.st}" style="left:${X(h1>>1)+dw/2-7}px" title="${esc(r.name)}"></div><span class="who" style="left:${X(h1>>1)+dw/2+12}px">${lab(r,h0,h1)}</span>`
      :`<div class="bar st-${r.st}${r.parent?" sum":""}${urg?" urg dl"+delay(r):""}" style="left:${x}px;width:${w}px" title="${esc(r.name)}｜${ST[r.st]}"><div class="fill" style="width:${r.progress}%"></div>${offSegs(h0,h1,dw)}${!r.parent&&w>50?`<span class="bl">${esc(r.name)}</span>`:""}</div><span class="who" style="left:${x+w+6}px">${lab(r,h0,h1)}</span>`;
    h+=`<div class="row ref${r.parent?" parent pc":""}${slim?" slim":""}"${r.parent?` style="--pc:${pcol(r)}"`:""}><div class="lc"><div class="c-name" style="padding-left:${6+(leaf?(r.level?1:0):r.level)*18}px">${r.parent?`<button type="button" class="tg" data-rtg="${id}" aria-label="折りたたみ" aria-expanded="${!shut}">${r.level?(shut?"▸":"▾"):folder(!shut)}</button>${ico(r)}`:ico(r)||`<span class="dot st-${r.st}${r.deliverable?" dv":""}" title="${ST[r.st]}"></span>`}<span class="tn"${leaf&&r.level>1?` title="${esc(pa.slice(1,r.level).join(" › "))}"`:""}>${esc(r.name)}</span></div><div class="c-as">${esc(r.assignees.join("、"))}</div><div class="c-d">${slim?"":dS(h0)}</div><div class="c-d">${slim?"":dE(h1)}</div><div class="c-n">${bizH(h0,h1)}</div><div class="c-p">${r.progress}%</div></div><div class="tl">${mark}</div></div>`;
  });
  return h;
}
function render(){
  const p=projects[curId];if(p&&H(p.id).last==null)H(p.id).last=snap(p); // undo starts from the state first shown
  renderToolbar();renderTools();syncForm();
  const chart=$("chart");if(!store||!p||view.memo)splitOn(false);
  if(!store){chart.innerHTML=`<div class="empty"><i class="spin"></i>読み込み中…</div>`;return}
  if(!p){chart.innerHTML=`<div class="empty"><div>プロジェクトがまだありません。</div><button class="btn pri" type="button" data-act="newproj">プロジェクトを作成</button></div>`;return}
  chart.classList.toggle("memo",view.memo);if(view.memo)return renderMemo(p);
  const all=derive(p);if(sel.size){const ids=new Set(all.map(r=>r.id));sel.forEach(id=>{if(!ids.has(id))sel.delete(id)})} // a kept selection (v0.0.16) whose task is gone
  const sc=view.scale, list=view.list, dw=sc==="day"?30:sc==="week"?12:4;
  const rp=list?null:refOf(),ra=rp?derive(rp):[],rms=(rp?.milestones||[]).filter(m=>m&&isDay(m.date));ra.forEach(r=>r.ref=1); // overlay (v0.0.10); r.ref: no progress button in lab()
  let mn=TODAY,mx=TODAY;[...all,...ra].forEach(r=>{mn=Math.min(mn,D(r.start));mx=Math.max(mx,D(r.end))});[...(p.milestones||[]),...rms].forEach(m=>{mn=Math.min(mn,D(m.date));mx=Math.max(mx,D(m.date))});
  // today ± half a year, stretched only to cover this project's own dates (and the overlaid one's)
  let a=Math.min(TODAY-183,mn-10),b=Math.max(TODAY+183,mx+10);
  if(sc==="week")while(dow(a)!==1)a--;
  if(sc==="month"){const d=dt(a);a=D(`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-01`)}
  range={a,b,dw};
  const tw=(b-a+1)*dw;
  const X=n=>(n-a)*dw,XH=h=>(h/2-a)*dw; // XH: where a half-day slot starts

  // header
  let top="",bot="",bg="";
  const monthRuns=[];
  for(let n=a;n<=b;){const d=dt(n),y=d.getUTCFullYear(),m=d.getUTCMonth();let e=n;while(e+1<=b&&dt(e+1).getUTCMonth()===m)e++;monthRuns.push({n,e,y,m});n=e+1}
  if(sc==="month"){
    for(let i=0;i<monthRuns.length;){const y=monthRuns[i].y;let j=i;while(j+1<monthRuns.length&&monthRuns[j+1].y===y)j++;top+=`<div class="hc top" style="left:${X(monthRuns[i].n)}px;width:${(monthRuns[j].e-monthRuns[i].n+1)*dw}px"><span>${y}年</span></div>`;i=j+1}
    monthRuns.forEach(r=>{bot+=`<div class="hc bot" style="left:${X(r.n)}px;width:${(r.e-r.n+1)*dw}px">${r.m+1}月</div>`;bg+=`<div class="vl" style="left:${X(r.n)}px"></div>`});
  }else{
    monthRuns.forEach(r=>{top+=`<div class="hc top" style="left:${X(r.n)}px;width:${(r.e-r.n+1)*dw}px"><span>${r.y}年${r.m+1}月</span></div>`});
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
  const visible=new Array(all.length).fill(true),leaf=view.leaf; // leaf = 「成果物のみ」 (一覧 and the chart): top-level folders and the tagged tasks (deliverables) one step in under them
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
    const s=D(r.start),e=D(r.end),h0=hs(r),h1=he(r),x=XH(h0),w=(h1-h0+1)*dw/2,bd=bizH(h0,h1);
    // a lower parent, unfolded: a low heading row (.row.slim, 22px in tempo.css) without a summary bar or dates — its tasks are right below and its progress
    // in the table; many of these bars made the chart hard to read. Folded, the bar is all the chart shows of the group, so the full row is back
    const slim=r.parent&&r.level&&!collapsed.has(r.id),rh=slim?22:RH;
    const who=r.assignees.join("、"),id=esc(r.id);if(!slim)geo[r.id]={i:vis.length,h0,h1,y:rowY+rh/2};rowY+=rh;vis.push(r.id); // y: the row's middle, for the link arrows; a low row has no bar for an arrow to end at (a link kept from before the task got sub-tasks)
    let mark;
    if(slim)mark="";
    else if(r.milestone&&!r.parent){
      mark=`<div class="ms st-${r.st}" data-bar="${id}" style="left:${X(e)+dw/2-7}px" title="${esc(r.name)}"></div><span class="who" style="left:${X(e)+dw/2+12}px">${lab(r,h0,h1)}</span>`;
    }else{
      const urg=!r.parent&&r.st!=="done"&&r.st!=="over";
      mark=`<div class="bar st-${r.st}${r.parent?" sum":""}${urg?" urg dl"+delay(r):""}" data-bar="${id}" style="left:${x}px;width:${w}px" title="${esc(r.name)}｜${md(s)}${h0&1?"午後":""}〜${md(e)}${h1&1?"":"午前"}｜${r.progress}%｜${ST[r.st]}"><div class="fill" style="width:${r.progress}%"></div>${offSegs(h0,h1,dw)}${!r.parent&&w>50?`<span class="bl">${esc(r.name)}</span>`:""}${r.parent?"":`<i class="h l"></i><i class="h r"></i>`}</div><span class="who" style="left:${x+w+6}px">${lab(r,h0,h1)}</span>`;
    }
    rowsHtml+=`<div class="row${r.parent?" parent":""}${r.parent?" pc":""}${slim?" slim":""}${r.id===editingId||sel.has(r.id)?" sel":""}"${r.parent?` style="--pc:${pcol(r)}"`:""} data-id="${id}">
      <div class="lc" data-open="${id}"><div class="c-name" style="padding-left:${6+(leaf?(r.level?1:0):r.level)*18}px">${r.parent?`<button type="button" class="tg" data-tg="${id}" aria-label="折りたたみ" aria-expanded="${!collapsed.has(r.id)}">${r.level?(collapsed.has(r.id)?"▸":"▾"):folder(!collapsed.has(r.id))}</button>${ico(r)}`:ico(r)||`<span class="dot st-${r.st}${r.deliverable?" dv":""}" title="${ST[r.st]}${r.deliverable?"・成果物":""}"></span>`}<span class="tn"${leaf&&r.level>1?` title="${esc(pa.slice(1,r.level).join(" › "))}"`:""}>${esc(r.name)}</span></div><div class="c-as">${r.parent||readOnly?esc(who):`<button type="button" class="asbox${who?"":" none"}" data-as="${id}" aria-label="担当者を選ぶ" title="${esc(who)}"><span>${esc(who)||"担当なし"}</span><b aria-hidden="true">${who?"▾":"＋"}</b></button>`}</div><div class="c-d">${slim?"":dS(h0)}</div><div class="c-d">${slim?"":dE(h1)}</div><div class="c-n">${bd}</div><div class="c-p">${r.progress}%</div><div class="c-id">${id}</div><div class="c-st"><span class="dot st-${r.st}"></span>${ST[r.st]}</div><div class="c-done">${list?doneCell(all,r,leaf):""}</div></div>
      <div class="tl">${mark}</div></div>`;
  });
  if(!readOnly)rowsHtml+=`<div class="row addrow"><div class="lc" data-act="add"><div class="c-name" style="padding-left:12px">＋ タスクを追加</div></div><div class="tl"></div></div>`;

  visOrder=vis;
  let lk="";const H0=75;
  all.forEach(r=>(r.deps||[]).forEach(pid=>{const A=geo[pid],B=geo[r.id];if(!A||!B)return;
    const x1=XH(A.h1+1),x2=XH(B.h0),up=B.i<A.i,y1=H0+A.y+(up?-10:10),y2=H0+B.y,xv=Math.min(x1-6,x2-10);
    lk+=`<path class="${B.h0<=A.h1?"bad":""}" d="M${xv} ${y1}V${y2}H${x2-1}" marker-end="url(#lk-arrow)"/>`;}));
  const linksSvg=lk?`<svg class="links" width="${tw}" height="${H0+rowY+RH}"><defs><marker id="lk-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--ink2)" stroke="none"/></marker></defs>${lk}</svg>`:"";
  const cr=$("chartRef"),sl=chart.scrollLeft,st=chart.scrollTop,st2=cr.scrollTop;splitOn(!!rp);
  cr.classList.toggle("noid",!view.ids);cr.classList.toggle("narrow",!view.cols);
  cr.innerHTML=rp?`<div class="grid" style="--tw:${tw}px;width:calc(var(--lc) + ${tw}px)"><div class="bgl" style="${bgStyle}">${bg}</div>${refRows(rp,ra,rms,X,XH,dw)}</div>`:""; // the lower pane: no date header, the upper one's is shared
  chart.classList.toggle("list",list); // 一覧: the same table without the timeline (tempo.css)
  chart.classList.toggle("noid",!view.ids);
  chart.classList.toggle("narrow",!view.cols); // ガント: 担当・開始・終了・日数・進捗 folded away, the task names only (v0.0.14)
  chart.innerHTML=`<div class="grid" style="--tw:${tw}px;width:calc(var(--lc) + ${tw}px)">
    <div class="bgl" style="${bgStyle}">${bg}</div>
    <div class="hdr"><div class="corner"><div class="c-name" style="flex:1;flex-direction:column;align-items:flex-start;gap:6px">${lockBar(p)}<small style="color:var(--ink2);font-size:11px">マイルストーン ▶</small>タスク</div><div class="c-fold"><button type="button" class="fold" data-cols title="${view.cols?"担当・開始・終了・日数・進捗の列を隠して、タイムラインを広くします":"担当・開始・終了・日数・進捗の列を表示します"}" aria-expanded="${view.cols}">${view.cols?"◂ 列を隠す":"列を表示 ▸"}</button></div><div class="c-as"><i class="lwh lwn" title="ドラッグでタスク列の幅を変更"></i>担当</div><div class="c-d">開始</div><div class="c-d">終了</div><div class="c-n" title="営業日">日数</div><div class="c-p">進捗</div><div class="c-id"><button type="button" class="tg" data-ids title="${view.ids?"ID の列を折りたたむ":"ID の列を表示"}" aria-label="ID の列の表示切り替え">${view.ids?"◂":"▸"}</button><span>ID</span></div><div class="c-st">状況</div><div class="c-done">完了</div><i class="lwh" title="ドラッグで幅を変更"></i></div><div class="ht" id="ht"><div class="band"></div>${top}${bot}${hint}${flags}</div></div>
    ${rowsHtml}${linksSvg}</div>`;
  if(scrolledFor!==curId+sc+list){scrolledFor=curId+sc+list;if(stPos){chart.scrollLeft=stPos[0];chart.scrollTop=stPos[1];cr.scrollTop=stPos[2];stPos=null}else scrollInitial()} // stPos: where it was before a reload / a switch of project (v0.0.16)
  else{chart.scrollLeft=sl;chart.scrollTop=st;cr.scrollTop=st2}
  cr.scrollLeft=chart.scrollLeft;whoGone();
  lockMove(chart);stSave();
}
// overlay in two panes (v0.0.16): the lower pane and its divider show only while a project is overlaid on the chart; the upper pane's share is kept in mg.split
const splitR=()=>{const v=+ls.get("mg.split");return v>=.15&&v<=.85?v:.5};
function splitOn(on){const w=$("charts");w.classList.toggle("split",on);$("refBar").hidden=$("chartRef").hidden=!on;if(on){w.style.setProperty("--sp",splitR());$("refBar").setAttribute("aria-valuenow",Math.round(splitR()*100))}else $("chartRef").innerHTML=""}
// the lock switch changed since the last drawing: lockBar drew its old state, now it moves
function lockMove(c){const lb=c.querySelector(".sw.lock");if(lb&&lb.getAttribute("aria-pressed")!==lb.dataset.on){void lb.offsetWidth;lb.setAttribute("aria-pressed",lb.dataset.on)}}
// today (or the project's start) about a quarter of the way into the visible timeline, so the days just before it show too (v0.0.13; was 120 px)
const lead=()=>{const c=$("chart");return Math.max(120,(c.clientWidth-(c.querySelector(".corner")?.offsetWidth||0))/4)};
function scrollToToday(){if(!range)return;const c=$("chart");c.scrollLeft=Math.max(0,(TODAY-range.a)*range.dw-lead());whoGone()}
function scrollInitial(){const p=projects[curId],o=p&&overall(p);if(!o||!o.rows.length||!range)return scrollToToday();
  const target=(TODAY>=o.mn-7&&TODAY<=o.mx+7)?TODAY:o.mn;$("chart").scrollLeft=Math.max(0,(target-range.a)*range.dw-lead());whoGone()}
// a bar label whose start has scrolled away under the task table is hidden: half a label tells nothing (v0.0.13). Run after drawing and on scroll (ui.js)
function whoGone(){const c=$("chart"),s=c.scrollLeft,ps=[c,$("chartRef")];ps.forEach(p=>p.querySelectorAll(".tl .who").forEach(w=>w.classList.toggle("gone",parseFloat(w.style.left)<s)));
  // a month label / a bar's name sticks right of the task table (v0.0.14); where its month or bar shows too little of it, it would be cut: hidden too. Read all, then write
  const e=c.querySelector(".corner")?.getBoundingClientRect().right;if(e==null)return;const ls=ps.flatMap(p=>[...p.querySelectorAll("#ht .hc.top span,.tl .bl")]),cut=ls.map(l=>l.getBoundingClientRect().left<e-1);ls.forEach((l,i)=>l.classList.toggle("gone",cut[i]))}
