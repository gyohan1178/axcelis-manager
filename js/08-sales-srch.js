function renderSalesDetail(){
  const all = getDelivered();
  const exrate = getExrate();
  let data = all.filter(r=>(r.deliveredDate||'').startsWith(String(salesYear)));
  if(!salesFilter.has('all')) data = data.filter(r=>salesFilter.has(r.ccn));

  const total = data.length, pages = Math.ceil(total/SALES_PER)||1;
  if(salesPage>pages) salesPage=1;
  const slice = data.slice((salesPage-1)*SALES_PER, salesPage*SALES_PER);

  document.getElementById('sales-detail-cnt').textContent = total+'건';
  document.getElementById('sales-pgn-info').textContent = `${salesPage}/${pages} (${total}건)`;
  document.getElementById('sl-prev').disabled = salesPage===1;
  document.getElementById('sl-next').disabled = salesPage===pages;

  if(!slice.length){
    document.getElementById('sales-detail-tbody').innerHTML='<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--text3)">데이터 없음</td></tr>';
    return;
  }
  const getAmt = r => r.amount || ((r.unitPrice||0)*(r.qty||1));
  document.getElementById('sales-detail-tbody').innerHTML = slice.map(r=>{
    const isB = r.ccn==='B';
    const amt = getAmt(r);
    const krw = isB ? amt*exrate : amt;
    const srcBadge = r._source==='upload'
      ? `<span class="bd" style="background:#0a1a30;color:#4f7cff;font-size:9px;margin-left:3px">업로드</span>`
      : `<span class="bd" style="background:#0a2018;color:#34d399;font-size:9px;margin-left:3px">PO</span>`;
    return `<tr>
      <td style="font-family:var(--mono);font-size:11px;color:var(--text3)">${fmtShortDate(r.deliveredDate)}</td>
      <td style="font-family:var(--mono);font-size:11px;color:var(--accent)">${r.item||'—'}${srcBadge}</td>
      <td style="color:var(--text);max-width:150px;overflow:hidden;text-overflow:ellipsis">${r.desc||'—'}</td>
      <td><span class="bd ${isB?'bd-amber':'bd-red'}">${r.ccn||'—'}</span></td>
      <td style="text-align:right;font-family:var(--mono)">${(r.qty||0).toLocaleString()}</td>
      <td style="text-align:right;font-family:var(--mono);color:var(--text3)">${isB?fmtUsd(r.unitPrice||0):(r.unitPrice||0)>0?(r.unitPrice||0).toLocaleString()+'원':'—'}</td>
      <td style="text-align:right;font-family:var(--mono);color:${isB?'var(--amber)':'var(--red)'}">${isB?fmtUsd(amt):amt>0?amt.toLocaleString()+'원':'—'}</td>
      <td style="text-align:right;font-family:var(--mono);color:var(--green);font-weight:600">${krw>0?fmtKrw(krw):'—'}</td>
      <td style="font-family:var(--mono);font-size:10px;color:var(--text3)">${r.order||'—'}</td>
    </tr>`;
  }).join('');
}

function onExrateChange(){
  const v = parseFloat(document.getElementById('exrate-input').value)||0;
  if(v>0){ saveExrate(v); document.getElementById('exrate-result').textContent=`1 USD = ${v.toLocaleString()}원 적용`; }
  else{ document.getElementById('exrate-result').textContent='환율을 입력하세요'; }
  renderSalesDash();
}

function toggleSalesFilter(f){
  if(f==='all'){salesFilter.clear();salesFilter.add('all');}
  else{salesFilter.delete('all');salesFilter.has(f)?salesFilter.delete(f):salesFilter.add(f);if(!salesFilter.size)salesFilter.add('all');}
  ['all','B','K'].forEach(k=>{const el=document.getElementById('sl-'+k);if(el){el.classList.remove('on','default');if(salesFilter.has(k))el.classList.add('on','default');}});
  salesPage=1; renderSalesDetail();
}
function salesChgPage(d){ salesPage+=d; renderSalesDetail(); }

function fmtKrw(n){ if(!n||isNaN(n))return '—'; if(Math.abs(n)>=100000000) return (n/100000000).toFixed(1)+'억'; if(Math.abs(n)>=10000) return (n/10000).toFixed(0)+'만'; return n.toLocaleString(); }
function fmtUsd(n){ if(!n||isNaN(n))return '—'; return '$'+(n<1000?n.toFixed(2):n.toLocaleString('en',{minimumFractionDigits:0,maximumFractionDigits:0})); }

function renderSalesChart(monthly){
  const el = document.getElementById('sales-chart');
  const hasDelivered = monthly.some(m=>m.bKrw>0||m.kKrw>0);
  const exrate = getExrate();

  // PO 잔여 월별 집계 (promise date 기준)
  const poData = (typeof PO !== 'undefined') ? PO : [];
  const poMonthly = monthly.map(m=>{
    const poRows = poData.filter(r=>(r.promise||'').startsWith(m.m));
    const getAmt = r=>r.extended_price||r.amount||(r.unit_price||0)*(r.qty||1)||0;
    const poBKrw = poRows.filter(r=>r.ccn==='B').reduce((s,r)=>s+getAmt(r),0)*exrate;
    const poKKrw = poRows.filter(r=>r.ccn==='K').reduce((s,r)=>s+getAmt(r),0);
    return {m:m.m, label:m.label, total:poBKrw+poKKrw, cnt:poRows.length};
  });
  const hasPO = poMonthly.some(m=>m.total>0);

  if(!hasDelivered && !hasPO){
    el.innerHTML='<div class="no-sales">데이터 없음</div>'; return;
  }

  const CHART_H=200, Y_LBL_W=58, BAR_AREA_W=46, BAR_W=10, BAR_GAP=2, BOTTOM_PAD=28, GRID_LINES=4;
  const maxVal=Math.max(...monthly.map(m=>Math.max(m.bKrw,m.kKrw,m.total)),...poMonthly.map(m=>m.total),1);
  const rawStep=maxVal/GRID_LINES, mag=Math.pow(10,Math.floor(Math.log10(rawStep)));
  const step=Math.ceil(rawStep/mag)*mag, yMax=step*GRID_LINES;
  const gridLabels=Array.from({length:GRID_LINES+1},(_,i)=>{
    const v=i*step; if(!v)return '0';
    if(v>=100000000)return (v/100000000).toFixed(1)+'억';
    if(v>=10000)return Math.round(v/10000)+'만'; return v.toLocaleString();
  });
  const totalW=Y_LBL_W+monthly.length*BAR_AREA_W+8;
  let svgBars='',svgMonthLabels='',svgGrid='';

  for(let i=0;i<=GRID_LINES;i++){
    const y=CHART_H-(i/GRID_LINES)*CHART_H;
    svgGrid+=`<line x1="${Y_LBL_W}" y1="${y}" x2="${totalW}" y2="${y}" stroke="#2e3448" stroke-width="${i===0?1.5:0.5}" stroke-dasharray="${i===0?'none':'4,3'}"/>`;
    svgGrid+=`<text x="${Y_LBL_W-6}" y="${y+4}" text-anchor="end" font-size="9" fill="#5a6180">${gridLabels[i]}</text>`;
  }

  monthly.forEach((m,i)=>{
    const x=Y_LBL_W+i*BAR_AREA_W+(BAR_AREA_W-BAR_W*3-BAR_GAP*2)/2;
    const cx=Y_LBL_W+i*BAR_AREA_W+BAR_AREA_W/2;
    svgMonthLabels+=`<text x="${cx}" y="${CHART_H+18}" text-anchor="middle" font-size="9" fill="#5a6180">${m.label}</text>`;

    const bH=m.bKrw>0?Math.max(2,(m.bKrw/yMax)*CHART_H):0;
    const kH=m.kKrw>0?Math.max(2,(m.kKrw/yMax)*CHART_H):0;
    const poH=poMonthly[i].total>0?Math.max(2,(poMonthly[i].total/yMax)*CHART_H):0;

    if(bH>0) svgBars+=`<rect x="${x}" y="${CHART_H-bH}" width="${BAR_W}" height="${bH}" rx="2" fill="#ffb547" opacity="0.9"><title>납품 CCN B ${m.label}: ${fmtKrw(m.bKrw)}</title></rect>`;
    if(kH>0) svgBars+=`<rect x="${x+BAR_W+BAR_GAP}" y="${CHART_H-kH}" width="${BAR_W}" height="${kH}" rx="2" fill="#ff5555" opacity="0.9"><title>납품 CCN K ${m.label}: ${fmtKrw(m.kKrw)}</title></rect>`;
    if(poH>0) svgBars+=`<rect x="${x+BAR_W*2+BAR_GAP*2}" y="${CHART_H-poH}" width="${BAR_W}" height="${poH}" rx="2" fill="#4f7cff" opacity="0.45"><title>PO잔여 ${m.label}: ${fmtKrw(poMonthly[i].total)} (${poMonthly[i].cnt}건)</title></rect>`;
  });

  el.innerHTML=`<div style="overflow-x:auto;padding-bottom:4px">
    <svg width="${Math.max(totalW,500)}" height="${CHART_H+BOTTOM_PAD+4}" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible">
      <g transform="translate(0,4)">${svgGrid}${svgBars}${svgMonthLabels}</g>
    </svg></div>`;
}


function renderSalesTable(monthly, exrate){
  const active = monthly.filter(m=>m.bKrw>0||m.kKrw>0);
  document.getElementById('sales-tbl-cnt').textContent = active.length+'개월';
  const totB = monthly.reduce((s,m)=>s+m.bUsd,0);
  const totBK= totB*exrate;
  const totK = monthly.reduce((s,m)=>s+m.kKrw,0);
  const totT = totBK+totK;
  const totC = monthly.reduce((s,m)=>s+m.cnt,0);

  document.getElementById('sales-tbody').innerHTML = [
    ...monthly.filter(m=>m.cnt>0).map(m=>`<tr>
      <td>${m.label}</td>
      <td style="color:var(--text3);font-family:var(--font)">${salesYear}년 ${m.label}</td>
      <td style="color:var(--amber)">${m.bUsd>0?fmtUsd(m.bUsd):'—'}</td>
      <td style="color:var(--amber)">${m.bKrw>0?fmtKrw(m.bKrw):'—'}</td>
      <td style="color:var(--red)">${m.kKrw>0?fmtKrw(m.kKrw):'—'}</td>
      <td style="color:var(--green);font-weight:600">${m.total>0?fmtKrw(m.total):'—'}</td>
      <td style="color:var(--text3)">${m.cnt||'—'}</td>
    </tr>`),
    `<tr class="total-row">
      <td>합계</td>
      <td style="font-family:var(--font)">${salesYear}년 전체</td>
      <td style="color:var(--amber)">${fmtUsd(totB)}</td>
      <td style="color:var(--amber)">${fmtKrw(totBK)}</td>
      <td style="color:var(--red)">${fmtKrw(totK)}</td>
      <td style="color:var(--green)">${fmtKrw(totT)}</td>
      <td>${totC}</td>
    </tr>`
  ].join('');
}

// ══ 초기 로드 ══
(function init() {
  const hist = getHist();
  // po_data(최근 500건 캐시) → hist[0].data 순으로 PO 복원
  // saveHist가 data 없이 메타만 저장하므로 po_data 키 우선
  const poCache = (function(){ try{ return JSON.parse(localStorage.getItem('po_data')||'[]'); }catch{ return []; }})();
  if(poCache.length > 0 || (hist.length > 0 && hist[0].data && hist[0].data.length > 0)) {
    PO = poCache.length > 0 ? poCache : hist[0].data;
    if(hist.length > 0) document.getElementById('last-updated').textContent = '마지막 업로드: ' + hist[0].date;
    refreshAll();
  } else {
    document.getElementById('dash-alert').innerHTML = `<div class="empty"><div class="empty-icon">📂</div><div class="empty-title">엑셀 파일을 업로드하세요</div><div class="empty-sub">헤더 오른쪽 업로드 버튼 또는 파일을 드래그하여 놓으세요</div></div>`;
    document.getElementById('dash-soon').innerHTML = '<div class="empty" style="padding:30px"><div>데이터 없음</div></div>';
  }
  buildHistSelect();
  ['chg-all'].forEach(id=>{const el=document.getElementById(id);if(el){el.classList.add('on','default');}});
  ['trk-all'].forEach(id=>{const el=document.getElementById(id);if(el){el.classList.add('on','default');}});
  ['sl-all'].forEach(id=>{const el=document.getElementById(id);if(el){el.classList.add('on','default');}});

  // 납품완료 데이터로 연도 탭 초기화 (업로드 이력 + PO납품 통합)
  const dvData = getDelivered();
  if(dvData.length){
    buildYearTabs(dvData);
    const exrate = getExrate();
    const inp = document.getElementById('exrate-input');
    if(inp) inp.value = exrate;
  }
  // 납품완료 배지
  updateDeliveredBadge();
})();

// ══════════════════════════════════════════════════════════
//  매입/매출 집계
// ══════════════════════════════════════════════════════════
var aggYear = new Date().getFullYear();

function renderAgg() {
  var _aggEl = document.getElementById('agg-exrate');
  var exrate = _aggEl ? (parseFloat(_aggEl.value) || 1380) : 1380;
  var exEl = document.getElementById('agg-exrate-label');
  if(exEl) exEl.textContent = '1 USD = ' + exrate.toLocaleString() + '원';

  var recvAll = ld(K.RECV, []);
  // 입고완료 = recv_date 있는 것, 예상 = recv_date 없는 것
  var recvDone = recvAll.filter(function(r){ return r.recv_date && r.recv_date.trim() !== ''; });
  var recvPend = recvAll.filter(function(r){ return !r.recv_date || r.recv_date.trim() === ''; });
  var delivered = getDelivered();

  // 연도 목록 수집 (입고일 + 발주일 + 납품일 모두 포함)
  var yearSet = new Set();
  // 입고완료: recv_date 기준
  recvDone.forEach(function(r){ var y=(r.recv_date||'').substring(0,4); if(y.match(/^\d{4}$/)) yearSet.add(y); });
  // 미입고: order_date 기준
  recvPend.forEach(function(r){ var y=(r.order_date||r.req_date||'').substring(0,4); if(y.match(/^\d{4}$/)) yearSet.add(y); });
  // 매출: deliveredDate 기준
  delivered.forEach(function(r){ var y=(r.deliveredDate||'').substring(0,4); if(y.match(/^\d{4}$/)) yearSet.add(y); });
  // 연도가 하나도 없으면 현재 연도 추가
  if(!yearSet.size) yearSet.add(String(new Date().getFullYear()));
  var years = Array.from(yearSet).sort(function(a,b){return b-a;});
  if(!years.length) years = [String(aggYear)];
  if(!years.includes(String(aggYear))) aggYear = parseInt(years[0]);

  // 연도 탭
  var ytEl = document.getElementById('agg-year-tabs');
  if(ytEl) ytEl.innerHTML = years.map(function(y){
    var active = y == aggYear;
    return '<button onclick="setAggYear('+y+')" style="padding:5px 14px;border-radius:6px;border:1px solid '+(active?'var(--accent)':'var(--border)')+';background:'+(active?'var(--accent)':'var(--bg3)')+';color:'+(active?'#fff':'var(--text3)')+';font-size:12px;cursor:pointer;font-family:var(--font)">'+y+'년</button>';
  }).join('');

  // 연도 필터 (입고일/발주일 기준)
  var yrDone = recvDone.filter(function(r){ return (r.recv_date||'').startsWith(String(aggYear)); });
  var yrPend = recvPend.filter(function(r){ return ((r.req_date||r.order_date||'')).startsWith(String(aggYear)); });
  var yrDeli = delivered.filter(function(r){ return (r.deliveredDate||'').startsWith(String(aggYear)); });

  // 월별 집계
  var months = [];
  for(var mn=1;mn<=12;mn++){
    var mStr = String(aggYear) + '-' + String(mn).padStart(2,'0');
    var mDone = yrDone.filter(function(r){ return (r.recv_date||'').startsWith(mStr); });
    var mPend = yrPend.filter(function(r){ return ((r.req_date||r.order_date||'')).startsWith(mStr); });
    var mDeli = yrDeli.filter(function(r){ return (r.deliveredDate||'').startsWith(mStr); });
    var doneAmt = mDone.reduce(function(s,r){ return s+(parseFloat(r.total)||0); },0);
    var pendAmt = mPend.reduce(function(s,r){ return s+(parseFloat(r.total)||0); },0);
    var bRows = mDeli.filter(function(r){ return r.ccn==='B'; });
    var kRows = mDeli.filter(function(r){ return r.ccn==='K'; });
    var getAmt = function(r){ return r.amount||((r.unitPrice||0)*(r.qty||1)); };
    var bUsd = bRows.reduce(function(s,r){ return s+getAmt(r); },0);
    var kKrw = kRows.reduce(function(s,r){ return s+getAmt(r); },0);
    months.push({
      m: mStr, label: mn+'월',
      doneAmt: doneAmt, doneCnt: mDone.length,
      pendAmt: pendAmt, pendCnt: mPend.length,
      bUsd: bUsd, bKrw: bUsd*exrate, kKrw: kKrw,
      salesTotal: bUsd*exrate+kKrw, salesCnt: mDeli.length
    });
  }

  // 포맷 함수
  var fk = function(n){ if(!n||isNaN(n))return '—'; if(Math.abs(n)>=100000000) return (n/100000000).toFixed(1)+'억'; if(Math.abs(n)>=10000) return Math.round(n/10000)+'만'; return n.toLocaleString(); };
  var fu = function(n){ if(!n||isNaN(n))return '—'; return '$'+(n>=1000?n.toLocaleString('en',{minimumFractionDigits:0,maximumFractionDigits:0}):n.toFixed(0)); };

  // 요약 카드
  var totDone  = months.reduce(function(s,m){ return s+m.doneAmt; },0);
  var totPend  = months.reduce(function(s,m){ return s+m.pendAmt; },0);
  var totBUsd  = months.reduce(function(s,m){ return s+m.bUsd; },0);
  var totBKrw  = totBUsd*exrate;
  var totKKrw  = months.reduce(function(s,m){ return s+m.kKrw; },0);
  var totSales = totBKrw+totKKrw;

  document.getElementById('agg-total-recv').textContent      = fk(totDone);
  document.getElementById('agg-total-recv-pend').textContent = fk(totPend);
  var raEl = document.getElementById('agg-total-recv-all'); if(raEl) raEl.textContent = fk(totDone+totPend);
  document.getElementById('agg-total-b').textContent         = fk(totBKrw);
  document.getElementById('agg-total-b-usd').textContent     = fu(totBUsd)+' (USD)';
  document.getElementById('agg-total-k').textContent         = fk(totKKrw);
  document.getElementById('agg-total-sales').textContent     = fk(totSales);

  renderAggChart('agg-recv-chart', months, 'recv', exrate);
  renderAggChart('agg-sales-chart', months, 'sales', exrate);
  renderAggTable(months, fk, fu);
}

function setAggYear(y){ aggYear=y; renderAgg(); }

function renderAggChart(elId, months, type, exrate) {
  exrate = exrate || 1380;
  var el = document.getElementById(elId);
  if(!el) return;
  var hasData = months.some(function(m){ return type==='recv'?(m.doneAmt>0||m.pendAmt>0):m.salesTotal>0; });
  if(!hasData){ el.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3)">데이터 없음</div>'; return; }

  var CHART_H=160, Y_W=58, BAR_W=type==='recv'?20:14, BAR_GAP=4, AREA_W=46, BOT=24, GRID=4;
  var maxVal = Math.max.apply(null, months.map(function(m){
    return type==='recv' ? Math.max(m.doneAmt, m.pendAmt, m.doneAmt+m.pendAmt) : Math.max(m.bKrw, m.kKrw, m.salesTotal);
  }).concat([1]));
  var rawStep=maxVal/GRID, mag=Math.pow(10,Math.floor(Math.log10(rawStep)));
  var step=Math.ceil(rawStep/mag)*mag, yMax=step*GRID;
  var gridLabels=[];
  for(var i=0;i<=GRID;i++){
    var v=i*step;
    gridLabels.push(v===0?'0':v>=100000000?(v/100000000).toFixed(1)+'억':v>=10000?Math.round(v/10000)+'만':v.toLocaleString());
  }
  var totalW = Y_W + months.length*AREA_W + 8;
  var bars='', xlabels='', grid='';
  for(var i2=0;i2<=GRID;i2++){
    var y2=CHART_H-(i2/GRID)*CHART_H;
    grid+='<line x1="'+Y_W+'" y1="'+y2+'" x2="'+totalW+'" y2="'+y2+'" stroke="#2e3448" stroke-width="'+(i2===0?1.5:0.5)+'" stroke-dasharray="'+(i2===0?'none':'4,3')+'"/>';
    grid+='<text x="'+(Y_W-6)+'" y="'+(y2+4)+'" text-anchor="end" font-size="9" fill="#5a6180">'+gridLabels[i2]+'</text>';
  }
  months.forEach(function(m,i){
    var cx=Y_W+i*AREA_W+AREA_W/2;
    xlabels+='<text x="'+cx+'" y="'+(CHART_H+18)+'" text-anchor="middle" font-size="9" fill="#5a6180">'+m.label+'</text>';
    if(type==='recv'){
      var dH=m.doneAmt>0?Math.max(2,(m.doneAmt/yMax)*CHART_H):0;
      var pH=m.pendAmt>0?Math.max(2,(m.pendAmt/yMax)*CHART_H):0;
      var xd=Y_W+i*AREA_W+(AREA_W-BAR_W*2-BAR_GAP)/2;
      if(dH>0) bars+='<rect x="'+xd+'" y="'+(CHART_H-dH)+'" width="'+BAR_W+'" height="'+dH+'" rx="2" fill="#4f7cff" opacity="0.9"><title>'+m.label+' 실제매입: '+m.doneAmt.toLocaleString()+'원 ('+m.doneCnt+'건)</title></rect>';
      if(pH>0) bars+='<rect x="'+(xd+BAR_W+BAR_GAP)+'" y="'+(CHART_H-pH)+'" width="'+BAR_W+'" height="'+pH+'" rx="2" fill="#a78bfa" opacity="0.85"><title>'+m.label+' 예상매입: '+m.pendAmt.toLocaleString()+'원 ('+m.pendCnt+'건)</title></rect>';
    } else {
      var bH=m.bKrw>0?Math.max(2,(m.bKrw/yMax)*CHART_H):0;
      var kH=m.kKrw>0?Math.max(2,(m.kKrw/yMax)*CHART_H):0;
      var xb=Y_W+i*AREA_W+(AREA_W-BAR_W*2-BAR_GAP)/2;
      if(bH>0) bars+='<rect x="'+xb+'" y="'+(CHART_H-bH)+'" width="'+BAR_W+'" height="'+bH+'" rx="2" fill="#ffb547" opacity="0.9"><title>CCN B '+m.label+': '+m.bKrw.toLocaleString()+'원</title></rect>';
      if(kH>0) bars+='<rect x="'+(xb+BAR_W+BAR_GAP)+'" y="'+(CHART_H-kH)+'" width="'+BAR_W+'" height="'+kH+'" rx="2" fill="#ff5555" opacity="0.9"><title>CCN K '+m.label+': '+m.kKrw.toLocaleString()+'원</title></rect>';
    }
  });
  el.innerHTML='<div style="overflow-x:auto"><svg width="'+Math.max(totalW,500)+'" height="'+(CHART_H+BOT+4)+'" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible"><g transform="translate(0,4)">'+grid+bars+xlabels+'</g></svg></div>';
}

function renderAggTable(months, fk, fu) {
  var active = months.filter(function(m){ return m.recvCnt>0||m.salesCnt>0; });
  document.getElementById('agg-tbl-cnt').textContent = active.length+'개월';
  var totR=0,totP=0,totBU=0,totBK=0,totK=0,totS=0,totRC=0,totSC=0;
  months.forEach(function(m){ totR+=m.doneAmt; totP+=m.pendAmt; totBU+=m.bUsd; totBK+=m.bKrw; totK+=m.kKrw; totS+=m.salesTotal; totRC+=m.doneCnt; totSC+=m.salesCnt; });
  var rows = months.filter(function(m){ return m.recvCnt>0||m.salesCnt>0; }).map(function(m){
    return '<tr>'+
      '<td>'+m.label+'</td>'+
      '<td style="text-align:right;font-family:var(--mono);color:var(--accent)">'+(m.doneAmt>0?fk(m.doneAmt):'—')+'</td>'+
      '<td style="text-align:right;font-family:var(--mono);color:var(--purple)">'+(m.pendAmt>0?fk(m.pendAmt):'—')+'</td>'+
      '<td style="text-align:right;font-family:var(--mono);color:var(--amber)">'+(m.bUsd>0?fu(m.bUsd):'—')+'</td>'+
      '<td style="text-align:right;font-family:var(--mono);color:var(--amber)">'+(m.bKrw>0?fk(m.bKrw):'—')+'</td>'+
      '<td style="text-align:right;font-family:var(--mono);color:var(--red)">'+(m.kKrw>0?fk(m.kKrw):'—')+'</td>'+
      '<td style="text-align:right;font-family:var(--mono);color:var(--green);font-weight:600">'+(m.salesTotal>0?fk(m.salesTotal):'—')+'</td>'+
      '<td style="text-align:right;color:var(--text3)">'+(m.doneCnt||'—')+'</td>'+
      '<td style="text-align:right;color:var(--text3)">'+(m.salesCnt||'—')+'</td>'+
    '</tr>';
  });
  rows.push('<tr class="total-row">'+
    '<td>합계</td>'+
    '<td style="text-align:right;font-family:var(--mono);color:var(--accent)">'+fk(totR)+'</td>'+
    '<td style="text-align:right;font-family:var(--mono);color:var(--purple)">'+fk(totP)+'</td>'+
    '<td style="text-align:right;font-family:var(--mono);color:var(--amber)">'+fu(totBU)+'</td>'+
    '<td style="text-align:right;font-family:var(--mono);color:var(--amber)">'+fk(totBK)+'</td>'+
    '<td style="text-align:right;font-family:var(--mono);color:var(--red)">'+fk(totK)+'</td>'+
    '<td style="text-align:right;font-family:var(--mono);color:var(--green);font-weight:700">'+fk(totS)+'</td>'+
    '<td style="text-align:right">'+totRC+'</td>'+
    '<td style="text-align:right">'+totSC+'</td>'+
  '</tr>');
  document.getElementById('agg-tbody').innerHTML = rows.join('');
}

// ── 테이블 열 간격 조절 (드래그) ──

// 각 탭 렌더 후 열 조절 초기화
var _origRenderDB    = typeof renderDB    !== 'undefined' ? renderDB    : null;
var _origRenderRecv  = typeof renderRecv  !== 'undefined' ? renderRecv  : null;
var _origRenderPO    = typeof renderPO    !== 'undefined' ? renderPO    : null;
var _origRenderDelivered = typeof renderDelivered !== 'undefined' ? renderDelivered : null;


// 집계탭 열려있으면 자동 갱신
function renderAggIfOpen(){
  var sa = document.getElementById('sect-agg');
  if(sa && sa.style.display !== 'none') renderAgg();
}


// ══════════════════════════════════════════
//  매입 대시보드
// ══════════════════════════════════════════
var rdashYear = new Date().getFullYear();

function renderRecvDash() {
  var exrate = parseFloat(document.getElementById('rdash-exrate')?.value) || 1380;
  var recvAll = ld(K.RECV, []);
  var recvDone = recvAll.filter(function(r){ return r.recv_date && r.recv_date.trim(); });
  var recvPend = recvAll.filter(function(r){ return !r.recv_date || !r.recv_date.trim(); });

  // 연도 수집
  var yearSet = new Set();
  recvDone.forEach(function(r){ var y=(r.recv_date||'').substring(0,4); if(/^\d{4}$/.test(y)) yearSet.add(y); });
  recvPend.forEach(function(r){ var y=(r.order_date||'').substring(0,4); if(/^\d{4}$/.test(y)) yearSet.add(y); });
  if(!yearSet.size) yearSet.add(String(rdashYear));
  var years = Array.from(yearSet).sort(function(a,b){return b-a;});
  if(!years.includes(String(rdashYear))) rdashYear = parseInt(years[0]);

  // 연도 탭
  var ytEl = document.getElementById('rdash-year-tabs');
  if(ytEl) ytEl.innerHTML = years.map(function(y){
    var on = y==rdashYear;
    return '<button onclick="setRdashYear('+y+')" style="padding:5px 14px;border-radius:6px;border:1px solid '+(on?'var(--accent)':'var(--border)')+';background:'+(on?'var(--accent)':'var(--bg3)')+';color:'+(on?'#fff':'var(--text3)')+';font-size:12px;cursor:pointer">'+y+'년</button>';
  }).join('');

  var yrDone = recvDone.filter(function(r){ return (r.recv_date||'').startsWith(String(rdashYear)); });
  var yrPend = recvPend.filter(function(r){ return ((r.req_date||r.order_date||'')).startsWith(String(rdashYear)); });

  // 월별 집계
  var fk = function(n){ if(!n||isNaN(n))return '—'; if(Math.abs(n)>=100000000) return (n/100000000).toFixed(1)+'억'; if(Math.abs(n)>=10000) return Math.round(n/10000)+'만'; return n.toLocaleString(); };
  var months = [];
  for(var mn=1;mn<=12;mn++){
    var mStr = String(rdashYear)+'-'+String(mn).padStart(2,'0');
    var mDone = yrDone.filter(function(r){ return (r.recv_date||'').startsWith(mStr); });
    var mPend = yrPend.filter(function(r){ return ((r.req_date||r.order_date||'')).startsWith(mStr); });
    var doneAmt = mDone.reduce(function(s,r){ return s+(parseFloat(r.total)||0); },0);
    var pendAmt = mPend.reduce(function(s,r){ return s+(parseFloat(r.total)||0); },0);
    months.push({ label:mn+'월', mStr:mStr, doneAmt:doneAmt, pendAmt:pendAmt, doneCnt:mDone.length, pendCnt:mPend.length });
  }

  var totDone = months.reduce(function(s,m){return s+m.doneAmt;},0);
  var totPend = months.reduce(function(s,m){return s+m.pendAmt;},0);
  var el_done  = document.getElementById('rdash-done');  if(el_done)  el_done.textContent  = fk(totDone);
  var el_pend  = document.getElementById('rdash-pend');  if(el_pend)  el_pend.textContent  = fk(totPend);
  var el_total = document.getElementById('rdash-total'); if(el_total) el_total.textContent = fk(totDone+totPend);
  var el_cnt   = document.getElementById('rdash-cnt');   if(el_cnt)   el_cnt.textContent   = (yrDone.length+yrPend.length).toLocaleString()+'건';

  // 차트
  var chartEl = document.getElementById('rdash-chart');
  var hasData = months.some(function(m){return m.doneAmt>0||m.pendAmt>0;});
  if(!hasData||!chartEl){ if(chartEl) chartEl.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3)">데이터 없음</div>'; }
  else {
    var CH=160, YW=58, BW=14, BG=4, AW=46, BOT=24, GRID=4;
    var maxV=Math.max.apply(null,months.map(function(m){return Math.max(m.doneAmt,m.pendAmt);}).concat([1]));
    var rawStep=maxV/GRID, mag=Math.pow(10,Math.floor(Math.log10(rawStep)));
    var step=Math.ceil(rawStep/mag)*mag, yMax=step*GRID;
    var gridLbls=[]; for(var gi=0;gi<=GRID;gi++){var v=gi*step;gridLbls.push(v===0?'0':v>=100000000?(v/100000000).toFixed(1)+'억':v>=10000?Math.round(v/10000)+'만':v.toLocaleString());}
    var W=YW+months.length*AW+8, bars='', xls='', grid='';
    for(var gi2=0;gi2<=GRID;gi2++){var y2=CH-(gi2/GRID)*CH;grid+='<line x1="'+YW+'" y1="'+y2+'" x2="'+W+'" y2="'+y2+'" stroke="#2e3448" stroke-width="'+(gi2===0?1.5:0.5)+'" stroke-dasharray="'+(gi2===0?'none':'4,3')+'"/><text x="'+(YW-6)+'" y="'+(y2+4)+'" text-anchor="end" font-size="9" fill="#5a6180">'+gridLbls[gi2]+'</text>';}
    months.forEach(function(m,i){
      var cx=YW+i*AW+AW/2;
      xls+='<text x="'+cx+'" y="'+(CH+18)+'" text-anchor="middle" font-size="9" fill="#5a6180">'+m.label+'</text>';
      var xd=YW+i*AW+(AW-BW*2-BG)/2;
      var dH=m.doneAmt>0?Math.max(2,(m.doneAmt/yMax)*CH):0;
      var pH=m.pendAmt>0?Math.max(2,(m.pendAmt/yMax)*CH):0;
      if(dH>0) bars+='<rect x="'+xd+'" y="'+(CH-dH)+'" width="'+BW+'" height="'+dH+'" rx="2" fill="#4f7cff" opacity="0.9"><title>'+m.label+' 실제매입: '+m.doneAmt.toLocaleString()+'원</title></rect>';
      if(pH>0) bars+='<rect x="'+(xd+BW+BG)+'" y="'+(CH-pH)+'" width="'+BW+'" height="'+pH+'" rx="2" fill="#a78bfa" opacity="0.85"><title>'+m.label+' 예상매입: '+m.pendAmt.toLocaleString()+'원</title></rect>';
    });
    chartEl.innerHTML='<div style="overflow-x:auto"><svg width="'+Math.max(W,500)+'" height="'+(CH+BOT+4)+'" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible"><g transform="translate(0,4)">'+grid+bars+xls+'</g></svg></div>';
  }

  // 테이블
  var active = months.filter(function(m){return m.doneCnt>0||m.pendCnt>0;});
  var cntEl = document.getElementById('rdash-tbl-cnt'); if(cntEl) cntEl.textContent=active.length+'개월';
  var totR=0,totP=0,totRC=0,totPC=0;
  months.forEach(function(m){totR+=m.doneAmt;totP+=m.pendAmt;totRC+=m.doneCnt;totPC+=m.pendCnt;});
  var rows = active.map(function(m){
    return '<tr><td>'+m.label+'</td><td style="text-align:right;font-family:var(--mono);color:var(--accent)">'+(m.doneAmt>0?fk(m.doneAmt):'—')+'</td><td style="text-align:right;font-family:var(--mono);color:var(--purple)">'+(m.pendAmt>0?fk(m.pendAmt):'—')+'</td><td style="text-align:right;font-family:var(--mono);color:var(--tel)">'+(m.doneAmt+m.pendAmt>0?fk(m.doneAmt+m.pendAmt):'—')+'</td><td style="text-align:right">'+(m.doneCnt||'—')+'</td><td style="text-align:right">'+(m.pendCnt||'—')+'</td></tr>';
  });
  rows.push('<tr class="total-row"><td>합계</td><td style="text-align:right;font-family:var(--mono);color:var(--accent)">'+fk(totR)+'</td><td style="text-align:right;font-family:var(--mono);color:var(--purple)">'+fk(totP)+'</td><td style="text-align:right;font-family:var(--mono);color:var(--tel)">'+fk(totR+totP)+'</td><td style="text-align:right">'+totRC+'</td><td style="text-align:right">'+totPC+'</td></tr>');
  var tbody = document.getElementById('rdash-tbody'); if(tbody) tbody.innerHTML=rows.join('');
}
function setRdashYear(y){ rdashYear=y; renderRecvDash(); }

// ══════════════════════════════════════════
//  자재조회 섹션 탭 전환
// ══════════════════════════════════════════
function srchTab(t){
  ['item','req','bom','where'].forEach(function(tab){
    var pg=document.getElementById('srch-pg-'+tab); if(pg) pg.style.display=tab===t?'block':'none';
  });
  document.querySelectorAll('#srch-inner-tabs .pt-itab').forEach(function(el){
    el.classList.toggle('on', el.dataset.tab===t);
  });
  if(t==='item') initSrch();
  if(t==='req'){
    // req-dt 기본값
    var dt=document.getElementById('req-dt');
    if(dt&&!dt.value) dt.value=new Date().toISOString().split('T')[0];
    // 출고처 datalist
    var dests=[...new Set(OUT.map(function(r){return r.dest;}).filter(Boolean))];
    var dl2=document.getElementById('dl2');
    if(dl2) dl2.innerHTML=dests.map(function(v){return '<option value="'+v+'">';}).join('');
    renderReqPanel();
  }
}

function initSrch2(){
  var dests=[...new Set(OUT.map(function(r){return r.dest;}).filter(Boolean))];
  var dl3=document.getElementById('dl3');
  if(dl3) dl3.innerHTML=dests.map(function(v){return '<option value="'+v+'">';}).join('');
  var dt2=document.getElementById('req-dt-2');
  if(dt2 && !dt2.value) dt2.value=new Date().toISOString().split('T')[0];
  renderReqPanel2();
}

var reqItems2 = [];
function addToReq2(pn){
  var r=DB.find(function(x){return x.pn===pn;})||{pn:pn};
  if(reqItems2.find(function(x){return x.pn===pn;})){alert(pn+'은 이미 요청 목록에 있습니다');return;}
  reqItems2.push({pn:pn,d:r.d||'',qty:1,unit:'EA',note:''});
  switchApp('srch'); srchTab('req');
  renderReqPanel2();
}
function renderReqPanel2(){
  var tbody=document.getElementById('req-tbody-2');
  if(!tbody) return;
  tbody.innerHTML=reqItems2.length
    ? reqItems2.map(function(r,i){return '<tr><td style="font-family:var(--mono);font-size:11px;color:var(--tel)">'+r.pn+'</td><td style="font-size:12px">'+( r.d||'—')+'</td><td><input type="number" min="1" value="'+r.qty+'" style="width:60px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:3px 6px;color:var(--text)" onchange="reqItems2['+i+'].qty=+this.value"></td><td>'+r.unit+'</td><td><input type="text" placeholder="비고" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:3px 6px;color:var(--text);font-size:12px" onchange="reqItems2['+i+'].note=this.value"></td><td><button class="btn br-btn sm" style="padding:2px 7px" onclick="reqItems2.splice('+i+',1);renderReqPanel2()">✕</button></td></tr>';}).join('')
    : '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:16px;font-size:12px">품번조회 탭에서 + 불출요청 버튼을 눌러 추가하세요</td></tr>';
}
function clearReq2(){
  if(!confirm('요청 목록을 초기화하시겠습니까?')) return;
  reqItems2=[];renderReqPanel2();
}
function submitReq2(){
  if(!reqItems2.length){alert('요청 품목이 없습니다');return;}
  var dt=document.getElementById('req-dt-2')?.value;
  var dest=document.getElementById('req-dest-2')?.value.trim();
  var rec=document.getElementById('req-rec-2')?.value.trim()||'';
  var pur=document.getElementById('req-pur-2')?.value||'자재불출';
  if(!dt||!dest){alert('요청일과 출고처를 입력하세요');return;}
  reqItems2.forEach(function(r){
    var dbr=DB.find(function(x){return x.pn===r.pn;})||{};
    OUT.unshift({date:dt,pn:r.pn,mfg_pn:dbr.mp||'',qty:r.qty,unit:r.unit,purpose:pur,dest:dest,receiver:rec,note:'[불출요청]'+(r.note||''),_added:new Date().toLocaleString('ko-KR')});
  });
  sv(K.OUT,OUT);
  var cnt=reqItems2.length;
  reqItems2=[];renderReqPanel2();
  updateStat();
  oF=new Set(['all']);
  alert('✅ '+cnt+'건 불출 요청 등록됨. 구매관리 → 자재불출 탭에서 확인하세요.');
}

function doSrchBOM(){
  var pn=document.getElementById('bom-srch-pn')?.value.trim();
  var el=document.getElementById('bom-srch-results');
  if(!pn||!el){alert('품번을 입력하세요');return;}
  var bom=BOM[pn];
  if(!bom||!bom.length){el.innerHTML='<div style="text-align:center;padding:30px;color:var(--text3)">BOM 데이터가 없습니다 (품번: '+pn+')</div>';return;}
  el.innerHTML='<div class="tw"><div class="th-row"><div class="th-title">BOM — '+pn+'</div><div class="th-count">'+bom.length+'개 부품</div></div><div class="tbl-scroll"><table><thead><tr><th>품번</th><th>품명</th><th>수량</th><th>단위</th><th>비고</th></tr></thead><tbody>'+bom.map(function(b){return '<tr><td style="font-family:var(--mono);font-size:11px;color:var(--tel)">'+b.cpn+'</td><td>'+( b.cdesc||'—')+'</td><td style="text-align:right">'+( b.qty||1)+'</td><td>'+(b.unit||'EA')+'</td><td style="font-size:11px;color:var(--text3)">'+( b.note||'—')+'</td></tr>';}).join('')+'</tbody></table></div></div>';
}

// ── 품목군별 월별 현황 ──
var ITEM_GROUP_COLORS = [
  '#4f7cff','#ffb547','#ff5555','#34d399','#a78bfa',
  '#fb923c','#38bdf8','#f472b6','#a3e635','#fbbf24',
  '#60a5fa','#f87171','#818cf8','#4ade80','#e879f9'
];

function getItemGroup(item){
  var s = String(item||'').trim();
  if(/^11[0-9]/.test(s)) return '110*';
  if(/^16[0-9]/.test(s)) return '16*';
  if(/^17[0-9]/.test(s)) return '17*';
  if(/^51[0-9]/.test(s)) return '51*';
  if(/^54[0-9]/.test(s)) return '54*';
  if(/^19[0-9]/.test(s)) return '19*';
  if(/^12[0-9]/.test(s)) return '12*';
  return '기타';
}

function renderItemGroupChart(){
  var el = document.getElementById('item-group-chart');
  var legendEl = document.getElementById('item-group-legend');
  if(!el) return;

  var src = (document.getElementById('item-group-src')||{value:'delivered'}).value;
  var months = Array.from({length:12}, function(_,i){
    return String(salesYear)+'-'+String(i+1).padStart(2,'0');
  });

  // 데이터 소스
  var rows = [];
  if(src === 'po'){
    rows = (typeof PO !== 'undefined' ? PO : []).map(function(r){
      return {item: r.item, month: (r.promise||'').substring(0,7), qty: r.qty||1};
    });
  } else {
    rows = getDelivered().filter(function(r){
      return (r.deliveredDate||'').startsWith(String(salesYear));
    }).map(function(r){
      return {item: r.item, month: (r.deliveredDate||'').substring(0,7), qty: r.qty||1};
    });
  }

  // 품목군 집계
  var groupSet = {};
  rows.forEach(function(r){
    var g = getItemGroup(r.item);
    var m = r.month;
    if(!groupSet[g]) groupSet[g] = {};
    if(!groupSet[g][m]) groupSet[g][m] = 0;
    groupSet[g][m] += r.qty||1;
  });

  var groups = Object.keys(groupSet).sort(function(a,b){
    var ta = Object.values(groupSet[a]).reduce(function(s,v){return s+v;},0);
    var tb = Object.values(groupSet[b]).reduce(function(s,v){return s+v;},0);
    return tb-ta;
  });

  if(!groups.length){
    el.innerHTML='<div class="no-sales">데이터를 업로드하면 표시됩니다</div>';
    if(legendEl) legendEl.innerHTML='';
    return;
  }

  // SVG 바 차트 (그룹 × 월)
  var CHART_H=140, Y_LBL_W=44, AREA_W=44, BOT=22, GRID=4;
  var maxVal=1;
  months.forEach(function(m){
    var sum=groups.reduce(function(s,g){return s+(groupSet[g][m]||0);},0);
    if(sum>maxVal) maxVal=sum;
  });
  var step=Math.ceil(maxVal/GRID), yMax=step*GRID;
  var totalW=Y_LBL_W+months.length*AREA_W+8;
  var barW=Math.max(3,Math.floor((AREA_W-2)/(groups.length||1)));
  var svgG='',svgB='',svgL='';

  for(var gi=0;gi<=GRID;gi++){
    var y=CHART_H-(gi/GRID)*CHART_H;
    svgG+='<line x1="'+Y_LBL_W+'" y1="'+y+'" x2="'+totalW+'" y2="'+y+'" stroke="#2e3448" stroke-width="'+(gi===0?1.5:0.5)+'" stroke-dasharray="'+(gi===0?'none':'4,3')+'"/>';
    svgG+='<text x="'+(Y_LBL_W-4)+'" y="'+(y+4)+'" text-anchor="end" font-size="9" fill="#5a6180">'+(gi*step)+'</text>';
  }

  months.forEach(function(m,mi){
    var cx=Y_LBL_W+mi*AREA_W+AREA_W/2;
    svgL+='<text x="'+cx+'" y="'+(CHART_H+16)+'" text-anchor="middle" font-size="9" fill="#5a6180">'+(mi+1)+'월</text>';
    var stackY=CHART_H;
    groups.forEach(function(g,gi){
      var cnt=groupSet[g][m]||0;
      if(!cnt) return;
      var h=Math.max(2,(cnt/yMax)*CHART_H);
      stackY-=h;
      var color=ITEM_GROUP_COLORS[gi%ITEM_GROUP_COLORS.length];
      svgB+='<rect x="'+(Y_LBL_W+mi*AREA_W+4)+'" y="'+stackY+'" width="'+(AREA_W-8)+'" height="'+h+'" fill="'+color+'" opacity="0.85"><title>'+g+' '+m.substring(5)+'월: '+cnt+'건</title></rect>';
    });
  });

  el.innerHTML='<div style="overflow-x:auto"><svg width="'+Math.max(totalW,500)+'" height="'+(CHART_H+BOT+4)+'" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible"><g transform="translate(0,4)">'+svgG+svgB+svgL+'</g></svg></div>';

  // 범례
  if(legendEl){
    legendEl.innerHTML=groups.map(function(g,i){
      var total=Object.values(groupSet[g]).reduce(function(s,v){return s+v;},0);
      var color=ITEM_GROUP_COLORS[i%ITEM_GROUP_COLORS.length];
      return '<span style="display:flex;align-items:center;gap:4px;padding:2px 8px;background:var(--bg3);border-radius:4px;border:1px solid var(--border)">'+
        '<span style="width:10px;height:10px;border-radius:2px;background:'+color+';display:inline-block"></span>'+
        '<span>'+g+'</span><span style="color:var(--text3)">'+total+'건</span></span>';
    }).join('');
  }
}


// ── 자재조회 하위탭 ──
function srchSubTab(tab){
  var panels = {item:'srch-panel-item', bom:'srch-panel-bom'};
  var tabs = {item:'srch-tab-item', bom:'srch-tab-bom'};
  Object.keys(panels).forEach(function(k){
    var p = document.getElementById(panels[k]);
    var t = document.getElementById(tabs[k]);
    if(p) p.style.display = k===tab ? 'block' : 'none';
    if(t){
      t.style.borderBottomColor = k===tab ? 'var(--tel)' : 'transparent';
      t.style.color = k===tab ? 'var(--tel)' : 'var(--text3)';
    }
  });
  if(tab==='item'){
    var sq = document.getElementById('sq');
    if(sq) sq.focus();
  }
}

// ── BOM 조회 (자재조회 탭) ──
function lookupBOM(){
  var pn = (document.getElementById('bom-lookup-pn')||{value:''}).value.trim();
  if(!pn){ alert('상위품번을 입력하세요'); return; }
  showBOM(pn);
  // bom-results 가 srch-panel-bom 안에 있으므로 자동 표시
}

// ── 역전개 (Where-Used) ──────────────────────────────
function lookupWhere(){
  var pn=(document.getElementById('where-pn')||{value:''}).value.trim();
  if(!pn){ alert('품번을 입력하세요'); return; }
  renderWhereUsed(pn);
}

function renderWhereUsed(childPN){
  var el=document.getElementById('where-results');
  if(!el) return;
  if(!BOM||!Object.keys(BOM).length){
    el.innerHTML='<div style="color:var(--amber);padding:20px;text-align:center">BOM 데이터가 없습니다. 로그인 후 데이터를 로드하세요.</div>';
    return;
  }

  var pn=String(childPN).trim();
  var raw=[];
  Object.keys(BOM).forEach(function(parentPN){
    (BOM[parentPN]||[]).forEach(function(child){
      if(String(child.pn||child.child_pn||'').trim()===pn){
        raw.push({parentPN:parentPN, qty:+(child.qty||child.aqty||0), lv:child.lv||1, no:child.no||'', isAlt:child.isAlt||false});
      }
    });
  });

  var dbItem=(typeof DB!=='undefined')?DB.find(function(r){return String(r.pn).trim()===pn;}):null;

  if(!raw.length){
    el.innerHTML='<div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:28px;text-align:center;color:var(--text3)">'
      +'<div style="font-size:22px;margin-bottom:8px">🔍</div>'
      +'<div style="font-size:13px;font-weight:600;color:var(--text2);margin-bottom:4px">사용처 없음</div>'
      +'<div style="font-size:12px">품번 <span style="font-family:var(--mono);color:var(--tel)">'+pn+'</span>을 사용하는 상위 ASSY가 없습니다</div>'
      +'</div>';
    return;
  }

  // ── 상위품번 기준 그룹핑 (합계 수량) ──
  var groupMap={};
  raw.forEach(function(r){
    if(!groupMap[r.parentPN]){
      var pi=(typeof DB!=='undefined')?DB.find(function(d){return String(d.pn).trim()===r.parentPN;}):null;
      groupMap[r.parentPN]={parentPN:r.parentPN, totalQty:0, rows:[], desc:pi?pi.d:'', mfg:pi?pi.mg:''};
    }
    groupMap[r.parentPN].totalQty+=r.qty;
    groupMap[r.parentPN].rows.push(r);
  });
  var groups=Object.values(groupMap).sort(function(a,b){return a.parentPN.localeCompare(b.parentPN);});
  var grandTotal=groups.reduce(function(s,g){return s+g.totalQty;},0);

  // ── 헤더 ──
  var html='<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;overflow:hidden">'
    +'<div style="background:var(--bg3);border-bottom:1px solid var(--border2);padding:11px 16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">'
      +'<span style="font-family:var(--mono);font-size:14px;font-weight:700;color:var(--tel)">'+pn+'</span>'
      +(dbItem?'<span style="font-size:13px;color:var(--text)">'+dbItem.d+'</span>':'')
      +(dbItem&&dbItem.mg?'<span style="font-size:11px;color:var(--text3)">'+dbItem.mg+'</span>':'')
      +'<div style="margin-left:auto;display:flex;gap:16px;font-size:12px">'
        +'<span style="color:var(--text2)">사용 ASSY: <b style="color:var(--tel)">'+groups.length+'개</b></span>'
        +'<span style="color:var(--text2)">총 합계수량: <b style="color:var(--tel)">'+grandTotal+'</b></span>'
      +'</div>'
    // ── 테이블 (품명 좁힘, 수량 소수점 2자리) ──
    +'<table style="width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed">'
    +'<colgroup><col style="width:140px"><col style="width:220px"><col style="width:100px"><col style="width:80px"><col style="width:72px"></colgroup>'
    +'<thead><tr style="background:var(--bg3);border-bottom:1px solid var(--border2)">'
      +'<th style="padding:7px 14px;text-align:left;font-size:10.5px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.4px;white-space:nowrap">상위품번 (ASSY)</th>'
      +'<th style="padding:7px 12px;text-align:left;font-size:10.5px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.4px">품명</th>'
      +'<th style="padding:7px 14px;text-align:right;font-size:10.5px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.4px">합계 수량</th>'
      +'<th style="padding:7px 12px;text-align:center;font-size:10.5px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.4px">BOM</th>'
      +'<th style="padding:7px 12px;text-align:center;font-size:10.5px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.4px">상세</th>'
    +'</tr></thead>'
    +'<tbody id="where-tbody">';

  groups.forEach(function(g,gi){
    var multiRow=g.rows.length>1;
    var detailId='wu-det-'+gi;
    var totQtyDisp=parseFloat(parseFloat(g.totalQty).toFixed(2));
    // ── 요약 행 ──
    html+='<tr style="border-bottom:1px solid var(--border)">'
      +'<td style="padding:9px 14px;font-family:var(--mono);font-size:12px;font-weight:700;color:var(--tel);white-space:nowrap">'+g.parentPN+'</td>'
      +'<td style="padding:9px 12px;font-size:12px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+g.desc+'">'+g.desc+'</td>'
      +'<td style="padding:9px 14px;text-align:right;font-family:var(--mono);font-size:14px;font-weight:700;color:var(--text)">'+totQtyDisp+'</td>'
      +'<td style="padding:9px 12px;text-align:center">'
        +'<button onclick="srchTab(\'bom\');document.getElementById(\'bom-lookup-pn\').value=\''+g.parentPN+'\';lookupBOM()" '
          +'style="background:none;border:1px solid var(--tel);border-radius:5px;padding:3px 10px;color:var(--tel);font-size:11px;cursor:pointer;font-weight:600">조회</button>'
      +'</td>'
      +'<td style="padding:9px 12px;text-align:center">'
        +(multiRow
          ? '<button onclick="wuToggle(\''+detailId+'\')" id="wubtn-'+gi+'" '
              +'style="background:none;border:1px solid var(--border2);border-radius:5px;padding:3px 10px;color:var(--text2);font-size:11px;cursor:pointer;min-width:44px">▼ '+g.rows.length+'</button>'
          : '<span style="font-size:11px;color:var(--text3)">—</span>')
      +'</td>'
    +'</tr>';
    // ── 세부 행 (기본 숨김, multiRow만) ──
    if(multiRow){
      html+='<tr id="'+detailId+'" style="display:none"><td colspan="5" style="padding:0;background:rgba(45,212,191,.04);border-bottom:2px solid var(--border2)">'
        +'<table style="width:100%;border-collapse:collapse;font-size:11.5px;table-layout:fixed">'
        +'<colgroup><col style="width:100px"><col style="width:44px"><col><col style="width:90px"><col style="width:70px"></colgroup>'
        +'<thead></thead><tbody>'
        +g.rows.map(function(r){
          var qDisp=parseFloat(parseFloat(r.qty).toFixed(2));
          return '<tr style="border-top:1px solid rgba(45,212,191,.1)">'
            +'<td style="padding:5px 14px;font-family:var(--mono);font-size:11px;color:var(--text3)">'+(r.no||'—')+'</td>'
            +'<td style="padding:5px 8px;text-align:center"><span style="background:rgba(45,212,191,.15);color:var(--tel);border-radius:3px;padding:1px 6px;font-size:10px;font-weight:700;font-family:var(--mono)">'+r.lv+'</span></td>'
            +'<td style="padding:5px 8px;color:var(--text2);font-size:11px;font-family:var(--mono)">'+pn+'</td>'
            +'<td style="padding:5px 14px;text-align:right;font-family:var(--mono);font-size:13px;font-weight:700;color:var(--text)">'+qDisp+'</td>'
            +'<td style="padding:5px 10px;text-align:center">'+(r.isAlt?'<span style="font-size:10px;background:rgba(255,181,71,.18);color:var(--amber);border-radius:3px;padding:1px 6px;font-weight:700">대체</span>':'')+'</td>'
            +'</tr>';
        }).join('')
        +'</tbody></table></td></tr>';
    }
  });

  html+='</tbody></table></div>';
  el.innerHTML=html;
}

function wuToggle(id){
  var row=document.getElementById(id);
  if(!row) return;
  var gi=id.replace('wu-det-','');
  var btn=document.getElementById('wubtn-'+gi);
  var open=row.style.display==='none'||row.style.display==='';
  row.style.display=open?'table-row':'none';
  if(btn){
    var cnt=btn.textContent.replace(/[▼▲ ]/g,'').trim();
    btn.textContent=(open?'▲ ':'▼ ')+cnt;
    btn.style.color=open?'var(--tel)':'var(--text2)';
    btn.style.borderColor=open?'var(--tel)':'var(--border2)';
  }
}



// ══════════════════════════════════════════════
//  발주 추이 분석
// ══════════════════════════════════════════════
var otrPeriod = 'month';  // month | quarter | half | year
var otrData   = 'both';     // po | delivered | both
var otrShow   = 'qty';    // qty | amt

function setOtrPeriod(v){
  otrPeriod = v;
  ['month','quarter','half','year'].forEach(function(k){
    var el = document.getElementById('otrp-'+k);
    if(el){ el.classList.toggle('on', k===v); el.classList.toggle('default', k===v); }
  });
  renderOrdTrend();
}

function setOtrData(v){
  otrData = v;
  ['po','delivered','both'].forEach(function(k){
    var el = document.getElementById('otrd-'+k);
    if(el){ el.classList.toggle('on', k===v); el.classList.toggle('default', k===v); }
  });
  renderOrdTrend();
}

function setOtrShow(v){
  otrShow = v;
  ['qty','amt'].forEach(function(k){
    var el = document.getElementById('otrs-'+k);
    if(el){ el.classList.toggle('on', k===v); el.classList.toggle('default', k===v); }
  });
  renderOrdTrend();
}

// 날짜 → 기간 레이블
function getPeriodKey(dateStr){
  if(!dateStr || dateStr.length < 7) return null;
  var y = dateStr.substring(0,4);
  var m = parseInt(dateStr.substring(5,7));
  if(otrPeriod === 'month')   return y + '-' + String(m).padStart(2,'0');
  if(otrPeriod === 'quarter') return y + '-Q' + Math.ceil(m/3);
  if(otrPeriod === 'half')    return y + '-H' + (m <= 6 ? 1 : 2);
  if(otrPeriod === 'year')    return y;
  return y + '-' + String(m).padStart(2,'0');
}

function renderOrdTrend(){
  var q = (document.getElementById('otr-q')||{value:''}).value.trim().toLowerCase();

  // ── 데이터 수집 ──
  var rows = [];

  if(otrData === 'po' || otrData === 'both'){
    var poRows = (typeof PO !== 'undefined' ? PO : []);
    poRows.forEach(function(r){
      var dateKey = getPeriodKey(r.promise || r.placed || '');
      if(!dateKey) return;
      var getAmt = function(x){ return x.extended_price || x.amount || (x.unit_price||0)*(x.qty||1) || 0; };
      var pn = r.item || r.pn || '';
      if(!pn) return;
      rows.push({
        pn: pn, desc: r.desc||'', ccn: r.ccn||'',
        qty: r.qty||0, amt: getAmt(r),
        period: dateKey, src: 'po'
      });
    });
  }

  if(otrData === 'delivered' || otrData === 'both'){
    var dvRows = getDelivered();
    dvRows.forEach(function(r){
      var dateKey = getPeriodKey(r.deliveredDate || '');
      if(!dateKey) return;
      rows.push({
        pn: r.item||'', desc: r.desc||'', ccn: r.ccn||'',
        qty: r.qty||0, amt: r.amount||((r.unitPrice||0)*(r.qty||1)),
        period: dateKey, src: 'delivered'
      });
    });
  }

  // ── 품번별 집계 ──
  var itemMap = {};
  rows.forEach(function(r){
    var pn = r.pn;
    if(!pn) return;
    if(!itemMap[pn]) itemMap[pn] = {pn:pn, desc:r.desc, ccn:r.ccn, periods:{}};
    if(!itemMap[pn].periods[r.period]) itemMap[pn].periods[r.period] = {qty:0, amt:0};
    itemMap[pn].periods[r.period].qty += r.qty;
    itemMap[pn].periods[r.period].amt += r.amt;
  });

  // 검색 필터
  var items = Object.values(itemMap).filter(function(it){
    if(!q) return true;
    return it.pn.toLowerCase().includes(q) || it.desc.toLowerCase().includes(q);
  });

  // 기간 컬럼 목록 (정렬)
  var periodSet = {};
  rows.forEach(function(r){ if(r.period) periodSet[r.period] = 1; });
  var periods = Object.keys(periodSet).sort();

  // ── 테이블 렌더링 ──
  var thead = document.getElementById('otr-thead');
  var tbody = document.getElementById('otr-tbody');
  var cntEl = document.getElementById('otr-cnt');
  if(!thead || !tbody) return;

  var TH_STYLE = 'padding:7px 10px;font-size:10px;font-weight:600;color:var(--text3);background:var(--bg3);border-bottom:1px solid var(--border);white-space:nowrap;text-align:right;position:sticky;top:0';
  var TH_LEFT  = TH_STYLE + ';text-align:left';

  var headerHTML = '<tr>'
    + '<th style="'+TH_LEFT+';min-width:110px">품번</th>'
    + '<th style="'+TH_LEFT+';min-width:150px">품명</th>'
    + '<th style="'+TH_LEFT+';width:50px">CCN</th>'
    + '<th style="'+TH_STYLE+';width:60px">합계</th>';
  periods.forEach(function(p){
    headerHTML += '<th style="'+TH_STYLE+'">' + p + '</th>';
  });
  headerHTML += '<th style="'+TH_STYLE+';color:var(--teal);width:80px">평균/기간</th>'
    + '<th style="'+TH_STYLE+';color:var(--green);width:80px">안전재고</th>'
    + '</tr>';
  thead.innerHTML = headerHTML;

  // 합계 기준 정렬
  items.sort(function(a,b){
    var sa = Object.values(a.periods).reduce(function(s,v){return s+(otrShow==='qty'?v.qty:v.amt);},0);
    var sb = Object.values(b.periods).reduce(function(s,v){return s+(otrShow==='qty'?v.qty:v.amt);},0);
    return sb - sa;
  });

  var fv = function(v){
    if(otrShow === 'qty') return v > 0 ? v.toLocaleString() : '';
    if(!v) return '';
    if(Math.abs(v)>=10000) return '$'+(v/10000).toFixed(1)+'만';
    return '$'+v.toLocaleString('en',{minimumFractionDigits:0,maximumFractionDigits:0});
  };

  var fkrw = function(v){
    if(!v) return '';
    if(Math.abs(v)>=100000000) return (v/100000000).toFixed(1)+'억';
    if(Math.abs(v)>=10000) return Math.round(v/10000)+'만';
    return v.toLocaleString();
  };

  var TD = 'padding:6px 10px;font-size:12px;border-bottom:1px solid var(--border2);text-align:right;font-family:var(--mono);white-space:nowrap';
  var TD_L = 'padding:6px 10px;font-size:12px;border-bottom:1px solid var(--border2);text-align:left;white-space:nowrap';

  var bodyHTML = items.map(function(it){
    var total = 0;
    var nonZeroCnt = 0;
    var cells = periods.map(function(p){
      var val = it.periods[p] ? (otrShow==='qty' ? it.periods[p].qty : it.periods[p].amt) : 0;
      if(val > 0){ total += val; nonZeroCnt++; }
      var heat = val > 0 ? 'color:var(--text);font-weight:600' : 'color:var(--text3)';
      return '<td style="'+TD+';'+heat+'">' + fv(val) + '</td>';
    }).join('');

    var avg = nonZeroCnt > 0 ? (total / periods.length) : 0; // 전체 기간 기준 평균
    // 안전재고: 평균 × (LT/4.3 + 1)
    var dbItem = DB.find(function(x){return x.pn===it.pn;})||{};
    var lt = dbItem.lt || 0;
    var safetyStock = avg > 0 ? Math.ceil(avg * (lt/4.3 + 1)) : 0;

    var ccnColor = it.ccn==='B' ? 'color:var(--amber)' : it.ccn==='K' ? 'color:var(--red)' : 'color:var(--text3)';

    var rowHtml = '<tr style="cursor:pointer;transition:background .1s" data-otr-pn="'+encodeURIComponent(it.pn)+'" onclick="showOtrSafety(decodeURIComponent(this.dataset.otrPn))" title="클릭: 안전재고 상세">'
      + '<td style="'+TD_L+';color:var(--accent);font-family:var(--mono);font-size:11px">'+it.pn+'</td>'
      + '<td style="'+TD_L+';max-width:180px;overflow:hidden;text-overflow:ellipsis" title="'+it.desc+'">'+it.desc+'</td>'
      + '<td style="'+TD_L+';'+ccnColor+';font-weight:700;font-size:11px">'+it.ccn+'</td>'
      + '<td style="'+TD+';color:var(--text);font-weight:700">'+fv(total)+'</td>'
      + cells
      + '<td style="'+TD+';color:var(--teal);font-weight:600">'+(avg>0?fv(Math.round(avg)):'—')+'</td>'
      + '<td style="'+TD+';color:var(--green);font-weight:700;background:var(--green-bg)">'+(safetyStock>0?safetyStock.toLocaleString():'—')+'</td>'
      + '</tr>';
    return rowHtml;
  }).join('');

  if(!items.length){
    bodyHTML = '<tr><td colspan="'+(periods.length+6)+'" style="text-align:center;padding:30px;color:var(--text3)">PO 또는 납품이력을 업로드하면 표시됩니다</td></tr>';
  }

  tbody.innerHTML = bodyHTML;
  if(cntEl) cntEl.textContent = items.length + '개 품목 · ' + periods.length + '개 기간';
}

function showOtrSafety(pn){
  var banner = document.getElementById('otr-safety-banner');
  var content = document.getElementById('otr-safety-content');
  if(!banner || !content) return;

  var itemMap = {};
  var rows = [];

  if(otrData === 'po' || otrData === 'both'){
    (typeof PO !== 'undefined' ? PO : []).forEach(function(r){
      var dk = getPeriodKey(r.promise||r.placed||'');
      var rpn = r.item || r.pn || '';
      if(!dk || rpn !== pn) return;
      rows.push({qty:r.qty||0, period:dk});
    });
  }
  if(otrData === 'delivered' || otrData === 'both'){
    getDelivered().filter(function(r){return r.item===pn;}).forEach(function(r){
      var dk = getPeriodKey(r.deliveredDate||'');
      if(!dk) return;
      rows.push({qty:r.qty||0, period:dk});
    });
  }

  var periodSet = {};
  rows.forEach(function(r){ periodSet[r.period] = (periodSet[r.period]||0) + r.qty; });
  var periods = Object.keys(periodSet).sort();
  var totalQty = Object.values(periodSet).reduce(function(s,v){return s+v;},0);
  var avgPerPeriod = periods.length > 0 ? totalQty / periods.length : 0;
  var maxQty = periods.length > 0 ? Math.max.apply(null, Object.values(periodSet)) : 0;

  var dbItem = DB.find(function(x){return x.pn===pn;})||{};
  var lt = dbItem.lt || 0;
  var safetyStock = Math.ceil(avgPerPeriod * (lt/4.3 + 1));

  var periodLabel = {month:'월', quarter:'분기', half:'반기', year:'년'}[otrPeriod]||'기간';

  content.innerHTML = [
    {label:'품번', val:pn, color:'var(--accent)'},
    {label:'품명', val:dbItem.d||'—', color:'var(--text)'},
    {label:'LT (주)', val: lt>0 ? lt+'주' : '미입력', color: lt>0?'var(--text)':'var(--red)'},
    {label:'집계 기간 수', val:periods.length+periodLabel, color:'var(--text)'},
    {label:'총 발주수량', val:totalQty.toLocaleString(), color:'var(--amber)'},
    {label:'평균/'+periodLabel, val:avgPerPeriod.toFixed(1), color:'var(--teal)'},
    {label:'최대 발주량', val:maxQty.toLocaleString(), color:'var(--purple)'},
    {label:'✅ 권장 안전재고', val:safetyStock>0?safetyStock.toLocaleString():'LT 필요', color:'var(--green)', bold:true},
  ].map(function(c){
    return '<div style="background:var(--bg3);border-radius:7px;padding:10px 14px;border:1px solid var(--border)">'
      + '<div style="font-size:10px;color:var(--text3);margin-bottom:4px">'+c.label+'</div>'
      + '<div style="font-size:'+(c.bold?'18':'15')+'px;font-weight:'+(c.bold?'800':'600')+';color:'+c.color+';font-family:var(--mono)">'+c.val+'</div>'
      + '</div>';
  }).join('');

  banner.style.display = 'block';
  banner.scrollIntoView({behavior:'smooth', block:'nearest'});
}

