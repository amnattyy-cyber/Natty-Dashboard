const SPREADSHEET_ID = "1gw9c97wtVitsn5B8P9ugwavD4xOGf3M_RScNGvk_hNM";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`;
const PERF_HEADERS = ["Report Date","Service","Region","No Shop","Rev Request","Rev Save","Churn Value","Budget Churn Month","Cutoff Day","Days in Month","Save Rate","RR Churn","RR / Cap","Tier"];
const DOWN_HEADERS = ["Report Date","Region","No Shop","Budget Downsell","Downsell Retention","Downsell Aftersale","Cutoff Day","Days in Month","Total Downsell","RR Downsell","MTD / Budget","RR / Budget","Over Budget Records","Status"];
let store = { performance: [], downsell: [], live: false };

const $ = id => document.getElementById(id);
const n = value => Number(value || 0);
const sum = (rows, key) => rows.reduce((a,r)=>a+n(r[key]),0);
const fmtMoney = value => new Intl.NumberFormat("th-TH",{notation:"compact",maximumFractionDigits:2}).format(n(value));
const fmtFull = value => new Intl.NumberFormat("th-TH",{maximumFractionDigits:0}).format(n(value));
const fmtSignedFull = value => `${n(value)>0?"+":""}${fmtFull(value)}`;
const fmtPct = value => `${(n(value)*100).toFixed(1)}%`;
const fmtPP = value => `${value>=0?"+":""}${(n(value)*100).toFixed(2)} pp`;
const fmtDelta = value => `${value>=0?"+":""}${(n(value)*100).toFixed(1)}%`;
const dateKey = value => {
  if (value instanceof Date) return value.toISOString().slice(0,10);
  const s=String(value||""); const m=s.match(/Date\((\d+),(\d+),(\d+)\)/);
  if(m) return `${m[1]}-${String(+m[2]+1).padStart(2,"0")}-${String(m[3]).padStart(2,"0")}`;
  return s.slice(0,10);
};
const fmtDate = value => { const d=new Date(`${dateKey(value)}T00:00:00`); return isNaN(d)?"—":d.toLocaleDateString("th-TH",{day:"numeric",month:"short",year:"numeric"}); };
const deltaClass = (value, inverse=false) => Math.abs(value)<.0005?"neutral":((inverse?value<0:value>0)?"good":"bad");
const rowObjects = (rows, headers) => rows.map(row=>Object.fromEntries(headers.map((h,i)=>[h,i===0?dateKey(row[i]):row[i]])));

function loadGviz(sheet){
  return new Promise((resolve,reject)=>{
    const cb=`__gviz_${sheet.replace(/\W/g,"_")}_${Date.now()}`;
    const timer=setTimeout(()=>{cleanup();reject(new Error("timeout"));},12000);
    const script=document.createElement("script");
    function cleanup(){clearTimeout(timer);delete window[cb];script.remove();}
    window[cb]=response=>{cleanup(); if(!response?.table){reject(new Error("invalid response"));return;} resolve(response.table.rows.map(r=>r.c.map(c=>c?.v??"")));};
    script.onerror=()=>{cleanup();reject(new Error("network"));};
    script.src=`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json;responseHandler:${cb}&sheet=${encodeURIComponent(sheet)}&headers=1`;
    document.head.appendChild(script);
  });
}

async function loadData(){
  const status=$("dataStatus"); status.className="status-pill"; status.innerHTML="<span></span>กำลังโหลดข้อมูล...";
  try{
    const [performance,downsell]=await Promise.all([loadGviz("Performance_Daily"),loadGviz("Downsell_Area_Daily")]);
    store={performance:rowObjects(performance,PERF_HEADERS),downsell:rowObjects(downsell,DOWN_HEADERS),live:true};
    status.className="status-pill live"; status.innerHTML="<span></span>Live from Google Sheet";
  }catch(error){
    store={performance:rowObjects(window.RETENTION_FALLBACK.performance,PERF_HEADERS),downsell:rowObjects(window.RETENTION_FALLBACK.downsell,DOWN_HEADERS),live:false};
    status.className="status-pill fallback"; status.innerHTML="<span></span>Snapshot • รอสิทธิ์ Google Sheet";
  }
  populateRegions(); render();
}

function populateRegions(){
  const select=$("regionFilter"), current=select.value;
  const regions=[...new Set([...store.performance.map(r=>r.Region),...store.downsell.map(r=>r.Region)].filter(x=>x&&x!=="ALL"))].sort();
  select.innerHTML='<option value="ALL">ทุกพื้นที่</option>'+regions.map(x=>`<option value="${x}">${x}</option>`).join("");
  if(regions.includes(current)) select.value=current;
}

function aggregatePerformance(rows){
  const request=sum(rows,"Rev Request"), save=sum(rows,"Rev Save"), churn=sum(rows,"Churn Value"), budget=sum(rows,"Budget Churn Month"), rr=sum(rows,"RR Churn");
  return {request,save,churn,budget,rr,saveRate:request?save/request:0,rrCap:budget?rr/budget:0,shops:sum(rows,"No Shop")};
}
function latestRows(service,region){
  let pool=store.performance.filter(r=>(service==="ALL"||r.Service===service)&&(region==="ALL"||r.Region===region));
  if(store.live) pool=pool.filter(r=>r.Region!=="ALL");
  if(!store.live&&region==="ALL"&&pool.some(r=>r.Region==="ALL")) pool=pool.filter(r=>r.Region==="ALL");
  const dates=[...new Set(pool.map(r=>r["Report Date"]))].sort();
  const latest=dates.at(-1), prior=dates.at(-2);
  return {latest,prior,now:pool.filter(r=>r["Report Date"]===latest),before:pool.filter(r=>r["Report Date"]===prior)};
}
function delta(now,before){return before?(now-before)/before:0;}

function renderKpis(now,before){
  const items=[
    ["Request",fmtMoney(now.request),"ล้านบาท",delta(now.request,before.request),false,"#1c3f79"],
    ["Save",fmtMoney(now.save),"ล้านบาท",delta(now.save,before.save),false,"#00a7a0"],
    ["Churn",fmtMoney(now.churn),"ล้านบาท",delta(now.churn,before.churn),true,"#d83578"],
    ["Save rate",fmtPct(now.saveRate),`เปลี่ยน ${fmtPP(now.saveRate-before.saveRate)}`,now.saveRate-before.saveRate,false,"#26a269"],
    ["Run rate / Cap",fmtPct(now.rrCap),now.rrCap>1?"สูงกว่า Cap":"อยู่ใน Cap",1-now.rrCap,false,"#f09b45"]
  ];
  $("kpiGrid").innerHTML=items.map(([label,value,note,d,inverse,color])=>`<article class="kpi" style="--accent:${color}"><div class="kpi__label">${label}</div><div class="kpi__value">${value}</div><div class="kpi__note"><span class="delta ${deltaClass(d,inverse)}">${label==="Save rate"?note:label==="Run rate / Cap"?note:fmtDelta(d)+" MoM"}</span>${label!=="Save rate"&&label!=="Run rate / Cap"?` • ${note}`:""}</div></article>`).join("");
}

function serviceCard(service){
  const {now,before}=latestRows(service,"ALL"), a=aggregatePerformance(now), b=aggregatePerformance(before);
  const churnMom=delta(a.churn,b.churn), savePP=a.saveRate-b.saveRate;
  return `<article class="service-card ${service.toLowerCase()}"><div class="service-card__head"><div><small>SERVICE PERFORMANCE</small><h3>${service}</h3></div><div class="service-card__rate"><strong>${fmtPct(a.saveRate)}</strong><small>Save rate <span class="delta ${deltaClass(savePP)}">${fmtPP(savePP)}</span></small></div></div><div class="service-card__metrics"><div class="service-card__metric"><small>Request</small><strong>${fmtMoney(a.request)}</strong></div><div class="service-card__metric"><small>Save</small><strong>${fmtMoney(a.save)}</strong></div><div class="service-card__metric"><small>Churn</small><strong>${fmtMoney(a.churn)}</strong></div></div><div class="service-card__foot"><span>Churn MoM <strong>${fmtDelta(churnMom)}</strong></span><span>RR / Cap <strong>${fmtPct(a.rrCap)}</strong></span></div></article>`;
}

function comparisonCard(label,now,before,inverse=false){
  const mx=Math.max(now,before)||1, d=delta(now,before);
  return `<article class="comparison-card"><div class="comparison-card__head"><h3>${label}</h3><span class="delta ${deltaClass(d,inverse)}">${fmtDelta(d)}</span></div><div class="comparison-chart"><div class="month-col"><strong>${fmtMoney(before)}</strong><div class="month-bar" style="height:${Math.max(5,before/mx*100)}%"></div><small>July</small></div><div class="month-col aug"><strong>${fmtMoney(now)}</strong><div class="month-bar" style="height:${Math.max(5,now/mx*100)}%"></div><small>August</small></div></div><div class="comparison-note">${inverse?(d<=0?"แนวโน้มดีขึ้น: ลดลงจากเดือนก่อน":"ควบคุมเพิ่ม: สูงขึ้นจากเดือนก่อน"):(d>=0?"เติบโตจากเดือนก่อน":"ลดลงจากเดือนก่อน")}</div></article>`;
}

function groupAreas(rows){
  const map=new Map();
  rows.forEach(r=>{const key=r.Region;if(!key||key==="ALL")return; const x=map.get(key)||[];x.push(r);map.set(key,x);});
  return [...map].map(([region,items])=>({region,...aggregatePerformance(items)}));
}

function areaSummary(rows){
  const request=sum(rows,"Rev Request"), save=sum(rows,"Rev Save"), churn=sum(rows,"Churn Value"), budget=sum(rows,"Budget Churn Month");
  const mtdBudget=rows.reduce((total,row)=>{
    const days=n(row["Days in Month"]), cutoff=n(row["Cutoff Day"]);
    return total+(days?n(row["Budget Churn Month"])*cutoff/days:0);
  },0);
  return {request,save,churn,budget,mtdBudget,saveRate:request?save/request:0,overBudget:mtdBudget?churn/mtdBudget:0};
}

function tierStatus(row){
  if(row.overBudget<=1&&row.saveRateAug>=.88) return {code:"T1",text:"T1 • In Cap / Save ≥ 88%"};
  if(row.overBudget>1&&row.saveRateAug>=.88) return {code:"T2",text:"T2 • Over Cap / Save ≥ 88%"};
  if(row.overBudget>1&&row.saveRateAug<.88) return {code:"T3",text:"T3 • Over Cap / Save < 88%"};
  return {code:"WATCH",text:"Watch • In Cap / Save < 88%"};
}

function areaFocusData(service){
  const pool=store.performance.filter(r=>r.Region&&r.Region!=="ALL"&&(service==="ALL"||r.Service===service));
  const dates=[...new Set(pool.map(r=>r["Report Date"]))].sort();
  const latest=dates.at(-1), prior=dates.at(-2);
  const regions=[...new Set(pool.map(r=>r.Region))].sort();
  const rows=regions.map(region=>{
    const jul=areaSummary(pool.filter(r=>r.Region===region&&r["Report Date"]===prior));
    const aug=areaSummary(pool.filter(r=>r.Region===region&&r["Report Date"]===latest));
    const row={region,requestJul:jul.request,requestAug:aug.request,saveJul:jul.save,saveAug:aug.save,churnJul:jul.churn,churnAug:aug.churn,saveRateJul:jul.saveRate,saveRateAug:aug.saveRate,budget:aug.budget,mtdBudget:aug.mtdBudget,overBudget:aug.overBudget};
    row.requestDiff=row.requestAug-row.requestJul; row.requestMom=delta(row.requestAug,row.requestJul);
    row.saveDiff=row.saveAug-row.saveJul; row.saveMom=delta(row.saveAug,row.saveJul);
    row.churnDiff=row.churnAug-row.churnJul; row.churnMom=delta(row.churnAug,row.churnJul);
    row.saveRateDiff=row.saveRateAug-row.saveRateJul; row.tier=tierStatus(row);
    return row;
  });
  const julTotal=areaSummary(pool.filter(r=>r["Report Date"]===prior));
  const augTotal=areaSummary(pool.filter(r=>r["Report Date"]===latest));
  const total={region:"Grand Total",requestJul:julTotal.request,requestAug:augTotal.request,saveJul:julTotal.save,saveAug:augTotal.save,churnJul:julTotal.churn,churnAug:augTotal.churn,saveRateJul:julTotal.saveRate,saveRateAug:augTotal.saveRate,budget:augTotal.budget,mtdBudget:augTotal.mtdBudget,overBudget:augTotal.overBudget};
  total.requestDiff=total.requestAug-total.requestJul; total.requestMom=delta(total.requestAug,total.requestJul);
  total.saveDiff=total.saveAug-total.saveJul; total.saveMom=delta(total.saveAug,total.saveJul);
  total.churnDiff=total.churnAug-total.churnJul; total.churnMom=delta(total.churnAug,total.churnJul);
  total.saveRateDiff=total.saveRateAug-total.saveRateJul; total.tier=tierStatus(total);
  return {rows,total,latest,prior};
}

function tone(value,inverse=false){return deltaClass(value,inverse);}
function focusRowHtml(row,selectedRegion,isTotal=false){
  const selected=!isTotal&&selectedRegion!=="ALL"&&row.region===selectedRegion;
  return `<tr class="${isTotal?"grand-total ":""}${selected?"is-focus":""}"${selected?' aria-current="true"':""}>
    <th class="region-cell" scope="row">${row.region}${selected?'<span class="focus-mark">Focus</span>':""}</th>
    <td>${fmtFull(row.requestJul)}</td><td>${fmtFull(row.requestAug)}</td><td class="cell-tone ${tone(row.requestDiff,true)}">${fmtSignedFull(row.requestDiff)}</td><td class="cell-tone ${tone(row.requestMom,true)}">${fmtDelta(row.requestMom)}</td>
    <td>${fmtFull(row.saveJul)}</td><td>${fmtFull(row.saveAug)}</td><td class="cell-tone ${tone(row.saveDiff)}">${fmtSignedFull(row.saveDiff)}</td><td class="cell-tone ${tone(row.saveMom)}">${fmtDelta(row.saveMom)}</td>
    <td>${fmtFull(row.churnJul)}</td><td>${fmtFull(row.churnAug)}</td><td class="cell-tone ${tone(row.churnDiff,true)}">${fmtSignedFull(row.churnDiff)}</td><td class="cell-tone ${tone(row.churnMom,true)}">${fmtDelta(row.churnMom)}</td>
    <td>${fmtPct(row.saveRateJul)}</td><td>${fmtPct(row.saveRateAug)}</td><td class="cell-tone ${tone(row.saveRateDiff)}">${fmtPP(row.saveRateDiff)}</td>
    <td>${fmtFull(row.budget)}</td><td>${fmtFull(row.mtdBudget)}</td><td class="over-budget ${row.overBudget>1?"bad":"good"}">${fmtPct(row.overBudget)}</td>
    <td><span class="tier-pill ${row.tier.code.toLowerCase()}">${row.tier.text}</span></td>
  </tr>`;
}

function renderAreaFocusTable(service,selectedRegion){
  const data=areaFocusData(service);
  $("focusTableService").textContent=service==="ALL"?"TMH + TOL":service;
  $("focusTableCount").textContent=`${data.rows.length} Areas`;
  $("focusTableBody").innerHTML=data.rows.map(row=>focusRowHtml(row,selectedRegion)).join("")+focusRowHtml(data.total,selectedRegion,true);
}
function bars(target,rows,key,{max,sort="desc",kind="teal",suffix="%",noteKey}={}){
  const sorted=[...rows].sort((a,b)=>sort==="asc"?a[key]-b[key]:b[key]-a[key]).slice(0,6);
  const ceiling=max||Math.max(...sorted.map(x=>x[key]),1);
  $(target).innerHTML=sorted.map(x=>`<div class="bar-row"><div class="bar-label" title="${x.region}">${x.region}</div><div class="bar-track"><div class="bar-fill ${kind}" style="width:${Math.min(100,x[key]/ceiling*100)}%"></div></div><div class="bar-value">${suffix==="%"?fmtPct(x[key]):fmtMoney(x[key])}</div>${noteKey?`<div class="bar-sub">${noteKey(x)}</div>`:""}</div>`).join("")||'<p>ไม่มีข้อมูลตามตัวกรอง</p>';
}

function downsellData(region){
  let pool=store.downsell.filter(r=>region==="ALL"||r.Region===region);
  if(store.live) pool=pool.filter(r=>r.Region!=="ALL");
  const latest=[...new Set(pool.map(r=>r["Report Date"]))].sort().at(-1);
  const latestPool=pool.filter(r=>r["Report Date"]===latest);
  const totalRows=!store.live&&region==="ALL"&&latestPool.some(r=>r.Region==="ALL")?latestPool.filter(r=>r.Region==="ALL"):latestPool;
  const rows=latestPool.filter(r=>r.Region!=="ALL");
  return {latest,rows,total:{budget:sum(totalRows,"Budget Downsell"),retention:sum(totalRows,"Downsell Retention"),after:sum(totalRows,"Downsell Aftersale"),mtd:sum(totalRows,"Total Downsell"),rr:sum(totalRows,"RR Downsell"),over:sum(totalRows,"Over Budget Records"),shops:sum(totalRows,"No Shop")}};
}
function renderDownsell(region){
  const d=downsellData(region), t=d.total, mtdPct=t.budget?t.mtd/t.budget:0, rrPct=t.budget?t.rr/t.budget:0, mix=t.mtd?t.retention/t.mtd:0;
  $("downsellDate").textContent=fmtDate(d.latest);
  $("downsellSummary").innerHTML=`<div class="donut" style="--donut:${Math.min(100,mtdPct*100)}%"><div class="donut__label"><strong>${fmtPct(mtdPct)}</strong><small>MTD / Budget</small></div></div><div class="downsell-details"><div class="detail-stat"><small>Budget</small><strong>${fmtMoney(t.budget)}</strong></div><div class="detail-stat"><small>Downsell MTD</small><strong>${fmtMoney(t.mtd)}</strong></div><div class="detail-stat alert"><small>Run rate / Budget</small><strong>${fmtPct(rrPct)}</strong></div><div class="detail-stat alert"><small>Projected gap</small><strong>${fmtMoney(Math.max(0,t.rr-t.budget))}</strong></div><div class="mix-bar"><small>สัดส่วนประเภท Downsell</small><div class="mix-bar__track"><div class="mix-bar__retention" style="width:${mix*100}%"></div><div class="mix-bar__after" style="width:${(1-mix)*100}%"></div></div><div class="mix-legend"><span>Retention ${fmtPct(mix)}</span><span>Aftersale ${fmtPct(1-mix)}</span></div></div></div>`;
  const areas=d.rows.filter(r=>r.Region!=="ALL").map(r=>({region:r.Region,rrPct:n(r["RR / Budget"]),over:n(r["Over Budget Records"]),shops:n(r["No Shop"])}));
  bars("downsellBars",areas,"rrPct",{max:Math.max(1.5,...areas.map(x=>x.rrPct)),kind:"risk",noteKey:x=>`${fmtFull(x.over)} จาก ${fmtFull(x.shops)} records เกิน Budget`});
  return {d,t,mtdPct,rrPct};
}

function renderInsights(now,before,areas,down){
  const worstSave=[...areas].sort((a,b)=>a.saveRate-b.saveRate)[0];
  const worstRR=[...areas].sort((a,b)=>b.rrCap-a.rrCap)[0];
  const churnMom=delta(now.churn,before.churn), gap=Math.max(0,down.t.rr-down.t.budget);
  const items=[
    ["signal","MoM signal",`Save rate เปลี่ยน <strong>${fmtPP(now.saveRate-before.saveRate)}</strong> ขณะที่ Churn <strong>${fmtDelta(churnMom)}</strong> จากงวดก่อน`],
    ["risk","Priority area",worstSave?`Save rate ต่ำสุดคือ <strong>${worstSave.region}</strong> (${fmtPct(worstSave.saveRate)}) และ RR / Cap สูงสุดคือ <strong>${worstRR.region}</strong> (${fmtPct(worstRR.rrCap)})`:"เลือกทุกพื้นที่เพื่อดูอันดับความเสี่ยง"],
    ["action","Daily action",gap>0?`Run rate Downsell สูงกว่า Budget ราว <strong>${fmtMoney(gap)}</strong> ควรทบทวนเคส over-budget และ owner รายพื้นที่ทุกวัน`:`Run rate ยังอยู่ใน Budget ควรรักษาจังหวะและติดตามพื้นที่ใกล้เกณฑ์ทุกวัน`]
  ];
  $("insightGrid").innerHTML=items.map(([cls,title,copy],i)=>`<article class="insight ${cls}"><div class="insight__number">0${i+1}</div><h3>${title}</h3><p>${copy}</p></article>`).join("");
}

function render(){
  const service=$("serviceFilter").value, region=$("regionFilter").value;
  const data=latestRows(service,region), now=aggregatePerformance(data.now), before=aggregatePerformance(data.before);
  $("performanceDate").textContent=fmtDate(data.latest);
  renderKpis(now,before);
  $("serviceCards").innerHTML=service==="ALL"?serviceCard("TMH")+serviceCard("TOL"):serviceCard(service);
  $("comparisonGrid").innerHTML=comparisonCard("Request",now.request,before.request)+comparisonCard("Save",now.save,before.save)+comparisonCard("Churn",now.churn,before.churn,true);
  const areaPool=store.performance.filter(r=>r["Report Date"]===data.latest&&r.Region!=="ALL"&&(service==="ALL"||r.Service===service)&&(region==="ALL"||r.Region===region));
  const areas=groupAreas(areaPool);
  bars("saveRateBars",areas,"saveRate",{max:1,sort:"asc",kind:"teal",noteKey:x=>x.saveRate<.88?"ต่ำกว่าเป้าหมาย 88%":"ผ่านเป้าหมาย 88%"});
  bars("runRateBars",areas,"rrCap",{max:Math.max(1.6,...areas.map(x=>x.rrCap)),sort:"desc",kind:"warn",noteKey:x=>x.rrCap>1?`เกิน Cap ${fmtPct(x.rrCap-1)}`:"อยู่ใน Cap"});
  renderAreaFocusTable(service,region);
  const down=renderDownsell(region);
  renderInsights(now,before,areas,down);
}

$("serviceFilter").addEventListener("change",render);
$("regionFilter").addEventListener("change",render);
$("refreshButton").addEventListener("click",loadData);
$("sheetLink").href=SHEET_URL;
loadData();

