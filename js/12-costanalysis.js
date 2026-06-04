/* ══════════════════ 원가분석 (Cost Analysis) ══════════════════ */
var CA = { mode:'target', rows:[], vendorMap:null };
var CA_VENDOR_KEY = 'ax_vendor_origin';   // {벤더명: 'imp'|'dom'} 사용자 override

/* RFQ 거래처 시트 기반 시드 (알려진 분류) */
var CA_SEED_IMP = ['AFC','ARROW','AXCELIS','CDM','ELECTRICAUTOMATION','FLYKEY','H AND J','HAIHONG','HYDRADYNE','INFINITEELECTRONICS','INSTRUTECHINC','INTERPOWER','MCMASTERCARR','MC-MC','MCS','MDC PRECISION','MOTIONELEC','MPF PRODUCTS INC','NASSAU','ONLINECOMPONENET','ONLINECOMPONENT','OXIDATIONTECH','RAPTOR','TME','해외구매','미국RS','사급','유로박스'];
var CA_SEED_DOM = ['KCD','L-COM','MALIN CO.','OMEGA','TURCK','가견적','가나에프에이','거전산업','국제산업기계','그로스','네이버','뉴엔','다일아이비씨','대동볼트','대현상공','동신','디지키','레오콤','마우저','메르센코리아','미즈미','바오산전','삼기','삼진ENG','상도전자','상명시스텍','상암교역','서울아크릴','선비기술','세방코포레이션','세봉','수주테크','쉬맥스','스마텍','스웨즈락','신원머티리얼즈','아마존','아이녹스','아이엠피티','알엔','에스엠이서브텍','에이치티씨','에이티에스솔루션','엘레파츠','엘리먼트','엘앤피코리아','엘엔피코리아','엠엠피','엠포시스템','위너스오토메이션','위트솔루션즈','이디에스','이레전선','이로피','이삭이앤아이','인터넷구매','인터캡','정금','지원테크','진풍','카본플러스','키엔스코리아','파워일렉','하네스','하네스팀','하네스팀관리','화인','진선테크'];

function caInit(){
  caLoadVendorMap();
  caRenderConfigDefaults();
  if(CA.mode==='vendor') caRenderVendors();
}
function caLoadVendorMap(){
  try{ CA.vendorMap = JSON.parse(localStorage.getItem(CA_VENDOR_KEY)||'{}'); }catch(e){ CA.vendorMap={}; }
  if(!CA.vendorMap) CA.vendorMap={};
}
function caSaveVendorMap(){
  try{ localStorage.setItem(CA_VENDOR_KEY, JSON.stringify(CA.vendorMap)); }catch(e){}
  if(typeof CURRENT_TOKEN!=='undefined' && CURRENT_TOKEN){
    // 별도 시트 저장 (선택) — 실패 무시
    try{ apiPost({action:'setSheet',sheet:'vendor_origin',data:Object.keys(CA.vendorMap).map(function(k){return {vendor:k,origin:CA.vendorMap[k]};})}).catch(function(){}); }catch(e){}
  }
}
function caRenderConfigDefaults(){
  // DB연결 기본값과 동일 (이미 HTML value 로 세팅됨)
}

/* ── 수입/국내 판정 ── */
function caNormVendor(v){ return String(v||'').trim().toUpperCase(); }
function caVendorOrigin(vendor){
  var key = caNormVendor(vendor);
  if(!key) return 'dom'; // 미상 → 국내 기본
  // 1) 사용자 override 우선
  if(CA.vendorMap && CA.vendorMap[key]) return CA.vendorMap[key];
  // 2) 시드
  if(CA_SEED_IMP.indexOf(key)>=0) return 'imp';
  if(CA_SEED_DOM.indexOf(key)>=0) return 'dom';
  // 3) 자동 규칙
  return caAutoOrigin(vendor);
}
function caAutoOrigin(vendor){
  var s=String(vendor||'').trim();
  if(!s) return 'dom';
  var up=s.toUpperCase();
  // 명시 키워드
  if(/해외|수입|미국|사급|유로박스|\bRS\b/.test(s)) return 'imp';
  if(/국내|코리아|KOREA/i.test(s)) return 'dom';
  if(/^HTTPS?:\/\//i.test(s) || /\.COM|\.NET/i.test(up)) return 'imp'; // URL
  // 한글 포함 → 국내
  if(/[가-힣]/.test(s)) return 'dom';
  // 영문/숫자만 → 수입
  if(/^[A-Z0-9 .\-_&/()]+$/i.test(s)) return 'imp';
  return 'dom';
}

/* ── 모드 전환 ── */
function caSetMode(m){
  CA.mode=m;
  ['target','rean','vendor'].forEach(function(k){
    var b=document.getElementById('ca-mode-'+k); if(b) b.classList.toggle('on',k===m);
  });
  document.getElementById('ca-pane-analyze').style.display = (m==='vendor')?'none':'';
  document.getElementById('ca-pane-vendor').style.display  = (m==='vendor')?'':'none';
  document.getElementById('ca-cfg-bar').style.display      = (m==='vendor')?'none':'';
  document.getElementById('ca-input-target').style.display = (m==='target')?'':'none';
  document.getElementById('ca-input-rean').style.display   = (m==='rean')?'':'none';
  document.getElementById('ca-target-row').style.display   = '';  // Target+작업비: 두 모드 모두 표시
  if(m==='vendor') caRenderVendors();
  else caRun();
}

/* ── 설정 읽기 ── */
function caCfg(){
  var g=function(id,d){ var e=document.getElementById(id); return e?(+e.value||d):d; };
  return {
    buyRate:g('ca-buy-rate',1450), sellRate:g('ca-sell-rate',1250),
    realRate:g('ca-real-rate',0),
    laborMarg:g('ca-labor-marg',25)/100,
    tiers:[{min:1000000,m:g('ca-m1',20)/100},{min:100000,m:g('ca-m2',25)/100},{min:10000,m:g('ca-m3',35)/100},{min:0,m:g('ca-m4',45)/100}]
  };
}
function caMarg(buyKrw,cfg){
  if(!buyKrw||buyKrw<=0) return cfg.tiers[cfg.tiers.length-1].m;
  for(var i=0;i<cfg.tiers.length;i++){ if(buyKrw>=cfg.tiers[i].min) return cfg.tiers[i].m; }
  return cfg.tiers[cfg.tiers.length-1].m;
}
function caToN(v){ if(v==null||v==='') return null; var n=parseFloat(String(v).replace(/,/g,'')); return isNaN(n)?null:n; }
/* 천단위 콤마 포맷 (입력 중 커서 유지 간단버전) */
function caFmtNum(el){
  var raw=el.value.replace(/[^\d.]/g,'');
  if(raw==='') { el.value=''; return; }
  var parts=raw.split('.');
  parts[0]=parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,',');
  el.value=parts.length>1?parts[0]+'.'+parts[1]:parts[0];
}
function caIsAssy(pn){ return /^(10|11|12|16)/.test(String(pn)); }

/* ── BOM 입력 (엑셀/붙여넣기) ── */
function caTogglePaste(){ var w=document.getElementById('ca-paste-wrap'); w.style.display=w.style.display==='none'?'':'none'; }
function caLoadBOMXl(inp){
  if(!inp||!inp.files[0]) return;
  if(typeof XLSX==='undefined'){ qToast('엑셀 라이브러리 로드 안됨','err'); return; }
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var wb=XLSX.read(e.target.result,{type:'array'});
      // BOM_업로드 시트 우선, 없으면 첫 시트
      var sn = wb.SheetNames.indexOf('BOM_업로드')>=0 ? 'BOM_업로드' : wb.SheetNames[0];
      var rows=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:null});
      caParseBOMRows(rows);
    }catch(err){ qToast('BOM 파싱 실패: '+err.message,'err',4000); }
  };
  reader.readAsArrayBuffer(inp.files[0]);
}
function caParsePaste(){
  var txt=document.getElementById('ca-paste-area').value;
  if(!txt.trim()){ qToast('붙여넣은 내용이 없습니다','info'); return; }
  var rows=txt.split(/\r?\n/).map(function(l){ return l.split('\t'); });
  caParseBOMRows(rows);
}
// 레벨 트리 보존 + 전개수량(상위수량 누적곱) 계산
function caParseBOMRows(rows){
  if(!rows||!rows.length){ qToast('데이터 없음','info'); return; }
  var hi=-1;
  for(var i=0;i<Math.min(rows.length,8);i++){
    var joined=(rows[i]||[]).map(function(c){return String(c||'').toUpperCase();}).join('|');
    if(/PN|품번|ITEMNO|PART/.test(joined) && /QTY|수량|QUANTITY/.test(joined)){ hi=i; break; }
  }
  var startRow, colMap={};
  if(hi>=0){
    var hdr=rows[hi].map(function(c){return String(c||'').toUpperCase().trim();});
    hdr.forEach(function(h,ci){
      if(/LEVEL|레벨/.test(h)) colMap.lv=ci;
      else if(/KIND|종류|TYPE/.test(h)) colMap.kind=ci;
      else if(/^PN$|품번|ITEMNO|PART\s*NUM/.test(h) && colMap.pn==null) colMap.pn=ci;
      else if(/DESC|품명/.test(h)) colMap.desc=ci;
      else if(/QTY|수량|QUANT/.test(h)) colMap.qty=ci;
      else if(/UNIT|단위/.test(h)) colMap.unit=ci;
      else if(/^REV$|버전/.test(h)) colMap.rev=ci;
    });
    startRow=hi+1;
  } else {
    colMap={lv:0,kind:1,pn:2,desc:3,qty:4,unit:5,rev:6}; startRow=0;
  }
  var out=[], skip=0;
  var qtyByLevel={};   // 레벨별 현재 수량 (전개수량 계산용)
  var uid=0;
  for(var r=startRow;r<rows.length;r++){
    var row=rows[r]; if(!row) continue;
    var pn=String(row[colMap.pn]!=null?row[colMap.pn]:'').trim();
    if(!pn||/^PN$|품번/i.test(pn)) continue;
    var kind=colMap.kind!=null?String(row[colMap.kind]||'').trim().toLowerCase():'';
    var isDoc = (kind.indexOf('document')>=0||kind==='doc'||kind.indexOf('mfr')>=0||kind.indexOf('manufactur')>=0)
             || /\.(DRW|ASM|PRT|PDF|DXF|STEP|STP|IGS)$/i.test(pn);
    if(isDoc){ skip++; continue; }
    var lv=parseInt(row[colMap.lv]); if(isNaN(lv)) lv=0;
    var rawQty=caToN(row[colMap.qty]); if(rawQty==null) rawQty=1;
    // 전개수량 = 상위 레벨의 전개수량 × 자기 수량
    var parentMul = lv>0 ? (qtyByLevel[lv-1]||1) : 1;
    var expQty = (lv===0) ? rawQty : parentMul*rawQty;
    qtyByLevel[lv]=expQty;
    // 하위 레벨 캐시 정리 (자기보다 깊은 레벨 무효화)
    Object.keys(qtyByLevel).forEach(function(k){ if(+k>lv) delete qtyByLevel[k]; });
    out.push({
      uid:'r'+(uid++), pn:pn, lv:lv,
      desc:colMap.desc!=null?String(row[colMap.desc]||'').trim():'',
      qty:rawQty,          // 원본(상위 1개 기준) 수량
      expQty:expQty,       // 전개 수량 (상위 수량 반영)
      unit:colMap.unit!=null?String(row[colMap.unit]||'').trim():'',
      rev:colMap.rev!=null?String(row[colMap.rev]||'').trim():'',
      excluded:(lv===0),   // 최상위(L0)는 기본 제외 (보통 KIT 자체는 매입대상 아님)
      marginOverride:null  // 품목별 마진 직접지정(% 0~100), null이면 자동
    });
  }
  CA.rows=out;
  var msg='✓ '+out.length+'개 품목 (L0:'+out.filter(function(x){return x.lv===0;}).length
        +' L1:'+out.filter(function(x){return x.lv===1;}).length
        +' L2+:'+out.filter(function(x){return x.lv>=2;}).length+')';
  if(skip) msg+=' · 문서/제조사 '+skip+'행 제외';
  document.getElementById('ca-bom-count').textContent=msg;
  caRun();
}

/* ── 기존 BOM 불러오기 (BOM 관리 데이터) ── */
function caLoadExistingBOM(){
  var pn=(document.getElementById('ca-rean-pn').value||'').trim();
  if(!pn){ qToast('ASSY 품번을 입력하세요','info'); return; }
  if(typeof BOM==='undefined' || !BOM){ qToast('BOM 데이터가 없습니다. BOM 관리에서 먼저 등록하세요','err',4000); return; }
  // BOM 구조: 보통 { assyPn: [{pn,qty,...}] } 또는 배열. 유연하게 처리
  var parts=caExtractBOMParts(pn);
  if(!parts.length){ qToast('해당 ASSY의 BOM을 찾을 수 없습니다: '+pn,'err',4000); return; }
  CA.rows=parts;
  document.getElementById('ca-bom-count').textContent='✓ '+pn+' BOM '+parts.length+'개 품목';
  caRun();
}
function caExtractBOMParts(assyPn){
  var out=[];
  try{
    if(Array.isArray(BOM)){
      BOM.forEach(function(b){
        if(String(b.assy||b.parent||b.assyPn||'').trim()===assyPn || String(b.pn||'')===assyPn){
          if(b.parts&&b.parts.length) b.parts.forEach(function(p){ out.push({pn:String(p.pn||p.child||'').trim(),desc:p.desc||'',qty:caToN(p.qty)||1,rev:p.rev||''}); });
          else if(b.child) out.push({pn:String(b.child).trim(),desc:b.desc||'',qty:caToN(b.qty)||1,rev:b.rev||''});
        }
      });
    } else if(BOM && typeof BOM==='object' && BOM[assyPn]){
      (BOM[assyPn]||[]).forEach(function(p){ out.push({pn:String(p.pn||p.child||'').trim(),desc:p.desc||'',qty:caToN(p.qty)||1,rev:p.rev||''}); });
    }
  }catch(e){}
  return out;
}

/* ── 핵심: 원가 계산 ── */
function caRun(){
  if(CA.mode==='vendor') return;
  var cfg=caCfg();
  if(!CA.rows||!CA.rows.length){ caClearResults(); return; }
  if(typeof DB==='undefined'||!DB||!DB.length){ qToast('품목 DB가 로드되지 않았습니다','err',4000); }

  var items=CA.rows.map(function(p,idx){
    var item = (typeof qFindItem==='function') ? qFindItem(p.pn) : (DB||[]).find(function(d){return String(d.pn).trim()===String(p.pn).trim();});
    var buyKrw = item ? (caToN(item.k6)||caToN(item.k5)||null) : null;
    var vendor = item ? (item.by||'') : '';
    var origin = caVendorOrigin(vendor);
    var qty = p.expQty!=null?p.expQty:(caToN(p.qty)||1);   // 전개수량 사용
    var status = !item ? 'unreg' : (buyKrw==null ? 'noprice' : 'ok');
    return {
      idx:idx, uid:p.uid, pn:p.pn, lv:p.lv!=null?p.lv:0,
      desc:(item&&item.d)||p.desc||'', rev:p.rev||(item&&item.rv)||'',
      mfg:(item&&item.mg)||p.mfg||'', mfgpn:(item&&item.mp)||p.mfgPn||'',
      qty:qty, rawQty:p.qty, unit:p.unit||'', vendor:vendor, origin:origin, status:status,
      excluded:!!p.excluded, marginOverride:p.marginOverride,
      buyKrw:buyKrw, buyKrwTotal:buyKrw!=null?buyKrw*qty:null,
      targetUsd:p.targetUsd!=null?p.targetUsd:null
    };
  });
  CA._items=items;

  // 원가 집계: 제외(excluded) 품목은 합계에서 제외 → 상위/하위 중복 방지
  var impKrw=0, domKrw=0, noPrice=0, impUsd=0;
  items.forEach(function(it){
    if(it.excluded) return;
    if(it.buyKrwTotal==null){ noPrice++; return; }
    if(it.origin==='imp'){ impKrw+=it.buyKrwTotal; impUsd+=it.buyKrwTotal/cfg.buyRate; } // 수입: 기준매입환율로 달러원가 역산
    else domKrw+=it.buyKrwTotal;
  });
  var laborKrw = caToN((document.getElementById('ca-labor-krw')||{}).value)||0;
  var totalBuyKrw = impKrw+domKrw+laborKrw;

  // Target 매출가($) — 품목별 합계 우선, 없으면 전체 입력값
  var perItemTarget = items.reduce(function(s,it){ return s+(it.targetUsd!=null?it.targetUsd*it.qty:0); },0);
  var totalTargetInput = caToN((document.getElementById('ca-target-total')||{}).value);
  var targetUsd = perItemTarget>0 ? perItemTarget : (totalTargetInput||0);
  var targetKrw = targetUsd * cfg.sellRate;

  // 권장 판매가($): 자재(품목별/자동 마진) + 작업비(작업비 마진) — 두 모드 공통
  var suggestUsd=0;
  items.forEach(function(it){
    if(it.excluded || it.buyKrw==null) return;
    var m=(it.marginOverride!=null)?(it.marginOverride/100):caMarg(it.buyKrw,cfg);
    if(m>=1) m=0.99;
    suggestUsd += (it.buyKrw/(1-m)/cfg.sellRate)*it.qty;
  });
  if(laborKrw>0){ var lm=cfg.laborMarg>=1?0.99:cfg.laborMarg; suggestUsd += laborKrw/(1-lm)/cfg.sellRate; }
  // Target 미입력 시 권장가를 기준으로 (두 모드 공통)
  if(targetUsd<=0){ targetUsd=suggestUsd; targetKrw=targetUsd*cfg.sellRate; }

  caRenderResults({cfg:cfg,items:items,impKrw:impKrw,domKrw:domKrw,impUsd:impUsd,laborKrw:laborKrw,totalBuyKrw:totalBuyKrw,
    targetUsd:targetUsd,targetKrw:targetKrw,suggestUsd:suggestUsd,noPrice:noPrice,targetInput:(perItemTarget>0||totalTargetInput>0)});
}

function caClearResults(){
  ['ca-sum-cards','ca-cost-breakdown','ca-scenario'].forEach(function(id){ var e=document.getElementById(id); if(e) e.innerHTML=''; });
  var t=document.getElementById('ca-detail-table'); if(t){ t.querySelector('thead').innerHTML=''; t.querySelector('tbody').innerHTML='<tr><td style="padding:20px;color:var(--text3)">BOM을 입력하세요</td></tr>'; }
}

function caRenderResults(R){
  var cfg=R.cfg;
  var real=cfg.realRate||0;
  // 기준환율 기반
  var baseSell = R.targetKrw;                       // = targetUsd × sellRate
  var baseBuy  = R.totalBuyKrw;                      // 수입(기준매입환율)+국내+작업비
  var baseMK   = baseSell - baseBuy;
  var baseMP   = baseSell>0?baseMK/baseSell*100:0;
  // 실제환율 기반 (수입자재·매출 모두 실제환율, 국내·작업비 고정)
  var realSell = real>0 ? R.targetUsd*real : null;
  var realBuy  = real>0 ? (R.impUsd*real + R.domKrw + R.laborKrw) : null;
  var realMK   = real>0 ? realSell-realBuy : null;
  var realMP   = (real>0&&realSell>0) ? realMK/realSell*100 : 0;

  var clsOf=function(mp){ return mp>=15?'good':(mp>=8?'warn':'bad'); };
  var usingSuggest = !R.targetInput;

  // 요약 레이아웃: [매입원가(세로 2칸)] | [기준환율: Target·마진] / [실제환율: Target·마진]
  var clsTxt=function(mp){ return mp>=15?'good':(mp>=8?'warn':'bad'); };
  var labelKind=usingSuggest?'권장가':'Target';
  function miniCard(lbl,val,sub,cls){
    return '<div class="ca-mini'+(cls?' '+cls:'')+'"><div class="cm-l">'+lbl+'</div><div class="cm-v">'+val+'</div><div class="cm-s">'+(sub||'')+'</div></div>';
  }
  var rightRows='';
  // 기준환율 행
  rightRows+='<div class="ca-rate-row"><div class="ca-rate-tag base">기준환율 @'+cfg.sellRate+'</div>'
    +miniCard(labelKind+' 매출가','$'+R.targetUsd.toLocaleString(undefined,{maximumFractionDigits:0}),'₩'+Math.round(baseSell).toLocaleString(),'')
    +miniCard('마진액','₩'+Math.round(baseMK).toLocaleString(),'마진율 '+baseMP.toFixed(1)+'%',clsTxt(baseMP))
    +'</div>';
  // 실제환율 행
  if(real>0){
    rightRows+='<div class="ca-rate-row"><div class="ca-rate-tag real">실제환율 @'+real+'</div>'
      +miniCard(labelKind+' 매출가','$'+R.targetUsd.toLocaleString(undefined,{maximumFractionDigits:0}),'₩'+Math.round(realSell).toLocaleString(),'')
      +miniCard('마진액','₩'+Math.round(realMK).toLocaleString(),'마진율 '+realMP.toFixed(1)+'%',clsTxt(realMP))
      +'</div>';
  } else {
    rightRows+='<div class="ca-rate-row" style="opacity:.5"><div class="ca-rate-tag real">실제환율</div>'
      +'<div class="ca-mini" style="grid-column:span 2;display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:12px">설정 바에 현재 실제환율을 입력하면 표시됩니다</div></div>';
  }
  var html=''
    +'<div class="ca-cost-big">'
    +  '<div class="cb-l">매입원가 합계</div>'
    +  '<div class="cb-v">₩'+Math.round(R.totalBuyKrw).toLocaleString()+'</div>'
    +  '<div class="cb-s">수입+국내'+(R.laborKrw>0?'+작업비':'')+'</div>'
    +  '<div class="cb-x">분석품목 '+(R.items?R.items.filter(function(x){return !x.excluded;}).length:0)+'건</div>'
    +'</div>'
    +'<div class="ca-right-rows">'+rightRows+'</div>';
  document.getElementById('ca-sum-cards').innerHTML=html;

  var marginKrw=baseMK, marginPct=baseMP, cls=clsTxt(baseMP);

  // 원가 구성
  var bd='';
  var pct=function(v){ return R.totalBuyKrw>0?(v/R.totalBuyKrw*100).toFixed(1):'0.0'; };
  bd+=caCostLine('수입 자재비','₩'+Math.round(R.impKrw).toLocaleString()+' ('+pct(R.impKrw)+'%)');
  bd+=caCostLine('국내 자재비','₩'+Math.round(R.domKrw).toLocaleString()+' ('+pct(R.domKrw)+'%)');
  if(R.laborKrw>0) bd+=caCostLine('작업비','₩'+Math.round(R.laborKrw).toLocaleString()+' ('+pct(R.laborKrw)+'%)');
  bd+='<div class="ca-cost-line total"><span class="nm">매입원가 합계</span><span class="amt">₩'+Math.round(R.totalBuyKrw).toLocaleString()+'</span></div>';
  if(R.noPrice>0) bd+='<div style="font-size:11px;color:var(--amb);margin-top:8px">⚠ 매입가 없는 품목 '+R.noPrice+'건 (DB k5/k6 등록 필요 — 합계에서 제외됨)</div>';
  document.getElementById('ca-cost-breakdown').innerHTML=bd;

  // 환율 시나리오 — 환율값(원/$) + 마진액 + 마진율. 판매환율 기준 ±5/10%, 수입매입도 동일비율
  var scn='';
  if(R.targetUsd>0){
    var baseRate=cfg.sellRate;
    var scenarios=[
      {nm:'↑10%',f:1.10},{nm:'↑5%',f:1.05},{nm:'현재 견적',f:1.0},{nm:'↓5%',f:0.95},{nm:'↓10%',f:0.90}
    ];
    scn+='<table class="ca-table" style="width:100%"><thead><tr>'
       +'<th>시나리오</th><th class="num">적용 환율</th><th class="num">매출(₩)</th><th class="num">매입(₩)</th><th class="num">마진액(₩)</th><th class="num">마진율</th>'
       +'</tr></thead><tbody>';
    scenarios.forEach(function(s){
      var rate=baseRate*s.f;
      // 수입자재: 달러원가 고정 → 원화는 환율 비례. 국내·작업비 고정.
      var buyAdj = R.impUsd*rate + R.domKrw + R.laborKrw;
      var sellAdj = R.targetUsd*rate;
      var mK = sellAdj - buyAdj;
      var mP = sellAdj>0?(mK/sellAdj*100):0;
      var c = mK<0?'#ff5a5a':(mP>=15?'#2dd4bf':(mP>=8?'#f59e0b':'#ffa94d'));
      var bg = s.f===1.0?'rgba(79,124,255,.12)':'transparent';
      var tag = mK<0?' <span style="font-size:10px;color:#ff5a5a">역마진</span>':'';
      scn+='<tr style="background:'+bg+'">'
         +'<td style="font-weight:600">'+s.nm+'</td>'
         +'<td class="num" style="font-family:var(--mono)">'+Math.round(rate).toLocaleString()+'</td>'
         +'<td class="num">'+Math.round(sellAdj).toLocaleString()+'</td>'
         +'<td class="num">'+Math.round(buyAdj).toLocaleString()+'</td>'
         +'<td class="num" style="color:'+c+';font-weight:700">'+Math.round(mK).toLocaleString()+tag+'</td>'
         +'<td class="num" style="color:'+c+';font-weight:700">'+mP.toFixed(1)+'%</td>'
         +'</tr>';
    });
    scn+='</tbody></table>';
    // 손익분기 환율: 매출(targetUsd×r) = 매입(impUsd×r + domKrw + laborKrw) → r(targetUsd−impUsd)=dom+labor
    var fixed=R.domKrw+R.laborKrw;
    var denom=R.targetUsd-R.impUsd;
    if(denom>0){
      var breakRate=fixed/denom;  // 이 환율에서 마진 0
      var gap=baseRate-breakRate; // 견적환율 − 손익분기환율 (양수면 여유)
      var gapPct=baseRate>0?(gap/baseRate*100):0;
      var msg = gap>=0
        ? '견적 기준환율 ₩'+baseRate.toLocaleString()+'/$ 기준, 환율이 <b>₩'+Math.round(breakRate).toLocaleString()+'/$</b>까지 내려가면 마진이 0이 됩니다. (약 '+gapPct.toFixed(1)+'%p 여유)'
        : '손익분기 환율은 <b>₩'+Math.round(breakRate).toLocaleString()+'/$</b>로, 견적 기준환율 ₩'+baseRate.toLocaleString()+'/$보다 높습니다. 기준환율을 재검토해 주세요.';
      scn+='<div style="margin-top:10px;padding:10px 12px;border-radius:8px;background:var(--bg3);border:1px solid var(--border2);font-size:12.5px;line-height:1.6;color:var(--text2)">'
         +'📌 <b>손익분기 환율</b> — '+msg
         +'</div>';
    } else {
      scn+='<div style="margin-top:10px;font-size:12px;color:var(--text3)">매출 달러가 수입 달러원가보다 작거나 같아 손익분기 전환점이 없습니다.</div>';
    }
  } else {
    scn='<div style="font-size:12px;color:var(--text3);padding:10px">Target 매출가를 입력하면 환율 시나리오별 마진이 표시됩니다</div>';
  }
  document.getElementById('ca-scenario').innerHTML=scn;

  // ── 기준 vs 실제환율: 환차손익 + 네고 여력 ──
  var fxEl=document.getElementById('ca-fx-body');
  if(fxEl){
    if(!real || R.targetUsd<=0){
      fxEl.innerHTML='<div style="font-size:12px;color:var(--text3);padding:8px">현재 실제환율과 Target 매출가를 입력하면, 환차손익과 네고 가능 금액이 표시됩니다.</div>';
    } else {
      // base*/real* 값은 상단에서 계산됨 (재사용)
      // 환차손익(실제−기준) = 매출환차 + 매입환차
      var sellFx = realSell - baseSell;             // 매출 환차익(+)
      var buyFx  = (R.impUsd*real) - R.impKrw;      // 수입매입 환차손(+면 비용증가)
      var netFx  = realMK - baseMK;                 // 순 환차손익
      // 네고 여력: 실제 마진을 기준 마진(baseMK)까지 떨어뜨릴 수 있는 매출 감소액
      var negoRoomKrw = realMK - baseMK;            // 이만큼 깎아도 기준마진 유지
      var negoRoomUsd = negoRoomKrw/real;           // 달러 환산(실제환율 기준 고객 부담)
      var negoPct = realSell>0?negoRoomKrw/realSell*100:0;

      var col=function(v){return v>=0?'#2dd4bf':'#ff5a5a';};
      fxEl.innerHTML=
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:12px">'
        + '<div style="background:var(--bg3);border-radius:8px;padding:10px 12px">'
        +   '<div style="font-size:11px;color:var(--text3);margin-bottom:6px">기준 (견적 제출 @'+cfg.sellRate+'/'+cfg.buyRate+')</div>'
        +   '<div class="ca-cost-line"><span class="nm">매출(₩)</span><span class="amt">'+Math.round(baseSell).toLocaleString()+'</span></div>'
        +   '<div class="ca-cost-line"><span class="nm">매입(₩)</span><span class="amt">'+Math.round(baseBuy).toLocaleString()+'</span></div>'
        +   '<div class="ca-cost-line total"><span class="nm">마진</span><span class="amt" style="color:'+col(baseMK)+'">'+Math.round(baseMK).toLocaleString()+' ('+baseMP.toFixed(1)+'%)</span></div>'
        + '</div>'
        + '<div style="background:rgba(45,212,191,.06);border:1px solid #2dd4bf;border-radius:8px;padding:10px 12px">'
        +   '<div style="font-size:11px;color:#2dd4bf;margin-bottom:6px">실제 (현재환율 @'+real+')</div>'
        +   '<div class="ca-cost-line"><span class="nm">매출(₩)</span><span class="amt">'+Math.round(realSell).toLocaleString()+'</span></div>'
        +   '<div class="ca-cost-line"><span class="nm">매입(₩)</span><span class="amt">'+Math.round(realBuy).toLocaleString()+'</span></div>'
        +   '<div class="ca-cost-line total"><span class="nm">마진</span><span class="amt" style="color:'+col(realMK)+'">'+Math.round(realMK).toLocaleString()+' ('+realMP.toFixed(1)+'%)</span></div>'
        + '</div>'
        + '</div>'
        + '<div class="ca-sum-cards" style="margin-bottom:0">'
        +   caCard('순 환차손익','₩'+Math.round(netFx).toLocaleString(), (netFx>=0?'환율 상승 이득':'환율로 손해'), netFx>=0?'good':'bad')
        +   caCard('└ 매출 환차익','₩'+Math.round(sellFx).toLocaleString(),'Target×('+real+'−'+cfg.sellRate+')','')
        +   caCard('└ 수입매입 환차','₩'+Math.round(-buyFx).toLocaleString(), buyFx>0?'매입비 증가':'매입비 감소','')
        +   caCard('네고 여력','$'+(negoRoomUsd>0?negoRoomUsd.toLocaleString(undefined,{maximumFractionDigits:0}):'0'),
              (negoRoomKrw>0?('₩'+Math.round(negoRoomKrw).toLocaleString()+' · '+negoPct.toFixed(1)+'%까지'):'여력 없음'),
              negoRoomKrw>0?'good':'warn')
        + '</div>'
        + '<div style="font-size:11.5px;color:var(--text2);margin-top:10px;line-height:1.6">'
        +   '💡 현재 실제환율 기준 마진이 <b style="color:'+col(realMK)+'">'+realMP.toFixed(1)+'%</b>입니다. '
        +   (negoRoomKrw>0
              ? '고객 네고를 <b style="color:#2dd4bf">최대 $'+negoRoomUsd.toLocaleString(undefined,{maximumFractionDigits:0})+' (₩'+Math.round(negoRoomKrw).toLocaleString()+')</b>까지 받아줘도 기준 견적 마진('+baseMP.toFixed(1)+'%)은 유지됩니다.'
              : '실제환율 마진이 기준 마진보다 낮아 네고 여력이 없습니다.')
        + '</div>';
    }
  }

  // 품목 상세 테이블 (레벨 들여쓰기 · 제외 토글 · 품목별 마진)
  var th='<tr><th>제외</th><th>LV</th><th>품번</th><th>품명</th><th>제조사</th><th>제조사품번</th><th class="num">수량</th><th>구매처</th><th>구분</th><th class="num">매입가(₩)</th><th class="num">합계(₩)</th><th class="num">마진%</th>'+(CA.mode==='target'?'<th class="num">Target($)</th>':'')+'</tr>';
  document.getElementById('ca-detail-table').querySelector('thead').innerHTML=th;
  var tb='';
  R.items.forEach(function(it){
    var autoM = it.buyKrw!=null?caMarg(it.buyKrw,cfg):null;
    var effM = it.marginOverride!=null?it.marginOverride:(autoM!=null?Math.round(autoM*100):null);
    var buyStr = it.buyKrw!=null?it.buyKrw.toLocaleString():(it.status==='unreg'?'<span style="color:var(--amb)">미등록</span>':'<span style="color:var(--amb)">단가없음</span>');
    var origLbl = it.origin==='imp'?'수입':'국내';
    var lvPad = (it.lv||0)*16;
    var rowStyle = it.excluded?'opacity:.4':'';
    var lvBadge = it.lv===0?'<span style="color:#f59e0b;font-weight:700">L0</span>':(it.lv===1?'<span style="color:#60a5fa">L1</span>':'<span style="color:var(--text3)">L'+it.lv+'</span>');
    tb+='<tr style="'+rowStyle+'">'
      +'<td style="text-align:center"><input type="checkbox" '+(it.excluded?'checked':'')+' onchange="caToggleExclude('+it.idx+')" title="체크 시 원가합계에서 제외" style="accent-color:var(--red);width:14px;height:14px;cursor:pointer"></td>'
      +'<td>'+lvBadge+'</td>'
      +'<td style="font-family:var(--mono);color:var(--accent);padding-left:'+(9+lvPad)+'px">'+it.pn+'</td>'
      +'<td>'+(it.desc||'')+'</td>'
      +'<td style="font-size:11px;color:var(--text3)">'+(it.mfg||'—')+'</td>'
      +'<td style="font-size:11px;color:var(--text3);font-family:var(--mono)">'+(it.mfgpn||'—')+'</td>'
      +'<td class="num">'+(it.qty%1===0?it.qty:it.qty.toFixed(2))+(it.unit&&it.unit!=='Each'?' '+it.unit:'')+'</td>'
      +'<td style="color:var(--text2)">'+(it.vendor||'—')+'</td>'
      +'<td><span class="ca-toggle-imp '+(it.origin==='imp'?'imp':'dom')+'" onclick="caToggleItemOrigin('+it.idx+')" title="클릭하여 수입/국내 전환">'+origLbl+'</span></td>'
      +'<td class="num">'+buyStr+'</td>'
      +'<td class="num">'+(it.excluded?'<span style="color:var(--text3)">제외</span>':(it.buyKrwTotal!=null?Math.round(it.buyKrwTotal).toLocaleString():'—'))+'</td>'
      +'<td class="num"><input type="number" value="'+(effM!=null?effM:'')+'" placeholder="auto" oninput="caSetItemMargin('+it.idx+',this.value)" title="비우면 자동 마진율" style="width:56px;background:var(--bg3);border:1px solid '+(it.marginOverride!=null?'var(--accent)':'var(--border2)')+';border-radius:5px;color:var(--text);padding:4px 5px;font-size:12px;text-align:right"></td>'
      +(CA.mode==='target'?'<td class="num"><input type="number" value="'+(it.targetUsd!=null?it.targetUsd:'')+'" placeholder="-" oninput="caSetItemTarget('+it.idx+',this.value)" style="width:72px;background:var(--bg3);border:1px solid var(--border2);border-radius:5px;color:var(--text);padding:4px 6px;font-size:12px;text-align:right"></td>':'')
      +'</tr>';
  });
  document.getElementById('ca-detail-table').querySelector('tbody').innerHTML=tb;
}
function caCard(lbl,val,sub,cls){ return '<div class="ca-sum-card '+(cls||'')+'"><div class="lbl">'+lbl+'</div><div class="val">'+val+'</div><div class="sub">'+(sub||'')+'</div></div>'; }
function caCostLine(nm,amt){ return '<div class="ca-cost-line"><span class="nm">'+nm+'</span><span class="amt">'+amt+'</span></div>'; }

/* 품목별 수입/국내 토글 (구매처 단위로 override 저장) */
function caToggleItemOrigin(idx){
  var it=CA._items[idx]; if(!it) return;
  var newOrigin = it.origin==='imp'?'dom':'imp';
  var key=caNormVendor(it.vendor);
  if(key){ CA.vendorMap[key]=newOrigin; caSaveVendorMap(); }
  caRun();
}
function caSetItemTarget(idx,val){
  if(!CA.rows[idx]) return;
  CA.rows[idx].targetUsd = caToN(val);
  // 디바운스 없이 즉시 재계산은 무거우니 가벼운 갱신
  clearTimeout(CA._tt); CA._tt=setTimeout(caRun,400);
}
function caToggleExclude(idx){
  if(!CA.rows[idx]) return;
  CA.rows[idx].excluded = !CA.rows[idx].excluded;
  caRun();
}
function caSetItemMargin(idx,val){
  if(!CA.rows[idx]) return;
  var n=caToN(val);
  CA.rows[idx].marginOverride = (n==null||val==='')?null:n;
  clearTimeout(CA._tm); CA._tm=setTimeout(caRun,400);
}
// 레벨 일괄 제외/포함 (상위 또는 하위 한쪽만 남기기)
function caExcludeLevel(lv, exclude){
  CA.rows.forEach(function(r){ if((r.lv||0)===lv) r.excluded=exclude; });
  caRun();
}
// 중복 방지 프리셋
function caKeepLevel(mode){
  if(!CA.rows||!CA.rows.length) return;
  var maxLv=Math.max.apply(null, CA.rows.map(function(r){return r.lv||0;}));
  CA.rows.forEach(function(r){
    var lv=r.lv||0;
    if(mode==='low'){
      // 최하위(자식 없는) 품목만 포함 — 부모인 품목은 제외
      r.excluded = caHasChild(r);
    } else if(mode==='mid'){
      // L1만 포함, 나머지(L0·L2+) 제외
      r.excluded = (lv!==1);
    } else { // all
      r.excluded = (lv===0);
    }
  });
  caRun();
}
// 다음 행이 더 깊은 레벨이면 = 자식 있음(=어셈)
function caHasChild(row){
  var i=CA.rows.indexOf(row);
  if(i<0||i+1>=CA.rows.length) return false;
  return (CA.rows[i+1].lv||0) > (row.lv||0);
}

/* ── 구매처 분류 화면 ── */
function caRenderVendors(){
  caLoadVendorMap();
  var q=((document.getElementById('ca-vendor-q')||{}).value||'').toLowerCase();
  // DB의 모든 구매처 수집
  var vendors={};
  (typeof DB!=='undefined'&&DB?DB:[]).forEach(function(d){ var by=(d.by||'').trim(); if(by) vendors[by]=(vendors[by]||0)+1; });
  var list=Object.keys(vendors).sort(function(a,b){return a.localeCompare(b);});
  if(q) list=list.filter(function(v){return v.toLowerCase().includes(q);});
  var imp=0,dom=0;
  var tb='';
  list.forEach(function(v){
    var o=caVendorOrigin(v); if(o==='imp')imp++;else dom++;
    var overridden = CA.vendorMap && CA.vendorMap[caNormVendor(v)];
    tb+='<tr>'
      +'<td style="color:var(--text)">'+v+'</td>'
      +'<td class="num" style="color:var(--text3)">'+vendors[v]+'개 품목</td>'
      +'<td><span class="ca-toggle-imp '+(o==='imp'?'imp':'dom')+'" onclick="caSetVendor(\''+v.replace(/'/g,"\\'")+'\',\''+(o==='imp'?'dom':'imp')+'\')">'+(o==='imp'?'수입':'국내')+'</span>'
      +(overridden?' <span style="font-size:10px;color:var(--amb)">(수정됨)</span>':'')+'</td>'
      +'</tr>';
  });
  var hd='<tr><th>구매처</th><th class="num">품목수</th><th>구분 (클릭 전환)</th></tr>';
  var t=document.getElementById('ca-vendor-table');
  t.querySelector('thead').innerHTML=hd;
  t.querySelector('tbody').innerHTML=tb||'<tr><td style="padding:16px;color:var(--text3)">DB에 구매처 정보가 없습니다</td></tr>';
  document.getElementById('ca-vendor-stats').innerHTML='총 '+list.length+'개 구매처 · 수입 <b style="color:#60a5fa">'+imp+'</b> · 국내 <b style="color:#a78bfa">'+dom+'</b>';
}
function caSetVendor(vendor,origin){
  CA.vendorMap[caNormVendor(vendor)]=origin;
  caSaveVendorMap();
  caRenderVendors();
}
function caResetVendors(){
  if(!confirm('수동 수정한 구매처 분류를 모두 초기화하고 자동판정으로 되돌릴까요?')) return;
  CA.vendorMap={}; caSaveVendorMap(); caRenderVendors();
}

/* ── 보고용 한 장 출력 ── */
function caPrintReport(){
  var cards=document.getElementById('ca-sum-cards').innerHTML;
  var fx=document.getElementById('ca-fx-body').innerHTML;
  var cost=document.getElementById('ca-cost-breakdown').innerHTML;
  var scn=document.getElementById('ca-scenario').innerHTML;
  var modeLbl = CA.mode==='target'?'Target가 분석':(CA.mode==='rean'?'기존 BOM 재분석':'분석');
  var items=(CA._items||[]);
  var nItems = items.filter(function(x){return !x.excluded;}).length;
  // 분석 대상 품번: 재분석은 입력 ASSY, 그 외엔 L0 품번(없으면 첫 품번)
  var reanPn=(document.getElementById('ca-rean-pn')||{}).value;
  var l0=(CA.rows||[]).find(function(r){return (r.lv||0)===0;});
  var subjPn = (reanPn&&reanPn.trim()) || (l0&&l0.pn) || (CA.rows&&CA.rows[0]&&CA.rows[0].pn) || '';
  var subjDesc = (l0&&l0.desc) || '';
  // 결론 산출 (요약 카드의 마진 재계산 대신 R 없으므로 텍스트로 안내)
  var d=new Date();
  var ymd=d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);
  var fname='원가분석보고서_'+(subjPn||'분석')+'_'+ymd;

  var w=window.open('','_ca_report','width=900,height=1100');
  if(!w){ alert('팝업이 차단되었습니다. 팝업 허용 후 다시 시도하세요.'); return; }
  var css='body{font-family:-apple-system,"Malgun Gothic","맑은 고딕",sans-serif;color:#1a1a1a;margin:0;padding:30px 34px;background:#fff}'
    +'.rpt-head{border-bottom:2px solid #1a1a1a;padding-bottom:12px;margin-bottom:18px}'
    +'h1{font-size:20px;margin:0 0 4px;letter-spacing:-.3px}'
    +'.subj{font-size:13px;color:#333;font-weight:600}'
    +'.sub{font-size:11.5px;color:#888;margin-top:4px}'
    +'.sec{margin-bottom:18px}.sec-t{font-size:13.5px;font-weight:700;border-left:4px solid #4f7cff;padding-left:8px;margin-bottom:10px}'
    +'#rpt-sum{display:grid;grid-template-columns:1fr 2.6fr;gap:10px;margin-bottom:6px}'
    +'.ca-cost-big{border:1px solid #ddd;border-left:3px solid #4f7cff;border-radius:8px;padding:12px 14px;display:flex;flex-direction:column;justify-content:center}'
    +'.ca-cost-big .cb-l{font-size:10px;color:#888}.ca-cost-big .cb-v{font-size:21px;font-weight:800;margin:5px 0 3px}.ca-cost-big .cb-s{font-size:9px;color:#999}.ca-cost-big .cb-x{font-size:9.5px;color:#666;margin-top:7px;padding-top:5px;border-top:1px solid #eee}'
    +'.ca-right-rows{display:flex;flex-direction:column;gap:8px}'
    +'.ca-rate-row{display:grid;grid-template-columns:100px 1fr 1fr;gap:8px}'
    +'.ca-rate-tag{display:flex;align-items:center;justify-content:center;border-radius:7px;font-size:11px;font-weight:700;padding:0 8px}'
    +'.ca-rate-tag.base{background:#eef3ff;color:#4f7cff;border:1px solid #cdddff}'
    +'.ca-rate-tag.real{background:#e7faf6;color:#12b886;border:1px solid #b6ece1}'
    +'.ca-mini{border:1px solid #e2e2e2;border-radius:7px;padding:8px 11px}.ca-mini .cm-l{font-size:9.5px;color:#888}.ca-mini .cm-v{font-size:16px;font-weight:700;margin-top:2px}.ca-mini .cm-s{font-size:9px;color:#999;margin-top:1px}'
    +'.ca-mini.good .cm-v{color:#12b886}.ca-mini.warn .cm-v{color:#f59f00}.ca-mini.bad .cm-v{color:#e03131}'
    +'.ca-cost-line{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee;font-size:12px}'
    +'.ca-cost-line.total{border-top:2px solid #999;border-bottom:none;font-weight:700;padding-top:8px}'
    +'table{width:100%;border-collapse:collapse;font-size:11.5px}th,td{border:1px solid #e2e2e2;padding:5px 8px;text-align:left}th{background:#f4f5f7;font-weight:600}.num{text-align:right;font-variant-numeric:tabular-nums}'
    +'.foot{margin-top:26px;border-top:1px solid #ddd;padding-top:8px;font-size:10px;color:#aaa;text-align:center}'
    +'@media print{button{display:none}body{padding:14px}.sec{page-break-inside:avoid}}';
  w.document.write('<html><head><meta charset="utf-8"><title>'+fname+'</title><style>'+css+'</style></head><body>'
    +'<div class="rpt-head">'
    +'<h1>원가분석 보고서</h1>'
    +'<div class="subj">'+(subjPn?('대상 품번: '+subjPn+(subjDesc?'  ('+subjDesc+')':'')):modeLbl)+'</div>'
    +'<div class="sub">'+modeLbl+' · 진선테크 구매자재 · 작성일 '+ymd+' · 분석품목 '+nItems+'건</div>'
    +'</div>'
    +'<div class="sec"><div class="sec-t">요약</div><div id="rpt-sum">'+cards+'</div></div>'
    +'<div class="sec"><div class="sec-t">환율 영향 — 환차손익 · 네고 여력</div>'+fx+'</div>'
    +'<div class="sec"><div class="sec-t">원가 구성</div>'+cost+'</div>'
    +'<div class="sec"><div class="sec-t">환율 시나리오 분석</div>'+scn+'</div>'
    +'<div class="foot">본 보고서는 사내 검토용입니다 · 매입가는 품목 DB 기준이며 실제 견적 시 변동될 수 있습니다</div>'
    +'<button onclick="window.print()" style="margin-top:14px;padding:9px 20px;background:#4f7cff;color:#fff;border:none;border-radius:7px;font-size:13px;cursor:pointer">🖨 인쇄 / PDF 저장</button>'
    +'</body></html>');
  w.document.close();
  w.document.title=fname;
}
