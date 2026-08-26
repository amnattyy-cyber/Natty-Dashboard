const SPREADSHEET_ID = "1gw9c97wtVitsn5B8P9ugwavD4xOGf3M_RScNGvk_hNM";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`;
const PERF_HEADERS = ["Report Date","Service","Region","No Shop","Rev Request","Rev Save","Churn Value","Budget Churn Month","Cutoff Day","Days in Month","Save Rate","RR Churn","RR / Cap","Tier"];
const DOWN_HEADERS = ["Report Date","Region","No Shop","Budget Downsell","Downsell Retention","Downsell Aftersale","Cutoff Day","Days in Month","Total Downsell","RR Downsell","MTD / Budget","RR / Budget","Over Budget Records","Status"];
const BRANCH_HEADERS = ["Report Date","Service","Area Group","Region","Shop Name","Shop Type","Request Jul","Request Aug","Request MoM","Request %MoM","Save Jul","Save Aug","Save MoM","Save %MoM","Churn Jul","Churn Aug","Churn MoM","Churn %MoM","Save Rate Jul","Save Rate Aug","Save Rate MoM","Budget Churn","MTD Budget Churn","Over Budget","Tier","Cutoff Day","Days in Month"];
const AREA_GROUPS = {
  "BMA 5 Area": ["BMA I - North West","BMA II - South West","BMA III - North East","BMA IV - South East","BMA V - Central"],
  UPC1: ["UPC - Central Northeast","UPC - Lower North","UPC - Lower Northeast","UPC - Upper North","UPC - Upper Northeast"],
  UPC2: ["UPC - Central","UPC - East","UPC - Upper South","UPC - West","UPC - Lower South"]
};
let store = { performance: [], downsell: [], branches: [], live: false, branchLive: false };

const $ = id => document.getElementById(id);
const n = value => Number(value || 0);
const sum = (rows, key) => rows.reduce((total,row)=>total+n(row[key]),0);
const fmtMoney = value => new Intl.NumberFormat("th-TH",{notation:"compact",maximumFractionDigits:2}).format(n(value));
const fmtFull = value => new Intl.NumberFormat("th-TH",{maximumFractionDigits:0}).format(n(value));
const fmtSignedFull = value => `${n(value)>0?"+":""}${fmtFull(value)}`;
const fmtPct = value => `${(n(value)*100).toFixed(1)}%`;
const fmtPP = value => `${value>=0?"+":""}${(n(value)*100).toFixed(2)} pp`;
const fmtDelta = value => `${value>=0?"+":""}${(n(value)*100).toFixed(1)}%`;
const escapeHtml = value => String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));
const dateKey = value => {
  if (value instanceof Date) return value.toISOString().slice(0,10);
  const text=String(value||"");
  const match=text.match(/Date\((\d+),(\d+),(\d+)\)/);
  if(match) return `${match[1]}-${String(+match[2]+1).padStart(2,"0")}-${String(match[3]).padStart(2,"0")}`;
  return text.slice(0,10);
};
const fmtDate = value => {
  const date=new Date(`${dateKey(value)}T00:00:00`);
  return isNaN(date)?"—":date.toLocaleDateString("th-TH",{day:"numeric",month:"short",year:"numeric"});
};
const deltaClass = (value,inverse=false) => Math.abs(value)<.0005?"neutral":((inverse?value<0:value>0)?"good":"bad");
const rowObjects = (rows,headers) => rows.map(row=>Object.fromEntries(headers.map((header,index)=>[header,index===0?dateKey(row[index]):row[index]])));
const delta = (now,before) => before?(now-before)/before:0;

function inScope(region,group,selectedRegion){
  if(!region||region==="ALL") return false;
  if(group!=="ALL"&&!AREA_GROUPS[group]?.includes(region)) return false;
  return selectedRegion==="ALL"||region===selectedRegion;
}

function scopeLabel(group,region){
  if(region!=="ALL") return region;
  return group==="ALL"?"ALL • 15 Areas":group;
}

function loadGviz(sheet){
  return new Promise((resolve,reject)=>{
    const callback=`__gviz_${sheet.replace(/\W/g,"_")}_${Date.now()}`;
    const timer=setTimeout(()=>{cleanup();reject(new Error("timeout"));},12000);
    const script=document.createElement("script");
    function cleanup(){clearTimeout(timer);delete window[callback];script.remove();}
    window[callback]=response=>{
      cleanup();
      if(!response?.table){reject(new Error("invalid response"));return;}
      resolve(response.table.rows.map(row=>row.c.map(cell=>cell?.v??"")));
    };
    script.onerror=()=>{cleanup();reject(new Error("network"));};
    script.src=`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json;responseHandler:${callback}&sheet=${encodeURIComponent(sheet)}&headers=1`;
    document.head.appendChild(script);
  });
}

async function loadData(){
  const status=$("dataStatus");
  status.className="status-pill";
  status.innerHTML="<span></span>กำลังโหลดข้อมูล...";
  const [performance,downsell,branches]=await Promise.allSettled([
    loadGviz("Performance_Daily"),loadGviz("Downsell_Area_Daily"),loadGviz("Branch_Performance_Daily")
  ]);
  const coreLive=performance.status==="fulfilled"&&downsell.status==="fulfilled";
  store={
    performance:coreLive?rowObjects(performance.value,PERF_HEADERS):rowObjects(window.RETENTION_FALLBACK.performance,PERF_HEADERS),
    downsell:coreLive?rowObjects(downsell.value,DOWN_HEADERS):rowObjects(window.RETENTION_FALLBACK.downsell,DOWN_HEADERS),
    branches:branches.status==="fulfilled"?rowObjects(branches.value,BRANCH_HEADERS):[],
    live:coreLive,
    branchLive:branches.status==="fulfilled"
  };
  if(coreLive&&store.branchLive){status.className="status-pill live";status.innerHTML="<span></span>Live from Google Sheet";}
  else if(coreLive){status.className="status-pill fallback";status.innerHTML="<span></span>Live • รอข้อมูลรายสาขา";}
  else{status.className="status-pill fallback";status.innerHTML="<span></span>Snapshot • รอสิทธิ์ Google Sheet";}
  populateRegions();render();
}

function populateRegions(){
  const select=$("regionFilter"),group=$("areaGroupFilter").value,current=select.value;
  const regions=[...new Set([...store.performance.map(row=>row.Region),...store.downsell.map(row=>row.Region),...store.branches.map(row=>row.Region)].filter(region=>region&&region!=="ALL"&&(group==="ALL"||AREA_GROUPS[group]?.includes(region))))].sort();
  select.innerHTML='<option value="ALL">ทุกพื้นที่ในกลุ่ม</option>'+regions.map(region=>`<option value="${escapeHtml(region)}">${escapeHtml(region)}</option>`).join("");
  select.value=regions.includes(current)?current:"ALL";
}

function aggregatePerformance(rows){
  const request=sum(rows,"Rev Request"),save=sum(rows,"Rev Save"),churn=sum(rows,"Churn Value"),budget=sum(rows,"Budget Churn Month"),rr=sum(rows,"RR Churn");
  return {request,save,churn,budget,rr,saveRate:request?save/request:0,rrCap:budget?rr/budget:0,shops:sum(rows,"No Shop")};
}

function latestRows(service,group,region){
  let pool=store.performance.filter(row=>service==="ALL"||row.Service===service);
  if(store.live) pool=pool.filter(row=>inScope(row.Region,group,region));
  else if(group==="ALL"&&region==="ALL"&&pool.some(row=>row.Region==="ALL")) pool=pool.filter(row=>row.Region==="ALL");
  else pool=pool.filter(row=>inScope(row.Region,group,region));
  const dates=[...new Set(pool.map(row=>row["Report Date"]))].sort(),latest=dates.at(-1),prior=dates.at(-2);
  return {latest,prior,now:pool.filter(row=>row["Report Date"]===latest),before:pool.filter(row=>row["Report Date"]===prior)};
}

function renderKpis(now,before){
  const items=[
    ["Request",fmtMoney(now.request),"ล้านบาท",delta(now.request,before.request),false,"#1c3f79"],
    ["Save",fmtMoney(now.save),"ล้านบาท",delta(now.save,before.save),false,"#00a7a0"],
    ["Churn",fmtMoney(now.churn),"ล้านบาท",delta(now.churn,before.churn),true,"#d83578"],
    ["Save rate",fmtPct(now.saveRate),`เปลี่ยน ${fmtPP(now.saveRate-before.saveRate)}`,now.saveRate-before.saveRate,false,"#26a269"],
    ["Run rate / Cap",fmtPct(now.rrCap),now.rrCap>1?"สูงกว่า Cap":"อยู่ใน Cap",1-now.rrCap,false,"#f09b45"]
  ];
  $("kpiGrid").innerHTML=items.map(([label,value,note,difference,inverse,color])=>`<article class="kpi" style="--accent:${color}"><div class="kpi__label">${label}</div><div class="kpi__value">${value}</div><div class="kpi__note"><span class="delta ${deltaClass(difference,inverse)}">${label==="Save rate"?note:label==="Run rate / Cap"?note:fmtDelta(difference)+" MoM"}</span>${label!=="Save rate"&&label!=="Run rate / Cap"?` • ${note}`:""}</div></article>`).join("");
}

function serviceCard(service,group,region){
  const {now,before}=latestRows(service,group,region),current=aggregatePerformance(now),previous=aggregatePerformance(before),churnMom=delta(current.churn,previous.churn),savePP=current.saveRate-previous.saveRate;
  return `<article class="service-card ${service.toLowerCase()}"><div class="service-card__head"><div><small>SERVICE PERFORMANCE</small><h3>${service}</h3></div><div class="service-card__rate"><strong>${fmtPct(current.saveRate)}</strong><small>Save rate <span class="delta ${deltaClass(savePP)}">${fmtPP(savePP)}</span></small></div></div><div class="service-card__metrics"><div class="service-card__metric"><small>Request</small><strong>${fmtMoney(current.request)}</strong></div><div class="service-card__metric"><small>Save</small><strong>${fmtMoney(current.save)}</strong></div><div class="service-card__metric"><small>Churn</small><strong>${fmtMoney(current.churn)}</strong></div></div><div class="service-card__foot"><span>Churn MoM <strong>${fmtDelta(churnMom)}</strong></span><span>RR / Cap <strong>${fmtPct(current.rrCap)}</strong></span></div></article>`;
}

function comparisonCard(label,now,before,inverse=false){
  const maximum=Math.max(now,before)||1,difference=delta(now,before);
  return `<article class="comparison-card"><div class="comparison-card__head"><h3>${label}</h3><span class="delta ${deltaClass(difference,inverse)}">${fmtDelta(difference)}</span></div><div class="comparison-chart"><div class="month-col"><strong>${fmtMoney(before)}</strong><div class="month-bar" style="height:${Math.max(5,before/maximum*100)}%"></div><small>July</small></div><div class="month-col aug"><strong>${fmtMoney(now)}</strong><div class="month-bar" style="height:${Math.max(5,now/maximum*100)}%"></div><small>August</small></div></div><div class="comparison-note">${inverse?(difference<=0?"แนวโน้มดีขึ้น: ลดลงจากเดือนก่อน":"ควบคุมเพิ่ม: สูงขึ้นจากเดือนก่อน"):(difference>=0?"เติบโตจากเดือนก่อน":"ลดลงจากเดือนก่อน")}</div></article>`;
}

function groupAreas(rows){
  const groups=new Map();
  rows.forEach(row=>{const items=groups.get(row.Region)||[];items.push(row);groups.set(row.Region,items);});
  return [...groups].map(([region,items])=>({region,...aggregatePerformance(items)}));
}

function areaSummary(rows){
  const request=sum(rows,"Rev Request"),save=sum(rows,"Rev Save"),churn=sum(rows,"Churn Value"),budget=sum(rows,"Budget Churn Month");
  const mtdBudget=rows.reduce((total,row)=>{const days=n(row["Days in Month"]),cutoff=n(row["Cutoff Day"]);return total+(days?n(row["Budget Churn Month"])*cutoff/days:0);},0);
  return {request,save,churn,budget,mtdBudget,saveRate:request?save/request:0,overBudget:mtdBudget?churn/mtdBudget:0};
}

function tierStatus(row){
  if(row.overBudget<=1&&row.saveRateAug>=.88) return {code:"T1",text:"T1 • In Cap / Save ≥ 88%"};
  if(row.overBudget>1&&row.saveRateAug>=.88) return {code:"T2",text:"T2 • Over Cap / Save ≥ 88%"};
  if(row.overBudget>1&&row.saveRateAug<.88) return {code:"T3",text:"T3 • Over Cap / Save < 88%"};
  return {code:"WATCH",text:"Watch • In Cap / Save < 88%"};
}

function comparisonRow(region,july,august){
  const row={region,requestJul:july.request,requestAug:august.request,saveJul:july.save,saveAug:august.save,churnJul:july.churn,churnAug:august.churn,saveRateJul:july.saveRate,saveRateAug:august.saveRate,budget:august.budget,mtdBudget:august.mtdBudget,overBudget:august.overBudget};
  row.requestDiff=row.requestAug-row.requestJul;row.requestMom=delta(row.requestAug,row.requestJul);
  row.saveDiff=row.saveAug-row.saveJul;row.saveMom=delta(row.saveAug,row.saveJul);
  row.churnDiff=row.churnAug-row.churnJul;row.churnMom=delta(row.churnAug,row.churnJul);
  row.saveRateDiff=row.saveRateAug-row.saveRateJul;row.tier=tierStatus(row);
  return row;
}

function areaFocusData(service,group,region){
  const pool=store.performance.filter(row=>row.Region&&row.Region!=="ALL"&&(service==="ALL"||row.Service===service)&&inScope(row.Region,group,region));
  const dates=[...new Set(pool.map(row=>row["Report Date"]))].sort(),latest=dates.at(-1),prior=dates.at(-2),regions=[...new Set(pool.map(row=>row.Region))].sort();
  const rows=regions.map(area=>comparisonRow(area,areaSummary(pool.filter(row=>row.Region===area&&row["Report Date"]===prior)),areaSummary(pool.filter(row=>row.Region===area&&row["Report Date"]===latest))));
  const total=comparisonRow("Selection Total",areaSummary(pool.filter(row=>row["Report Date"]===prior)),areaSummary(pool.filter(row=>row["Report Date"]===latest)));
  return {rows,total,latest,prior};
}

const tone=(value,inverse=false)=>deltaClass(value,inverse);
function focusRowHtml(row,selectedRegion,isTotal=false){
  const selected=!isTotal&&selectedRegion!=="ALL"&&row.region===selectedRegion;
  return `<tr class="${isTotal?"grand-total ":""}${selected?"is-focus":""}"${selected?' aria-current="true"':""}><th class="region-cell" scope="row">${escapeHtml(row.region)}${selected?'<span class="focus-mark">Focus</span>':""}</th><td>${fmtFull(row.requestJul)}</td><td>${fmtFull(row.requestAug)}</td><td class="cell-tone ${tone(row.requestDiff,true)}">${fmtSignedFull(row.requestDiff)}</td><td class="cell-tone ${tone(row.requestMom,true)}">${fmtDelta(row.requestMom)}</td><td>${fmtFull(row.saveJul)}</td><td>${fmtFull(row.saveAug)}</td><td class="cell-tone ${tone(row.saveDiff)}">${fmtSignedFull(row.saveDiff)}</td><td class="cell-tone ${tone(row.saveMom)}">${fmtDelta(row.saveMom)}</td><td>${fmtFull(row.churnJul)}</td><td>${fmtFull(row.churnAug)}</td><td class="cell-tone ${tone(row.churnDiff,true)}">${fmtSignedFull(row.churnDiff)}</td><td class="cell-tone ${tone(row.churnMom,true)}">${fmtDelta(row.churnMom)}</td><td>${fmtPct(row.saveRateJul)}</td><td>${fmtPct(row.saveRateAug)}</td><td class="cell-tone ${tone(row.saveRateDiff)}">${fmtPP(row.saveRateDiff)}</td><td>${fmtFull(row.budget)}</td><td>${fmtFull(row.mtdBudget)}</td><td class="over-budget ${row.overBudget>1?"bad":"good"}">${fmtPct(row.overBudget)}</td><td><span class="tier-pill ${row.tier.code.toLowerCase()}">${row.tier.text}</span></td></tr>`;
}

function renderAreaFocusTable(service,group,selectedRegion){
  const data=areaFocusData(service,group,selectedRegion);
  $("focusTableService").textContent=service==="ALL"?"TMH + TOL":service;
  $("focusTableCount").textContent=`${data.rows.length} ${data.rows.length===1?"Area":"Areas"}`;
  $("focusTableBody").innerHTML=data.rows.length?data.rows.map(row=>focusRowHtml(row,selectedRegion)).join("")+focusRowHtml(data.total,selectedRegion,true):'<tr><td colspan="20" class="empty-state">ไม่มีข้อมูลตามตัวกรอง</td></tr>';
}

function bars(target,rows,key,{max,sort="desc",kind="teal",suffix="%",noteKey}={}){
  const sorted=[...rows].sort((a,b)=>sort==="asc"?a[key]-b[key]:b[key]-a[key]).slice(0,6),ceiling=max||Math.max(...sorted.map(item=>item[key]),1);
  $(target).innerHTML=sorted.map(item=>`<div class="bar-row"><div class="bar-label" title="${escapeHtml(item.region)}">${escapeHtml(item.region)}</div><div class="bar-track"><div class="bar-fill ${kind}" style="width:${Math.min(100,item[key]/ceiling*100)}%"></div></div><div class="bar-value">${suffix==="%"?fmtPct(item[key]):fmtMoney(item[key])}</div>${noteKey?`<div class="bar-sub">${noteKey(item)}</div>`:""}</div>`).join("")||'<p>ไม่มีข้อมูลตามตัวกรอง</p>';
}

function downsellData(group,region){
  let pool=store.downsell;
  if(store.live) pool=pool.filter(row=>inScope(row.Region,group,region));
  else if(group==="ALL"&&region==="ALL"&&pool.some(row=>row.Region==="ALL")) pool=pool.filter(row=>row.Region==="ALL");
  else pool=pool.filter(row=>inScope(row.Region,group,region));
  const latest=[...new Set(pool.map(row=>row["Report Date"]))].sort().at(-1),latestPool=pool.filter(row=>row["Report Date"]===latest);
  return {latest,rows:latestPool.filter(row=>row.Region!=="ALL"),total:{budget:sum(latestPool,"Budget Downsell"),retention:sum(latestPool,"Downsell Retention"),after:sum(latestPool,"Downsell Aftersale"),mtd:sum(latestPool,"Total Downsell"),rr:sum(latestPool,"RR Downsell"),over:sum(latestPool,"Over Budget Records"),shops:sum(latestPool,"No Shop")}};
}

function renderDownsell(group,region){
  const data=downsellData(group,region),total=data.total,mtdPct=total.budget?total.mtd/total.budget:0,rrPct=total.budget?total.rr/total.budget:0,mix=total.mtd?total.retention/total.mtd:0;
  $("downsellDate").textContent=fmtDate(data.latest);
  $("downsellSummary").innerHTML=`<div class="donut" style="--donut:${Math.min(100,mtdPct*100)}%"><div class="donut__label"><strong>${fmtPct(mtdPct)}</strong><small>MTD / Budget</small></div></div><div class="downsell-details"><div class="detail-stat"><small>Budget</small><strong>${fmtMoney(total.budget)}</strong></div><div class="detail-stat"><small>Downsell MTD</small><strong>${fmtMoney(total.mtd)}</strong></div><div class="detail-stat alert"><small>Run rate / Budget</small><strong>${fmtPct(rrPct)}</strong></div><div class="detail-stat alert"><small>Projected gap</small><strong>${fmtMoney(Math.max(0,total.rr-total.budget))}</strong></div><div class="mix-bar"><small>สัดส่วนประเภท Downsell</small><div class="mix-bar__track"><div class="mix-bar__retention" style="width:${mix*100}%"></div><div class="mix-bar__after" style="width:${(1-mix)*100}%"></div></div><div class="mix-legend"><span>Retention ${fmtPct(mix)}</span><span>Aftersale ${fmtPct(1-mix)}</span></div></div></div>`;
  const areas=data.rows.map(row=>({region:row.Region,rrPct:n(row["RR / Budget"]),over:n(row["Over Budget Records"]),shops:n(row["No Shop"])}));
  bars("downsellBars",areas,"rrPct",{max:Math.max(1.5,...areas.map(item=>item.rrPct)),kind:"risk",noteKey:item=>`${fmtFull(item.over)} จาก ${fmtFull(item.shops)} records เกิน Budget`});
  return {data,total,mtdPct,rrPct};
}

function renderInsights(now,before,areas,downsell){
  const worstSave=[...areas].sort((a,b)=>a.saveRate-b.saveRate)[0],worstRR=[...areas].sort((a,b)=>b.rrCap-a.rrCap)[0],churnMom=delta(now.churn,before.churn),gap=Math.max(0,downsell.total.rr-downsell.total.budget);
  const items=[["signal","MoM signal",`Save rate เปลี่ยน <strong>${fmtPP(now.saveRate-before.saveRate)}</strong> ขณะที่ Churn <strong>${fmtDelta(churnMom)}</strong> จากงวดก่อน`],["risk","Priority area",worstSave?`Save rate ต่ำสุดคือ <strong>${escapeHtml(worstSave.region)}</strong> (${fmtPct(worstSave.saveRate)}) และ RR / Cap สูงสุดคือ <strong>${escapeHtml(worstRR.region)}</strong> (${fmtPct(worstRR.rrCap)})`:"ไม่มีข้อมูล Area ตามตัวกรอง"],["action","Daily action",gap>0?`Run rate Downsell สูงกว่า Budget ราว <strong>${fmtMoney(gap)}</strong> ควรทบทวนเคส over-budget และ owner รายพื้นที่ทุกวัน`:`Run rate ยังอยู่ใน Budget ควรรักษาจังหวะและติดตามพื้นที่ใกล้เกณฑ์ทุกวัน`]];
  $("insightGrid").innerHTML=items.map(([style,title,copy],index)=>`<article class="insight ${style}"><div class="insight__number">0${index+1}</div><h3>${title}</h3><p>${copy}</p></article>`).join("");
}

function summarizeBranchRows(rows,service){
  const requestJul=sum(rows,"Request Jul"),requestAug=sum(rows,"Request Aug"),saveJul=sum(rows,"Save Jul"),saveAug=sum(rows,"Save Aug"),churnJul=sum(rows,"Churn Jul"),churnAug=sum(rows,"Churn Aug"),budget=sum(rows,"Budget Churn"),mtdBudget=sum(rows,"MTD Budget Churn");
  const item={shop:rows[0]["Shop Name"],region:rows[0].Region,service,shopType:[...new Set(rows.map(row=>row["Shop Type"]).filter(Boolean))].join(" / "),requestJul,requestAug,saveJul,saveAug,churnJul,churnAug,budget,mtdBudget,saveRateJul:requestJul?saveJul/requestJul:0,saveRateAug:requestAug?saveAug/requestAug:0,overBudget:mtdBudget?churnAug/mtdBudget:0};
  item.requestDiff=requestAug-requestJul;item.requestMom=delta(requestAug,requestJul);item.saveDiff=saveAug-saveJul;item.saveMom=delta(saveAug,saveJul);item.churnDiff=churnAug-churnJul;item.churnMom=delta(churnAug,churnJul);item.saveRateDiff=item.saveRateAug-item.saveRateJul;item.tier=tierStatus(item);
  return item;
}

function branchFocusData(service,group,region){
  let pool=store.branches.filter(row=>(service==="ALL"||row.Service===service)&&inScope(row.Region,group,region));
  const latest=[...new Set(pool.map(row=>row["Report Date"]))].sort().at(-1);
  pool=pool.filter(row=>row["Report Date"]===latest&&row["Shop Name"]);
  const grouped=new Map();
  pool.forEach(row=>{const key=service==="ALL"?`${row.Region}|${row["Shop Name"]}`:`${row.Service}|${row.Region}|${row["Shop Name"]}`,items=grouped.get(key)||[];items.push(row);grouped.set(key,items);});
  const label=service==="ALL"?"TMH + TOL":service;
  return {latest,rows:[...grouped.values()].map(items=>summarizeBranchRows(items,label)).sort((a,b)=>a.region.localeCompare(b.region)||b.overBudget-a.overBudget||a.shop.localeCompare(b.shop))};
}

function branchRowHtml(row){
  return `<tr><th class="branch-cell" scope="row"><strong>${escapeHtml(row.shop)}</strong><small>${escapeHtml(row.shopType)}</small></th><td class="area-cell">${escapeHtml(row.region)}</td><td>${escapeHtml(row.service)}</td><td>${fmtFull(row.requestJul)}</td><td>${fmtFull(row.requestAug)}</td><td class="cell-tone ${tone(row.requestDiff,true)}">${fmtSignedFull(row.requestDiff)}</td><td class="cell-tone ${tone(row.requestMom,true)}">${fmtDelta(row.requestMom)}</td><td>${fmtFull(row.saveJul)}</td><td>${fmtFull(row.saveAug)}</td><td class="cell-tone ${tone(row.saveDiff)}">${fmtSignedFull(row.saveDiff)}</td><td class="cell-tone ${tone(row.saveMom)}">${fmtDelta(row.saveMom)}</td><td>${fmtFull(row.churnJul)}</td><td>${fmtFull(row.churnAug)}</td><td class="cell-tone ${tone(row.churnDiff,true)}">${fmtSignedFull(row.churnDiff)}</td><td class="cell-tone ${tone(row.churnMom,true)}">${fmtDelta(row.churnMom)}</td><td>${fmtPct(row.saveRateJul)}</td><td>${fmtPct(row.saveRateAug)}</td><td class="cell-tone ${tone(row.saveRateDiff)}">${fmtPP(row.saveRateDiff)}</td><td>${fmtFull(row.budget)}</td><td>${fmtFull(row.mtdBudget)}</td><td class="over-budget ${row.overBudget>1?"bad":"good"}">${fmtPct(row.overBudget)}</td><td><span class="tier-pill ${row.tier.code.toLowerCase()}">${row.tier.text}</span></td></tr>`;
}

function renderBranchTable(service,group,region){
  const data=branchFocusData(service,group,region);
  $("branchTableScope").textContent=scopeLabel(group,region);$("branchTableCount").textContent=`${data.rows.length} Branches`;
  $("branchDataNotice").textContent=store.branchLive?`ข้อมูล ณ ${fmtDate(data.latest)} • แสดงเฉพาะชื่อสาขา • ซ่อนรหัส TDS/WW`:`ไม่สามารถโหลดข้อมูลรายสาขาได้ กรุณาตรวจสิทธิ์ Google Sheet`;
  $("branchTableBody").innerHTML=data.rows.length?data.rows.map(branchRowHtml).join(""):'<tr><td colspan="22" class="empty-state">ไม่มีข้อมูลรายสาขาตามตัวกรอง</td></tr>';
}

function render(){
  const service=$("serviceFilter").value,group=$("areaGroupFilter").value,region=$("regionFilter").value,data=latestRows(service,group,region),now=aggregatePerformance(data.now),before=aggregatePerformance(data.before);
  $("performanceDate").textContent=fmtDate(data.latest);renderKpis(now,before);
  $("serviceCards").innerHTML=service==="ALL"?serviceCard("TMH",group,region)+serviceCard("TOL",group,region):serviceCard(service,group,region);
  $("comparisonGrid").innerHTML=comparisonCard("Request",now.request,before.request)+comparisonCard("Save",now.save,before.save)+comparisonCard("Churn",now.churn,before.churn,true);
  const areaPool=store.performance.filter(row=>row["Report Date"]===data.latest&&row.Region!=="ALL"&&(service==="ALL"||row.Service===service)&&inScope(row.Region,group,region)),areas=groupAreas(areaPool);
  bars("saveRateBars",areas,"saveRate",{max:1,sort:"asc",kind:"teal",noteKey:item=>item.saveRate<.88?"ต่ำกว่าเป้าหมาย 88%":"ผ่านเป้าหมาย 88%"});
  bars("runRateBars",areas,"rrCap",{max:Math.max(1.6,...areas.map(item=>item.rrCap)),sort:"desc",kind:"warn",noteKey:item=>item.rrCap>1?`เกิน Cap ${fmtPct(item.rrCap-1)}`:"อยู่ใน Cap"});
  renderAreaFocusTable(service,group,region);const downsell=renderDownsell(group,region);renderInsights(now,before,areas,downsell);renderBranchTable(service,group,region);
}

function setPartition(partition){
  document.querySelectorAll(".partition-tab").forEach(button=>{const active=button.dataset.partition===partition;button.classList.toggle("is-active",active);button.setAttribute("aria-selected",String(active));});
  $("overviewPartition").hidden=partition!=="overview";$("branchPartition").hidden=partition!=="branch";
}

$("serviceFilter").addEventListener("change",render);
$("areaGroupFilter").addEventListener("change",()=>{populateRegions();render();});
$("regionFilter").addEventListener("change",render);
$("refreshButton").addEventListener("click",loadData);
document.querySelectorAll(".partition-tab").forEach(button=>button.addEventListener("click",()=>setPartition(button.dataset.partition)));
$("sheetLink").href=SHEET_URL;
loadData();
