/* ══════════════════ 원가분석 (Cost Analysis) ══════════════════ */
var CA = { mode:'target', rows:[], vendorMap:null };
var CA_VENDOR_KEY = 'ax_vendor_origin';   // {벤더명: 'imp'|'dom'} 사용자 override

/* RFQ 거래처 시트 기반 시드 (알려진 분류) */
var CA_SEED_IMP = ['AFC','ARROW','AXCELIS','CDM','ELECTRICAUTOMATION','FLYKEY','H AND J','HAIHONG','HYDRADYNE','INFINITEELECTRONICS','INSTRUTECHINC','INTERPOWER','MCMASTERCARR','MC-MC','MCS','MDC PRECISION','MOTIONELEC','MPF PRODUCTS INC','NASSAU','ONLINECOMPONENET','ONLINECOMPONENT','OXIDATIONTECH','RAPTOR','TME','해외구매','미국RS','사급','유로박스'];
var CA_SEED_DOM = ['KCD','L-COM','MALIN CO.','OMEGA','TURCK','가견적','가나에프에이','거전산업','국제산업기계','그로스','네이버','뉴엔','다일아이비씨','대동볼트','대현상공','동신','디지키','레오콤','마우저','메르센코리아','미즈미','바오산전','삼기','삼진ENG','상도전자','상명시스텍','상암교역','서울아크릴','선비기술','세방코포레이션','세봉','수주테크','쉬맥스','스마텍','스웨즈락','신원머티리얼즈','아마존','아이녹스','아이엠피티','알엔','에스엠이서브텍','에이치티씨','에이티에스솔루션','엘레파츠','엘리먼트','엘앤피코리아','엘엔피코리아','엠엠피','엠포시스템','위너스오토메이션','위트솔루션즈','이디에스','이레전선','이로피','이삭이앤아이','인터넷구매','인터캡','정금','지원테크','진풍','카본플러스','키엔스코리아','파워일렉','하네스','하네스팀','하네스팀관리','화인','진선테크'];

function caInit(){
  caLoadVendorMap();
  caLoadCfg();
  caRenderConfigDefaults();
  caRenderSheetList();
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
    rebate:g('ca-rebate',0)/100,
    tiers:[{min:1000000,m:g('ca-m1',20)/100},{min:100000,m:g('ca-m2',25)/100},{min:10000,m:g('ca-m3',35)/100},{min:0,m:g('ca-m4',45)/100}]
  };
}
// 설정값 저장/복원 (마지막 입력값 유지)
var CA_CFG_KEYS=['ca-buy-rate','ca-sell-rate','ca-real-rate','ca-labor-marg','ca-rebate','ca-m1','ca-m2','ca-m3','ca-m4'];
function caSaveCfg(){
  try{
    var o={}; CA_CFG_KEYS.forEach(function(id){ var e=document.getElementById(id); if(e) o[id]=e.value; });
    localStorage.setItem('ax_ca_cfg', JSON.stringify(o));
  }catch(e){}
}
function caLoadCfg(){
  try{
    var o=JSON.parse(localStorage.getItem('ax_ca_cfg')||'{}');
    CA_CFG_KEYS.forEach(function(id){ var e=document.getElementById(id); if(e && o[id]!=null && o[id]!=='') e.value=o[id]; });
  }catch(e){}
}
function caMarg(buyKrw,cfg){
  if(!buyKrw||buyKrw<=0) return cfg.tiers[cfg.tiers.length-1].m;
  for(var i=0;i<cfg.tiers.length;i++){ if(buyKrw>=cfg.tiers[i].min) return cfg.tiers[i].m; }
  return cfg.tiers[cfg.tiers.length-1].m;
}
function caToN(v){ if(v==null||v==='') return null; var n=parseFloat(String(v).replace(/,/g,'')); return isNaN(n)?null:n; }
var _caRunTimer=null;
function caRunDebounced(){ clearTimeout(_caRunTimer); _caRunTimer=setTimeout(function(){ caRun(); }, 400); }
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
  var children = (BOM && typeof BOM==='object' && !Array.isArray(BOM)) ? (BOM[pn]||[]) : [];
  if(!children.length){
    // 배열형 BOM 폴백
    if(Array.isArray(BOM)){
      BOM.forEach(function(b){
        if(String(b.assy||b.parent||b.assyPn||b.pn||'').trim()===pn && b.parts) children=b.parts;
      });
    }
  }
  if(!children.length){ qToast('해당 ASSY의 BOM을 찾을 수 없습니다: '+pn,'err',4000); return; }

  // caParseBOMRows 와 동일한 구조로 변환 (레벨 트리 + 전개수량)
  var qtyByLevel={}, uid=0, out=[];
  children.forEach(function(c){
    var lv = c.lv!=null?parseInt(c.lv):1; if(isNaN(lv)) lv=1;
    var rawQty = caToN(c.qty)!=null?caToN(c.qty):1;
    var parentMul = lv>0 ? (qtyByLevel[lv-1]||1) : 1;
    var expQty = (lv===0)?rawQty:parentMul*rawQty;
    qtyByLevel[lv]=expQty;
    Object.keys(qtyByLevel).forEach(function(k){ if(+k>lv) delete qtyByLevel[k]; });
    out.push({
      uid:'r'+(uid++), pn:String(c.pn||c.child_pn||'').trim(), lv:lv,
      desc:c.desc||'', qty:rawQty, expQty:expQty,
      unit:c.unit||'', rev:c.rev||'',
      cat:c.cat||'', mfg:c.mfg||'', mfgPn:c.mfgPn||c.mfgpn||'', loc:c.loc||'',
      excluded:(lv===0), marginOverride:null
    });
  });
  CA.rows=out;
  document.getElementById('ca-bom-count').textContent='✓ '+pn+' BOM '+out.length+'개 품목 (L0:'+out.filter(function(x){return x.lv===0;}).length+' L1:'+out.filter(function(x){return x.lv===1;}).length+' L2+:'+out.filter(function(x){return x.lv>=2;}).length+')';
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

  // 현재 판매금액($) — 네고 전 기준
  var currentUsd = caToN((document.getElementById('ca-current-usd')||{}).value)||0;

  // 권장단가: 현재가·Target 둘 다 미입력 시, 매입가 구간별 자동마진으로 역산 (리베이트 미반영)
  // 권장단가($) = Σ [ 품목매입가 / (1-마진율) ] / 기준환율  + 작업비/(1-작업마진)/환율
  var suggestUsd=0;
  var noPriceInput = (currentUsd<=0) && (targetUsd<=0);
  if(noPriceInput){
    items.forEach(function(it){
      if(it.excluded || it.buyKrw==null) return;
      var m=(it.marginOverride!=null)?(it.marginOverride/100):caMarg(it.buyKrw,cfg);
      if(m>=1) m=0.99;
      suggestUsd += (it.buyKrw/(1-m)/cfg.sellRate)*it.qty;
    });
    if(laborKrw>0){ var lm=cfg.laborMarg>=1?0.99:cfg.laborMarg; suggestUsd += laborKrw/(1-lm)/cfg.sellRate; }
  }

  caRenderResults({cfg:cfg,items:items,impKrw:impKrw,domKrw:domKrw,impUsd:impUsd,laborKrw:laborKrw,totalBuyKrw:totalBuyKrw,
    targetUsd:targetUsd,targetKrw:targetKrw,currentUsd:currentUsd,suggestUsd:suggestUsd,noPriceInput:noPriceInput,noPrice:noPrice,targetInput:(perItemTarget>0||totalTargetInput>0)});
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
  var clsTxt=clsOf;
  function miniCard(lbl,val,sub,cls){
    return '<div class="ca-mini'+(cls?' '+cls:'')+'"><div class="cm-l">'+lbl+'</div><div class="cm-v">'+val+'</div><div class="cm-s">'+(sub||'')+'</div></div>';
  }
  // 현재가/타겟가 마진 (견적 기준환율로 환산)
  var sr=cfg.sellRate;
  var curUsd=R.currentUsd||0;
  var curSell=curUsd*sr, curMK=curSell-R.totalBuyKrw, curMP=curSell>0?curMK/curSell*100:0;
  var tgtSell=R.targetUsd*sr, tgtMK=tgtSell-R.totalBuyKrw, tgtMP=tgtSell>0?tgtMK/tgtSell*100:0;
  var diffUsd=curUsd>0?(R.targetUsd-curUsd):0;       // 타겟−현재 (음수=네고로 하락)
  var diffMK=curUsd>0?(tgtMK-curMK):0;
  // 권장단가 (현재가·Target 둘 다 미입력 시) — 매입가 구간마진 역산
  var sugUsd=R.suggestUsd||0;
  var sugSell=sugUsd*sr, sugMK=sugSell-R.totalBuyKrw, sugMP=sugSell>0?sugMK/sugSell*100:0;
  var useSuggest = !!R.noPriceInput && sugUsd>0;

  // 갑지용 마지막 분석결과 캡처
  (function(){
    var reanPn=(document.getElementById('ca-rean-pn')||{}).value;
    var l0=(CA.rows||[]).find(function(r){return (r.lv||0)===0;});
    var pn=(reanPn&&reanPn.trim())||(l0&&l0.pn)||(CA.rows&&CA.rows[0]&&CA.rows[0].pn)||'';
    var dsc=(l0&&l0.desc)||'';
    if(!dsc&&pn&&typeof qFindItem==='function'){ var di=qFindItem(pn); if(di&&di.d) dsc=di.d; }
    var reb=cfg.rebate||0;
    var hasTgt=R.targetInput;
    var tgtMKr=hasTgt?(tgtMK-tgtSell*reb):null;        // 리베이트 반영 타겟 마진
    var tgtMPr=(hasTgt&&tgtSell>0)?tgtMKr/tgtSell*100:null;
    // 환율 시나리오 마진(네고가 우선, 없으면 현재가) — 현재실제/-100/-200
    var baseR=(cfg.realRate>0?cfg.realRate:cfg.sellRate);
    var priceUsd = hasTgt?R.targetUsd:(curUsd>0?curUsd:(useSuggest?sugUsd:R.targetUsd));
    var fxMargin=function(rate){
      var buy=R.impUsd*rate + R.domKrw + R.laborKrw;
      var sell=priceUsd*rate;
      return { mK:sell-buy, mP:sell>0?(sell-buy)/sell*100:0, sell:sell };
    };
    CA._last={
      pn:pn, desc:dsc, buyKrw:R.totalBuyKrw,
      curUsd:curUsd, curMP:curUsd>0?curMP:null,
      tgtUsd:hasTgt?R.targetUsd:null, tgtMP:hasTgt?tgtMP:null,
      tgtMPr:tgtMPr, rebate:reb, noPrice:R.noPrice||0, nItems:(R.items||[]).filter(function(x){return !x.excluded;}).length,
      priceUsd:priceUsd, baseRate:baseR,
      fxNow:fxMargin(baseR), fxM100:fxMargin(baseR-100), fxM200:fxMargin(baseR-200),
      impUsd:R.impUsd, domKrw:R.domKrw, laborKrw:R.laborKrw, sellRate:cfg.sellRate
    };
  })();

  var rightRows='';
  // 현재 판매단가 행 (입력 시에만)
  if(curUsd>0){
    rightRows+='<div class="ca-rate-row"><div class="ca-rate-tag base">현재 판매가</div>'
      +miniCard('매출단가','$'+curUsd.toLocaleString(undefined,{maximumFractionDigits:0}),'₩'+Math.round(curSell).toLocaleString()+' @'+sr,'')
      +miniCard('마진액','₩'+Math.round(curMK).toLocaleString(),'마진율 '+curMP.toFixed(1)+'% · 기준환율',clsTxt(curMP))
      +'</div>';
  }
  // 권장단가 행 (현재가·Target 둘 다 미입력 시) — 견적용
  if(useSuggest){
    rightRows+='<div class="ca-rate-row" style="background:#eef9f4;border:1px solid #a8e0cc;border-radius:8px">'
      +'<div class="ca-rate-tag" style="background:#12b886;color:#fff">💡 권장단가</div>'
      +miniCard('견적 제시단가','$'+sugUsd.toLocaleString(undefined,{maximumFractionDigits:2}),'₩'+Math.round(sugSell).toLocaleString()+' @'+sr,'')
      +miniCard('마진액','₩'+Math.round(sugMK).toLocaleString(),'마진율 '+sugMP.toFixed(1)+'% · 구간마진 적용',clsTxt(sugMP))
      +'</div>'
      +'<div class="ca-diff-row" style="border-style:dashed;color:var(--text3)">'
      +'📋 매입원가에 구간별 마진(매입가대별 20~45%)을 적용한 <b>신규 견적 제시가</b>입니다 · 리베이트 미반영 · 현재가/Target을 입력하면 비교 분석으로 전환됩니다'
      +'</div>';
  }
  // 타겟 판매단가 행 (Target 입력 시에만 표시)
  if(R.targetInput && R.targetUsd>0){
    rightRows+='<div class="ca-rate-row"><div class="ca-rate-tag real">Target가</div>'
      +miniCard('매출단가','$'+R.targetUsd.toLocaleString(undefined,{maximumFractionDigits:0}),'₩'+Math.round(tgtSell).toLocaleString()+' @'+sr,'')
      +miniCard('마진액','₩'+Math.round(tgtMK).toLocaleString(),'마진율 '+tgtMP.toFixed(1)+'% · 기준환율',clsTxt(tgtMP))
      +'</div>';
  }
  // 현재→타겟 변화 요약 (둘 다 있을 때)
  if(curUsd>0 && R.targetInput && R.targetUsd>0){
    var dcls=diffMK>=0?'good':'bad';
    rightRows+='<div class="ca-diff-row '+dcls+'">'
      +'현재 → Target 변화: '
      +'<b>'+(diffUsd>=0?'+':'')+'$'+diffUsd.toLocaleString(undefined,{maximumFractionDigits:0})+'</b>'
      +' · 마진 <b>'+(diffMK>=0?'+':'')+'₩'+Math.round(diffMK).toLocaleString()+'</b>'
      +' ('+curMP.toFixed(1)+'% → '+tgtMP.toFixed(1)+'%)'
      +'</div>';
  }
  // 연말 리베이트 참고 표기 (마진 계산엔 미반영, 참고용)
  var reb=cfg.rebate||0;
  if(reb>0 && R.targetInput && R.targetUsd>0){
    var rebKrw=tgtSell*reb;                       // 리베이트 금액 = 타겟 매출 × %
    var tgtMKr=tgtMK-rebKrw;                       // 리베이트 반영 실질 마진액
    var tgtMPr=tgtSell>0?tgtMKr/tgtSell*100:0;
    var rcls=tgtMKr>=0?'good':'bad';
    rightRows+='<div class="ca-diff-row '+rcls+'" style="border-style:dashed">'
      +'📎 <b>연말 리베이트 '+(reb*100).toFixed(0)+'% 참고</b> — Target가 기준 리베이트 ₩'+Math.round(rebKrw).toLocaleString()+' 차감 시 '
      +'실질 마진 <b style="color:'+(tgtMKr>=0?'#2dd4bf':'#ff5a5a')+'">₩'+Math.round(tgtMKr).toLocaleString()+' ('+tgtMPr.toFixed(1)+'%)</b> '
      +'<span style="color:var(--text3)">· 위 마진율에는 미반영</span>'
      +'</div>';
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

  var marginKrw=tgtMK, marginPct=tgtMP, cls=clsTxt(tgtMP);

  // 원가 구성 — 카드 + 비율 막대
  var pct=function(v){ return R.totalBuyKrw>0?(v/R.totalBuyKrw*100):0; };
  function costCard(lbl,val,p,color){
    return '<div class="ca-cost-card">'
      +'<div class="cc-top"><span class="cc-l">'+lbl+'</span><span class="cc-p">'+p.toFixed(1)+'%</span></div>'
      +'<div class="cc-v">₩'+Math.round(val).toLocaleString()+'</div>'
      +'<div class="cc-bar"><span style="width:'+Math.min(p,100).toFixed(1)+'%;background:'+color+'"></span></div>'
      +'</div>';
  }
  var bd='<div class="ca-cost-cards">';
  bd+=costCard('수입 자재비',R.impKrw,pct(R.impKrw),'#60a5fa');
  bd+=costCard('국내 자재비',R.domKrw,pct(R.domKrw),'#a78bfa');
  if(R.laborKrw>0) bd+=costCard('작업비',R.laborKrw,pct(R.laborKrw),'#f59e0b');
  bd+='<div class="ca-cost-card total"><div class="cc-top"><span class="cc-l">매입원가 합계</span></div><div class="cc-v">₩'+Math.round(R.totalBuyKrw).toLocaleString()+'</div></div>';
  bd+='</div>';
  if(R.noPrice>0){
    var npComment=(document.getElementById('ca-noprice-comment')||{}).value||'';
    if(npComment.trim()){
      bd+='<div style="font-size:11.5px;color:var(--text2);margin-top:10px;padding:9px 12px;background:var(--bg3);border-radius:8px;border-left:3px solid #2dd4bf;line-height:1.55">'
         +'✔ <b>매입가 미연결 품목 '+R.noPrice+'건</b> — 담당자 확인: '+npComment.replace(/</g,'&lt;')
         +'</div>';
    } else {
      bd+='<div style="font-size:11.5px;color:var(--text2);margin-top:10px;padding:9px 12px;background:var(--bg3);border-radius:8px;line-height:1.55">'
         +'ℹ <b>매입가 미연결 품목 '+R.noPrice+'건</b> — 도면번호·작업사양 등 단가와 직접 연결되지 않은 품목일 수 있습니다. 아래 "확인 코멘트"에 적으면 보고서에 반영됩니다.'
         +'</div>';
    }
  }
  document.getElementById('ca-cost-breakdown').innerHTML=bd;

  // 환율 시나리오 — 현재 실제환율 기준 ±원. 현재가 입력 시 현재가 vs 네고가(Target) 비교
  var scn='';
  if(R.targetUsd>0){
    var baseRate = (cfg.realRate>0?cfg.realRate:cfg.sellRate);
    var deltas=[ {d:+100}, {d:+50}, {d:0}, {d:-50}, {d:-100}, {d:-150}, {d:-200} ];
    var curUsdS = R.currentUsd||0;
    var cmpMode = curUsdS>0 && curUsdS!==R.targetUsd;  // 비교 모드
    var mc=function(mK,mP){ return mK<0?'#ff5a5a':(mP>=15?'#2dd4bf':(mP>=8?'#f59e0b':'#ffa94d')); };
    var reb=cfg.rebate||0;
    if(cmpMode){
      var rebHdr = reb>0 ? '<th class="num" style="background:#fde8e8">네고+리베'+(reb*100).toFixed(0)+'%<br>마진율</th>' : '';
      scn+='<table class="ca-table" style="width:100%"><thead>'
         +'<tr><th rowspan="2" style="vertical-align:bottom">환율 변동</th><th rowspan="2" class="num" style="vertical-align:bottom">적용 환율</th>'
         +'<th colspan="2" style="text-align:center;border-bottom:2px solid #4f7cff;color:#4f7cff">현재가 $'+curUsdS.toLocaleString(undefined,{maximumFractionDigits:0})+'</th>'
         +'<th colspan="2" style="text-align:center;border-bottom:2px solid #f59e0b;color:#f59e0b;background:#fff6ec">네고가 $'+R.targetUsd.toLocaleString(undefined,{maximumFractionDigits:0})+'</th>'
         + (reb>0?'<th rowspan="2" class="num" style="vertical-align:bottom;background:#fde8e8;color:#d23030">네고+리베<br>'+(reb*100).toFixed(0)+'% 마진율</th>':'')
         +'</tr>'
         +'<tr><th class="num" style="color:#4f7cff">마진액</th><th class="num" style="color:#4f7cff">마진율</th>'
         +'<th class="num" style="background:#fff6ec;color:#f59e0b">마진액</th><th class="num" style="background:#fff6ec;color:#f59e0b">마진율</th></tr>'
         +'</thead><tbody>';
      deltas.forEach(function(s){
        var rate=baseRate+s.d;
        var buyAdj = R.impUsd*rate + R.domKrw + R.laborKrw;
        var curSell=curUsdS*rate, curMK=curSell-buyAdj, curMP=curSell>0?curMK/curSell*100:0;
        var tgtSell=R.targetUsd*rate, tgtMK=tgtSell-buyAdj, tgtMP=tgtSell>0?tgtMK/tgtSell*100:0;
        // 네고가 리베이트 반영: 매출에서 리베이트 차감
        var tgtMKr=tgtMK-(tgtSell*reb), tgtMPr=tgtSell>0?tgtMKr/tgtSell*100:0;
        var isNow = s.d===0;
        var rowBg = isNow?'background:#eaf7f4;':'';
        var lbl = isNow?'<b>현재 ('+Math.round(baseRate).toLocaleString()+')</b>':(s.d>0?'+'+s.d+'원':s.d+'원');
        // 색: 역마진=빨강굵게, 그 외 검정
        var fmt=function(mK,mP,showMK){
          var neg=mK<0;
          var style='color:'+(neg?'#d23030':'#222')+';'+(neg?'font-weight:700;':'');
          return showMK
            ? '<td class="num" style="'+style+'">'+Math.round(mK).toLocaleString()+'</td>'
            : '<td class="num" style="'+style+'font-weight:700">'+mP.toFixed(1)+'%'+(neg?' <span style="font-size:8px">역마진</span>':'')+'</td>';
        };
        scn+='<tr style="'+rowBg+'">'
           +'<td style="font-weight:600">'+lbl+'</td>'
           +'<td class="num" style="font-family:var(--mono)">'+Math.round(rate).toLocaleString()+'</td>'
           +fmt(curMK,curMP,true)+fmt(curMK,curMP,false)
           +'<td class="num" style="background:'+(isNow?'#e0f0eb':'#fff6ec')+';color:'+(tgtMK<0?'#d23030':'#222')+';'+(tgtMK<0?'font-weight:700':'')+'">'+Math.round(tgtMK).toLocaleString()+'</td>'
           +'<td class="num" style="background:'+(isNow?'#e0f0eb':'#fff6ec')+';color:'+(tgtMK<0?'#d23030':'#222')+';font-weight:700">'+tgtMP.toFixed(1)+'%'+(tgtMK<0?' <span style="font-size:8px">역마진</span>':'')+'</td>'
           + (reb>0?'<td class="num" style="background:#fde8e8;color:'+(tgtMKr<0?'#d23030':'#222')+';font-weight:700">'+tgtMPr.toFixed(1)+'%'+(tgtMKr<0?' <span style="font-size:8px">역마진</span>':'')+'</td>':'')
           +'</tr>';
      });
      scn+='</tbody></table>';
      scn+='<div style="font-size:11px;color:var(--text3);margin-top:6px;line-height:1.6">'
         +'· <b style="color:#4f7cff">파랑</b> = 현재가 · <b style="color:#f59e0b">주황</b> = 네고가(Target)'+(reb>0?' · <b style="color:#d23030">빨강 열</b> = 네고가에 리베이트 '+(reb*100).toFixed(0)+'% 반영':'')+'<br>'
         +'· 음영 행 = 현재 실제환율('+Math.round(baseRate).toLocaleString()+') · 역마진은 빨간 글자<br>'
         +'· 환율이 통째로 변동하는 가정(매출·수입매입 동시 적용)이라, 매입을 확정원가로 고정한 \'요약\' 마진과 값이 다를 수 있습니다.'
         +'</div>';
    } else {
      var rebS=cfg.rebate||0;
      scn+='<table class="ca-table" style="width:100%"><thead><tr>'
         +'<th>환율 변동</th><th class="num">적용 환율</th><th class="num">매출(₩)</th><th class="num">매입(₩)</th><th class="num">마진액(₩)</th><th class="num">마진율</th>'
         + (rebS>0?'<th class="num" style="background:#fde8e8;color:#d23030">리베'+(rebS*100).toFixed(0)+'%<br>마진율</th>':'')
         +'</tr></thead><tbody>';
      deltas.forEach(function(s){
        var rate=baseRate+s.d;
        var buyAdj = R.impUsd*rate + R.domKrw + R.laborKrw;
        var sellAdj = R.targetUsd*rate;
        var mK = sellAdj - buyAdj;
        var mP = sellAdj>0?(mK/sellAdj*100):0;
        var mKr=mK-(sellAdj*rebS), mPr=sellAdj>0?mKr/sellAdj*100:0;
        var isNow=s.d===0;
        var col=mK<0?'#d23030':'#222';
        var rowBg=isNow?'background:#eaf7f4;':'';
        var tag = mK<0?' <span style="font-size:8px">역마진</span>':'';
        var lbl = isNow?'<b>현재 ('+Math.round(baseRate).toLocaleString()+')</b>':(s.d>0?'+'+s.d+'원':s.d+'원');
        scn+='<tr style="'+rowBg+'">'
           +'<td style="font-weight:600">'+lbl+'</td>'
           +'<td class="num" style="font-family:var(--mono)">'+Math.round(rate).toLocaleString()+'</td>'
           +'<td class="num">'+Math.round(sellAdj).toLocaleString()+'</td>'
           +'<td class="num">'+Math.round(buyAdj).toLocaleString()+'</td>'
           +'<td class="num" style="color:'+col+';font-weight:700">'+Math.round(mK).toLocaleString()+'</td>'
           +'<td class="num" style="color:'+col+';font-weight:700">'+mP.toFixed(1)+'%'+tag+'</td>'
           + (rebS>0?'<td class="num" style="background:#fde8e8;color:'+(mKr<0?'#d23030':'#222')+';font-weight:700">'+mPr.toFixed(1)+'%'+(mKr<0?' <span style="font-size:8px">역마진</span>':'')+'</td>':'')
           +'</tr>';
      });
      scn+='</tbody></table>';
      scn+='<div style="font-size:11px;color:var(--text3);margin-top:6px;line-height:1.6">'
         +'· 음영 행 = 현재 실제환율('+Math.round(baseRate).toLocaleString()+') · 역마진은 빨간 글자'+(rebS>0?' · <b style="color:#d23030">빨강 열</b> = 리베이트 '+(rebS*100).toFixed(0)+'% 반영':'')+'<br>'
         +'· 환율이 통째로 변동하는 가정(매출·수입매입 동시 적용)이라, 매입을 확정원가로 고정한 \'요약\' 마진과 값이 다를 수 있습니다.'
         +'</div>';
    }
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
      var sellFx = realSell - baseSell;
      var buyFx  = (R.impUsd*real) - R.impKrw;
      var netFx  = realMK - baseMK;
      var negoRoomKrw = realMK - baseMK;
      var negoRoomUsd = negoRoomKrw/real;
      var negoPct = realSell>0?negoRoomKrw/realSell*100:0;
      var col=function(v){return v>=0?'#2dd4bf':'#ff5a5a';};

      // 실제 네고건: 현재가 → Target가 (현재가 입력 시)
      var curUsd2 = R.currentUsd||0;
      var hasNego = curUsd2>0 && R.targetUsd>0 && curUsd2!==R.targetUsd;
      var negoUsd = hasNego ? (R.targetUsd - curUsd2) : 0;        // 음수 = 인하
      // 기준환율 기준 현재가/타겟가 마진
      var curMKb = curUsd2*cfg.sellRate - R.totalBuyKrw;
      var curMPb = (curUsd2*cfg.sellRate)>0 ? curMKb/(curUsd2*cfg.sellRate)*100 : 0;
      var tgtMKb = baseMK, tgtMPb = baseMP;

      fxEl.innerHTML=
        '<div class="ca-fx-cards">'
        +  '<div class="ca-fx-card '+(netFx>=0?'good':'bad')+'">'
        +    '<div class="fx-l">순 환차손익</div>'
        +    '<div class="fx-v">₩'+Math.round(netFx).toLocaleString()+'</div>'
        +    '<div class="fx-s">'+(netFx>=0?'환율 상승 이득':'환율로 손해')+' · 기준환율 @'+cfg.sellRate+' → 실제 @'+real+'</div>'
        +  '</div>'
        + (hasNego
            ? '<div class="ca-fx-card '+(tgtMKb>=0?'good':'bad')+'">'
              +'<div class="fx-l">네고 결과 <span style="font-size:9px;color:var(--text3)">· $'+curUsd2.toLocaleString(undefined,{maximumFractionDigits:0})+' → $'+R.targetUsd.toLocaleString(undefined,{maximumFractionDigits:0})+' ('+(negoUsd>=0?'+':'')+'$'+negoUsd.toLocaleString(undefined,{maximumFractionDigits:0})+')</span></div>'
              +'<div class="fx-v">'+tgtMPb.toFixed(1)+'%</div>'
              +'<div class="fx-s">기준환율 마진 ₩'+Math.round(tgtMKb).toLocaleString()+' (네고 전 '+curMPb.toFixed(1)+'%)</div>'
              +'</div>'
            : '<div class="ca-fx-card '+(negoRoomKrw>0?'good':'warn')+'">'
              +'<div class="fx-l">네고 여력 <span style="font-size:9px;color:var(--text3)">· 실제환율 @'+real+' 유지 시</span></div>'
              +'<div class="fx-v">'+(negoRoomKrw>0?('$'+negoRoomUsd.toLocaleString(undefined,{maximumFractionDigits:0})):'없음')+'</div>'
              +'<div class="fx-s">'+(negoRoomKrw>0?('₩'+Math.round(negoRoomKrw).toLocaleString()+' · 매출의 '+negoPct.toFixed(1)+'%까지'):'실제환율 마진이 기준보다 낮음')+'</div>'
              +'</div>')
        +'</div>'
        +'<div class="ca-fx-note">'
        + (hasNego
            ? '💡 현재 <b>$'+curUsd2.toLocaleString(undefined,{maximumFractionDigits:0})+'</b>에서 <b>$'+R.targetUsd.toLocaleString(undefined,{maximumFractionDigits:0})+'</b>로 네고('+(negoUsd>=0?'+':'')+'$'+negoUsd.toLocaleString(undefined,{maximumFractionDigits:0})+', 매출 ₩'+Math.round((R.targetUsd-curUsd2)*cfg.sellRate).toLocaleString()+') 시 — '
              +'<b>기준환율 @'+cfg.sellRate+'</b> 마진은 <b style="color:'+col(curMKb)+'">'+curMPb.toFixed(1)+'%</b> → <b style="color:'+col(tgtMKb)+'">'+tgtMPb.toFixed(1)+'%</b>로 바뀝니다. '
              + (tgtMKb>=0
                  ? '<b>현재 실제환율 @'+real+'</b>가 유지되면 같은 네고가에서도 <b style="color:'+col(realMK)+'">'+realMP.toFixed(1)+'%</b>로 여유가 있습니다. <span style="color:var(--text3)">단, 정산 환율이 기준('+cfg.sellRate+')으로 내려가면 '+tgtMPb.toFixed(1)+'%가 실제 마진입니다.</span>'
                  : '<b style="color:#ff5a5a">기준환율에서는 역마진</b>이라, 이 네고는 현재 실제환율('+real+', 마진 '+realMP.toFixed(1)+'%)이 유지될 때만 수익이 납니다. 환율이 빠지면 손실이므로 신중해야 합니다.')
            : '💡 마진은 환율 기준에 따라 둘로 봐야 합니다 — '
              +'<b>견적 기준환율 @'+cfg.sellRate+'</b>에서는 <b style="color:'+col(baseMK)+'">'+baseMP.toFixed(1)+'%</b>, '
              +'<b>현재 실제환율 @'+real+'</b>가 유지되면 <b style="color:'+col(realMK)+'">'+realMP.toFixed(1)+'%</b>입니다.'
              + (negoRoomKrw>0
                  ? ' 환율 강세가 유지된다는 전제에서 고객 네고를 <b style="color:#2dd4bf">최대 $'+negoRoomUsd.toLocaleString(undefined,{maximumFractionDigits:0})+'</b>까지 받아줘도 기준 견적 마진('+baseMP.toFixed(1)+'%)은 지켜집니다. <span style="color:var(--text3)">단, 정산 시 환율이 기준환율('+cfg.sellRate+')로 내려가면 이 여력은 사라집니다.</span>'
                  : ' 실제환율 마진이 기준 마진보다 낮아 네고 여력이 없습니다.'))
        +'</div>';
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
  if(!subjDesc && subjPn){ var _di=(typeof qFindItem==='function')?qFindItem(subjPn):null; if(_di&&_di.d) subjDesc=_di.d; }
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
    +'.subj2{font-size:12px;color:#555;margin-top:2px}'
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
    +'.ca-diff-row{background:#f7f8fa;border:1px solid #e2e2e2;border-radius:8px;padding:8px 12px;font-size:11.5px;color:#444;margin-top:8px}'
    +'.ca-fx-cards{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px}'
    +'.ca-fx-card{border:1px solid #ddd;border-radius:9px;padding:11px 13px}.ca-fx-card .fx-l{font-size:11px;color:#888}.ca-fx-card .fx-v{font-size:20px;font-weight:800;margin:4px 0}.ca-fx-card .fx-s{font-size:10px;color:#999}'
    +'.ca-fx-card.good{border-left:3px solid #12b886}.ca-fx-card.good .fx-v{color:#12b886}.ca-fx-card.bad{border-left:3px solid #e03131}.ca-fx-card.bad .fx-v{color:#e03131}.ca-fx-card.warn{border-left:3px solid #f59f00}.ca-fx-card.warn .fx-v{color:#f59f00}'
    +'.ca-fx-note{font-size:11px;color:#555;background:#f7f8fa;border-radius:7px;padding:9px 12px;line-height:1.5}'
    +'.ca-cost-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:9px}'
    +'.ca-cost-card{border:1px solid #ddd;border-radius:9px;padding:10px 12px}.ca-cost-card .cc-top{display:flex;justify-content:space-between}.ca-cost-card .cc-l{font-size:10px;color:#888}.ca-cost-card .cc-p{font-size:10px;font-weight:700;color:#666}.ca-cost-card .cc-v{font-size:15px;font-weight:700;margin:5px 0 7px}.ca-cost-card .cc-bar{height:5px;background:#eee;border-radius:3px;overflow:hidden}.ca-cost-card .cc-bar span{display:block;height:100%}'
    +'.ca-cost-card.total{background:#f4f5f7;border-left:3px solid #4f7cff}.ca-cost-card.total .cc-v{color:#4f7cff}'
    +'.ca-cost-line{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee;font-size:12px}'
    +'.ca-cost-line.total{border-top:2px solid #999;border-bottom:none;font-weight:700;padding-top:8px}'
    +'table{width:100%;border-collapse:collapse;font-size:11.5px}th,td{border:1px solid #e2e2e2;padding:5px 8px;text-align:left}th{background:#f4f5f7;font-weight:600}.num{text-align:right;font-variant-numeric:tabular-nums}'
    +'.foot{margin-top:26px;border-top:1px solid #ddd;padding-top:8px;font-size:10px;color:#aaa;text-align:center}'
    +'@page{size:A4 portrait;margin:8mm}'
    +'@media print{'
    +  'button{display:none}'
    +  'body{padding:0;font-size:10px;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    +  '.rpt-head{padding-bottom:7px;margin-bottom:9px}h1{font-size:15px}.subj{font-size:11px}.sub{font-size:9px}'
    +  '.sec{margin-bottom:8px;page-break-inside:avoid}.sec-t{font-size:11px;margin-bottom:5px}'
    +  '#rpt-sum{gap:5px;margin-bottom:3px}.ca-cost-big{padding:7px 9px}.ca-cost-big .cb-v{font-size:16px;margin:2px 0}'
    +  '.ca-right-rows{gap:4px}.ca-rate-row{gap:5px}.ca-mini{padding:5px 7px}.ca-mini .cm-v{font-size:13px}'
    +  '.ca-diff-row{padding:5px 8px;font-size:10px;margin-top:4px}'
    +  '.ca-fx-cards{gap:6px;margin-bottom:5px}.ca-fx-card{padding:7px 9px}.ca-fx-card .fx-v{font-size:15px;margin:2px 0}'
    +  '.ca-fx-note{padding:6px 9px;font-size:9.5px;line-height:1.4}'
    +  '.ca-cost-cards{gap:5px}.ca-cost-card{padding:6px 8px}.ca-cost-card .cc-v{font-size:12px;margin:3px 0 4px}'
    +  'table{font-size:9px}th,td{padding:3px 5px}'
    +  '.foot{margin-top:8px;padding-top:5px;font-size:8px}'
    +'}';
  w.document.write('<html><head><meta charset="utf-8"><title>'+fname+'</title><style>'+css+'</style></head><body>'
    +'<div class="rpt-head">'
    +'<h1>원가분석 보고서</h1>'
    +'<div class="subj">대상 품번: '+(subjPn||'-')+'</div>'
    +(subjDesc?'<div class="subj2">품명: '+subjDesc+'</div>':'')
    +'<div class="sub">'+modeLbl+' · 진선테크 구매자재 · 작성일 '+ymd+' · 분석품목 '+nItems+'건</div>'
    +'</div>'
    +'<div class="sec"><div class="sec-t">요약</div><div id="rpt-sum">'+cards+'</div></div>'
    +'<div class="sec"><div class="sec-t">환율 시나리오 분석</div>'+scn+'</div>'
    +'<div class="sec"><div class="sec-t">원가 구성</div>'+cost+'</div>'
    +'<div class="foot">본 보고서는 사내 검토용입니다 · 매입가는 품목 DB 기준이며 실제 견적 시 변동될 수 있습니다</div>'
    +'<button onclick="window.print()" style="margin-top:14px;padding:9px 20px;background:#4f7cff;color:#fff;border:none;border-radius:7px;font-size:13px;cursor:pointer">🖨 인쇄 / PDF 저장</button>'
    +'</body></html>');
  w.document.close();
  w.document.title=fname;
}

/* ── 갑지(다품목 표지) ── */
var CA_SHEET=[];  // 담긴 품목들
function caAddToSheet(){
  if(!CA._last || !CA._last.pn){ qToast('먼저 품목을 분석하세요','info'); return; }
  var i=CA_SHEET.findIndex(function(x){return x.pn===CA._last.pn;});
  var prevQty = i>=0 ? CA_SHEET[i].annualQty : '';
  var q=prompt('['+CA._last.pn+'] 연간 수량을 입력하세요 (모르면 1 또는 비워두기)', prevQty||'1');
  if(q===null) return; // 취소
  var annualQty=parseFloat(String(q).replace(/,/g,''))||1;
  var entry=JSON.parse(JSON.stringify(CA._last));
  entry.annualQty=annualQty;
  if(i>=0){ CA_SHEET[i]=entry; qToast('갑지 갱신: '+entry.pn,'ok'); }
  else { CA_SHEET.push(entry); qToast('갑지에 담음: '+entry.pn+' ('+CA_SHEET.length+'건)','ok'); }
  caRenderSheetList();
}
function caRemoveFromSheet(pn){
  CA_SHEET=CA_SHEET.filter(function(x){return x.pn!==pn;});
  caRenderSheetList();
}
function caClearSheet(){
  if(CA_SHEET.length && !confirm('갑지에 담긴 '+CA_SHEET.length+'건을 모두 비울까요?')) return;
  CA_SHEET=[]; caRenderSheetList();
}
function caRenderSheetList(){
  var el=document.getElementById('ca-sheet-list'); if(!el) return;
  if(!CA_SHEET.length){ el.innerHTML='<span style="font-size:12px;color:var(--text3)">담긴 품목이 없습니다. 품목 분석 후 "갑지에 담기"를 누르세요.</span>'; return; }
  var h='<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">';
  CA_SHEET.forEach(function(e){
    h+='<span style="display:inline-flex;align-items:center;gap:5px;background:var(--bg2);border:1px solid var(--border2);border-radius:6px;padding:3px 8px;font-size:11.5px">'
      +'<b>'+e.pn+'</b>'
      +'<span style="color:var(--text3)">'+(e.tgtMP!=null?e.tgtMP.toFixed(1)+'%':(e.curMP!=null?e.curMP.toFixed(1)+'%':'원가'))+'</span>'
      +'<span style="color:var(--accent);font-size:10px">×'+(e.annualQty||1).toLocaleString()+'</span>'
      +'<span onclick="caRemoveFromSheet(\''+e.pn+'\')" style="cursor:pointer;color:var(--red);font-weight:700">×</span>'
      +'</span>';
  });
  h+='</div>';
  el.innerHTML=h;
}
function caPrintSheet(){
  if(!CA_SHEET.length){ qToast('갑지에 담긴 품목이 없습니다','info'); return; }
  var title=prompt('갑지 제목을 입력하세요 (프로젝트명 등)', (window._caSheetTitle||'원가분석 종합'));
  if(title===null) return;
  window._caSheetTitle=title;
  var d=new Date();
  var ymd=d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);
  var reb=(CA_SHEET[0]&&CA_SHEET[0].rebate)||0;
  var baseRate=(CA_SHEET[0]&&CA_SHEET[0].baseRate)||1500;

  // 갑지 데이터 — 품목별 (네고전/네고후/매입/작업비 + 환율 컴포넌트)
  var items=CA_SHEET.map(function(e){
    var qty=e.annualQty||1;
    return {
      pn:e.pn, desc:e.desc||'', qty:qty,
      preUsd: e.curUsd||0,              // 네고 전 단가($)
      negoUsd: e.tgtUsd||e.curUsd||0,   // 네고 후 단가($) (없으면 현재가)
      isNego: !!e.tgtUsd,
      buyKrw: e.buyKrw||0,              // 매입원가(개당, 작업비 포함 합계)
      laborKrw: e.laborKrw||0,          // 작업비(개당)
      impUsd: e.impUsd||0,              // 수입 자재 $ (환율 변동 계산용)
      domKrw: e.domKrw||0,              // 국내 자재 ₩
      rebate: e.rebate||0
    };
  });
  var payload={ title:title, ymd:ymd, baseRate:baseRate, rebate:reb, items:items };

  // 자립형 인터랙티브 HTML
  var html=caBuildSheetHTML(payload);

  // 새 창에 표시 + 다운로드 버튼 포함
  var w=window.open('','_ca_sheet','width=1200,height=1400');
  if(!w){ alert('팝업이 차단되었습니다. 팝업 허용 후 다시 시도하세요.'); return; }
  w.document.write(html);
  w.document.close();
}

// 갑지 HTML 빌더 (자립형 — 추가비용 입력 시 JS로 재계산)
function caBuildSheetHTML(payload){
  var dataJson=JSON.stringify(payload).replace(/<\//g,'<\\/');
  var css='*{box-sizing:border-box}body{font-family:-apple-system,"Malgun Gothic","맑은 고딕",sans-serif;color:#1a1a1a;margin:0;padding:26px 30px;background:#fff}'
    +'.rpt-head{border-bottom:2px solid #1a1a1a;padding-bottom:12px;margin-bottom:14px}'
    +'h1{font-size:20px;margin:0 0 4px}.sub{font-size:11.5px;color:#888;margin-top:4px}'
    +'.ctrl{background:#f7f9fc;border:1px solid #dde6f2;border-radius:9px;padding:12px 14px;margin-bottom:14px}'
    +'.ctrl h3{margin:0 0 8px;font-size:12.5px;color:#33507a}'
    +'.ctrl-row{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end}'
    +'.ctrl-item{display:flex;flex-direction:column;gap:3px}.ctrl-item label{font-size:10.5px;color:#777}'
    +'.ctrl-item input,.ctrl-item select{font-size:12px;padding:5px 8px;border:1px solid #ccd;border-radius:6px;width:120px}'
    +'table{width:100%;border-collapse:collapse;font-size:10.5px;margin-bottom:12px}'
    +'th,td{border:1px solid #ddd;padding:5px 6px;text-align:left}th{background:#f4f5f7;font-weight:600;font-size:9.5px;text-align:center}'
    +'.num{text-align:right;font-variant-numeric:tabular-nums}'
    +'tfoot td{background:#eef3ff;font-weight:700;border-top:2px solid #4f7cff}'
    +'.concl{background:#f4f8ff;border:1px solid #cdddff;border-radius:8px;padding:12px 14px;font-size:12.5px;line-height:1.7;margin-bottom:8px}'
    +'.note{font-size:9.5px;color:#999;margin-top:4px;line-height:1.5}'
    +'.foot{margin-top:18px;border-top:1px solid #ddd;padding-top:8px;font-size:9.5px;color:#aaa;text-align:center}'
    +'.btns{display:flex;gap:8px;margin-top:12px}'
    +'button{padding:9px 18px;color:#fff;border:none;border-radius:7px;font-size:12.5px;cursor:pointer}'
    +'.b-print{background:#4f7cff}.b-save{background:#12b886}'
    +'@page{size:A4 landscape;margin:8mm}@media print{.ctrl,.btns{display:none}body{padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}}';
  var body=''
    +'<div class="rpt-head"><h1 id="rpt-title"></h1><div class="sub" id="rpt-sub"></div></div>'
    +'<div class="ctrl" style="background:#eef4ff;border-color:#c7d8f5">'
    +'<h3 style="color:#2c5cc5">💱 기준 환율 조정 — 환율을 바꾸면 전체 마진이 다시 계산됩니다</h3>'
    +'<div class="ctrl-row">'
    +'<div class="ctrl-item"><label>기준 환율 (원/$)</label><input type="number" id="x-rate" value="RATEVAL" step="10" style="width:140px;font-weight:700;font-size:14px"></div>'
    +'<div class="ctrl-item"><label>&nbsp;</label><button type="button" onclick="document.getElementById(\'x-rate\').value=RATEVAL;render();" style="padding:7px 14px;border:none;border-radius:6px;background:#4f7cff;color:#fff;font-weight:600;cursor:pointer;white-space:nowrap">↺ RATEVAL원 복원</button></div>'
    +'<div class="ctrl-item" style="flex:1;min-width:200px"><label>&nbsp;</label><div id="rate-hint" style="font-size:11px;color:#5a7bc5;padding-top:6px"></div></div>'
    +'</div></div>'
    +'<div class="ctrl">'
    +'<h3>➕ 추가비용 반영 (금융비·간접비 등) — 입력하면 마진이 다시 계산됩니다</h3>'
    +'<div class="ctrl-row">'
    +'<div class="ctrl-item"><label>금융비</label><input type="number" id="x-fin" value="0" step="0.1"></div>'
    +'<div class="ctrl-item"><label>단위</label><select id="x-fin-u"><option value="pct">% (매출 대비)</option><option value="krw">원 (연간 총액)</option></select></div>'
    +'<div class="ctrl-item"><label>간접비</label><input type="number" id="x-ind" value="0" step="0.1"></div>'
    +'<div class="ctrl-item"><label>단위</label><select id="x-ind-u"><option value="pct">% (매출 대비)</option><option value="krw">원 (연간 총액)</option></select></div>'
    +'<div class="ctrl-item"><label>기타비용</label><input type="number" id="x-etc" value="0" step="0.1"></div>'
    +'<div class="ctrl-item"><label>단위</label><select id="x-etc-u"><option value="pct">% (매출 대비)</option><option value="krw">원 (연간 총액)</option></select></div>'
    +'<div class="ctrl-item" style="background:#fff3e0;border-radius:7px;padding:4px 8px"><label style="color:#e08a00">리베이트</label><input type="number" id="x-reb-v" value="REBPCT" step="0.1"></div>'
    +'<div class="ctrl-item"><label>단위</label><select id="x-reb-u"><option value="pct">% (매출 대비)</option><option value="krw">원 (연간 총액)</option></select></div>'
    +'</div></div>'
    +'<div id="rpt-table"></div>'
    +'<div id="rpt-concl"></div>'
    +'<div class="note">· 단가 마진율은 환율 시나리오(현재/-100/-200) 기준 · 환율 변동 시 매출·수입매입 동시 적용<br>'
    +'· 연간 금액 = 단가 × 연간수량 · 추가비용/리베이트는 현재환율 마진에서 차감하여 "실질 마진"으로 표시 · 상세는 품목별 보고서 참조</div>'
    +'<div class="foot">본 보고서는 사내 검토용입니다 · 매입가는 품목 DB 기준</div>'
    +'<div class="btns"><button class="b-print" onclick="window.print()">🖨 인쇄 / PDF</button>'
    +'<button class="b-save" onclick="saveHTML()">💾 HTML 파일 저장</button></div>';
  // 내장 스크립트: 재계산 로직
  var script='var D='+dataJson+';\n'
    +'function won(x){return Math.round(x).toLocaleString();}\n'
    +'function eok(x){return Math.round(x/10000).toLocaleString();}\n'
    +'function eokeok(x){return (Math.round(x/100000000*10)/10);}\n'
    +'function pcol(v){return v==null?"#999":(v<0?"#d23030":(v<8?"#f59e0b":"#222"));}\n'
    +'function fxM(it,rate){var buy=it.impUsd*rate+it.domKrw;var labor=it.laborKrw;var sell=it.negoUsd*rate;return {sell:sell,buy:buy+labor,mK:sell-(buy+labor),mP:sell>0?(sell-(buy+labor))/sell*100:0};}\n'
    +'function getExtra(sellTot){\n'
    +'  var v=function(id){return parseFloat(document.getElementById(id).value)||0;};\n'
    +'  var u=function(id){return document.getElementById(id).value;};\n'
    +'  var sum=0;\n'
    +'  [["x-fin","x-fin-u"],["x-ind","x-ind-u"],["x-etc","x-etc-u"]].forEach(function(p){\n'
    +'    var val=v(p[0]); if(u(p[1])==="pct") sum+=sellTot*val/100; else sum+=val;\n'
    +'  });\n'
    +'  return sum;\n'
    +'}\n'
    +'function render(){\n'
    +'  var br=parseFloat(document.getElementById("x-rate").value)||D.baseRate;\n'
    +'  document.getElementById("rpt-title").textContent=D.title;\n'
    +'  document.getElementById("rpt-sub").textContent="진선테크 구매자재 · 작성일 "+D.ymd+" · 대상 "+D.items.length+"개 품목 · 기준 환율 @"+won(br)+(br!==D.baseRate?" (기준값 "+won(D.baseRate)+"에서 조정됨)":"")+(D.rebate>0?" · 리베이트 "+(D.rebate*100).toFixed(0)+"%":"");\n'
    +'  var rhint=document.getElementById("rate-hint"); if(rhint){ rhint.textContent = br===D.baseRate?("기준 환율 "+won(br)+"원 적용 중 · 표의 -100/-200 열은 "+won(br-100)+"/"+won(br-200)+"원"):("조정: "+won(br)+"원 (기준 "+won(D.baseRate)+"원 대비 "+(br>=D.baseRate?"+":"")+won(br-D.baseRate)+"원)"); }\n'
    +'  var sumSell=0,sumMKnow=0,sumMK200=0,sumBuy=0,sumLabor=0;\n'
    +'  D.items.forEach(function(it){var f=fxM(it,br);sumSell+=f.sell*it.qty;sumMKnow+=f.mK*it.qty;sumMK200+=fxM(it,br-200).mK*it.qty;sumBuy+=it.buyKrw*it.qty;sumLabor+=it.laborKrw*it.qty;});\n'
    +'  var rebV=parseFloat(document.getElementById("x-reb-v").value)||0;\n'
    +'  var rebU=document.getElementById("x-reb-u").value;\n'
    +'  var rebKrw=rebU==="pct"?sumSell*rebV/100:rebV;\n'
    +'  var extra=getExtra(sumSell);\n'
    +'  var netMK=sumMKnow-rebKrw-extra;\n'
    +'  var netMP=sumSell>0?netMK/sumSell*100:0;\n'
    +'  var rows="";\n'
    +'  D.items.forEach(function(it,i){\n'
    +'    var fNow=fxM(it,br),f100=fxM(it,br-100),f200=fxM(it,br-200);\n'
    +'    var ySell=fNow.sell*it.qty, yMK=fNow.mK*it.qty, yBuy=it.buyKrw*it.qty, yLabor=it.laborKrw*it.qty;\n'
    +'    rows+="<tr><td class=num>"+(i+1)+"</td>"\n'
    +'      +"<td style=\\"font-family:monospace\\">"+it.pn+"</td><td>"+(it.desc||"-")+"</td>"\n'
    +'      +"<td class=num>"+it.qty.toLocaleString()+"</td>"\n'
    +'      +"<td class=num>"+(it.preUsd?"$"+it.preUsd.toLocaleString():"—")+"</td>"\n'
    +'      +"<td class=num>$"+it.negoUsd.toLocaleString()+(it.isNego?" <span style=\\"font-size:8px;color:#f59e0b\\">네고</span>":"")+"</td>"\n'
    +'      +"<td class=num>"+eok(yBuy)+"</td>"\n'
    +'      +"<td class=num>"+eok(yLabor)+"</td>"\n'
    +'      +"<td class=num style=\\"background:#eaf7f4;font-weight:700;color:"+pcol(fNow.mP)+"\\">"+fNow.mP.toFixed(1)+"%</td>"\n'
    +'      +"<td class=num style=\\"color:"+pcol(f100.mP)+"\\">"+f100.mP.toFixed(1)+"%</td>"\n'
    +'      +"<td class=num style=\\"color:"+pcol(f200.mP)+"\\">"+f200.mP.toFixed(1)+"%</td>"\n'
    +'      +"<td class=num>"+eok(ySell)+"</td>"\n'
    +'      +"<td class=num style=\\"font-weight:700;color:"+pcol(fNow.mP)+"\\">"+eok(yMK)+"</td></tr>";\n'
    +'  });\n'
    +'  var tbl="<table><thead><tr>"\n'
    +'    +"<th rowspan=2>No</th><th rowspan=2>품번</th><th rowspan=2>품명</th><th rowspan=2>연간<br>수량</th>"\n'
    +'    +"<th colspan=2>단가($)</th><th colspan=2>연간 원가(만원)</th><th colspan=3>환율별 마진율</th><th colspan=2 style=\\"background:#eef3ff\\">연간 금액(만원)</th></tr>"\n'
    +'    +"<tr><th>네고 전</th><th>네고 후</th><th>매입</th><th>작업비</th>"\n'
    +'    +"<th style=\\"background:#eaf7f4\\">현재("+won(br)+")</th><th>-100원</th><th>-200원</th>"\n'
    +'    +"<th style=\\"background:#eef3ff\\">매출</th><th style=\\"background:#eef3ff\\">마진</th></tr></thead><tbody>"+rows+"</tbody>"\n'
    +'    +"<tfoot><tr><td colspan=6 style=\\"text-align:right\\">연간 합계 →</td>"\n'
    +'    +"<td class=num>"+eok(sumBuy)+"</td><td class=num>"+eok(sumLabor)+"</td>"\n'
    +'    +"<td colspan=3 style=\\"text-align:center;color:#888\\">매출 대비</td>"\n'
    +'    +"<td class=num>"+eok(sumSell)+"</td><td class=num style=\\"color:"+pcol(sumSell>0?sumMKnow/sumSell*100:0)+"\\">"+eok(sumMKnow)+"</td></tr></tfoot></table>";\n'
    +'  document.getElementById("rpt-table").innerHTML=tbl;\n'
    +'  var totMPnow=sumSell>0?sumMKnow/sumSell*100:0, totMP200=sumSell>0?sumMK200/sumSell*100:0;\n'
    +'  var ded="";\n'
    +'  if(rebKrw>0) ded+="리베이트 (-"+eok(rebKrw)+"만원) ";\n'
    +'  if(extra>0) ded+="+ 추가비용 -"+eok(extra)+"만원 ";\n'
    +'  var c="<div class=concl>📊 <b>연간 종합</b> — 매출 약 <b>"+eokeok(sumSell)+"억원</b>, 기본 마진 약 <b style=\\"color:"+pcol(totMPnow)+"\\">"+eokeok(sumMKnow)+"억원 ("+totMPnow.toFixed(1)+"%)</b> <span style=\\"color:#888\\">@현재환율 "+won(br)+"</span><br>";\n'
    +'  if(rebKrw>0||extra>0) c+="➖ "+ded+"반영 시 — <b>실질 마진 약 <span style=\\"color:"+pcol(netMP)+"\\">"+eokeok(netMK)+"억원 ("+netMP.toFixed(1)+"%)</span></b><br>";\n'
    +'  c+="⚠ 환율 <b>-200원("+won(br-200)+")</b> 하락 시 (추가비용 제외) — 마진 약 <b style=\\"color:"+pcol(totMP200)+"\\">"+eokeok(sumMK200)+"억원 ("+totMP200.toFixed(1)+"%)</b>, 현재 대비 <b style=\\"color:#d23030\\">"+(totMPnow-totMP200).toFixed(1)+"%p 하락</b></div>";\n'
    +'  document.getElementById("rpt-concl").innerHTML=c;\n'
    +'}\n'
    +'["x-rate","x-fin","x-fin-u","x-ind","x-ind-u","x-etc","x-etc-u","x-reb-v","x-reb-u"].forEach(function(id){document.getElementById(id).addEventListener("input",render);document.getElementById(id).addEventListener("change",render);});\n'
    +'function saveHTML(){var h="<!DOCTYPE html>"+document.documentElement.outerHTML;var b=new Blob([h],{type:"text/html;charset=utf-8"});var a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=D.title.replace(/[^가-힣a-zA-Z0-9_-]/g,"_")+"_"+D.ymd+".html";a.click();}\n'
    +'render();';
  var bodyFilled = body
    .replace('REBPCT', ((payload.rebate||0)*100).toFixed(1).replace(/\.0$/,''))
    .split('RATEVAL').join(String(Math.round(payload.baseRate||1500)));
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+(payload.title||'갑지')+'_'+payload.ymd+'</title><style>'+css+'</style></head><body>'+bodyFilled+'<scr'+'ipt>'+script+'</scr'+'ipt></body></html>';
}
