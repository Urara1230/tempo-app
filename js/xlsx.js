// Excel (.xlsx) read / write without a library: an .xlsx is a zip of XML files.
//   xlsxBlob(rows, {widths, head, freeze}) → Blob   rows = [[cell…]…]; cell = string | number | {date:"YYYY-MM-DD"}; row index `head` is bold, rows above `freeze` stay fixed
//   readXlsx(arrayBuffer) → Promise<rows>   first sheet only; dates come back as Excel serial numbers
const XL_NS='xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',XL_R="http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const XL_EPOCH=25569; // Excel serial number of 1970-01-01
const CRCT=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c}return t})();
const crc32=b=>{let c=~0;for(const x of b)c=CRCT[(c^x)&255]^(c>>>8);return~c>>>0};
// ponytail: stored (uncompressed) zip, no zip64 — fine for a schedule; compress if files ever reach MBs
function zip(files,type){
  const enc=new TextEncoder(),parts=[],cd=[];let off=0;
  for(const[name,text]of files){
    const n=enc.encode(name),d=enc.encode(text),crc=crc32(d);
    const h=new DataView(new ArrayBuffer(30));
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);h.setUint16(12,33,true);
    h.setUint32(14,crc,true);h.setUint32(18,d.length,true);h.setUint32(22,d.length,true);h.setUint16(26,n.length,true);
    const c=new DataView(new ArrayBuffer(46));
    c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint16(14,33,true);
    c.setUint32(16,crc,true);c.setUint32(20,d.length,true);c.setUint32(24,d.length,true);c.setUint16(28,n.length,true);c.setUint32(42,off,true);
    parts.push(h,n,d);cd.push(c,n);off+=30+n.length+d.length;
  }
  const e=new DataView(new ArrayBuffer(22)),size=cd.reduce((s,x)=>s+x.byteLength,0);
  e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,size,true);e.setUint32(16,off,true);
  return new Blob([...parts,...cd,e],{type});
}
async function unzip(buf){ // → {name: text} for the .xml / .rels entries
  const v=new DataView(buf),dec=new TextDecoder(),out={};
  let e=buf.byteLength-22;while(e>=0&&v.getUint32(e,true)!==0x06054b50)e--;if(e<0)throw new Error("not a zip");
  let p=v.getUint32(e+16,true);
  for(let i=v.getUint16(e+10,true);i>0;i--){
    const m=v.getUint16(p+10,true),size=v.getUint32(p+20,true),nl=v.getUint16(p+28,true),lo=v.getUint32(p+42,true);
    const name=dec.decode(new Uint8Array(buf,p+46,nl));p+=46+nl+v.getUint16(p+30,true)+v.getUint16(p+32,true);
    if(!/\.(xml|rels)$/.test(name))continue;
    const raw=new Uint8Array(buf,lo+30+v.getUint16(lo+26,true)+v.getUint16(lo+28,true),size);
    out[name]=m===0?dec.decode(raw):await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
  }
  return out;
}
const xe=s=>String(s).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,"").replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
const colL=i=>String.fromCharCode(65+i); // A–Z is enough here
function xlsxBlob(rows,{widths=[],head=0,freeze=head+1}={}){
  const X='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n',R='xmlns="http://schemas.openxmlformats.org/package/2006/relationships"',CT="application/vnd.openxmlformats-officedocument.spreadsheetml";
  const cell=(v,ref,hd)=>v==null||v===""?"":typeof v==="number"?`<c r="${ref}"><v>${v}</v></c>`
    :v.date?`<c r="${ref}" s="1"><v>${D(v.date)+XL_EPOCH}</v></c>`
    :`<c r="${ref}" t="inlineStr"${hd?' s="2"':""}><is><t xml:space="preserve">${xe(v)}</t></is></c>`;
  const data=rows.map((r,i)=>`<row r="${i+1}">${r.map((v,j)=>cell(v,colL(j)+(i+1),i===head)).join("")}</row>`).join("");
  const cols=widths.length?`<cols>${widths.map((w,j)=>`<col min="${j+1}" max="${j+1}" width="${w}" customWidth="1"/>`).join("")}</cols>`:"";
  const font=b=>`<font>${b?"<b/>":""}<sz val="11"/><name val="游ゴシック"/></font>`,xf=(f,n)=>`<xf numFmtId="${n}" fontId="${f}" fillId="0" borderId="0" xfId="0"${n?' applyNumberFormat="1"':""}${f?' applyFont="1"':""}/>`;
  return zip([
    ["[Content_Types].xml",X+`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="${CT}.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="${CT}.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="${CT}.styles+xml"/></Types>`],
    ["_rels/.rels",X+`<Relationships ${R}><Relationship Id="rId1" Type="${XL_R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml",X+`<workbook ${XL_NS} xmlns:r="${XL_R}"><sheets><sheet name="タスク" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels",X+`<Relationships ${R}><Relationship Id="rId1" Type="${XL_R}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${XL_R}/styles" Target="styles.xml"/></Relationships>`],
    ["xl/styles.xml",X+`<styleSheet ${XL_NS}><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy/mm/dd"/></numFmts><fonts count="2">${font(0)}${font(1)}</fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3">${xf(0,0)}${xf(0,164)}${xf(1,0)}</cellXfs></styleSheet>`],
    ["xl/worksheets/sheet1.xml",X+`<worksheet ${XL_NS}><sheetViews><sheetView workbookViewId="0"><pane ySplit="${freeze}" topLeftCell="A${freeze+1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${data}</sheetData></worksheet>`],
  ],CT+".sheet");
}
async function readXlsx(buf){
  const z=await unzip(buf),X=s=>new DOMParser().parseFromString(s||"","application/xml"),tag=(el,n)=>[...el.getElementsByTagName(n)];
  const text=el=>tag(el,"t").filter(t=>t.parentNode.nodeName!=="rPh").map(t=>t.textContent).join(""); // rPh = furigana added by Japanese Excel
  const ss=tag(X(z["xl/sharedStrings.xml"]),"si").map(text);
  const rid=tag(X(z["xl/workbook.xml"]),"sheet")[0].getAttribute("r:id");
  const tg=tag(X(z["xl/_rels/workbook.xml.rels"]),"Relationship").find(r=>r.getAttribute("Id")===rid).getAttribute("Target");
  const sh=X(z[tg.startsWith("/")?tg.slice(1):"xl/"+tg]);
  return tag(sh,"row").map(r=>{const a=[];let i=0;
    for(const c of tag(r,"c")){
      const ref=(c.getAttribute("r")||"").replace(/\d/g,"");if(ref)i=[...ref].reduce((n,ch)=>n*26+ch.charCodeAt(0)-64,0)-1;
      const t=c.getAttribute("t"),v=c.getElementsByTagName("v")[0]?.textContent;
      a[i++]=t==="s"?ss[+v]:t==="inlineStr"?text(c):t==="b"?v==="1":t==="str"||t==="e"?v:v==null?"":+v;
    }
    return a});
}
